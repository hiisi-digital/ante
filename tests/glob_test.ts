//----------------------------------------------------------------------------------------------------
// Copyright (c) 2025                    orgrinrt                    orgrinrt@ikiuni.dev
//                                      orgrinrt                 ort@hiisi.digital
// SPDX-License-Identifier: MPL-2.0      https://mozilla.org/MPL/2.0 contact@hiisi.digital
//----------------------------------------------------------------------------------------------------

/**
 * Unit tests for glob pattern matching.
 *
 * Tests the matchesGlob function with various glob patterns to ensure
 * correct behavior across all expected syntaxes.
 */

import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { filterPaths, globToRegex, matchesAnyGlob, matchesGlob } from "../core/glob.ts";

describe("matchesGlob", () => {
  describe("single asterisk patterns", () => {
    it("should match files in the current directory", () => {
      assertEquals(matchesGlob("test.ts", "*.ts"), true);
      assertEquals(matchesGlob("file.js", "*.js"), true);
      assertEquals(matchesGlob("readme.md", "*.md"), true);
    });

    it("should not match files in subdirectories with single asterisk", () => {
      assertEquals(matchesGlob("src/test.ts", "*.ts"), false);
      assertEquals(matchesGlob("lib/file.js", "*.js"), false);
    });

    it("should match partial filenames", () => {
      assertEquals(matchesGlob("utils.test.ts", "*.test.ts"), true);
      assertEquals(matchesGlob("app.spec.js", "*.spec.js"), true);
      assertEquals(matchesGlob("config.prod.json", "*.prod.json"), true);
    });

    it("should match with asterisk in the middle", () => {
      assertEquals(matchesGlob("test_utils.ts", "test_*.ts"), true);
      assertEquals(matchesGlob("test_helper.ts", "test_*.ts"), true);
      assertEquals(matchesGlob("helper.ts", "test_*.ts"), false);
    });

    it("should not match path separators with single asterisk", () => {
      assertEquals(matchesGlob("a/b.ts", "a*.ts"), false);
      assertEquals(matchesGlob("ab/c.ts", "a*c.ts"), false);
    });
  });

  describe("double asterisk (globstar) patterns", () => {
    it("should match files at any depth with prefix globstar", () => {
      assertEquals(matchesGlob("file.ts", "**/*.ts"), true);
      assertEquals(matchesGlob("src/file.ts", "**/*.ts"), true);
      assertEquals(matchesGlob("src/lib/file.ts", "**/*.ts"), true);
      assertEquals(matchesGlob("a/b/c/d/file.ts", "**/*.ts"), true);
    });

    it("should match directories at any depth", () => {
      assertEquals(matchesGlob("dist/bundle.js", "**/dist/**"), true);
      assertEquals(matchesGlob("foo/dist/bar.js", "**/dist/**"), true);
      assertEquals(matchesGlob("a/b/dist/c/d.js", "**/dist/**"), true);
    });

    it("should match with globstar at the end", () => {
      assertEquals(matchesGlob("src/file.ts", "src/**"), true);
      assertEquals(matchesGlob("src/lib/file.ts", "src/**"), true);
      // Note: "src/**" matches files under src, not src itself
      // This is standard glob behavior
      assertEquals(matchesGlob("src", "src/**"), false);
    });

    it("should match node_modules patterns", () => {
      assertEquals(
        matchesGlob("node_modules/pkg/index.ts", "**/node_modules/**"),
        true,
      );
      assertEquals(
        matchesGlob("foo/node_modules/bar/baz.js", "**/node_modules/**"),
        true,
      );
      assertEquals(matchesGlob("src/file.ts", "**/node_modules/**"), false);
    });

    it("should match test file patterns", () => {
      assertEquals(matchesGlob("test.test.ts", "**/*.test.ts"), true);
      assertEquals(matchesGlob("src/utils.test.ts", "**/*.test.ts"), true);
      assertEquals(
        matchesGlob("src/lib/helper.test.ts", "**/*.test.ts"),
        true,
      );
      assertEquals(matchesGlob("src/utils.ts", "**/*.test.ts"), false);
    });
  });

  describe("question mark patterns", () => {
    it("should match single character", () => {
      assertEquals(matchesGlob("a.ts", "?.ts"), true);
      assertEquals(matchesGlob("b.ts", "?.ts"), true);
      assertEquals(matchesGlob("ab.ts", "?.ts"), false);
    });

    it("should match specific positions", () => {
      assertEquals(matchesGlob("file1.ts", "file?.ts"), true);
      assertEquals(matchesGlob("file2.ts", "file?.ts"), true);
      assertEquals(matchesGlob("file10.ts", "file?.ts"), false);
    });

    it("should not match path separators", () => {
      assertEquals(matchesGlob("a/b.ts", "?/b.ts"), true);
      assertEquals(matchesGlob("a.ts", "?/?.ts"), false);
    });
  });

  describe("combined patterns", () => {
    it("should handle multiple asterisks in one pattern", () => {
      assertEquals(matchesGlob("src/lib/utils.ts", "src/*/*.ts"), true);
      assertEquals(matchesGlob("src/utils.ts", "src/*/*.ts"), false);
      assertEquals(matchesGlob("src/a/b/utils.ts", "src/*/*.ts"), false);
    });

    it("should handle globstar with specific directory", () => {
      assertEquals(matchesGlob("src/components/Button.tsx", "src/**/*.tsx"), true);
      assertEquals(matchesGlob("lib/components/Button.tsx", "src/**/*.tsx"), false);
    });

    it("should handle asterisk and question mark together", () => {
      assertEquals(matchesGlob("test1.spec.ts", "test?.*.ts"), true);
      assertEquals(matchesGlob("testA.spec.ts", "test?.*.ts"), true);
      assertEquals(matchesGlob("test12.spec.ts", "test?.*.ts"), false);
    });
  });

  describe("edge cases", () => {
    it("should handle empty pattern", () => {
      assertEquals(matchesGlob("", ""), true);
      assertEquals(matchesGlob("file.ts", ""), false);
    });

    it("should handle exact matches", () => {
      assertEquals(matchesGlob("file.ts", "file.ts"), true);
      assertEquals(matchesGlob("src/file.ts", "src/file.ts"), true);
      assertEquals(matchesGlob("file.ts", "other.ts"), false);
    });

    it("should handle patterns with special regex characters", () => {
      assertEquals(matchesGlob("file.ts", "file.ts"), true);
      assertEquals(matchesGlob("file(1).ts", "file(1).ts"), true);
      assertEquals(matchesGlob("file[0].ts", "file[0].ts"), true);
      assertEquals(matchesGlob("file+name.ts", "file+name.ts"), true);
    });

    it("should handle patterns starting with dot", () => {
      assertEquals(matchesGlob(".gitignore", ".*"), true);
      assertEquals(matchesGlob(".eslintrc.js", ".*.js"), true);
      assertEquals(matchesGlob("src/.hidden", "**/.hidden"), true);
    });

    it("should handle root-relative paths", () => {
      assertEquals(matchesGlob("./src/file.ts", "./**/*.ts"), true);
      assertEquals(matchesGlob("./file.ts", "./*.ts"), true);
    });
  });

  describe("common real-world patterns", () => {
    it("should match TypeScript source files", () => {
      const pattern = "**/*.ts";
      assertEquals(matchesGlob("index.ts", pattern), true);
      assertEquals(matchesGlob("src/index.ts", pattern), true);
      assertEquals(matchesGlob("src/lib/utils.ts", pattern), true);
      assertEquals(matchesGlob("index.js", pattern), false);
    });

    it("should match TSX files", () => {
      const pattern = "**/*.tsx";
      assertEquals(matchesGlob("App.tsx", pattern), true);
      assertEquals(matchesGlob("src/components/Button.tsx", pattern), true);
      assertEquals(matchesGlob("src/App.ts", pattern), false);
    });

    it("should match JavaScript files", () => {
      const pattern = "**/*.js";
      assertEquals(matchesGlob("index.js", pattern), true);
      assertEquals(matchesGlob("dist/bundle.js", pattern), true);
      assertEquals(matchesGlob("index.ts", pattern), false);
    });

    it("should exclude test files", () => {
      const pattern = "**/*.test.ts";
      assertEquals(matchesGlob("utils.test.ts", pattern), true);
      assertEquals(matchesGlob("src/utils.test.ts", pattern), true);
      assertEquals(matchesGlob("src/utils.ts", pattern), false);
    });

    it("should exclude spec files", () => {
      const pattern = "**/*.spec.ts";
      assertEquals(matchesGlob("utils.spec.ts", pattern), true);
      assertEquals(matchesGlob("src/utils.spec.ts", pattern), true);
      assertEquals(matchesGlob("src/utils.ts", pattern), false);
    });

    it("should exclude build directories", () => {
      const pattern = "**/dist/**";
      assertEquals(matchesGlob("dist/index.js", pattern), true);
      assertEquals(matchesGlob("dist/lib/utils.js", pattern), true);
      assertEquals(matchesGlob("packages/app/dist/bundle.js", pattern), true);
      assertEquals(matchesGlob("src/index.ts", pattern), false);
    });

    it("should exclude build output directories", () => {
      const pattern = "**/build/**";
      assertEquals(matchesGlob("build/index.js", pattern), true);
      assertEquals(matchesGlob("packages/app/build/bundle.js", pattern), true);
      assertEquals(matchesGlob("src/index.ts", pattern), false);
    });
  });
});

