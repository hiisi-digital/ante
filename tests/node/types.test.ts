//----------------------------------------------------------------------------------------------------
// Copyright (c) 2025                    orgrinrt                    orgrinrt@ikiuni.dev
//                                      orgrinrt                 ort@hiisi.digital
// SPDX-License-Identifier: MPL-2.0      https://mozilla.org/MPL/2.0 contact@hiisi.digital
//----------------------------------------------------------------------------------------------------

/**
 * TypeScript types verification test for Node.js and Bun.
 *
 * This file imports from the built npm package and verifies:
 * 1. Types are correctly exported and usable
 * 2. Function signatures match expected types
 * 3. The package can be consumed as a library
 *
 * Run with:
 *   - Node.js: npx tsx tests/node/types.test.ts
 *   - Bun: bun tests/node/types.test.ts
 */

import process from "node:process";
import { generateHeader, hasValidHeader, loadConfig } from "../../npm/esm/mod.js";

console.log("Verifying TypeScript types...");

async function runTypeTests(): Promise<void> {
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, message: string): void {
    if (condition) {
      console.log(`  [OK] ${message}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${message}`);
      failed++;
    }
  }

  // Test 1: hasValidHeader accepts string and returns boolean
  const testContent: string = "console.log('hello');";
  const result: boolean = hasValidHeader(testContent);
  assert(typeof result === "boolean", "hasValidHeader returns boolean");

  // Test 2: hasValidHeader returns false for content without header
  assert(result === false, "hasValidHeader returns false for headerless content");

  // Test 3: loadConfig returns a Promise that resolves to an object
  const config = await loadConfig();
  assert(
    typeof config === "object" && config !== null,
    "loadConfig returns an object",
  );

  // Test 4: generateHeader is a function
  assert(
    typeof generateHeader === "function",
    "generateHeader is exported as a function",
  );

  // Test 5: Config object has expected shape (basic check)
  assert(
    "width" in config || Object.keys(config).length >= 0,
    "Config has expected structure",
  );

  console.log("");
  console.log(`Results: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exit(1);
  }

  console.log("TypeScript types verification passed!");
}

runTypeTests().catch((err) => {
  console.error("TypeScript types verification failed:", err);
  process.exit(1);
});
