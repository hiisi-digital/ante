//--------------------------------------------------------------------------------------------------
// Copyright (c) 2026                   orgrinrt                 ort@hiisi.digital
// SPDX-License-Identifier: MPL-2.0     https://mozilla.org/MPL/2.0        ort@hiisi.digital
//--------------------------------------------------------------------------------------------------

/**
 * The pre-commit hook, installed into a real repository and run by git.
 *
 * Nothing tested it before, which is how it came to carry its own copy of the
 * header engine in shell. That copy did not know a rust inner attribute is not a
 * shebang, matched only files ending in `.ts` whatever the config said, and had
 * never heard of the contributor limit. Two implementations of one job disagree,
 * and the untested one is the one that runs on every commit.
 *
 * So the hook runs `ante fix` now, and these assert that it does: the header
 * lands where the library puts it, and the config decides which files are
 * touched rather than a grep in the hook.
 *
 * `ante` is put on the path as a shim over this working tree, which is also the
 * first of the three ways the hook looks for it.
 *
 * Every message here is conventional-commit shaped because `installHook` installs
 * a commit-msg hook too, and it refuses anything else.
 */

import { assert, assertEquals, assertStringIncludes } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { fromFileUrl, join } from "@std/path";
import { installHook } from "#git";
import { loadConfig } from "#core";

const HERE = fromFileUrl(new URL("../", import.meta.url));

/** Run a command and give back what it said. */
async function ran(
  cmd: string,
  args: string[],
  cwd: string,
  env: Record<string, string> = {},
): Promise<{ code: number; out: string }> {
  const done = await new Deno.Command(cmd, {
    args,
    cwd,
    env,
    stdout: "piped",
    stderr: "piped",
  }).output();
  const read = new TextDecoder();
  return {
    code: done.code,
    out: read.decode(done.stdout) + read.decode(done.stderr),
  };
}

/**
 * A repository with the hook installed and an `ante` on its path.
 *
 * The shim is a two-line script that runs this working tree's cli, so the hook
 * exercises its own first branch (`command -v ante`) without needing anything
 * published. What is under test is the hook, not how ante got there.
 */
async function aRepo(): Promise<{ dir: string; env: Record<string, string> }> {
  const dir = await Deno.makeTempDir({ prefix: "ante_hook_" });
  await ran("git", ["init", "-q"], dir);
  await ran("git", ["config", "user.name", "Hook Test"], dir);
  await ran("git", ["config", "user.email", "hook@x.dev"], dir);
  await ran("git", ["config", "commit.gpgsign", "false"], dir);

  const bin = join(dir, ".bin");
  await Deno.mkdir(bin);
  await Deno.writeTextFile(
    join(bin, "ante"),
    `#!/bin/sh\nexec deno run -A ${join(HERE, "cli/mod.ts")} "$@"\n`,
  );
  await Deno.chmod(join(bin, "ante"), 0o755);

  // Its own config, and `include` reaches rust as well as typescript, which is
  // the point of one of the cases below: the hook must not decide for itself
  // which files are its business.
  await Deno.writeTextFile(
    join(dir, "ante.toml"),
    [
      'spdxLicense = "MPL-2.0"',
      'licenseUrl = "https://mozilla.org/MPL/2.0"',
      'maintainerEmail = "hook@x.dev"',
      'include = ["**/*.ts", "**/*.rs"]',
      'exclude = ["**/.bin/**"]',
      "",
    ].join("\n"),
  );
  await installHook(dir, await loadConfig(join(dir, "ante.toml")));

  return {
    dir,
    env: {
      PATH: `${bin}:${Deno.env.get("PATH") ?? ""}`,
      HOME: Deno.env.get("HOME") ?? "",
    },
  };
}

