//----------------------------------------------------------------------------------------------------
// Copyright (c) 2025                    orgrinrt                    orgrinrt@ikiuni.dev
//                                      orgrinrt                 ort@hiisi.digital
// SPDX-License-Identifier: MPL-2.0      https://mozilla.org/MPL/2.0 contact@hiisi.digital
//----------------------------------------------------------------------------------------------------

/**
 * Integration tests for ante - testing the full workflow.
 *
 * These tests create temporary directories and files to simulate
 * real-world usage of the ante tool.
 *
 * This test file uses cross-runtime utilities to work on Deno, Node.js, and Bun.
 */

import {
  generateHeader,
  hasValidHeader,
  loadConfig,
  parseHeader,
  replaceHeader,
  resolveConfig,
  updateHeader,
  validateHeader,
} from "#core";
import { assertEquals, assertExists } from "@std/assert";
import { afterEach, beforeEach, describe, it } from "@std/testing/bdd";
import { DEFAULT_CONFIG } from "../core/config.generated.ts";
import { createTempDir, joinPath, readFile, removeDir, writeFile } from "./_utils/mod.ts";

describe("Integration: Full Header Workflow", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await createTempDir("ante_test_");
  });

  afterEach(async () => {
    await removeDir(tempDir);
  });

  it("should add header to a file without one", async () => {
    const config = resolveConfig({
      spdxLicense: "MIT",
      licenseUrl: "https://opensource.org/licenses/MIT",
      maintainerEmail: "test@example.com",
    });

    const contributors = [{ name: "Test Author", email: "author@example.com" }];

    // Create a file without a header
    const filePath = joinPath(tempDir, "test.ts");
    const originalContent = `export function hello(): string {
  return "Hello, World!";
}
`;
    await writeFile(filePath, originalContent);

    // Generate and add header
    const header = generateHeader(config, contributors, 2025);
    const content = await readFile(filePath);
    const newContent = replaceHeader(content, header);
    await writeFile(filePath, newContent);

    // Verify
    const finalContent = await readFile(filePath);
    assertEquals(hasValidHeader(finalContent), true);
    assertEquals(finalContent.includes("Test Author"), true);
    assertEquals(finalContent.includes("author@example.com"), true);
    assertEquals(finalContent.includes("SPDX-License-Identifier: MIT"), true);
    assertEquals(finalContent.includes("Hello, World!"), true);
  });

  it("should update an existing header with a new contributor", async () => {
    const config = resolveConfig({
      spdxLicense: "MPL-2.0",
      licenseUrl: "https://mozilla.org/MPL/2.0",
      maintainerEmail: "maintain@example.com",
    });

    // Create a file with an existing header
    const filePath = joinPath(tempDir, "existing.ts");
    const existingHeader =
      `//----------------------------------------------------------------------------------------------------
// Copyright (c) 2024                    original                    original@example.com
// SPDX-License-Identifier: MPL-2.0      https://mozilla.org/MPL/2.0 maintain@example.com
//----------------------------------------------------------------------------------------------------

export const value = 42;
`;
    await writeFile(filePath, existingHeader);

    // Read and parse existing header
    const content = await readFile(filePath);
    const parsed = parseHeader(content);
    assertExists(parsed);

    // Update with new contributor and year
    const newContributor = { name: "newdev", email: "newdev@example.com" };
    const updatedHeader = updateHeader(parsed, config, {
      newContributor,
      updateYear: 2025,
    });
    const newContent = replaceHeader(content, updatedHeader, parsed);
    await writeFile(filePath, newContent);

    // Verify
    const finalContent = await readFile(filePath);
    assertEquals(hasValidHeader(finalContent), true);
    assertEquals(finalContent.includes("original@example.com"), true);
    assertEquals(finalContent.includes("newdev@example.com"), true);
    assertEquals(finalContent.includes("2024-2025"), true);
    assertEquals(finalContent.includes("export const value = 42"), true);
  });

  it("should validate headers correctly", async () => {
    const config = resolveConfig({
      spdxLicense: "MIT",
      licenseUrl: "https://opensource.org/licenses/MIT",
      maintainerEmail: "test@example.com",
    });

    // Create file with matching license
    const validFile = joinPath(tempDir, "valid.ts");
    const validHeader =
      `//----------------------------------------------------------------------------------------------------
// Copyright (c) 2025                    author                      author@example.com
// SPDX-License-Identifier: MIT          https://opensource.org/licenses/MIT test@example.com
//----------------------------------------------------------------------------------------------------

export const x = 1;
`;
    await writeFile(validFile, validHeader);

    // Create file with mismatched license
    const mismatchFile = joinPath(tempDir, "mismatch.ts");
    const mismatchHeader =
      `//----------------------------------------------------------------------------------------------------
// Copyright (c) 2025                    author                      author@example.com
// SPDX-License-Identifier: GPL-3.0      https://gnu.org/gpl-3.0 test@example.com
//----------------------------------------------------------------------------------------------------

export const y = 2;
`;
    await writeFile(mismatchFile, mismatchHeader);

    // Validate
    const validContent = await readFile(validFile);
    const validResult = validateHeader(validContent, config);
    assertEquals(validResult.valid, true);
    assertEquals(validResult.issues.length, 0);

    const mismatchContent = await readFile(mismatchFile);
    const mismatchResult = validateHeader(mismatchContent, config);
    assertEquals(mismatchResult.valid, false);
    assertEquals(mismatchResult.issues.some((i) => i.includes("does not match")), true);
  });

  it("should handle files without headers during validation", async () => {
    const config = resolveConfig({
      spdxLicense: "MIT",
    });

    const noHeaderFile = joinPath(tempDir, "noheader.ts");
    await writeFile(noHeaderFile, "export const z = 3;\n");

    const content = await readFile(noHeaderFile);
    const result = validateHeader(content, config);

    assertEquals(result.valid, false);
    assertEquals(result.issues.includes("No valid header found"), true);
  });

  it("should preserve code content when replacing headers", async () => {
    const config = resolveConfig({
      spdxLicense: "Apache-2.0",
      licenseUrl: "https://www.apache.org/licenses/LICENSE-2.0",
      maintainerEmail: "apache@example.com",
    });

    const complexCode = `export interface User {
  id: number;
  name: string;
  email: string;
}

export function createUser(name: string, email: string): User {
  return {
    id: Math.random(),
    name,
    email,
  };
}

export class UserService {
  private users: User[] = [];

  add(user: User): void {
    this.users.push(user);
  }

  find(id: number): User | undefined {
    return this.users.find((u) => u.id === id);
  }
}
`;

    const filePath = joinPath(tempDir, "complex.ts");
    await writeFile(filePath, complexCode);

    // Add header
    const contributors = [{ name: "Developer", email: "dev@example.com" }];
    const header = generateHeader(config, contributors, 2025);
    const content = await readFile(filePath);
    const newContent = replaceHeader(content, header);
    await writeFile(filePath, newContent);

    // Verify all code is preserved
    const finalContent = await readFile(filePath);
    assertEquals(finalContent.includes("export interface User"), true);
    assertEquals(finalContent.includes("export function createUser"), true);
    assertEquals(finalContent.includes("export class UserService"), true);
    assertEquals(finalContent.includes("this.users.push(user)"), true);
  });
});

