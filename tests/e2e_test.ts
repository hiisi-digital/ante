//----------------------------------------------------------------------------------------------------
// Copyright (c) 2025                    orgrinrt                    orgrinrt@ikiuni.dev
//                                      orgrinrt                 ort@hiisi.digital
// SPDX-License-Identifier: MPL-2.0      https://mozilla.org/MPL/2.0 contact@hiisi.digital
//----------------------------------------------------------------------------------------------------

/**
 * End-to-end integration tests for ante.
 *
 * These tests simulate a real-world project environment:
 * - A directory structure with various source files
 * - A proper deno.json configuration
 * - A git repository with history
 * - Running the actual CLI commands
 * - Comparing file contents against expected results
 */

import { assertEquals, assertStringIncludes } from "@std/assert";
import { join } from "@std/path";
import { afterEach, beforeEach, describe, it } from "@std/testing/bdd";
import { main as cliMain } from "../cli/mod.ts";

/**
 * Test environment representing a simulated project.
 */
interface TestEnvironment {
  /** Root directory of the test project */
  rootDir: string;
  /** Original working directory to restore after tests */
  originalCwd: string;
}

/**
 * Creates a temporary directory for the test environment.
 */
async function createTempDir(prefix: string): Promise<string> {
  return await Deno.makeTempDir({ prefix });
}

/**
 * Removes a directory recursively.
 */
async function removeDir(path: string): Promise<void> {
  try {
    await Deno.remove(path, { recursive: true });
  } catch {
    // Ignore errors during cleanup
  }
}

/**
 * Writes a file, creating parent directories as needed.
 */
async function writeFile(path: string, content: string): Promise<void> {
  const dir = path.substring(0, path.lastIndexOf("/"));
  if (dir) {
    await Deno.mkdir(dir, { recursive: true });
  }
  await Deno.writeTextFile(path, content);
}

/**
 * Reads a file and returns its content.
 */
async function readFile(path: string): Promise<string> {
  return await Deno.readTextFile(path);
}

/**
 * Runs a shell command and returns the result.
 */
async function runCommand(
  cmd: string[],
  cwd?: string,
): Promise<{ success: boolean; stdout: string; stderr: string }> {
  const command = new Deno.Command(cmd[0], {
    args: cmd.slice(1),
    cwd,
    stdout: "piped",
    stderr: "piped",
  });

  const output = await command.output();
  return {
    success: output.success,
    stdout: new TextDecoder().decode(output.stdout),
    stderr: new TextDecoder().decode(output.stderr),
  };
}

/**
 * Initializes a git repository in the given directory.
 */
async function initGitRepo(dir: string): Promise<void> {
  await runCommand(["git", "init"], dir);
  await runCommand(["git", "config", "user.name", "Test Author"], dir);
  await runCommand(["git", "config", "user.email", "test@example.com"], dir);
}

/**
 * Creates a git commit with the given message.
 */
async function gitCommit(dir: string, message: string): Promise<void> {
  await runCommand(["git", "add", "."], dir);
  await runCommand(["git", "commit", "-m", message, "--allow-empty"], dir);
}

// ============================================================================
// Test Configuration
// ============================================================================

/**
 * deno.json configuration for the test project.
 */
const TEST_DENO_JSON = {
  name: "@test/example-project",
  version: "1.0.0",
  license: "MIT",
  ante: {
    width: 100,
    maxContributors: 3,
    spdxLicense: "MIT",
    licenseUrl: "https://opensource.org/licenses/MIT",
    maintainerEmail: "maintainer@example.com",
    include: ["**/*.ts", "**/*.tsx", "**/*.js"],
    exclude: ["**/node_modules/**", "**/dist/**", "**/*.test.ts"],
  },
};

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Sets up a basic test environment.
 */
async function setupBasicEnvironment(): Promise<TestEnvironment> {
  const rootDir = await createTempDir("ante_e2e_");
  const originalCwd = Deno.cwd();

  // Create deno.json
  await writeFile(
    join(rootDir, "deno.json"),
    JSON.stringify(TEST_DENO_JSON, null, 2),
  );

  // Initialize git repository
  await initGitRepo(rootDir);

  // Change to test directory
  Deno.chdir(rootDir);

  return { rootDir, originalCwd };
}

/**
 * Tears down the test environment.
 */
async function teardownEnvironment(env: TestEnvironment): Promise<void> {
  // Restore original working directory
  Deno.chdir(env.originalCwd);

  // Clean up temp directory
  await removeDir(env.rootDir);
}

