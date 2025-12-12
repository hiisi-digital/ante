//----------------------------------------------------------------------------------------------------
// Copyright (c) 2025                    orgrinrt                    orgrinrt@ikiuni.dev
// SPDX-License-Identifier: MPL-2.0      https://mozilla.org/MPL/2.0 contact@hiisi.digital
//----------------------------------------------------------------------------------------------------

import { deriveLicenseUrl, resolveConfig } from "#core";
import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { DEFAULT_CONFIG } from "../core/config.generated.ts";

describe("DEFAULT_CONFIG", () => {
  it("should have sensible defaults", () => {
    assertEquals(DEFAULT_CONFIG.width, 100);
    assertEquals(DEFAULT_CONFIG.separatorChar, "-");
    assertEquals(DEFAULT_CONFIG.commentPrefix, "//");
    assertEquals(DEFAULT_CONFIG.nameColumn, 40);
    assertEquals(DEFAULT_CONFIG.emailColumn, 65);
    assertEquals(DEFAULT_CONFIG.maxContributors, 3);
    assertEquals(DEFAULT_CONFIG.contributorSelection, "commits");
  });

  it("should have default include patterns for TypeScript", () => {
    assertEquals(DEFAULT_CONFIG.include.some((p) => p.includes("*.ts")), true);
    assertEquals(DEFAULT_CONFIG.include.some((p) => p.includes("*.tsx")), true);
  });

  it("should exclude node_modules by default", () => {
    assertEquals(DEFAULT_CONFIG.exclude.some((p) => p.includes("node_modules")), true);
  });
});

describe("resolveConfig", () => {
  it("should return defaults when given empty partial", () => {
    const resolved = resolveConfig({});
    assertEquals(resolved.width, DEFAULT_CONFIG.width);
    assertEquals(resolved.separatorChar, DEFAULT_CONFIG.separatorChar);
    assertEquals(resolved.commentPrefix, DEFAULT_CONFIG.commentPrefix);
  });

  it("should override defaults with provided values", () => {
    const resolved = resolveConfig({
      width: 80,
      separatorChar: "=",
      maxContributors: 5,
    });
    assertEquals(resolved.width, 80);
    assertEquals(resolved.separatorChar, "=");
    assertEquals(resolved.maxContributors, 5);
    // Defaults should still apply to non-overridden values
    assertEquals(resolved.commentPrefix, DEFAULT_CONFIG.commentPrefix);
  });

  it("should preserve partial include patterns", () => {
    const resolved = resolveConfig({
      include: ["**/*.rs"],
    });
    assertEquals(resolved.include, ["**/*.rs"]);
  });

  it("should preserve partial exclude patterns", () => {
    const resolved = resolveConfig({
      exclude: ["**/vendor/**"],
    });
    assertEquals(resolved.exclude, ["**/vendor/**"]);
  });

  it("should handle manual contributors", () => {
    const contributors = [
      { name: "Test User", email: "test@example.com" },
    ];
    const resolved = resolveConfig({
      contributorSelection: "manual",
      manualContributors: contributors,
    });
    assertEquals(resolved.contributorSelection, "manual");
    assertEquals(resolved.manualContributors, contributors);
  });

  it("should preserve empty arrays", () => {
    const resolved = resolveConfig({
      manualContributors: [],
    });
    assertEquals(resolved.manualContributors, []);
  });
});

describe("deriveLicenseUrl", () => {
  it("should return URL for MIT license", () => {
    const url = deriveLicenseUrl("MIT");
    assertEquals(url, "https://opensource.org/licenses/MIT");
  });

  it("should return URL for MPL-2.0 license", () => {
    const url = deriveLicenseUrl("MPL-2.0");
    assertEquals(url, "https://mozilla.org/MPL/2.0");
  });

  it("should return URL for Apache-2.0 license", () => {
    const url = deriveLicenseUrl("Apache-2.0");
    assertEquals(url, "https://www.apache.org/licenses/LICENSE-2.0");
  });

  it("should return URL for GPL-3.0 license", () => {
    const url = deriveLicenseUrl("GPL-3.0");
    assertEquals(url, "https://www.gnu.org/licenses/gpl-3.0.html");
  });

  it("should return URL for BSD-3-Clause license", () => {
    const url = deriveLicenseUrl("BSD-3-Clause");
    assertEquals(url, "https://opensource.org/licenses/BSD-3-Clause");
  });

  it("should return SPDX URL for unknown licenses", () => {
    const url = deriveLicenseUrl("Unknown-License-1.0");
    assertEquals(url, "https://spdx.org/licenses/Unknown-License-1.0.html");
  });

  it("should return empty string for empty input", () => {
    const url = deriveLicenseUrl("");
    assertEquals(url, "");
  });

  it("should handle GPL-3.0-only variant", () => {
    const url = deriveLicenseUrl("GPL-3.0-only");
    assertEquals(url, "https://www.gnu.org/licenses/gpl-3.0.html");
  });

  it("should handle ISC license", () => {
    const url = deriveLicenseUrl("ISC");
    assertEquals(url, "https://opensource.org/licenses/ISC");
  });

  it("should handle Unlicense", () => {
    const url = deriveLicenseUrl("Unlicense");
    assertEquals(url, "https://unlicense.org/");
  });
});
