//----------------------------------------------------------------------------------------------------
// Copyright (c) 2025                    orgrinrt                    orgrinrt@ikiuni.dev
// SPDX-License-Identifier: MPL-2.0      https://mozilla.org/MPL/2.0 contact@hiisi.digital
//----------------------------------------------------------------------------------------------------

import {
  generateHeader,
  getYearRange,
  hasContributor,
  hasValidHeader,
  parseHeader,
  replaceHeader,
  updateHeader,
  validateHeader,
} from "#core";
import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { DEFAULT_CONFIG } from "../core/config.generated.ts";

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