/**
 * Captures console output during a function call.
 */
async function captureOutput(
  fn: () => Promise<number>,
): Promise<{ exitCode: number; output: string[] }> {
  const output: string[] = [];
  const originalLog = console.log;
  const originalError = console.error;

  console.log = (...args: unknown[]) => {
    output.push(args.map(String).join(" "));
  };
  console.error = (...args: unknown[]) => {
    output.push(`[ERROR] ${args.map(String).join(" ")}`);
  };

  try {
    const exitCode = await fn();
    return { exitCode, output };
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }
}

// ============================================================================
// Tests: Check Command
// ============================================================================

describe("E2E: ante check", () => {
  let env: TestEnvironment;

  beforeEach(async () => {
    env = await setupBasicEnvironment();
  });

  afterEach(async () => {
    await teardownEnvironment(env);
  });

  it("should detect files without headers", async () => {
    // Create a file without header
    await writeFile(
      join(env.rootDir, "src/utils.ts"),
      `export function formatDate(date: Date): string {\n  return date.toISOString();\n}\n`,
    );
    await gitCommit(env.rootDir, "Add utils");

    const { exitCode, output } = await captureOutput(
      () => cliMain(["check", "src/utils.ts"]),
    );

    assertEquals(exitCode, 1);
    const outputStr = output.join("\n");
    assertStringIncludes(outputStr, "fail");
  });

  it("should pass files with valid headers", async () => {
    // Create a file with correct header
    await writeFile(
      join(env.rootDir, "src/main.ts"),
      `//----------------------------------------------------------------------------------------------------
// Copyright (c) 2025                    Test Author                 test@example.com
// SPDX-License-Identifier: MIT          https://opensource.org/licenses/MIT maintainer@example.com
//----------------------------------------------------------------------------------------------------

export const main = () => console.log("hello");
`,
    );
    await gitCommit(env.rootDir, "Add main");

    const { exitCode, output } = await captureOutput(
      () => cliMain(["check", "src/main.ts"]),
    );

    assertEquals(exitCode, 0);
    const outputStr = output.join("\n");
    assertStringIncludes(outputStr, "Passed: 1");
  });

  it("should detect license mismatches", async () => {
    // Create a file with wrong license
    await writeFile(
      join(env.rootDir, "src/wrong.ts"),
      `//----------------------------------------------------------------------------------------------------
// Copyright (c) 2025                    Author                      author@example.com
// SPDX-License-Identifier: GPL-3.0      https://gnu.org/licenses/gpl-3.0 gpl@example.com
//----------------------------------------------------------------------------------------------------

export const wrong = true;
`,
    );
    await gitCommit(env.rootDir, "Add wrong license file");

    const { exitCode, output } = await captureOutput(
      () => cliMain(["check", "src/wrong.ts"]),
    );

    assertEquals(exitCode, 1);
    const outputStr = output.join("\n");
    assertStringIncludes(outputStr, "fail");
  });

  it("should report summary statistics", async () => {
    // Create a couple of files
    await writeFile(
      join(env.rootDir, "src/a.ts"),
      `export const a = 1;\n`,
    );
    await writeFile(
      join(env.rootDir, "src/b.ts"),
      `export const b = 2;\n`,
    );
    await gitCommit(env.rootDir, "Add files");

    const { output } = await captureOutput(
      () => cliMain(["check"]),
    );

    const outputStr = output.join("\n");
    assertStringIncludes(outputStr, "Checked");
    assertStringIncludes(outputStr, "Passed:");
    assertStringIncludes(outputStr, "Failed:");
  });
});

// ============================================================================
// Tests: Fix Command
// ============================================================================

