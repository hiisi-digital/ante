//----------------------------------------------------------------------------------------------------
// Copyright (c) 2025                    orgrinrt                    orgrinrt@ikiuni.dev
//                                      orgrinrt                 ort@hiisi.digital
// SPDX-License-Identifier: MPL-2.0      https://mozilla.org/MPL/2.0 contact@hiisi.digital
//----------------------------------------------------------------------------------------------------

/**
 * TypeScript smoke test.
 * Verifies that the package exports resolvable types and functions.
 */

import { generateHeader, hasValidHeader, loadConfig } from "../mod.ts";

console.log("Checking TypeScript types...");

async function run(): Promise<void> {
  // 1. Check hasValidHeader signature
  const content: string = "console.log('hello');";
  const isValid: boolean = hasValidHeader(content);
  console.log(`hasValidHeader check: ${isValid}`);

  // 2. Check loadConfig signature
  const config = await loadConfig();
  if (typeof config !== "object" || config === null) {
    throw new Error("loadConfig did not return an object");
  }
  console.log("Config loaded successfully.");

  // 3. Check generateHeader existence
  if (typeof generateHeader !== "function") {
    throw new Error("generateHeader is not a function");
  }

  console.log("Types verification passed.");
}

run().catch((err) => {
  console.error("Types verification failed:", err);
  // @ts-ignore Node/Bun globals
  // deno-lint-ignore no-process-global
  if (typeof process !== "undefined") process.exit(1);
  // @ts-ignore Deno globals
  if (typeof Deno !== "undefined") Deno.exit(1);
});
