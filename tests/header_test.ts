//----------------------------------------------------------------------------------------------------
// Copyright (c) 2025-2026                    orgrinrt                    orgrinrt@ikiuni.dev
//                                      orgrinrt                 ort@hiisi.digital
// SPDX-License-Identifier: MPL-2.0      https://mozilla.org/MPL/2.0 contact@hiisi.digital
//----------------------------------------------------------------------------------------------------

import {
  generateHeader,
  getYearRange,
  hasContributor,
  hasValidHeader,
  omittedContributors,
  parseHeader,
  replaceHeader,
  stackedHeaders,
  updateHeader,
  validateHeader,
} from "#core";
import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { DEFAULT_CONFIG } from "../core/config.generated.ts";
import { CATALOGUED } from "./catalogued.ts";
import { people } from "./conservation.ts";

const SAMPLE_HEADER =
  `//----------------------------------------------------------------------------------------------------
// Copyright (c) 2020-2025               orgrinrt                    orgrinrt@ikiuni.dev
// SPDX-License-Identifier: MPL-2.0      https://mozilla.org/MPL/2.0 contact@hiisi.digital
//----------------------------------------------------------------------------------------------------`;

const SAMPLE_HEADER_SINGLE_YEAR =
  `//----------------------------------------------------------------------------------------------------
// Copyright (c) 2025                    testuser                    test@example.com
// SPDX-License-Identifier: MIT          https://opensource.org/licenses/MIT maintainer@example.com
//----------------------------------------------------------------------------------------------------`;

const SAMPLE_FILE_WITH_HEADER = `${SAMPLE_HEADER}

export function hello(): string {
  return "Hello, World!";
}
`;

const SAMPLE_FILE_WITHOUT_HEADER = `export function hello(): string {
  return "Hello, World!";
}
`;

describe("parseHeader", () => {
  it("should parse a valid header", () => {
    const parsed = parseHeader(SAMPLE_FILE_WITH_HEADER);
    assertEquals(parsed !== null, true);
    assertEquals(parsed!.yearStart, 2020);
    assertEquals(parsed!.yearEnd, 2025);
    assertEquals(parsed!.contributors.length, 1);
    assertEquals(parsed!.contributors[0].name, "orgrinrt");
    assertEquals(parsed!.contributors[0].email, "orgrinrt@ikiuni.dev");
    assertEquals(parsed!.spdxLicense, "MPL-2.0");
  });

  it("should return null for content without header", () => {
    const parsed = parseHeader(SAMPLE_FILE_WITHOUT_HEADER);
    assertEquals(parsed, null);
  });

  it("should parse header with single year", () => {
    const parsed = parseHeader(SAMPLE_HEADER_SINGLE_YEAR + "\n\ncode here");
    assertEquals(parsed !== null, true);
    assertEquals(parsed!.yearStart, 2025);
    assertEquals(parsed!.yearEnd, 2025);
  });

  it("should return null for empty content", () => {
    const parsed = parseHeader("");
    assertEquals(parsed, null);
  });

  it("should return null for content not starting with separator", () => {
    const parsed = parseHeader("// Just a comment\nexport const x = 1;");
    assertEquals(parsed, null);
  });
});

describe("hasValidHeader", () => {
  it("should return true for valid header", () => {
    assertEquals(hasValidHeader(SAMPLE_FILE_WITH_HEADER), true);
  });

  it("should return false for missing header", () => {
    assertEquals(hasValidHeader(SAMPLE_FILE_WITHOUT_HEADER), false);
  });

  it("should return false for empty content", () => {
    assertEquals(hasValidHeader(""), false);
  });
});