describe("Integration: Configuration Loading", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await createTempDir("ante_config_test_");
  });

  afterEach(async () => {
    await removeDir(tempDir);
  });

  it("should load config from deno.json", async () => {
    const denoJson = {
      name: "@test/package",
      version: "1.0.0",
      license: "MIT",
      ante: {
        width: 80,
        maxContributors: 5,
        maintainerEmail: "custom@example.com",
      },
    };

    const configPath = joinPath(tempDir, "deno.json");
    await writeFile(configPath, JSON.stringify(denoJson, null, 2));

    const config = await loadConfig(configPath);

    assertEquals(config.width, 80);
    assertEquals(config.maxContributors, 5);
    assertEquals(config.maintainerEmail, "custom@example.com");
    // Should derive spdxLicense from "license" field
    assertEquals(config.spdxLicense, "MIT");
  });

  it("should use defaults when no config file exists", async () => {
    // loadConfig will fall back to defaults when no file found
    const config = await loadConfig(joinPath(tempDir, "nonexistent.json"));

    assertEquals(config.width, DEFAULT_CONFIG.width);
    assertEquals(config.maxContributors, DEFAULT_CONFIG.maxContributors);
    assertEquals(config.separatorChar, DEFAULT_CONFIG.separatorChar);
  });

  it("should merge partial config with defaults", async () => {
    const denoJson = {
      ante: {
        width: 120,
        // Other values should come from defaults
      },
    };

    const configPath = joinPath(tempDir, "deno.json");
    await writeFile(configPath, JSON.stringify(denoJson, null, 2));

    const config = await loadConfig(configPath);

    assertEquals(config.width, 120);
    assertEquals(config.separatorChar, DEFAULT_CONFIG.separatorChar);
    assertEquals(config.commentPrefix, DEFAULT_CONFIG.commentPrefix);
    assertEquals(config.nameColumn, DEFAULT_CONFIG.nameColumn);
  });
});

