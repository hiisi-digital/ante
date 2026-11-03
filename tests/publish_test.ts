//--------------------------------------------------------------------------------------------------
// Copyright (c) 2026                   orgrinrt                 ort@hiisi.digital
// SPDX-License-Identifier: MPL-2.0     https://mozilla.org/MPL/2.0        ort@hiisi.digital
//--------------------------------------------------------------------------------------------------

/**
 * What a publish actually ships.
 *
 * The exclusions are decided rather than accidental: `publish.exclude` names
 * `tests/`, `scripts/` and `.githooks/`, and the npm build copies three files by
 * name rather than sweeping a directory. What is missing is anything that would
 * notice the decision being undone, and undoing it takes one line in either
 * place with nothing about the edit looking like it is about a 188K fixture.
 *
 * The dry run is what deno itself would ship, so this reads the real answer
 * rather than re-deriving it from the manifest. It takes both lists to break a
 * case here, which is the point: `exclude` wins over `include`, so naming a test
 * file in the include list alone changes nothing, and a control has to remove
 * the exclusion too.
 *
 * @module
 */

import { assertEquals, assertStringIncludes } from "@std/assert";
import { describe, it } from "@std/testing/bdd";

/** The file list `deno publish` would send, relative to the repository root. */
async function shipped(): Promise<string[]> {
  const run = new Deno.Command(Deno.execPath(), {
    args: ["publish", "--dry-run", "--allow-dirty", "--no-check"],
    stdout: "piped",
    stderr: "piped",
  });
  const out = await run.output();
  const text = new TextDecoder().decode(out.stdout) +
    new TextDecoder().decode(out.stderr);

  const here = new URL("../", import.meta.url).href;
  const files = [...text.matchAll(/file:\/\/\S+/g)]
    .map((one) => one[0])
    .filter((one) => one.startsWith(here))
    .map((one) => decodeURIComponent(one.slice(here.length)));

  if (files.length === 0) {
    throw new Error(
      `the dry run named no files, so this test measured nothing:\n${text.trimEnd()}`,
    );
  }
  return files;
}

describe("what a publish ships", () => {
  it("carries the module, the cli, the schema and the licence", async () => {
    const files = await shipped();

    for (const one of ["mod.ts", "cli/mod.ts", "schema/config.schema.json", "LICENSE"]) {
      assertEquals(files.includes(one), true, `${one} is not in the publish`);
    }
  });

  it("carries nothing from tests, which is where the fixtures are", async () => {
    // The corpus alone is 188K of vendored third-party header text. It belongs
    // in the repository and has no business in a package somebody installs.
    // Controlled by removing `tests/` from `publish.exclude` and naming a test
    // file in `publish.include`, which turns this red.
    const files = await shipped();
    const strays = files.filter((one) => one.startsWith("tests/"));

    assertEquals(strays, []);
  });

  it("carries nothing from the places a tool wrote", async () => {
    const files = await shipped();
    const strays = files.filter((one) =>
      one.startsWith("npm/") || one.startsWith("scripts/") ||
      one.startsWith("coverage/") || one.startsWith(".github/")
    );

    assertEquals(strays, []);
  });

  it("names every file the cli reaches, so the entry point is not broken", async () => {
    // `cli/commands/_files.ts` was in the module graph and outside the include
    // list once, which the dry run caught rather than a reader. Anything the cli
    // imports has to be in the publish or the export resolves to nothing.
    const files = await shipped();

    for (const one of ["cli/commands/_files.ts", "cli/commands/fix.ts", "core/header.ts"]) {
      assertEquals(files.includes(one), true, `${one} is not in the publish`);
    }
  });

  it("reads the real dry run rather than a message about one", async () => {
    // The control for every case above: if the parse stopped matching what deno
    // prints, the lists would be empty and the exclusions would all pass.
    const files = await shipped();

    assertEquals(files.length > 10, true);
    assertStringIncludes(files.join("\n"), "README.md");
  });
});
