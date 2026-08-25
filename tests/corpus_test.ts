//--------------------------------------------------------------------------------------------------
// Copyright (c) 2026                   orgrinrt                 ort@hiisi.digital
// SPDX-License-Identifier: MPL-2.0     https://mozilla.org/MPL/2.0        ort@hiisi.digital
//--------------------------------------------------------------------------------------------------

/**
 * Conservation, against headers nobody here wrote.
 *
 * The sweep in `roundtrip_test.ts` builds its blocks from shapes we chose, so it
 * can only find the ways we already imagined a header being written. This one
 * runs the same property over `tests/fixtures/headers.json`, which is 244 blocks
 * harvested from vendored third-party source: openssl notices, kernel tags,
 * generated-file warnings, patent grants, addresses in four different forms.
 *
 * The property is that adopting the tool over one of those blocks, and every
 * repair after it, leaves every line that was in it. The licence tag and the
 * copyright line are the exception, because those are fields the tool owns and
 * rewrites on purpose.
 *
 * It is worth knowing that this can fail, because a suite that could not would
 * read the same. Run the same check against the code as it stood before the
 * rewrite path carried a block's own lines across and 225 of the 244 lose a
 * line, 182 of them written as line comments and 43 as block comments.
 */

import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { type Contributor, DEFAULT_CONFIG, parseHeader, rewriteHeader } from "#core";
import { destroyed } from "./conservation.ts";
import type { ResolvedConfig } from "#core";

interface Harvested {
  id: string;
  ext: string;
  from: string;
  block: string;
}

const CORPUS: Harvested[] = JSON.parse(
  Deno.readTextFileSync(new URL("./fixtures/headers.json", import.meta.url)),
);

const CONFIG: ResolvedConfig = {
  ...DEFAULT_CONFIG,
  spdxLicense: "MPL-2.0",
  licenseUrl: "https://mozilla.org/MPL/2.0",
  maintainerEmail: "contact@hiisi.digital",
};

const WHO: Contributor[] = [{ name: "orgrinrt", email: "orgrinrt@ikiuni.dev" }];

/** A harvested block is somebody else's, so the fields the tool owns are its own. */
const KEEPS = { prefix: CONFIG.commentPrefix, rewritesCopyright: true } as const;

/** The block as it would sit in a project that has just adopted the tool. */
function adopted(block: string, config: ResolvedConfig): string {
  const rule = config.commentPrefix +
    config.separatorChar.repeat(config.width - config.commentPrefix.length);
  const lines = block.split("\n").map((line) =>
    line.startsWith(config.commentPrefix) || line.trim() === ""
      ? line
      : `${config.commentPrefix} ${line}`
  );
  return [rule, ...lines, rule].join("\n") + "\n\nconst x = 1;\n";
}

describe("a header somebody else wrote", () => {
  it("survives the run that adopts the tool, all 244 of them", () => {
    const casualties: string[] = [];
    for (const one of CORPUS) {
      const after = rewriteHeader(adopted(one.block, CONFIG), CONFIG, WHO, 2020, 2026);
      const gone = destroyed(one.block.split("\n"), after, KEEPS);
      if (gone.length > 0) casualties.push(`${one.id} (${one.from}${one.ext}): ${gone[0]}`);
    }
    assertEquals(casualties, []);
  });

  it("survives every repair after that one, and settles", () => {
    const casualties: string[] = [];
    for (const one of CORPUS) {
      let content = adopted(one.block, CONFIG);
      for (let round = 0; round < 3; round++) {
        content = rewriteHeader(content, CONFIG, WHO, 2020, 2026);
      }
      const gone = destroyed(one.block.split("\n"), content, KEEPS);
      if (gone.length > 0) casualties.push(`${one.id} (${one.from}${one.ext}): ${gone[0]}`);
      const again = rewriteHeader(content, CONFIG, WHO, 2020, 2026);
      if (again !== content) casualties.push(`${one.id}: still moving after three repairs`);
    }
    assertEquals(casualties, []);
  });

  it("reads every one of them back once the rules are around it", () => {
    const unreadable = CORPUS.filter((one) =>
      parseHeader(adopted(one.block, CONFIG), CONFIG) === null
    );
    assertEquals(unreadable.map((one) => one.id), []);
  });
});
