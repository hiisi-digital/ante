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

import type { ResolvedConfig } from "#core";
import { hasValidHeader, validateHeader } from "#core";

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
 * Expands glob patterns to file paths.
 */
async function expandGlobs(
  patterns: string[],
  excludePatterns: string[],
): Promise<string[]> {
  const files: string[] = [];

  for (const pattern of patterns) {
    try {
      // Use Deno's glob expansion
      for await (const entry of Deno.readDir(".")) {
        if (entry.isFile && entry.name.endsWith(".ts")) {
          // Check if excluded
          let excluded = false;
          for (const exclude of excludePatterns) {
            if (matchesPattern(entry.name, exclude)) {
              excluded = true;
              break;
            }
          }
          if (!excluded && matchesPattern(entry.name, pattern)) {
            files.push(entry.name);
          }
        }
      }
    } catch {
      // Directory read failed
    }
  }

  // Also recursively search directories
  const allFiles = await findFilesRecursive(".", patterns, excludePatterns);
  return [...new Set([...files, ...allFiles])];
}

/**
 * Simple pattern matching (supports * and **).
 */
function matchesPattern(path: string, pattern: string): boolean {
  // Convert glob pattern to regex
  const regexPattern = pattern
    .replace(/\*\*/g, "<<<GLOBSTAR>>>")
    .replace(/\*/g, "[^/]*")
    .replace(/<<<GLOBSTAR>>>/g, ".*")
    .replace(/\?/g, ".");

  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(path);
}

/**
 * Recursively finds files matching patterns.
 */
async function findFilesRecursive(
  dir: string,
  includePatterns: string[],
  excludePatterns: string[],
): Promise<string[]> {
  const files: string[] = [];

  try {
    for await (const entry of Deno.readDir(dir)) {
      const path = dir === "." ? entry.name : `${dir}/${entry.name}`;

      // Check if path is excluded
      let excluded = false;
      for (const pattern of excludePatterns) {
        if (matchesPattern(path, pattern)) {
          excluded = true;
          break;
        }
      }

      if (excluded) {
        continue;
      }

      if (entry.isDirectory) {
        const subFiles = await findFilesRecursive(
          path,
          includePatterns,
          excludePatterns,
        );
        files.push(...subFiles);
      } else if (entry.isFile) {
        for (const pattern of includePatterns) {
          if (matchesPattern(path, pattern)) {
            files.push(path);
            break;
          }
        }
      }
    }
  } catch {
    // Directory read failed
  }

  return files;
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

    if (!hasValidHeader(content)) {
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
  const includePatterns = options.glob ? [options.glob] : config.include;
  const excludePatterns = config.exclude;

  // Find all files to check
  const files = await expandGlobs(includePatterns, excludePatterns);

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

/**
 * Entry point when run as CLI command.
 */
export async function main(args: string[]): Promise<void> {
  // This is handled by the main CLI dispatcher
  // Parse args locally if needed
  const glob = args[0];

  // Load config and run check
  const { loadConfig } = await import("#core");
  const config = await loadConfig();

  const result = await runCheck(config, {
    glob,
    verbose: args.includes("--verbose") || args.includes("-v"),
    format: args.includes("--json") ? "json" : "human",
  });

  if (result.failedFiles > 0) {
    Deno.exit(1);
  }
}