describe("generateHeader", () => {
  const config = {
    ...DEFAULT_CONFIG,
    width: 100,
    spdxLicense: "MPL-2.0",
    licenseUrl: "https://mozilla.org/MPL/2.0",
    maintainerEmail: "contact@example.com",
  };

  it("should generate a header with contributors", () => {
    const contributors = [{ name: "testuser", email: "test@example.com" }];
    const header = generateHeader(config, contributors, 2025);

    assertEquals(header.includes("Copyright (c) 2025"), true);
    assertEquals(header.includes("testuser"), true);
    assertEquals(header.includes("test@example.com"), true);
    assertEquals(header.includes("SPDX-License-Identifier: MPL-2.0"), true);
  });

  it("should generate year range when years differ", () => {
    const contributors = [{ name: "author", email: "author@example.com" }];
    const header = generateHeader(config, contributors, 2020, 2025);

    assertEquals(header.includes("2020-2025"), true);
  });

  it("should limit contributors to maxContributors", () => {
    const manyContributors = [
      { name: "one", email: "one@example.com" },
      { name: "two", email: "two@example.com" },
      { name: "three", email: "three@example.com" },
      { name: "four", email: "four@example.com" },
      { name: "five", email: "five@example.com" },
    ];
    const limitedConfig = { ...config, maxContributors: 3 };
    const header = generateHeader(limitedConfig, manyContributors, 2025);

    assertEquals(header.includes("one@example.com"), true);
    assertEquals(header.includes("two@example.com"), true);
    assertEquals(header.includes("three@example.com"), true);
    assertEquals(header.includes("four@example.com"), false);
    assertEquals(header.includes("five@example.com"), false);
  });

  it("should include separator lines", () => {
    const contributors = [{ name: "test", email: "test@example.com" }];
    const header = generateHeader(config, contributors, 2025);
    const lines = header.split("\n");

    assertEquals(lines[0].startsWith("//---"), true);
    assertEquals(lines[lines.length - 1].startsWith("//---"), true);
  });
});

describe("updateHeader", () => {
  const config = {
    ...DEFAULT_CONFIG,
    spdxLicense: "MPL-2.0",
    licenseUrl: "https://mozilla.org/MPL/2.0",
    maintainerEmail: "contact@example.com",
  };

  it("should update year when specified", () => {
    const parsed = parseHeader(SAMPLE_FILE_WITH_HEADER)!;
    const updated = updateHeader(parsed, config, { updateYear: 2026 });

    assertEquals(updated.includes("2020-2026"), true);
  });

  it("should not change year if updateYear is not greater", () => {
    const parsed = parseHeader(SAMPLE_FILE_WITH_HEADER)!;
    const updated = updateHeader(parsed, config, { updateYear: 2024 });

    assertEquals(updated.includes("2020-2025"), true);
  });

  it("should add new contributor", () => {
    const parsed = parseHeader(SAMPLE_FILE_WITH_HEADER)!;
    const newContributor = { name: "newuser", email: "new@example.com" };
    const updated = updateHeader(parsed, config, { newContributor });

    assertEquals(updated.includes("newuser"), true);
    assertEquals(updated.includes("new@example.com"), true);
  });

  it("should not duplicate existing contributor", () => {
    const parsed = parseHeader(SAMPLE_FILE_WITH_HEADER)!;
    const existingContributor = { name: "orgrinrt", email: "orgrinrt@ikiuni.dev" };
    const updated = updateHeader(parsed, config, { newContributor: existingContributor });

    const count = (updated.match(/orgrinrt@ikiuni\.dev/g) || []).length;
    assertEquals(count, 1);
  });
});

describe("validateHeader", () => {
  const config = {
    ...DEFAULT_CONFIG,
    spdxLicense: "MPL-2.0",
  };

  it("should validate a correct header", () => {
    const result = validateHeader(SAMPLE_FILE_WITH_HEADER, config);
    assertEquals(result.valid, true);
    assertEquals(result.issues.length, 0);
  });

  it("should fail for missing header", () => {
    const result = validateHeader(SAMPLE_FILE_WITHOUT_HEADER, config);
    assertEquals(result.valid, false);
    assertEquals(result.issues.includes("No valid header found"), true);
  });

  it("should report mismatched license", () => {
    const wrongConfig = { ...config, spdxLicense: "MIT" };
    const result = validateHeader(SAMPLE_FILE_WITH_HEADER, wrongConfig);
    assertEquals(result.valid, false);
    assertEquals(result.issues.some((i) => i.includes("does not match")), true);
  });
});

