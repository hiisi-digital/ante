//----------------------------------------------------------------------------------------------------
// Copyright (c) 2025                    orgrinrt                    orgrinrt@ikiuni.dev
// SPDX-License-Identifier: MPL-2.0      https://mozilla.org/MPL/2.0 contact@hiisi.digital
//----------------------------------------------------------------------------------------------------

/**
 * CLI command: check
 *
 * Verifies that all matching files have valid copyright headers according to
 * the current configuration. Exits with code 1 if any issues are found.
 */

import type { AnteConfig } from "../../core/config.ts";

/**
 * Options for the check command.
 */
export interface CheckOptions {
  /** Glob pattern to filter files (overrides config.include) */
  glob?: string;
  /** Show verbose output */
  verbose?: boolean;
  /** Output format: "human" for readable, "json" for machine-parseable */
  format?: "human" | "json";
}

/**
 * Result of checking a single file.
 */
export interface FileCheckResult {
  /** Path to the file */
  path: string;
  /** Whether the file passed validation */
  valid: boolean;
  /** List of issues found */
  issues: string[];
}

/**
 * Result of the check command.
 */
export interface CheckResult {
  /** Total files checked */
  totalFiles: number;
  /** Files that passed */
  passedFiles: number;
  /** Files that failed */
  failedFiles: number;
  /** Per-file results */
  files: FileCheckResult[];
}

/**
 * Runs the check command.
 *
 * @param config - The resolved configuration
 * @param options - Command options
 * @returns Check results
 */
export function runCheck(
  _config: AnteConfig,
  _options: CheckOptions,
): Promise<CheckResult> {
  // TODO: Enumerate files matching config.include, excluding config.exclude
  // TODO: For each file, check if header exists and is valid
  // TODO: Collect results and return summary
  // TODO: If format is "human", print readable output
  // TODO: If format is "json", print JSON
  // TODO: Exit with code 1 if any files failed
  return Promise.reject(new Error("Not implemented"));
}

/**
 * Entry point when run as CLI command.
 */
export function main(_args: string[]): Promise<void> {
  // TODO: Parse args for --glob, --verbose, --format
  // TODO: Load config
  // TODO: Run check
  // TODO: Exit with appropriate code
  return Promise.reject(new Error("Not implemented"));
}