describe("the pre-commit hook", () => {
  it("puts a header above a rust inner attribute, not below it", async () => {
    const { dir, env } = await aRepo();
    await Deno.writeTextFile(join(dir, "lib.rs"), "#![no_std]\npub fn f() {}\n");
    await ran("git", ["add", "lib.rs"], dir);

    const committed = await ran("git", ["commit", "-q", "-m", "feat: add lib"], dir, env);
    assertEquals(committed.code, 0, `the commit failed:\n${committed.out}`);

    const after = await Deno.readTextFile(join(dir, "lib.rs"));
    assert(
      after.startsWith("//"),
      `the header did not land on line one, which is where check looks:\n${after}`,
    );
    assertStringIncludes(after, "#![no_std]");
    assertStringIncludes(after, "Copyright (c)");
  });

  it("leaves a real shebang on line one", async () => {
    const { dir, env } = await aRepo();
    await Deno.writeTextFile(
      join(dir, "tool.ts"),
      "#!/usr/bin/env -S deno run\nconsole.log(1);\n",
    );
    await ran("git", ["add", "tool.ts"], dir);
    await ran("git", ["commit", "-q", "-m", "feat: add tool"], dir, env);

    const after = await Deno.readTextFile(join(dir, "tool.ts"));
    assert(
      after.startsWith("#!/usr/bin/env"),
      `the shebang stopped being line one, so the file stopped being executable:\n${after}`,
    );
    assertStringIncludes(after, "Copyright (c)");
  });

  it("stages what it changed, so the commit carries the header", async () => {
    const { dir, env } = await aRepo();
    await Deno.writeTextFile(join(dir, "a.ts"), "export const a = 1;\n");
    await ran("git", ["add", "a.ts"], dir);
    await ran("git", ["commit", "-q", "-m", "feat: add a"], dir, env);

    // What landed in the commit, not what is in the working tree. A hook that
    // rewrites a file and forgets to stage it commits the version without the
    // header and leaves the tree dirty.
    const inCommit = await ran("git", ["show", "HEAD:a.ts"], dir);
    assertStringIncludes(inCommit.out, "Copyright (c)");

    // The file, not the tree: the scaffolding this test wrote is untracked on
    // purpose and says nothing about the hook.
    const dirty = await ran("git", ["status", "--porcelain", "--", "a.ts"], dir);
    assertEquals(
      dirty.out.trim(),
      "",
      `the hook rewrote a.ts and did not stage it, so the commit holds the ` +
        `version without the header:\n${dirty.out}`,
    );
  });

  it("runs a second time without stacking a second header", async () => {
    const { dir, env } = await aRepo();
    await Deno.writeTextFile(join(dir, "b.ts"), "export const b = 1;\n");
    await ran("git", ["add", "b.ts"], dir);
    await ran("git", ["commit", "-q", "-m", "feat: one"], dir, env);

    await Deno.writeTextFile(
      join(dir, "b.ts"),
      (await Deno.readTextFile(join(dir, "b.ts"))) + "export const c = 2;\n",
    );
    await ran("git", ["add", "b.ts"], dir);
    await ran("git", ["commit", "-q", "-m", "feat: two"], dir, env);

    const after = await Deno.readTextFile(join(dir, "b.ts"));
    const blocks = after.split("\n").filter((l) => /^\/\/-+$/.test(l)).length;
    assertEquals(blocks, 2, `one header is two separator lines, and this had:\n${after}`);
  });

  it("says nothing and blocks nothing when ante is not reachable", async () => {
    const { dir } = await aRepo();
    await Deno.writeTextFile(join(dir, "c.ts"), "export const c = 1;\n");
    await ran("git", ["add", "c.ts"], dir);

    // An empty path, so none of the three ways of finding ante works. A hook
    // that cannot do its job must not stop somebody committing.
    const committed = await ran("git", ["commit", "-q", "-m", "feat: no ante"], dir, {
      PATH: "/usr/bin:/bin",
      HOME: Deno.env.get("HOME") ?? "",
    });
    assertEquals(committed.code, 0, `the commit was blocked:\n${committed.out}`);
  });
});
