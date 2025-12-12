//----------------------------------------------------------------------------------------------------
// Copyright (c) 2025                    orgrinrt                    orgrinrt@ikiuni.dev
//                                      orgrinrt                 ort@hiisi.digital
// SPDX-License-Identifier: MPL-2.0      https://mozilla.org/MPL/2.0 contact@hiisi.digital
//----------------------------------------------------------------------------------------------------

/**
 * Cross-runtime testing utilities.
 *
 * This module provides utilities that work across Deno, Node.js, and Bun
 * to enable running the same tests on all runtimes.
 *
 * Usage:
 *   import { createTempDir, writeFile, readFile, removeDir } from "./_utils/mod.ts";
 */

// Re-export file system utilities
export {
  createTempDir,
  cwd,
  exists,
  joinPath,
  mkdir,
  readFile,
  removeDir,
  runtime,
  writeFile,
} from "./fs.ts";
