//----------------------------------------------------------------------------------------------------
// Copyright (c) 2025-2026                    orgrinrt                    orgrinrt@ikiuni.dev
//                                      orgrinrt                 ort@hiisi.digital
// SPDX-License-Identifier: MPL-2.0      https://mozilla.org/MPL/2.0 contact@hiisi.digital
//----------------------------------------------------------------------------------------------------

/**
 * CLI command: add
 *
 * Adds a copyright header to a specific file.
 */

import type { Contributor, ResolvedConfig } from "#core";
import {
  getCurrentGitUser,
  getFileYearRange,
  hasValidHeader,
  parseHeader,
  replaceHeader,
  rewriteHeader,
  updateHeader,
} from "#core";

/**
 * Options for the add command.
 */
interface AddOptions {
  /** Path to the file to add a header to */
  file: string;
  /** Force overwrite existing header */
  force?: boolean;
  /** Report what would be written without writing it */
  dryRun?: boolean;
}

/**
 * Adds a copyright header to a specific file.
 *
 * @param options - Command options
 * @param config - Resolved configuration
 * @returns Exit code (0 for success, non-zero for failure)
 */
export async function add(options: AddOptions, config: ResolvedConfig): Promise<number> {
  const { file, force = false, dryRun = false } = options;

  // Check if file exists
  try {
    const stat = await Deno.stat(file);
    if (!stat.isFile) {
      console.error(`Error: ${file} is not a file`);
      return 1;
    }
  } catch {
    console.error(`Error: File not found: ${file}`);
    return 1;
  }

  // Read file content
  let content: string;
  try {
    content = await Deno.readTextFile(file);
  } catch (error) {
    console.error(
      `Error reading file: ${error instanceof Error ? error.message : error}`,
    );
    return 1;
  }

  // Check for existing header
  if (hasValidHeader(content, config)) {
    if (!force) {
      console.log(`File already has a copyright header: ${file}`);
      console.log("Use --force to overwrite");
      return 0;
    }
    console.log(`Replacing existing header in: ${file}`);
  } else {
    console.log(`Adding copyright header to: ${file}`);
  }

  // Get current git user as contributor
  const currentUser = await getCurrentGitUser();
  if (!currentUser) {
    console.error(
      "Error: Could not determine git user. Please configure git user.name and user.email",
    );
    return 1;
  }

  const contributors: Contributor[] = [currentUser];
  const currentYear = new Date().getFullYear();

  // Try to get year range from git history
  const yearRange = await getFileYearRange(file);
  const yearStart = yearRange?.firstYear ?? currentYear;
  const yearEnd = yearRange?.lastYear ?? currentYear;

  let newContent: string;

  if (hasValidHeader(content, config) && force) {
    // Force replace - parse existing and regenerate
    const parsed = parseHeader(content, config);
    if (parsed) {
      // Merge existing contributors with current user
      const existingEmails = new Set(parsed.contributors.map((c) => c.email.toLowerCase()));
      if (!existingEmails.has(currentUser.email.toLowerCase())) {
        contributors.push(...parsed.contributors);
      } else {
        contributors.length = 0;
        contributors.push(...parsed.contributors);
      }

      const updatedHeader = updateHeader(parsed, config, {
        newContributor: currentUser,
        updateYear: currentYear,
      });
      newContent = replaceHeader(content, updatedHeader, parsed, config);
    } else {
      // Can't read it, so write a fresh one carrying whatever it said.
      newContent = rewriteHeader(content, config, contributors, yearStart, yearEnd);
    }
  } else {
    // No existing header - create new one
    newContent = rewriteHeader(content, config, contributors, yearStart, yearEnd);
  }

  // Write the file
  if (dryRun) {
    console.log(`Would write header to: ${file}`);
    return 0;
  }
  try {
    await Deno.writeTextFile(file, newContent);
    console.log(`Done.`);
    return 0;
  } catch (error) {
    console.error(
      `Error writing file: ${error instanceof Error ? error.message : error}`,
    );
    return 1;
  }
}
