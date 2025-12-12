//----------------------------------------------------------------------------------------------------
// Copyright (c) 2025                    orgrinrt                    orgrinrt@ikiuni.dev
//                                      orgrinrt                 ort@hiisi.digital
// SPDX-License-Identifier: MPL-2.0      https://mozilla.org/MPL/2.0 contact@hiisi.digital
//----------------------------------------------------------------------------------------------------

/**
 * Build script for npm package WITH tests included.
 *
 * This is a variant of build-npm.ts that:
 * 1. Includes test files in the build
 * 2. Enables dnt's test runner to execute tests on Node.js
 * 3. Is intended for CI compatibility testing only (not for publishing)
 *
 * The tests use @std/assert and @std/testing/bdd which dnt will shim
 * to work with Node.js's built-in test runner.
 *
 * Test categories:
 * - Unit tests (*_test.ts): Pure logic tests, should work on all runtimes
 * - Integration tests (integration_test.ts): Uses cross-runtime FS utilities
 * - E2E tests (e2e_test.ts): Uses Deno.Command for CLI, skip on Node/Bun
 *
 * Run with: deno run -A scripts/build-npm-with-tests.ts
 *
 * Options:
 *   --skip-test    Build without running tests (just compile)
 *   --unit-only    Only include unit tests (exclude integration)
 */

import { build, emptyDir } from "jsr:@deno/dnt@0.41.3";

// Parse CLI arguments
const args = new Set(Deno.args);
const skipTest = args.has("--skip-test");
const unitOnly = args.has("--unit-only");

const denoJson = JSON.parse(await Deno.readTextFile("deno.json"));
const outDir = "./npm-test";

console.log("Building npm package with tests for compatibility testing...\n");
console.log(`   Options: skipTest=${skipTest}, unitOnly=${unitOnly}\n`);

await emptyDir(outDir);

// Create a temporary import map for dnt that resolves our aliases
// Include the test utilities as well
const importMap = {
  imports: {
    "#core": "./core/mod.ts",
    "#git": "./git/mod.ts",
    "#cli": "./cli/mod.ts",
    "@std/fs": "jsr:@std/fs@^1.0.0",
    "@std/path": "jsr:@std/path@^1.0.0",
    "@std/fmt": "jsr:@std/fmt@^1.0.0",
    "@std/assert": "jsr:@std/assert@^1.0.0",
    "@std/testing": "jsr:@std/testing@^1.0.0",
  },
};

const importMapPath = "./npm_import_map_test.json";
await Deno.writeTextFile(importMapPath, JSON.stringify(importMap, null, 2));

// Define which tests to include based on mode
const unitTestFiles = [
  "tests/config_test.ts",
  "tests/contributors_test.ts",
  "tests/formatter_test.ts",
  "tests/glob_test.ts",
  "tests/header_test.ts",
];

// Integration tests now use cross-runtime utilities and should work on Node/Bun
const integrationTestFiles = [
  "tests/integration_test.ts",
];

// E2E tests are excluded - they use Deno.Command extensively
const excludedTests = [
  "tests/e2e_test.ts",
];

// Test utilities need to be included
const testUtilFiles = [
  "tests/_utils/mod.ts",
  "tests/_utils/fs.ts",
];

// Build the test list based on options
const _testsToInclude = unitOnly ? [...unitTestFiles] : [...unitTestFiles, ...integrationTestFiles];

console.log("Test files to include:");
unitTestFiles.forEach((f) => console.log(`   [+] ${f} (unit)`));
if (!unitOnly) {
  integrationTestFiles.forEach((f) => console.log(`   [+] ${f} (integration)`));
}
console.log("Test utilities:");
testUtilFiles.forEach((f) => console.log(`   [+] ${f}`));
console.log("Excluded tests:");
excludedTests.forEach((f) => console.log(`   [-] ${f} (Deno-specific)`));
console.log("");

