//--------------------------------------------------------------------------------------------------
// Copyright (c) 2026                   orgrinrt                 ort@hiisi.digital
// SPDX-License-Identifier: MPL-2.0     https://mozilla.org/MPL/2.0        ort@hiisi.digital
//--------------------------------------------------------------------------------------------------

/**
 * What a run is pointed at, and what it does when that is nothing.
 *
 * `ante check .` used to report `Checked 0 file(s)` and exit 0, because `.` is
 * a glob and one path that is not a file is an honest zero. The reporting was
 * the defect: a run that looked at nothing printed the same summary, and
 * returned the same code, as a run that looked at everything and found nothing
 * wrong. In a hook or in continuous integration that reads as a pass.
 *
 * Two things are pinned here. A directory is walked, so the invocation people
 * actually type does the thing they meant. And a run matching no file is an
 * error, loudly, whichever way it was asked for.
 *
 * Every assertion below has its control in the same block: a run known to match
 * something, asserted to exit zero. Without it the whole file would pass on a
 * build where every invocation fails.
 *
 * Measured against the tree before the fix, with the two commands restored and
 * the error type left in place so it still compiles: six of the eight fail and
 * the two controls pass, which is the shape wanted.
 *
 * @module
 */

import { assert, assertEquals, assertStringIncludes } from "@std/assert";
import { afterEach, beforeEach, describe, it } from "@std/testing/bdd";
import { loadConfig } from "#core";
import { main } from "../cli/mod.ts";
import { runCheck } from "../cli/commands/check.ts";
import { MatchedNothing } from "../cli/commands/_files.ts";
import { createTempDir, removeDir, writeFile } from "./_utils/fs.ts";

/** A file with a header ante will accept, so a matching run passes. */
const HEADER = [
  "//-----------------------------------------------------------------------------",
  "// Copyright (c) 2026                 Test Author           test@example.com",
  "// SPDX-License-Identifier: MPL-2.0   https://mozilla.org/MPL/2.0",
  "//-----------------------------------------------------------------------------",
  "",
  "export const one = 1;",
  "",
].join("\n");

/** Runs a command in `dir` and waits for it. */
async function run(dir: string, ...cmd: string[]): Promise<void> {
  await new Deno.Command(cmd[0], {
    args: cmd.slice(1),
    cwd: dir,
    stdout: "null",
    stderr: "null",
  }).output();
}

/** Everything `main` and `runCheck` print, so a count can be read back. */
function quietly<T>(body: () => Promise<T>): Promise<T> {
  const said = console.log;
  console.log = () => {};
  return body().finally(() => {
    console.log = said;
  });
}

describe("what a run is pointed at", () => {
  let root = "";
  let was = "";

  beforeEach(async () => {
    was = Deno.cwd();
    root = await createTempDir("matching_");
    await run(root, "git", "init");
    await run(root, "git", "config", "user.name", "Test Author");
    await run(root, "git", "config", "user.email", "test@example.com");
    await writeFile(`${root}/src/one.ts`, HEADER);
    await writeFile(`${root}/src/two.ts`, HEADER);
    await writeFile(`${root}/other/three.ts`, HEADER);
    await writeFile(`${root}/empty/notes.rs`, "fn main() {}\n");
    Deno.chdir(root);
  });

  afterEach(async () => {
    Deno.chdir(was);
    await removeDir(root);
  });

  it("exits zero for a pattern that matches files, which is the control", async () => {
    assertEquals(await quietly(() => main(["check", "**/*.ts"])), 0);
  });

  it("exits non-zero for a pattern that matches no file", async () => {
    assertEquals(await quietly(() => main(["check", "**/*.zig"])), 1);
  });

  it("exits non-zero for nothing matched, not because a file was bad", async () => {
    // `**/*.rs` matches `empty/notes.rs`, which carries no header, so that run
    // also exits 1. The two reasons are different and this keeps them apart:
    // one file looked at and failing, against no file looked at at all.
    const config = await loadConfig();
    const rust = await quietly(() => runCheck(config, { glob: "**/*.rs" }));
    assertEquals(rust.totalFiles, 1);
    assertEquals(rust.failedFiles, 1);
    assertEquals(await quietly(() => main(["check", "**/*.rs"])), 1);
  });

  it("names the pattern and the configured includes when it matches nothing", async () => {
    const config = await loadConfig();
    let thrown: unknown = null;
    try {
      await quietly(() => runCheck(config, { glob: "**/*.zig" }));
    } catch (error) {
      thrown = error;
    }
    assert(thrown instanceof MatchedNothing);
    assertEquals(thrown.asked, "**/*.zig");
    assertStringIncludes(thrown.message, "**/*.zig");
    assertStringIncludes(thrown.message, "**/*.ts");
  });

  it("walks a directory handed to it, and only that directory", async () => {
    const config = await loadConfig();
    const inSrc = await quietly(() => runCheck(config, { glob: "src" }));
    assertEquals(inSrc.totalFiles, 2);
    assertEquals(inSrc.failedFiles, 0);
  });

  it("treats a dot as the whole tree, the same as no argument at all", async () => {
    const config = await loadConfig();
    const dot = await quietly(() => runCheck(config, { glob: "." }));
    const bare = await quietly(() => runCheck(config, {}));
    assertEquals(dot.totalFiles, bare.totalFiles);
    assertEquals(dot.totalFiles, 3);
  });

  it("still refuses a directory holding nothing it includes", async () => {
    assertEquals(await quietly(() => main(["check", "empty"])), 1);
  });

  it("refuses a fix that would match nothing, and runs one that would not", async () => {
    assertEquals(await quietly(() => main(["fix", "**/*.zig"])), 1);
    assertEquals(await quietly(() => main(["fix", "src"])), 0);
  });
});