describe("replaceHeader", () => {
  const config = {
    ...DEFAULT_CONFIG,
    spdxLicense: "MIT",
    licenseUrl: "https://opensource.org/licenses/MIT",
    maintainerEmail: "test@example.com",
  };

  it("should prepend header to content without existing header", () => {
    const contributors = [{ name: "author", email: "author@example.com" }];
    const newHeader = generateHeader(config, contributors, 2025);
    const result = replaceHeader(SAMPLE_FILE_WITHOUT_HEADER, newHeader);

    assertEquals(result.startsWith("//---"), true);
    assertEquals(result.includes("export function hello()"), true);
  });

  it("should replace existing header", () => {
    const parsed = parseHeader(SAMPLE_FILE_WITH_HEADER)!;
    const contributors = [{ name: "newauthor", email: "new@example.com" }];
    const newHeader = generateHeader(config, contributors, 2025);
    const result = replaceHeader(SAMPLE_FILE_WITH_HEADER, newHeader, parsed);

    assertEquals(result.includes("newauthor"), true);
    assertEquals(result.includes("export function hello()"), true);
    // Old author should be gone
    const orgrinrtCount = (result.match(/orgrinrt/g) || []).length;
    assertEquals(orgrinrtCount, 0);
  });

  const contributor = [{ name: "author", email: "author@example.com" }];

  it("should keep a shebang first and put the header under it", () => {
    const newHeader = generateHeader(config, contributor, 2025);
    const result = replaceHeader("#!/usr/bin/env node\nconsole.log(1);\n", newHeader);

    assertEquals(result.split("\n")[0], "#!/usr/bin/env node");
    assertEquals(result.split("\n")[1].startsWith("//---"), true);
  });

  it("should treat a rust inner attribute as content, not as a shebang", () => {
    const newHeader = generateHeader(config, contributor, 2025);

    // `#![...]` opens the same two characters a shebang does and is not one.
    // Read as a shebang it stays on line one and the header lands under it,
    // where `parseHeader` will not find it, so the file fails its own check
    // for as long as it exists.
    for (
      const first of [
        "#![no_std]",
        "#![feature(generic_const_exprs)]",
        "#![allow(clippy::all)]",
        "#![cfg_attr(docsrs, feature(doc_cfg))]",
      ]
    ) {
      const result = replaceHeader(`${first}\npub fn f() {}\n`, newHeader);

      assertEquals(result.startsWith("//---"), true, first);
      assertEquals(result.includes(first), true, first);
      assertEquals(hasValidHeader(result), true, first);
    }
  });

  it("should still find the header it wrote above an inner attribute", () => {
    // The control for the case above. Placing the header on line two leaves a
    // file that parses to no header at all, so this is what tells the two
    // outcomes apart rather than the ordering alone.
    const newHeader = generateHeader(config, contributor, 2025);
    const broken = `#![no_std]\n${newHeader}\n\npub fn f() {}\n`;

    // The same header, on line one, is what a valid file looks like. Without
    // this pair the control could be passing because the header is malformed
    // rather than because it is in the wrong place.
    assertEquals(hasValidHeader(`${newHeader}\n\n#![no_std]\npub fn f() {}\n`), true);

    assertEquals(hasValidHeader(broken), false);
    assertEquals(parseHeader(broken), null);
  });
});

describe("hasContributor", () => {
  it("should find existing contributor by email", () => {
    assertEquals(hasContributor(SAMPLE_FILE_WITH_HEADER, "orgrinrt@ikiuni.dev"), true);
  });

  it("should be case-insensitive", () => {
    assertEquals(hasContributor(SAMPLE_FILE_WITH_HEADER, "ORGRINRT@IKIUNI.DEV"), true);
  });

  it("should return false for non-existent contributor", () => {
    assertEquals(hasContributor(SAMPLE_FILE_WITH_HEADER, "unknown@example.com"), false);
  });

  it("should return false for content without header", () => {
    assertEquals(hasContributor(SAMPLE_FILE_WITHOUT_HEADER, "anyone@example.com"), false);
  });
});