describe("globToRegex", () => {
  it("should return a RegExp object", () => {
    const result = globToRegex("*.ts");
    assertEquals(result instanceof RegExp, true);
  });

  it("should properly escape special regex characters", () => {
    // The dot should be escaped so it matches literal dots
    const regex = globToRegex("file.ts");
    assertEquals(regex.test("file.ts"), true);
    assertEquals(regex.test("filets"), false);
  });
});

describe("matchesAnyGlob", () => {
  it("should return true if any pattern matches", () => {
    const patterns = ["**/*.ts", "**/*.js"];
    assertEquals(matchesAnyGlob("file.ts", patterns), true);
    assertEquals(matchesAnyGlob("file.js", patterns), true);
    assertEquals(matchesAnyGlob("file.tsx", patterns), false);
  });

  it("should return false for empty patterns array", () => {
    assertEquals(matchesAnyGlob("file.ts", []), false);
  });

  it("should handle multiple complex patterns", () => {
    const patterns = ["src/**/*.ts", "lib/**/*.js", "*.json"];
    assertEquals(matchesAnyGlob("src/utils.ts", patterns), true);
    assertEquals(matchesAnyGlob("lib/helper.js", patterns), true);
    assertEquals(matchesAnyGlob("package.json", patterns), true);
    assertEquals(matchesAnyGlob("dist/bundle.js", patterns), false);
  });
});

