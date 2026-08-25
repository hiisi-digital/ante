//----------------------------------------------------------------------------------------------------
// Copyright (c) 2025-2026                    orgrinrt                    orgrinrt@ikiuni.dev
//                                      orgrinrt                 ort@hiisi.digital
// SPDX-License-Identifier: MPL-2.0      https://mozilla.org/MPL/2.0 contact@hiisi.digital
//----------------------------------------------------------------------------------------------------

/**
 * CLI command: check
 *
 * Verifies that all matching files have valid copyright headers according to
 * the current configuration. Exits with code 1 if any issues are found.
 */

import type { ResolvedConfig } from "#core";
import { hasValidHeader, validateHeader } from "#core";
import { filesToActOn } from "./_files.ts";

/**
 * Options for the check command.
 */
interface CheckOptions {
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
interface FileCheckResult {
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
interface CheckResult {
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
 * Checks a single file for valid header.
 */
async function checkFile(
  path: string,
  config: ResolvedConfig,
): Promise<FileCheckResult> {
  try {
    const content = await Deno.readTextFile(path);

    if (!hasValidHeader(content, config)) {
      return {
        path,
        valid: false,
        issues: ["No valid copyright header found"],
      };
    }

    const validation = validateHeader(content, config);
    return {
      path,
      valid: validation.valid,
      issues: validation.issues,
    };
  } catch (error) {
    return {
      path,
      valid: false,
      issues: [`Failed to read file: ${error instanceof Error ? error.message : error}`],
    };
  }
}

/**
 * Runs the check command.
 *
 * @param config - The resolved configuration
 * @param options - Command options
 * @returns Check results
 */
export async function runCheck(
  config: ResolvedConfig,
  options: CheckOptions = {},
): Promise<CheckResult> {
  const files = await filesToActOn(config, options.glob);

  if (options.verbose) {
    console.log(`Found ${files.length} file(s) to check`);
  }

  // Check each file in parallel
  const results = await Promise.all(files.map((file) => checkFile(file, config)));

  // Print results
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const result = results[i];

    if (options.verbose || !result.valid) {
      if (result.valid) {
        console.log(`[ok] ${file}`);
      } else {
        console.log(`[fail] ${file}`);
        for (const issue of result.issues) {
          console.log(`  - ${issue}`);
        }
      }
    }
  }

  const passed = results.filter((r) => r.valid).length;
  const failed = results.filter((r) => !r.valid).length;

  const summary: CheckResult = {
    totalFiles: files.length,
    passedFiles: passed,
    failedFiles: failed,
    files: results,
  };

  // Output based on format
  if (options.format === "json") {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    console.log("");
    console.log(`Checked ${summary.totalFiles} file(s)`);
    console.log(`  Passed: ${summary.passedFiles}`);
    console.log(`  Failed: ${summary.failedFiles}`);
  }

  return summary;
}