describe("E2E: ante fix", () => {
  let env: TestEnvironment;

  beforeEach(async () => {
    env = await setupBasicEnvironment();
  });

  afterEach(async () => {
    await teardownEnvironment(env);
  });

  it("should add headers in dry-run mode without modifying files", async () => {
    const originalContent = `export function hello(): string {\n  return "world";\n}\n`;
    await writeFile(join(env.rootDir, "src/hello.ts"), originalContent);
    await gitCommit(env.rootDir, "Add hello");

    const { exitCode, output } = await captureOutput(
      () => cliMain(["fix", "src/hello.ts", "--dry-run", "--verbose"]),
    );

    assertEquals(exitCode, 0);
    const outputStr = output.join("\n");
    assertStringIncludes(outputStr, "Created");

    // File should be unchanged in dry-run mode
    const afterContent = await readFile(join(env.rootDir, "src/hello.ts"));
    assertEquals(afterContent, originalContent);
  });

  it("should actually add headers when not in dry-run mode", async () => {
    await writeFile(
      join(env.rootDir, "src/utils.ts"),
      `export function capitalize(str: string): string {\n  return str.toUpperCase();\n}\n`,
    );
    await gitCommit(env.rootDir, "Add utils");

    const { exitCode } = await captureOutput(
      () => cliMain(["fix", "src/utils.ts"]),
    );

    assertEquals(exitCode, 0);

    // File should now have a header
    const content = await readFile(join(env.rootDir, "src/utils.ts"));
    assertStringIncludes(content, "Copyright (c)");
    assertStringIncludes(content, "SPDX-License-Identifier: MIT");
    assertStringIncludes(content, "maintainer@example.com");

    // Original code should still be present
    assertStringIncludes(content, "export function capitalize");
  });

  it("should preserve existing code when adding headers", async () => {
    await writeFile(
      join(env.rootDir, "src/complex.ts"),
      `interface User {
  id: string;
  name: string;
}

export function getUser(id: string): User {
  return { id, name: "test" };
}
`,
    );
    await gitCommit(env.rootDir, "Add complex file");

    await cliMain(["fix", "src/complex.ts"]);

    const content = await readFile(join(env.rootDir, "src/complex.ts"));

    // Header should be present
    assertStringIncludes(content, "SPDX-License-Identifier: MIT");

    // All original code should be preserved
    assertStringIncludes(content, "interface User");
    assertStringIncludes(content, "export function getUser");
  });

  it("should report fix statistics", async () => {
    await writeFile(join(env.rootDir, "src/a.ts"), `export const a = 1;\n`);
    await writeFile(join(env.rootDir, "src/b.ts"), `export const b = 2;\n`);
    await gitCommit(env.rootDir, "Add files");

    const { output } = await captureOutput(
      () => cliMain(["fix", "--verbose"]),
    );

    const outputStr = output.join("\n");
    assertStringIncludes(outputStr, "Processed");
  });
});

// ============================================================================
// Tests: Add Command
// ============================================================================

describe("E2E: ante add", () => {
  let env: TestEnvironment;

  beforeEach(async () => {
    env = await setupBasicEnvironment();
  });

  afterEach(async () => {
    await teardownEnvironment(env);
  });

  it("should add header to a specific file", async () => {
    await writeFile(
      join(env.rootDir, "src/feature.ts"),
      `export const feature = () => "hello";\n`,
    );
    await gitCommit(env.rootDir, "Add feature");

    const { exitCode } = await captureOutput(
      () => cliMain(["add", "src/feature.ts"]),
    );

    assertEquals(exitCode, 0);

    const content = await readFile(join(env.rootDir, "src/feature.ts"));
    assertStringIncludes(content, "SPDX-License-Identifier: MIT");
    assertStringIncludes(content, "export const feature");
  });

  it("should require a file path", async () => {
    const { exitCode, output } = await captureOutput(
      () => cliMain(["add"]),
    );

    assertEquals(exitCode, 1);
    const outputStr = output.join("\n");
    assertStringIncludes(outputStr, "requires a file path");
  });
});

// ============================================================================
// Tests: Full Workflow
// ============================================================================

describe("E2E: Full workflow", () => {
  let env: TestEnvironment;

  beforeEach(async () => {
    env = await setupBasicEnvironment();
  });

  afterEach(async () => {
    await teardownEnvironment(env);
  });

  it("should handle a complete fix -> check cycle", async () => {
    // Create a file without header
    await writeFile(
      join(env.rootDir, "src/workflow.ts"),
      `export function workflowTest(): boolean {\n  return true;\n}\n`,
    );
    await gitCommit(env.rootDir, "Add workflow test file");

    // Initial check should fail
    const check1 = await captureOutput(
      () => cliMain(["check", "src/workflow.ts"]),
    );
    assertEquals(check1.exitCode, 1, "Initial check should fail");

    // Fix the file
    const fix = await captureOutput(
      () => cliMain(["fix", "src/workflow.ts"]),
    );
    assertEquals(fix.exitCode, 0, "Fix should succeed");

    // Verify file was modified
    const content = await readFile(join(env.rootDir, "src/workflow.ts"));
    assertStringIncludes(content, "SPDX-License-Identifier: MIT");

    // Check should now pass
    const check2 = await captureOutput(
      () => cliMain(["check", "src/workflow.ts"]),
    );
    assertEquals(check2.exitCode, 0, "Check after fix should pass");
  });
});

