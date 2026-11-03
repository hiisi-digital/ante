//--------------------------------------------------------------------------------------------------
// Copyright (c) 2025-2026              orgrinrt                 orgrinrt@ikiuni.dev
//                                      orgrinrt                 ort@hiisi.digital
// SPDX-License-Identifier: MPL-2.0     https://mozilla.org/MPL/2.0        ort@hiisi.digital
//--------------------------------------------------------------------------------------------------

/**
 * What `scripts/pre-commit.sh` hands to `fix`, and what it stages afterwards.
 *
 * The script is the whole of what `shook.toml` registers, so its two failure
 * modes reach every commit in this repository. It ran `fix` with no arguments,
 * which walks everything the config allows and rewrote files somebody had left
 * out of the commit on purpose, and it read the staged list without `-z`, so a
 * name git had to quote reached a `[ -f ]` test that could never be true and
 * was silently dropped.
 *
 * Neither is observable from the tool's own suite, because neither is about
 * the tool. `deno` is stubbed with a shim that records its argument list, so
 * what is measured is the plumbing rather than the header rewriting, and the
 * arms are the two files the plumbing used to lose.
 */

import { assertEquals, assertStringIncludes } from "@std/assert";
import { join } from "@std/path";
import { afterEach, beforeEach, describe, it } from "@std/testing/bdd";

const SCRIPT = new URL("../scripts/pre-commit.sh", import.meta.url).pathname;

let dir: string;
let argvLog: string;

async function run(cmd: string, args: string[], cwd: string, env: Record<string, string> = {}) {
  const out = await new Deno.Command(cmd, {
    args,
    cwd,
    env: { ...Deno.env.toObject(), ...env },
    stdout: "piped",
    stderr: "piped",
  }).output();
  return {
    code: out.code,
    stdout: new TextDecoder().decode(out.stdout),
    stderr: new TextDecoder().decode(out.stderr),
  };
}

/** A `deno` earlier on PATH than the real one, writing its argv to a file. */
async function stubDeno(bin: string, log: string) {
  await Deno.mkdir(bin, { recursive: true });
  await Deno.writeTextFile(
    join(bin, "deno"),
    `#!/bin/sh\nfor a in "$@"; do printf '%s\\n' "$a" >> ${JSON.stringify(log)}; done\n`,
  );
  await Deno.chmod(join(bin, "deno"), 0o755);
}

describe("the pre-commit script", () => {
  beforeEach(async () => {
    dir = await Deno.makeTempDir();
    argvLog = join(dir, "argv.log");
    await Deno.writeTextFile(argvLog, "");
    await stubDeno(join(dir, "bin"), argvLog);
    await run("git", ["init", "-q", "."], dir);
    await run("git", ["config", "user.email", "t@example.com"], dir);
    await run("git", ["config", "user.name", "t"], dir);
    await Deno.mkdir(join(dir, "scripts"), { recursive: true });
    await Deno.copyFile(SCRIPT, join(dir, "scripts", "pre-commit.sh"));
  });

  afterEach(async () => {
    await Deno.remove(dir, { recursive: true });
  });

  async function fire() {
    return await run("sh", ["scripts/pre-commit.sh"], dir, {
      PATH: `${join(dir, "bin")}:${Deno.env.get("PATH")}`,
    });
  }

  it("hands fix only the paths that are staged", async () => {
    await Deno.writeTextFile(join(dir, "staged.ts"), "a\n");
    await Deno.writeTextFile(join(dir, "left-out.ts"), "b\n");
    await run("git", ["add", "staged.ts"], dir);

    const r = await fire();
    assertEquals(r.code, 0, r.stderr);

    const argv = await Deno.readTextFile(argvLog);
    assertStringIncludes(argv, "staged.ts");
    assertEquals(argv.includes("left-out.ts"), false, argv);

    // And the file left out is still left out, rather than swept in by the
    // re-staging that follows.
    const status = await run("git", ["status", "--porcelain"], dir);
    assertStringIncludes(status.stdout, "?? left-out.ts");
  });

  it("keeps a name git would have quoted", async () => {
    await Deno.writeTextFile(join(dir, "café.ts"), "a\n");
    await run("git", ["add", "café.ts"], dir);

    const r = await fire();
    assertEquals(r.code, 0, r.stderr);

    const argv = await Deno.readTextFile(argvLog);
    assertStringIncludes(argv, "café.ts");
    // The quoted spelling is what a read without `-z` would have produced,
    // and it names a path that does not exist.
    assertEquals(argv.includes("\\303\\251"), false, argv);
  });

  it("does nothing at all when nothing is staged", async () => {
    await Deno.writeTextFile(join(dir, "untracked.ts"), "a\n");

    const r = await fire();
    assertEquals(r.code, 0, r.stderr);

    // An empty argument list to `fix` means the whole tree, so not running it
    // is the behaviour rather than an optimisation.
    assertEquals(await Deno.readTextFile(argvLog), "");
  });
});
