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

import type { Contributor, ResolvedConfig } from "#core";
import {
  generateHeader,
  getCurrentGitUser,
  getFileYearRange,
  hasValidHeader,
  parseHeader,
  replaceHeader,
  updateHeader,
} from "#core";

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
 * Simple pattern matching (supports * and **).
 */
function matchesPattern(path: string, pattern: string): boolean {
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
 * Fixes a single file's header.
 */
async function fixFile(
  path: string,
  config: ResolvedConfig,
  currentUser: Contributor | null,
  dryRun: boolean,
): Promise<FixResult> {
  try {
    const content = await Deno.readTextFile(path);
    const currentYear = new Date().getFullYear();

    if (!hasValidHeader(content)) {
      // No header - create one
      const contributors: Contributor[] = currentUser ? [currentUser] : [];

      // Try to get year range from git
      const yearRange = await getFileYearRange(path);
      const yearStart = yearRange?.firstYear ?? currentYear;
      const yearEnd = yearRange?.lastYear ?? currentYear;

      const header = generateHeader(config, contributors, yearStart, yearEnd);
      const newContent = replaceHeader(content, header);

      if (!dryRun) {
        await Deno.writeTextFile(path, newContent);
      }

      return {
        file: path,
        modified: true,
        action: "created",
        details: "Created new copyright header",
      };
    }

    // Header exists - check if updates needed
    const parsed = parseHeader(content);
    if (!parsed) {
      return {
        file: path,
        modified: false,
        action: "skipped",
        details: "Could not parse existing header",
      };
    }

    let needsUpdate = false;
    const updates: string[] = [];

    // Check if year needs updating
    if (parsed.yearEnd < currentYear) {
      needsUpdate = true;
      updates.push(`Update year to ${parsed.yearStart}-${currentYear}`);
    }

    // Check if current user needs to be added
    if (currentUser) {
      const hasCurrentUser = parsed.contributors.some(
        (c) => c.email.toLowerCase() === currentUser.email.toLowerCase(),
      );
      if (!hasCurrentUser) {
        needsUpdate = true;
        updates.push(`Add contributor: ${currentUser.name}`);
      }
    }

    if (!needsUpdate) {
      return {
        file: path,
        modified: false,
        action: "unchanged",
      };
    }

    // Update the header
    const updatedHeader = updateHeader(parsed, config, {
      newContributor: currentUser ?? undefined,
      updateYear: currentYear,
    });
    const newContent = replaceHeader(content, updatedHeader, parsed);

    if (!dryRun) {
      await Deno.writeTextFile(path, newContent);
    }

    return {
      file: path,
      modified: true,
      action: "updated",
      details: updates.join("; "),
    };
  } catch (error) {
    return {
      file: path,
      modified: false,
      action: "skipped",
      details: `Error: ${error instanceof Error ? error.message : error}`,
    };
  }
}

/**
 * Runs the fix command.
 *
 * @param config - The resolved configuration
 * @param options - Command options
 * @returns Array of results for each processed file
 */
export async function runFix(
  config: ResolvedConfig,
  options: FixOptions = {},
): Promise<FixResult[]> {
  const includePatterns = options.glob ? [options.glob] : config.include;
  const excludePatterns = config.exclude;

  // Find all files to process
  const files = await findFilesRecursive(".", includePatterns, excludePatterns);

  if (options.verbose) {
    console.log(`Found ${files.length} file(s) to process`);
    if (options.dryRun) {
      console.log("(dry run - no changes will be made)");
    }
  }

  // Get current git user
  const currentUser = await getCurrentGitUser();
  if (!currentUser && options.verbose) {
    console.log("Warning: Could not determine git user");
  }

  // Process each file sequentially (intentional - we print progress and write files)
  const results: FixResult[] = [];
  for (const file of files) {
    // deno-lint-ignore no-await-in-loop
    const result = await fixFile(file, config, currentUser, options.dryRun ?? false);
    results.push(result);

    if (options.verbose) {
      const prefix = result.action === "created"
        ? "+"
        : result.action === "updated"
        ? "~"
        : result.action === "skipped"
        ? "!"
        : " ";
      console.log(`${prefix} ${file}`);
      if (result.details) {
        console.log(`  ${result.details}`);
      }
    } else if (result.modified) {
      console.log(`Fixed: ${file}`);
    }
  }

  // Summary
  const created = results.filter((r) => r.action === "created").length;
  const updated = results.filter((r) => r.action === "updated").length;
  const unchanged = results.filter((r) => r.action === "unchanged").length;
  const skipped = results.filter((r) => r.action === "skipped").length;

  if (options.verbose || created > 0 || updated > 0) {
    console.log("");
    console.log(`Processed ${files.length} file(s)`);
    console.log(`  Created: ${created}`);
    console.log(`  Updated: ${updated}`);
    console.log(`  Unchanged: ${unchanged}`);
    console.log(`  Skipped: ${skipped}`);
  }

  return results;
}

/**
 * Entry point for CLI invocation.
 */
export async function main(args: string[]): Promise<number> {
  const { loadConfig } = await import("#core");
  const config = await loadConfig();

  const results = await runFix(config, {
    glob: args[0],
    dryRun: args.includes("--dry-run"),
    verbose: args.includes("--verbose") || args.includes("-v"),
  });

  const modified = results.filter((r) => r.modified).length;
  return modified > 0 ? 0 : 0;
}
