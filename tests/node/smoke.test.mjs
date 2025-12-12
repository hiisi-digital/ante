//----------------------------------------------------------------------------------------------------
// Copyright (c) 2025                    orgrinrt                    orgrinrt@ikiuni.dev
// SPDX-License-Identifier: MPL-2.0      https://mozilla.org/MPL/2.0 contact@hiisi.digital
//----------------------------------------------------------------------------------------------------

/**
 * Smoke test for Node.js and Bun runtimes.
 *
 * This test imports from the built npm package (./npm/esm/mod.js) and verifies
 * that the core functionality works correctly in these runtimes.
 *
 * Run with:
 *   node tests/node/smoke.test.mjs
 *   bun run tests/node/smoke.test.mjs
 */

import { hasValidHeader } from "../../npm/esm/mod.js";

console.log("Running Ante smoke test (Node/Bun)...");

const SAMPLE_HEADER = `//----------------------------------------------------------------------------------------------------
// Copyright (c) 2025                    orgrinrt                    orgrinrt@ikiuni.dev
// SPDX-License-Identifier: MPL-2.0      https://mozilla.org/MPL/2.0 contact@hiisi.digital
//----------------------------------------------------------------------------------------------------
`;

const SAMPLE_CONTENT = `console.log("Hello world");`;

const FULL_FILE = SAMPLE_HEADER + "\n" + SAMPLE_CONTENT;

let errors = 0;

function assert(condition, message) {
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
    "Should return false for content without header"
  );

  // Test 2: Content with valid header
  assert(
    hasValidHeader(FULL_FILE) === true,
    "Should return true for content with valid header"
  );

  // Test 3: Empty string
  assert(
    hasValidHeader("") === false,
    "Should return false for empty string"
  );

  // Test 4: Just the header (no content)
  assert(
    hasValidHeader(SAMPLE_HEADER) === true,
    "Should return true for just the header"
  );

} catch (err) {
  console.error("CRITICAL: Uncaught exception during smoke test:");
  console.error(err);
  errors++;
}

if (errors > 0) {
  console.error(`\nSmoke test failed with ${errors} error(s).`);
  process.exit(1);
} else {
  console.log("\nSmoke test passed successfully!");
  process.exit(0);
}