describe("filterPaths", () => {
  const allPaths = [
    "src/index.ts",
    "src/utils.ts",
    "src/utils.test.ts",
    "lib/helper.js",
    "dist/bundle.js",
    "node_modules/pkg/index.ts",
    "package.json",
  ];

  it("should include paths matching include patterns", () => {
    const result = filterPaths(allPaths, ["**/*.ts"]);
    assertEquals(result.includes("src/index.ts"), true);
    assertEquals(result.includes("src/utils.ts"), true);
    assertEquals(result.includes("src/utils.test.ts"), true);
    assertEquals(result.includes("node_modules/pkg/index.ts"), true);
    assertEquals(result.includes("lib/helper.js"), false);
  });

  it("should exclude paths matching exclude patterns", () => {
    const result = filterPaths(
      allPaths,
      ["**/*.ts"],
      ["**/node_modules/**", "**/*.test.ts"],
    );
    assertEquals(result.includes("src/index.ts"), true);
    assertEquals(result.includes("src/utils.ts"), true);
    assertEquals(result.includes("src/utils.test.ts"), false);
    assertEquals(result.includes("node_modules/pkg/index.ts"), false);
  });

  it("should handle multiple include and exclude patterns", () => {
    const result = filterPaths(
      allPaths,
      ["**/*.ts", "**/*.js"],
      ["**/dist/**", "**/node_modules/**"],
    );
    assertEquals(result.includes("src/index.ts"), true);
    assertEquals(result.includes("lib/helper.js"), true);
    assertEquals(result.includes("dist/bundle.js"), false);
    assertEquals(result.includes("node_modules/pkg/index.ts"), false);
  });

  it("should return empty array when no paths match", () => {
    const result = filterPaths(allPaths, ["**/*.tsx"]);
    assertEquals(result.length, 0);
  });

  it("should return empty array when all paths are excluded", () => {
    const result = filterPaths(allPaths, ["**/*"], ["**/*"]);
    assertEquals(result.length, 0);
  });
});