describe("getYearRange", () => {
  it("should extract year range from header", () => {
    const range = getYearRange(SAMPLE_FILE_WITH_HEADER);
    assertEquals(range !== null, true);
    assertEquals(range!.yearStart, 2020);
    assertEquals(range!.yearEnd, 2025);
  });

  it("should return null for content without header", () => {
    const range = getYearRange(SAMPLE_FILE_WITHOUT_HEADER);
    assertEquals(range, null);
  });

  it("should handle single year", () => {
    const range = getYearRange(SAMPLE_HEADER_SINGLE_YEAR + "\n\ncode");
    assertEquals(range !== null, true);
    assertEquals(range!.yearStart, 2025);
    assertEquals(range!.yearEnd, 2025);
  });
});

describe("a header written with no licence configured", () => {
  const nameless = {
    ...DEFAULT_CONFIG,
    spdxLicense: "",
    licenseUrl: "",
    maintainerEmail: "maintainer@example.com",
  };
  const contributors = [{ name: "Test Author", email: "test@example.com" }];

  it("writes an spdx line with nothing on it", () => {
    // Not the wanted behaviour, recorded because it is the current one and the
    // case below is what should replace it.
    const header = generateHeader(nameless, contributors, 2026);
    assertEquals(header.includes("SPDX-License-Identifier:"), true);
    assertEquals(header.includes("SPDX-License-Identifier: "), true);
    const line = header.split("\n").find((one) => one.includes("SPDX"))!;
    assertEquals(
      line.replace(/\s+/g, " ").trim(),
      "// SPDX-License-Identifier: maintainer@example.com",
    );
  });

  it({
    name: "does not certify a header whose licence is blank (ante-blank-licence-certified)",
    ignore: !CATALOGUED,
    fn(): void {
      // Catalogued rather than fixed. `validateHeader` skips the comparison
      // entirely when the configured licence is empty, so the same guard means
      // both "no licence configured" and "nothing to check", and a header the
      // tool wrote with a blank identifier passes its own check.
      //
      // Making this green needs a decision about what happens at write time,
      // because turning it green alone would fail every project that has never
      // configured a licence and give them no repair path, which is the shape
      // of the fix/check disagreement that was just removed.
      const header = generateHeader(nameless, contributors, 2026);
      const result = validateHeader(`${header}\n\nexport const a = 1;\n`, nameless);
      assertEquals(result.valid, false);
      assertEquals(
        result.issues.some((one) => one.toLowerCase().includes("license")),
        true,
        `expected a licence issue, got ${JSON.stringify(result.issues)}`,
      );
    },
  });
});

describe("a header written before the gap was widened", () => {
  // Versions up to 0.2.2 put a single space after a name that overran its
  // column, and then could not read the line back. The contributor on it was
  // dropped on the next repair. Those files are still on disk, so the parser
  // takes one space even though the formatter no longer writes one.
  const legacy = [
    "//----------------------------------------",
    "// Copyright (c) 2020-2026                  orgrinrt                  ort@hiisi.digital",
    "//                                      Jean-Baptiste Grenouille jb@example.com",
    "// SPDX-License-Identifier: MIT      https://opensource.org/licenses/MIT c@x.dev",
    "//----------------------------------------",
    "",
    "const x = 1;",
  ].join("\n");

  it("still yields every contributor on it", () => {
    const parsed = parseHeader(legacy);
    assertEquals(parsed?.contributors, [
      { name: "orgrinrt", email: "ort@hiisi.digital" },
      { name: "Jean-Baptiste Grenouille", email: "jb@example.com" },
    ]);
  });

  it("still yields the licence it names", () => {
    const parsed = parseHeader(legacy);
    assertEquals(parsed?.spdxLicense, "MIT");
    assertEquals(parsed?.licenseUrl, "https://opensource.org/licenses/MIT");
    assertEquals(parsed?.maintainerEmail, "c@x.dev");
  });
});