// ============================================================================
// Tests: Header Content Verification
// ============================================================================

describe("E2E: Header Content Verification", () => {
  let env: TestEnvironment;

  beforeEach(async () => {
    env = await setupBasicEnvironment();
  });

  afterEach(async () => {
    await teardownEnvironment(env);
  });

  it("should generate headers with correct column alignment", async () => {
    await writeFile(join(env.rootDir, "src/align.ts"), `export const x = 1;\n`);
    await gitCommit(env.rootDir, "Add align test");

    await cliMain(["fix", "src/align.ts"]);

    const content = await readFile(join(env.rootDir, "src/align.ts"));
    const lines = content.split("\n");

    // Header separator lines should be exactly 100 characters (as configured)
    const separatorLines = lines.filter((line) => /^\/\/-+$/.test(line));
    for (const line of separatorLines) {
      assertEquals(
        line.length,
        100,
        `Separator line should be 100 chars: "${line}" (was ${line.length})`,
      );
    }
  });

  it("should include correct license information", async () => {
    await writeFile(join(env.rootDir, "src/license.ts"), `export const y = 2;\n`);
    await gitCommit(env.rootDir, "Add license test");

    await cliMain(["fix", "src/license.ts"]);

    const content = await readFile(join(env.rootDir, "src/license.ts"));

    assertStringIncludes(content, "SPDX-License-Identifier: MIT");
    assertStringIncludes(content, "https://opensource.org/licenses/MIT");
    assertStringIncludes(content, "maintainer@example.com");
  });

  it("should include contributor information from git", async () => {
    await writeFile(join(env.rootDir, "src/contributor.ts"), `export const z = 3;\n`);
    await gitCommit(env.rootDir, "Add contributor test");

    await cliMain(["fix", "src/contributor.ts"]);

    const content = await readFile(join(env.rootDir, "src/contributor.ts"));

    // Should include git user (configured as "Test Author")
    assertStringIncludes(content, "Test Author");
    assertStringIncludes(content, "test@example.com");
  });

  it("should include current year in new headers", async () => {
    await writeFile(join(env.rootDir, "src/year.ts"), `export const w = 4;\n`);
    await gitCommit(env.rootDir, "Add year test");

    await cliMain(["fix", "src/year.ts"]);

    const content = await readFile(join(env.rootDir, "src/year.ts"));
    const currentYear = new Date().getFullYear().toString();

    assertStringIncludes(content, `Copyright (c) ${currentYear}`);
  });
});

// ============================================================================
// Tests: Edge Cases
// ============================================================================

