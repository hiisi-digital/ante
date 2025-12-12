//----------------------------------------------------------------------------------------------------
// Copyright (c) 2025                    orgrinrt                    orgrinrt@ikiuni.dev
//                                      orgrinrt                 ort@hiisi.digital
// SPDX-License-Identifier: MPL-2.0      https://mozilla.org/MPL/2.0 contact@hiisi.digital
//----------------------------------------------------------------------------------------------------

/**
 * Deno Smoke Test
 *
 * Tests the ante library directly from source to verify Deno compatibility.
 * Run with: deno run --allow-read tests/deno/smoke.test.ts
 */

import { generateHeader, hasValidHeader, loadConfig } from "../../mod.ts";

const SAMPLE_HEADER =
  `//----------------------------------------------------------------------------------------------------
// Copyright (c) 2025                    orgrinrt                    orgrinrt@ikiuni.dev
// SPDX-License-Identifier: MPL-2.0      https://mozilla.org/MPL/2.0 contact@hiisi.digital
//----------------------------------------------------------------------------------------------------
`;

const SAMPLE_CONTENT = `console.log("Hello world");`;
const FULL_FILE = SAMPLE_HEADER + "\n" + SAMPLE_CONTENT;

let passed = 0;
let failed = 0;

function test(name: string, fn: () => boolean): void {
  try {
    const result = fn();
    if (result) {
      console.log(`[PASS] ${name}`);
      passed++;
    } else {
      console.log(`[FAIL] ${name}`);
      failed++;
    }
  } catch (err) {
    console.log(`[FAIL] ${name}`);
    console.error(`   Error: ${err}`);
    failed++;
  }
}

console.log("\n=== Deno Smoke Test ===\n");
console.log("=".repeat(60));

// Test 1: hasValidHeader exists and is a function
test("hasValidHeader is a function", () => {
  return typeof hasValidHeader === "function";
});

// Test 2: Content without header returns false
test("hasValidHeader returns false for content without header", () => {
  return hasValidHeader(SAMPLE_CONTENT) === false;
});

// Test 3: Content with header returns true
test("hasValidHeader returns true for content with valid header", () => {
  return hasValidHeader(FULL_FILE) === true;
});

// Test 4: generateHeader exists and is a function
test("generateHeader is a function", () => {
  return typeof generateHeader === "function";
});

// Test 5: loadConfig exists and is a function
test("loadConfig is a function", () => {
  return typeof loadConfig === "function";
});

// Test 6: Empty string returns false
test("hasValidHeader returns false for empty string", () => {
  return hasValidHeader("") === false;
});

// Test 7: Header-only content returns true
test("hasValidHeader returns true for header-only content", () => {
  return hasValidHeader(SAMPLE_HEADER) === true;
});

console.log("=".repeat(60));
console.log(`\nResults: ${passed} passed, ${failed} failed\n`);

if (failed > 0) {
  console.error("[ERROR] Smoke test failed!");
  Deno.exit(1);
} else {
  console.log("[OK] All smoke tests passed!");
  Deno.exit(0);
}
