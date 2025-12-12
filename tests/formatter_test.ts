//----------------------------------------------------------------------------------------------------
// Copyright (c) 2025                    orgrinrt                    orgrinrt@ikiuni.dev
// SPDX-License-Identifier: MPL-2.0      https://mozilla.org/MPL/2.0 contact@hiisi.digital
//----------------------------------------------------------------------------------------------------

import {
  adjustToWidth,
  type Column,
  formatCopyrightLine,
  formatLine,
  formatSpdxLine,
  generateSeparator,
  padToColumn,
  trimToWidth,
} from "#core";
import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { DEFAULT_CONFIG } from "../core/config.generated.ts";

describe("formatLine", () => {
  it("should format empty columns as empty string", () => {
    assertEquals(formatLine([]), "");
  });

  it("should format a single column at position 0", () => {
    const columns: Column[] = [{ content: "Hello", position: 0 }];
    assertEquals(formatLine(columns), "Hello");
  });

  it("should format a single column at a non-zero position", () => {
    const columns: Column[] = [{ content: "Hello", position: 10 }];
    assertEquals(formatLine(columns), "          Hello");
  });

  it("should format multiple columns with proper spacing", () => {
    const columns: Column[] = [
      { content: "First", position: 0 },
      { content: "Second", position: 10 },
      { content: "Third", position: 20 },
    ];
    const result = formatLine(columns);
    assertEquals(result.indexOf("First"), 0);
    assertEquals(result.indexOf("Second"), 10);
    assertEquals(result.indexOf("Third"), 20);
  });

  it("should handle overlapping columns with minimum spacing", () => {
    const columns: Column[] = [
      { content: "VeryLongContent", position: 0 },
      { content: "Next", position: 5 },
    ];
    const result = formatLine(columns);
    // Should have at least one space between overlapping content
    assertEquals(result.includes("VeryLongContent Next"), true);
  });

  it("should sort columns by position", () => {
    const columns: Column[] = [
      { content: "Third", position: 20 },
      { content: "First", position: 0 },
      { content: "Second", position: 10 },
    ];
    const result = formatLine(columns);
    assertEquals(result.indexOf("First"), 0);
  });
});

describe("generateSeparator", () => {
  it("should generate a separator of the specified width", () => {
    const separator = generateSeparator(80, "-", "//");
    assertEquals(separator.length, 80);
    assertEquals(separator.startsWith("//"), true);
  });

  it("should use the specified character", () => {
    const separator = generateSeparator(50, "=", "//");
    assertEquals(separator, "//" + "=".repeat(48));
  });

  it("should use the specified prefix", () => {
    const separator = generateSeparator(40, "-", "#");
    assertEquals(separator.startsWith("#"), true);
    assertEquals(separator.length, 40);
  });

  it("should handle edge case where width equals prefix length", () => {
    const separator = generateSeparator(2, "-", "//");
    assertEquals(separator, "//");
  });

  it("should handle width less than prefix length", () => {
    const separator = generateSeparator(1, "-", "//");
    assertEquals(separator, "//");
  });
});

describe("padToColumn", () => {
  it("should pad text to reach target column", () => {
    const result = padToColumn("Hello", 10);
    assertEquals(result.length, 10);
    assertEquals(result, "Hello     ");
  });

  it("should add minimum one space if text is longer than target", () => {
    const result = padToColumn("VeryLongText", 5);
    assertEquals(result, "VeryLongText ");
  });

  it("should handle exact length with one space", () => {
    const result = padToColumn("Hello", 5);
    assertEquals(result, "Hello ");
  });
});

describe("trimToWidth", () => {
  it("should not modify lines shorter than width", () => {
    assertEquals(trimToWidth("Hello", 100), "Hello");
  });

  it("should trim lines longer than width", () => {
    const longLine = "x".repeat(150);
    const result = trimToWidth(longLine, 100);
    assertEquals(result.length, 100);
  });

  it("should return exact width for exact length", () => {
    const line = "x".repeat(100);
    assertEquals(trimToWidth(line, 100), line);
  });
});

describe("adjustToWidth", () => {
  it("should pad short lines to target width", () => {
    const result = adjustToWidth("Hello", 10);
    assertEquals(result.length, 10);
    assertEquals(result, "Hello     ");
  });

  it("should trim long lines to target width", () => {
    const result = adjustToWidth("HelloWorld", 5);
    assertEquals(result.length, 5);
    assertEquals(result, "Hello");
  });

  it("should not modify lines of exact width", () => {
    const result = adjustToWidth("Hello", 5);
    assertEquals(result, "Hello");
  });
});

describe("formatCopyrightLine", () => {
  const config = {
    ...DEFAULT_CONFIG,
    commentPrefix: "//",
    nameColumn: 40,
    emailColumn: 65,
  };

  it("should format a copyright line with year", () => {
    const result = formatCopyrightLine(config, "2025", "orgrinrt", "test@example.com");
    assertEquals(result.startsWith("// Copyright (c) 2025"), true);
    assertEquals(result.includes("orgrinrt"), true);
    assertEquals(result.includes("test@example.com"), true);
  });

  it("should format a continuation line without year", () => {
    const result = formatCopyrightLine(config, "", "contributor", "contrib@example.com");
    assertEquals(result.startsWith("//"), true);
    assertEquals(result.includes("Copyright"), false);
    assertEquals(result.includes("contributor"), true);
  });

  it("should align name at configured column", () => {
    const result = formatCopyrightLine(config, "2025", "test", "email@example.com");
    const nameIndex = result.indexOf("test");
    assertEquals(nameIndex, config.nameColumn);
  });

  it("should handle year ranges", () => {
    const result = formatCopyrightLine(config, "2020-2025", "author", "author@example.com");
    assertEquals(result.includes("2020-2025"), true);
  });
});

describe("formatSpdxLine", () => {
  const config = {
    ...DEFAULT_CONFIG,
    commentPrefix: "//",
    spdxLicense: "MPL-2.0",
    licenseUrl: "https://mozilla.org/MPL/2.0",
    maintainerEmail: "contact@example.com",
    licenseUrlColumn: 40,
    maintainerColumn: 75,
  };

  it("should include SPDX identifier", () => {
    const result = formatSpdxLine(config);
    assertEquals(result.includes("SPDX-License-Identifier: MPL-2.0"), true);
  });

  it("should include license URL", () => {
    const result = formatSpdxLine(config);
    assertEquals(result.includes("https://mozilla.org/MPL/2.0"), true);
  });

  it("should include maintainer email", () => {
    const result = formatSpdxLine(config);
    assertEquals(result.includes("contact@example.com"), true);
  });
});