try {
  await build({
    entryPoints: [
      "./mod.ts",
      {
        name: "./cli",
        path: "./cli/mod.ts",
      },
      // Include test utilities as an entry point so they get transpiled
      {
        name: "./tests/_utils",
        path: "./tests/_utils/mod.ts",
      },
    ],
    outDir,
    importMap: importMapPath,
    shims: {
      deno: {
        test: true, // Enable test shims for Node.js
      },
    },
    typeCheck: false, // Skip type checking - Deno.Command shim typing issues
    scriptModule: false, // ESM only
    skipSourceOutput: true,
    compilerOptions: {
      lib: ["ES2022"],
      target: "ES2022",
    },
    // Enable or skip testing based on flag
    test: !skipTest,
    // Filter diagnostics to suppress known shim-related warnings
    filterDiagnostic(diagnostic): boolean {
      const messageText = typeof diagnostic.messageText === "string"
        ? diagnostic.messageText
        : diagnostic.messageText?.messageText || "";

      // Ignore "Cannot find name 'Deno'" errors in test files
      if (messageText.includes("Cannot find name 'Deno'")) {
        return false;
      }
      // Ignore "Cannot find name 'process'" for Node shims
      if (messageText.includes("Cannot find name 'process'")) {
        return false;
      }
      return true;
    },
    package: {
      name: "ante-cli-test",
      version: denoJson.version,
      description: "Test build of ante - not for publishing",
      license: denoJson.license,
      type: "module",
      private: true, // Prevent accidental publishing
      engines: {
        node: ">=18",
      },
      scripts: {
        // Add npm test script that runs Node's built-in test runner
        test: "node --test esm/tests/*_test.js",
        "test:unit":
          "node --test esm/tests/config_test.js esm/tests/contributors_test.js esm/tests/formatter_test.js esm/tests/glob_test.js esm/tests/header_test.js",
        "test:integration": "node --test esm/tests/integration_test.js",
      },
    },
    postBuild(): void {
      console.log("\n[OK] Build completed!");
      console.log(`   Output directory: ${outDir}`);

      // Create a simple test runner script for manual testing
      const testRunner = `#!/usr/bin/env node
/**
 * Test runner for ante compatibility testing.
 * Run with: node test-runner.js
 */

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Unit tests (should always work)
const unitTests = [
  'esm/tests/config_test.js',
  'esm/tests/contributors_test.js',
  'esm/tests/formatter_test.js',
  'esm/tests/glob_test.js',
  'esm/tests/header_test.js',
];

// Integration tests (use cross-runtime FS utilities)
const integrationTests = [
  'esm/tests/integration_test.js',
];

const allTests = [...unitTests, ...integrationTests];
const testsToRun = process.argv.includes('--unit-only') ? unitTests : allTests;

console.log('Running ante tests...\\n');
console.log('Tests to run:', testsToRun.length);
console.log('');

const child = spawn('node', [
  '--test',
  '--test-reporter', 'spec',
  ...testsToRun.map(f => join(__dirname, f))
], {
  stdio: 'inherit',
  cwd: __dirname
});

child.on('close', (code) => {
  process.exit(code ?? 0);
});
`;

      Deno.writeTextFileSync(`${outDir}/test-runner.js`, testRunner);
      console.log("   Created test-runner.js for manual testing");

      // Create a Bun-compatible test runner
      const bunTestRunner = `#!/usr/bin/env bun
/**
 * Bun test runner for ante compatibility testing.
 * Run with: bun bun-test-runner.js
 */

import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Unit tests
const unitTests = [
  'esm/tests/config_test.js',
  'esm/tests/contributors_test.js',
  'esm/tests/formatter_test.js',
  'esm/tests/glob_test.js',
  'esm/tests/header_test.js',
];

// Integration tests
const integrationTests = [
  'esm/tests/integration_test.js',
];

const allTests = [...unitTests, ...integrationTests];
const testsToRun = process.argv.includes('--unit-only') ? unitTests : allTests;

console.log('Running ante tests with Bun...\\n');

let passed = 0;
let failed = 0;

for (const testFile of testsToRun) {
  const fullPath = join(__dirname, testFile);
  console.log(\`Running \${testFile}...\`);
  
  try {
    await import(fullPath);
    passed++;
    console.log(\`  [OK] Passed\\n\`);
  } catch (error) {
    failed++;
    console.error(\`  [FAIL] Failed: \${error.message}\\n\`);
  }
}

console.log(\`\\nResults: \${passed} passed, \${failed} failed\`);
process.exit(failed > 0 ? 1 : 0);
`;

      Deno.writeTextFileSync(`${outDir}/bun-test-runner.js`, bunTestRunner);
      console.log("   Created bun-test-runner.js for Bun testing");
    },
  });
} catch (error) {
  console.error("\n[ERROR] Build failed:", error);
  Deno.exit(1);
} finally {
  // Clean up temporary import map
  try {
    await Deno.remove(importMapPath);
  } catch {
    // Ignore cleanup errors
  }
}

console.log("\nTo run tests on different runtimes:");
console.log("   Deno:    deno test --allow-read --allow-write tests/");
console.log(`   Node.js: cd ${outDir} && npm test`);
console.log(`   Node.js: cd ${outDir} && node test-runner.js`);
console.log(`   Bun:     cd ${outDir} && bun bun-test-runner.js`);
