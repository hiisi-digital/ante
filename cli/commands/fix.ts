//----------------------------------------------------------------------------------------------------
// Copyright (c) 2025-2026                    orgrinrt                    orgrinrt@ikiuni.dev
//                                      orgrinrt                 ort@hiisi.digital
// SPDX-License-Identifier: MPL-2.0      https://mozilla.org/MPL/2.0 contact@hiisi.digital
//----------------------------------------------------------------------------------------------------

/**
 * CLI command: fix
 *
 * Fixes copyright headers across all matching files.
 * Adds missing headers, updates outdated ones, and ensures consistency.
 */

import type { Contributor, ParsedHeader, ResolvedConfig } from "#core";
import {
  getCurrentGitUser,
  getFileYearRange,
  hasValidHeader,
  parseHeader,
  replaceHeader,
  rewriteHeader,
  updateHeader,
} from "#core";
import { findFilesRecursive } from "./_files.ts";

/**
 * Options for the fix command.
 */
interface FixOptions {
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
interface FixResult {
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
 * What changed, for the verbose listing. Not what decides to write: that is the
 * comparison in `fixFile`, and this only puts names to the parts of it a reader
 * would recognise.
 */
function named(
  parsed: ParsedHeader,
  config: ResolvedConfig,
  currentUser: Contributor | null,
  currentYear: number,
): string[] {
  const updates: string[] = [];
  if (parsed.yearEnd < currentYear) {
    updates.push(`Update year to ${parsed.yearStart}-${currentYear}`);
  }
  if (
    currentUser && !parsed.contributors.some(
      (one) => one.email.toLowerCase() === currentUser.email.toLowerCase(),
    )
  ) {
    updates.push(`Add contributor: ${currentUser.name}`);
  }
  if (config.spdxLicense && parsed.spdxLicense !== config.spdxLicense) {
    updates.push(`Set SPDX license to ${config.spdxLicense}`);
  }
  if (updates.length === 0) updates.push("Reformat to match the configuration");
  return updates;
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

    if (!hasValidHeader(content, config)) {
      // No header - create one
      const contributors: Contributor[] = currentUser ? [currentUser] : [];

      // Try to get year range from git
      const yearRange = await getFileYearRange(path);
      const yearStart = yearRange?.firstYear ?? currentYear;
      const yearEnd = yearRange?.lastYear ?? currentYear;

      const newContent = rewriteHeader(
        content,
        config,
        contributors,
        yearStart,
        yearEnd,
      );

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
    const parsed = parseHeader(content, config);
    if (!parsed) {
      return {
        file: path,
        modified: false,
        action: "skipped",
        details: "Could not parse existing header",
      };
    }

    // What the header should be, and the only thing that decides whether to
    // write. A list of conditions here was the same list twice, and the two
    // drifted: `check` reported an spdx mismatch that `fix` had no condition
    // for, so the repair command said there was nothing to repair and a
    // pre-commit hook running `check` blocked every commit after a relicense.
    const updatedHeader = updateHeader(parsed, config, {
      newContributor: currentUser ?? undefined,
      updateYear: currentYear,
    });

    if (updatedHeader === parsed.raw) {
      return {
        file: path,
        modified: false,
        action: "unchanged",
      };
    }

    const updates = named(parsed, config, currentUser, currentYear);
    const newContent = replaceHeader(content, updatedHeader, parsed, config);

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