describe("Integration: Multiple Contributors", () => {
  it("should handle multiple contributors in a header", () => {
    const config = resolveConfig({
      spdxLicense: "MPL-2.0",
      licenseUrl: "https://mozilla.org/MPL/2.0",
      maintainerEmail: "team@example.com",
      maxContributors: 5,
    });

    const contributors = [
      { name: "Alice", email: "alice@example.com" },
      { name: "Bob", email: "bob@example.com" },
      { name: "Charlie", email: "charlie@example.com" },
    ];

    const header = generateHeader(config, contributors, 2023, 2025);

    // All contributors should be present
    assertEquals(header.includes("alice@example.com"), true);
    assertEquals(header.includes("bob@example.com"), true);
    assertEquals(header.includes("charlie@example.com"), true);

    // First contributor should have the year
    assertEquals(header.includes("Copyright (c) 2023-2025"), true);

    // Parse it back
    const parsed = parseHeader(header + "\n\nexport const x = 1;");
    assertExists(parsed);
    assertEquals(parsed.contributors.length, 3);
    assertEquals(parsed.yearStart, 2023);
    assertEquals(parsed.yearEnd, 2025);
  });

  it("should respect maxContributors limit", () => {
    const config = resolveConfig({
      spdxLicense: "MIT",
      licenseUrl: "https://opensource.org/licenses/MIT",
      maintainerEmail: "team@example.com",
      maxContributors: 2,
    });

    const contributors = [
      { name: "First", email: "first@example.com" },
      { name: "Second", email: "second@example.com" },
      { name: "Third", email: "third@example.com" },
      { name: "Fourth", email: "fourth@example.com" },
    ];

    const header = generateHeader(config, contributors, 2025);

    // Only first 2 should be present
    assertEquals(header.includes("first@example.com"), true);
    assertEquals(header.includes("second@example.com"), true);
    assertEquals(header.includes("third@example.com"), false);
    assertEquals(header.includes("fourth@example.com"), false);
  });
});

describe("Integration: Year Handling", () => {
  it("should use single year when start and end are the same", () => {
    const config = resolveConfig({
      spdxLicense: "MIT",
      licenseUrl: "https://opensource.org/licenses/MIT",
      maintainerEmail: "test@example.com",
    });

    const contributors = [{ name: "Author", email: "author@example.com" }];
    const header = generateHeader(config, contributors, 2025, 2025);

    assertEquals(header.includes("Copyright (c) 2025 "), true);
    assertEquals(header.includes("2025-2025"), false);
  });

  it("should use year range when years differ", () => {
    const config = resolveConfig({
      spdxLicense: "MIT",
      licenseUrl: "https://opensource.org/licenses/MIT",
      maintainerEmail: "test@example.com",
    });

    const contributors = [{ name: "Author", email: "author@example.com" }];
    const header = generateHeader(config, contributors, 2020, 2025);

    assertEquals(header.includes("Copyright (c) 2020-2025"), true);
  });

  it("should update year range when modifying existing header", () => {
    const config = resolveConfig({
      spdxLicense: "MPL-2.0",
      licenseUrl: "https://mozilla.org/MPL/2.0",
      maintainerEmail: "test@example.com",
    });

    const existingContent =
      `//----------------------------------------------------------------------------------------------------
// Copyright (c) 2020                    author                      author@example.com
// SPDX-License-Identifier: MPL-2.0      https://mozilla.org/MPL/2.0 test@example.com
//----------------------------------------------------------------------------------------------------

export const x = 1;
`;

    const parsed = parseHeader(existingContent);
    assertExists(parsed);
    assertEquals(parsed.yearStart, 2020);
    assertEquals(parsed.yearEnd, 2020);

    const updated = updateHeader(parsed, config, { updateYear: 2025 });
    assertEquals(updated.includes("2020-2025"), true);
  });
});
