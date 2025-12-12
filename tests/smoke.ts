//--------------------------------------------------------------------------------------------------
// Copyright (c) 2025                   orgrinrt                 ort@hiisi.digital
// SPDX-License-Identifier: MPL-2.0     https://mozilla.org/MPL/2.0        ort@hiisi.digital
//--------------------------------------------------------------------------------------------------

/**
 * Smoke test for verifying runtime compatibility.
 *
 * This script imports the library and performs basic checks.
 * It is designed to be runnable in Deno directly (testing source)
 * or adapted to run in Node/Bun against the built package.
 */

import { hasValidHeader } from "../mod.ts";

console.log("Running Ante smoke test...");

const SAMPLE_HEADER =
  `//----------------------------------------------------------------------------------------------------
// Copyright (c) 2025                    orgrinrt                    orgrinrt@ikiuni.dev
// SPDX-License-Identifier: MPL-2.0      https://mozilla.org/MPL/2.0 contact@hiisi.digital
//----------------------------------------------------------------------------------------------------
`;

const SAMPLE_CONTENT = `console.log("Hello world");`;

const FULL_FILE = SAMPLE_HEADER + "\n" + SAMPLE_CONTENT;

let errors = 0;

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    errors++;
  } else {
    console.log(`PASS: ${message}`);
  }
}

try {
  // Test 1: Content without header
  assert(
    hasValidHeader(SAMPLE_CONTENT) === false,
    "Should return false for content without header",
  );

  // Test 2: Content with valid header
  assert(
    hasValidHeader(FULL_FILE) === true,
    "Should return true for content with valid header",
  );
} catch (err) {
  console.error("CRITICAL: Uncaught exception during smoke test:");
  console.error(err);
  errors++;
}

if (errors > 0) {
  console.error(`\nSmoke test failed with ${errors} error(s).`);
  // Cross-runtime exit
  if (typeof Deno !== "undefined") Deno.exit(1);
  // @ts-ignore Node/Bun globals
  // deno-lint-ignore no-process-global
  if (typeof process !== "undefined") process.exit(1);
} else {
  console.log("\nSmoke test passed successfully!");
}