describe("E2E: Edge Cases", () => {
  let env: TestEnvironment;

  beforeEach(async () => {
    env = await setupBasicEnvironment();
  });

  afterEach(async () => {
    await teardownEnvironment(env);
  });

  it("should handle empty files", async () => {
    await writeFile(join(env.rootDir, "src/empty.ts"), "");
    await gitCommit(env.rootDir, "Add empty file");

    const { exitCode } = await captureOutput(
      () => cliMain(["fix", "src/empty.ts"]),
    );

    assertEquals(exitCode, 0);

    const content = await readFile(join(env.rootDir, "src/empty.ts"));
    assertStringIncludes(content, "SPDX-License-Identifier");
  });

  it("should handle files with only comments", async () => {
    await writeFile(
      join(env.rootDir, "src/comments.ts"),
      `// Just a comment\n// Another comment\n`,
    );
    await gitCommit(env.rootDir, "Add comments only file");

    const { exitCode } = await captureOutput(
      () => cliMain(["fix", "src/comments.ts"]),
    );

    assertEquals(exitCode, 0);

    const content = await readFile(join(env.rootDir, "src/comments.ts"));
    assertStringIncludes(content, "SPDX-License-Identifier");
    assertStringIncludes(content, "// Just a comment");
  });

  it("should handle files with shebang", async () => {
    await writeFile(
      join(env.rootDir, "scripts/cli.js"),
      `#!/usr/bin/env node\nconsole.log("hello");\n`,
    );
    await gitCommit(env.rootDir, "Add shebang file");

    const { exitCode } = await captureOutput(
      () => cliMain(["fix", "scripts/cli.js"]),
    );

    assertEquals(exitCode, 0);

    const content = await readFile(join(env.rootDir, "scripts/cli.js"));
    const lines = content.split("\n");

    // Shebang should be preserved at the top
    assertEquals(lines[0], "#!/usr/bin/env node");
    // Header should be after shebang
    assertStringIncludes(content, "SPDX-License-Identifier");
  });

  it("should handle deeply nested files", async () => {
    await writeFile(
      join(env.rootDir, "src/deep/nested/path/to/file.ts"),
      `export const deep = true;\n`,
    );
    await gitCommit(env.rootDir, "Add deep file");

    const { exitCode } = await captureOutput(
      () => cliMain(["fix", "src/deep/nested/path/to/file.ts"]),
    );

    assertEquals(exitCode, 0);

    const content = await readFile(join(env.rootDir, "src/deep/nested/path/to/file.ts"));
    assertStringIncludes(content, "SPDX-License-Identifier");
    assertStringIncludes(content, "export const deep");
  });

  it("should handle files with unicode content", async () => {
    const unicodeContent =
      `export const emoji = "\u{1f389}";\nexport const japanese = "\u{65e5}\u{672c}\u{8a9e}";\n`;
    await writeFile(join(env.rootDir, "src/unicode.ts"), unicodeContent);
    await gitCommit(env.rootDir, "Add unicode file");

    const { exitCode } = await captureOutput(
      () => cliMain(["fix", "src/unicode.ts"]),
    );

    assertEquals(exitCode, 0);

    const content = await readFile(join(env.rootDir, "src/unicode.ts"));
    assertStringIncludes(content, "\u{1f389}");
    assertStringIncludes(content, "\u{65e5}\u{672c}\u{8a9e}");
    assertStringIncludes(content, "SPDX-License-Identifier");
  });

  it("should handle long contributor names", async () => {
    // Temporarily change git user to a long name
    await runCommand(
      ["git", "config", "user.name", "Alexander Bartholomew Constantine III"],
      env.rootDir,
    );
    await runCommand(
      ["git", "config", "user.email", "alexander@very-long-domain.example.com"],
      env.rootDir,
    );

    await writeFile(join(env.rootDir, "src/longname.ts"), `export const x = 1;\n`);
    await gitCommit(env.rootDir, "Add long name file");

    const { exitCode } = await captureOutput(
      () => cliMain(["fix", "src/longname.ts"]),
    );

    assertEquals(exitCode, 0);

    const content = await readFile(join(env.rootDir, "src/longname.ts"));
    assertStringIncludes(content, "SPDX-License-Identifier");
  });
});

// ============================================================================
// Tests: CLI Options
// ============================================================================

describe("E2E: CLI Options", () => {
  let env: TestEnvironment;

  beforeEach(async () => {
    env = await setupBasicEnvironment();
  });

  afterEach(async () => {
    await teardownEnvironment(env);
  });

  it("should show version with --version", async () => {
    const { exitCode, output } = await captureOutput(
      () => cliMain(["--version"]),
    );

    assertEquals(exitCode, 0);
    const outputStr = output.join("\n");
    assertStringIncludes(outputStr, "ante v");
  });

  it("should show help with --help", async () => {
    const { exitCode, output } = await captureOutput(
      () => cliMain(["--help"]),
    );

    assertEquals(exitCode, 0);
    const outputStr = output.join("\n");
    assertStringIncludes(outputStr, "ante");
    assertStringIncludes(outputStr, "COMMANDS");
    assertStringIncludes(outputStr, "check");
    assertStringIncludes(outputStr, "fix");
    assertStringIncludes(outputStr, "add");
    assertStringIncludes(outputStr, "init");
  });

  it("should output JSON format with --format json", async () => {
    // Create a file with a valid header for JSON output test
    await writeFile(
      join(env.rootDir, "src/json.ts"),
      `//----------------------------------------------------------------------------------------------------
// Copyright (c) 2025                    Test Author                 test@example.com
// SPDX-License-Identifier: MIT          https://opensource.org/licenses/MIT maintainer@example.com
//----------------------------------------------------------------------------------------------------

export const json = true;
`,
    );
    await gitCommit(env.rootDir, "Add json test file");

    const { exitCode, output } = await captureOutput(
      () => cliMain(["check", "src/json.ts", "--format", "json"]),
    );

    assertEquals(exitCode, 0);
    const outputStr = output.join("\n");

    // Should be valid JSON
    const parsed = JSON.parse(outputStr);
    assertEquals(typeof parsed.totalFiles, "number");
    assertEquals(typeof parsed.passedFiles, "number");
    assertEquals(typeof parsed.failedFiles, "number");
    assertEquals(Array.isArray(parsed.files), true);
  });

  it("should show verbose output with -v", async () => {
    await writeFile(join(env.rootDir, "src/verbose.ts"), `export const v = 1;\n`);
    await gitCommit(env.rootDir, "Add verbose test file");

    const { output } = await captureOutput(
      () => cliMain(["check", "-v"]),
    );

    const outputStr = output.join("\n");
    // Verbose mode should show individual file results
    assertStringIncludes(outputStr, "Found");
    assertStringIncludes(outputStr, "file");
  });
});

