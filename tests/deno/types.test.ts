//----------------------------------------------------------------------------------------------------
// Copyright (c) 2025                    orgrinrt                    orgrinrt@ikiuni.dev
//                                      orgrinrt                 ort@hiisi.digital
// SPDX-License-Identifier: MPL-2.0      https://mozilla.org/MPL/2.0 contact@hiisi.digital
//----------------------------------------------------------------------------------------------------

/**
 * Deno TypeScript types verification test.
 *
 * This test verifies that the library exports correct TypeScript types
 * and that the API signatures match expectations.
 *
 * Run with: deno check tests/deno/types.test.ts && deno run --allow-read tests/deno/types.test.ts
 */

import type { ResolvedConfig } from "../../core/config.ts";
import { generateHeader, hasValidHeader, loadConfig } from "../../mod.ts";

console.log("Deno: Checking TypeScript types...");

async function run(): Promise<void> {
  // 1. Check hasValidHeader signature: (content: string) => boolean
  const content: string = "console.log('hello');";
  const isValid: boolean = hasValidHeader(content);
  console.log(`  hasValidHeader('...'): ${isValid} (expected: false)`);
  if (typeof isValid !== "boolean") {
    throw new Error("hasValidHeader should return a boolean");
  }

  // 2. Check loadConfig signature: () => Promise<ResolvedConfig>
  const config: ResolvedConfig = await loadConfig();
  if (typeof config !== "object" || config === null) {
    throw new Error("loadConfig should return a ResolvedConfig object");
  }
  console.log(`  loadConfig(): returned config with width=${config.width}`);

  // 3. Check generateHeader existence and type
  if (typeof generateHeader !== "function") {
    throw new Error("generateHeader should be a function");
  }
  console.log("  generateHeader: is a function [OK]");

  // 4. Verify config type shape (compile-time check)
  // These properties are required in ResolvedConfig, so they should always be defined
  const widthCheck: number = config.width;
  const separatorCheck: string = config.separatorChar;
  console.log(`  Config shape verified: width=${widthCheck}, separatorChar='${separatorCheck}'`);

  console.log("\nDeno: Types verification PASSED");
}

run().catch((err) => {
  console.error("Deno: Types verification FAILED");
  console.error(err);
  Deno.exit(1);
});