describe("a header written twice over the same file", () => {
  const block = [
    "//" + "-".repeat(98),
    "// Copyright (c) 2026                   orgrinrt                 ort@hiisi.digital",
    "// SPDX-License-Identifier: MPL-2.0     https://mozilla.org/MPL/2.0        ort@hiisi.digital",
    "//" + "-".repeat(98),
  ].join("\n");
  const body = "\nexport const x = 1;\n";

  it("is counted, where one block and none are counted too", () => {
    assertEquals(stackedHeaders(block + "\n" + body, DEFAULT_CONFIG), 1);
    assertEquals(stackedHeaders(body.trimStart(), DEFAULT_CONFIG), 0);
    assertEquals(stackedHeaders(block + "\n\n" + block + "\n" + body, DEFAULT_CONFIG), 2);
    assertEquals(
      stackedHeaders(block + "\n\n" + block + "\n\n" + block + "\n" + body, DEFAULT_CONFIG),
      3,
    );
  });

  it("counts across the blank line fix leaves between them, and stops at real content", () => {
    // No blank line at all is still two blocks back to back.
    assertEquals(stackedHeaders(block + "\n" + block + "\n" + body, DEFAULT_CONFIG), 2);
    // A block further down the file belongs to whoever put it there, so the run
    // ends at the first line that is neither blank nor a separator.
    assertEquals(
      stackedHeaders(block + "\n\nconst a = 1;\n\n" + block + "\n", DEFAULT_CONFIG),
      1,
    );
  });

  it("fails validation, which is what check reads", () => {
    const one = validateHeader(block + "\n" + body, DEFAULT_CONFIG);
    assertEquals(one.valid, true, "one block is the ordinary case and stays valid");

    const two = validateHeader(block + "\n\n" + block + "\n" + body, DEFAULT_CONFIG);
    assertEquals(two.valid, false);
    assertEquals(
      two.issues.some((i) => i.includes("2 header blocks are stacked")),
      true,
      `the issue names the count, and said: ${JSON.stringify(two.issues)}`,
    );
  });

  it("is invisible to parseHeader, which is why validate has to ask", () => {
    // Stated as a test rather than a comment, because it is the reason the
    // defect survived two releases: parsing stops at the first closing
    // separator, so a file with two blocks parses exactly like a file with one.
    const one = parseHeader(block + "\n" + body, DEFAULT_CONFIG);
    const two = parseHeader(block + "\n\n" + block + "\n" + body, DEFAULT_CONFIG);
    assertEquals(two?.endLine, one?.endLine);
    assertEquals(hasValidHeader(block + "\n\n" + block + "\n" + body, DEFAULT_CONFIG), true);
  });
});

describe("the names a header will not carry", () => {
  it("is empty while the limit has room, and names the tail once it does not", () => {
    const config = { ...DEFAULT_CONFIG, maxContributors: 3 };
    assertEquals(omittedContributors(people(0), config), []);
    assertEquals(omittedContributors(people(3), config), []);
    assertEquals(
      omittedContributors(people(5), config).map((c) => c.name),
      people(5).slice(3).map((c) => c.name),
    );
  });

  it("names exactly who the header leaves out, at any limit", () => {
    // Tied to what `generateHeader` actually writes rather than to the slice, so
    // the two cannot drift into disagreeing about who was dropped.
    for (const limit of [1, 2, 3, 7]) {
      for (const count of [0, 1, 3, 5, 9]) {
        const config = { ...DEFAULT_CONFIG, maxContributors: limit };
        const who = people(count);
        const written = generateHeader(config, who, 2026, 2026);
        const parsed = parseHeader(written, config);
        const kept = parsed?.contributors.map((c) => c.name) ?? [];
        const left = omittedContributors(who, config).map((c) => c.name);

        assertEquals(
          [...kept, ...left].length,
          count,
          `limit=${limit} people=${count}: kept ${kept.length} and left ${left.length}`,
        );
        assertEquals(
          left,
          who.slice(kept.length).map((c) => c.name),
          `limit=${limit} people=${count}: the tail has to be the ones not written`,
        );
      }
    }
  });
});