// ============================================================================
// Tests: Configuration Handling
// ============================================================================

describe("E2E: Configuration Handling", () => {
  let env: TestEnvironment;

  beforeEach(async () => {
    env = await setupBasicEnvironment();
  });

  afterEach(async () => {
    await teardownEnvironment(env);
  });

  it("should respect custom width from config", async () => {
    await writeFile(join(env.rootDir, "src/width.ts"), `export const a = 1;\n`);
    await gitCommit(env.rootDir, "Add width test file");

    await cliMain(["fix", "src/width.ts"]);

    const content = await readFile(join(env.rootDir, "src/width.ts"));
    const lines = content.split("\n");
    const separatorLine = lines.find((l) => /^\/\/-+$/.test(l));

    if (separatorLine) {
      // Should match configured width of 100
      assertEquals(separatorLine.length, 100);
    }
  });

  it("should respect include patterns from config", async () => {
    // Create a .rs file which should NOT be included
    await writeFile(join(env.rootDir, "src/rust.rs"), `fn main() {}\n`);
    // Create a .ts file which should be included
    await writeFile(join(env.rootDir, "src/included.ts"), `export const x = 1;\n`);
    await gitCommit(env.rootDir, "Add files");

    const { output } = await captureOutput(
      () => cliMain(["check", "--verbose"]),
    );

    const outputStr = output.join("\n");

    // .ts files should be checked
    assertStringIncludes(outputStr, "included.ts");
    // .rs files should not be checked (not in include patterns)
    assertEquals(outputStr.includes("rust.rs"), false);
  });
});

// ============================================================================
// Tests: Exclude Patterns
// ============================================================================

describe("E2E: Exclude Patterns", () => {
  let env: TestEnvironment;

  beforeEach(async () => {
    env = await setupBasicEnvironment();
  });

  afterEach(async () => {
    await teardownEnvironment(env);
  });

  it("should exclude test files matching *.test.ts pattern", async () => {
    // Create a test file (should be excluded)
    await writeFile(
      join(env.rootDir, "src/utils.test.ts"),
      `import { assertEquals } from "@std/assert";\nDeno.test("test", () => {});\n`,
    );
    // Create a regular file (should be included)
    await writeFile(
      join(env.rootDir, "src/utils.ts"),
      `export const x = 1;\n`,
    );
    await gitCommit(env.rootDir, "Add files");

    const { output } = await captureOutput(
      () => cliMain(["check", "--verbose"]),
    );

    // Regular file should be in output
    // Test file with .test.ts should not be processed
    // We can verify by checking that the test file is not mentioned in failure/success list
    const lines = output.filter((line) =>
      line.includes("utils.test.ts") && (line.includes("[ok]") || line.includes("[fail]"))
    );
    assertEquals(lines.length, 0, "Test files should not be checked");
  });

  it("should exclude dist directory", async () => {
    // Create a file in dist (should be excluded)
    await writeFile(
      join(env.rootDir, "dist/bundle.js"),
      `console.log("bundled");\n`,
    );
    // Create a regular file (should be included)
    await writeFile(
      join(env.rootDir, "src/app.ts"),
      `export const app = true;\n`,
    );
    await gitCommit(env.rootDir, "Add files");

    const { output } = await captureOutput(
      () => cliMain(["check", "--verbose"]),
    );

    // dist files should not be processed
    const distLines = output.filter((line) =>
      line.includes("dist/bundle.js") && (line.includes("[ok]") || line.includes("[fail]"))
    );
    assertEquals(distLines.length, 0, "dist files should not be checked");
  });
});
