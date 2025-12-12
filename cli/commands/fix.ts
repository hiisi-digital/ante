//----------------------------------------------------------------------------------------------------
// Copyright (c) 2025                    orgrinrt                    orgrinrt@ikiuni.dev
// SPDX-License-Identifier: MPL-2.0      https://mozilla.org/MPL/2.0 contact@hiisi.digital
//----------------------------------------------------------------------------------------------------

/**
 * CLI command: fix
 *
 * Fixes copyright headers across all matching files.
 * Adds missing headers, updates outdated ones, and ensures consistency.
 */

import type { AnteConfig } from "../../core/config.ts";

/**
 * Options for the fix command.
 */
export interface FixOptions {
  /** Glob pattern to match files (overrides config.include) */
  glob?: string;
  /** Dry run - show what would be fixed without making changes */
  dryRun?: boolean;
  /** Verbose output */
  verbose?: boolean;
}

/**
 * Result of fixing a single file.
 */
export interface FixResult {
  /** The file path */
  file: string;
  /** Whether the file was modified */
  modified: boolean;
  /** What action was taken */
  action: "created" | "updated" | "unchanged" | "skipped";
  /** Details about what changed */
  details?: string;
}

/**
 * Runs the fix command.
 *
 * @param config - The resolved configuration
 * @param options - Command options
 * @returns Array of results for each processed file
 */
export function runFix(
  _config: AnteConfig,
  _options: FixOptions = {},
): Promise<FixResult[]> {
  // TODO: Expand glob patterns from config.include
  // TODO: Filter out config.exclude patterns
  // TODO: For each file:
  //   - Read content
  //   - Check for existing header
  //   - If missing, generate and prepend
  //   - If present but outdated, update
  //   - Write back if changed
  // TODO: Return results array
  return Promise.reject(new Error("Not implemented"));
}

/**
 * Entry point for CLI invocation.
 */
export function main(_args: string[]): Promise<number> {
  // TODO: Parse CLI arguments
  // TODO: Load config
  // TODO: Run fix with options
  // TODO: Print summary
  // TODO: Return exit code (0 = success)
  return Promise.reject(new Error("Not implemented"));
}
