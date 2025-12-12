//----------------------------------------------------------------------------------------------------
// Copyright (c) 2025                    orgrinrt                    orgrinrt@ikiuni.dev
// SPDX-License-Identifier: MPL-2.0      https://mozilla.org/MPL/2.0 contact@hiisi.digital
//----------------------------------------------------------------------------------------------------

/**
 * Git history utilities for extracting contributor information.
 *
 * Most of the git history functionality is implemented in core/contributors.ts.
 * This module re-exports the relevant functions and provides additional utilities.
 */

import { getContributorsFromHistory, getCurrentGitUser, getFileYearRange } from "#core";

export { getContributorsFromHistory, getCurrentGitUser, getFileYearRange };

/**
 * Gets the list of staged files for a git commit.
 *
 * @param filter - Optional filter for file status (A=Added, C=Copied, M=Modified, etc.)
 * @returns Promise resolving to array of file paths
 */
export async function getStagedFiles(filter = "ACM"): Promise<string[]> {
  try {
    const cmd = new Deno.Command("git", {
      args: ["diff", "--cached", "--name-only", `--diff-filter=${filter}`],
      stdout: "piped",
      stderr: "null",
    });

    const output = await cmd.output();
    if (!output.success) {
      return [];
    }

    const text = new TextDecoder().decode(output.stdout).trim();
    if (!text) {
      return [];
    }

    return text.split("\n").filter((f) => f.length > 0);
  } catch {
    return [];
  }
}

/**
 * Checks if a file exists in git (is tracked).
 *
 * @param file - Path to the file
 * @returns Promise resolving to true if file is tracked
 */
export async function isTrackedByGit(file: string): Promise<boolean> {
  try {
    const cmd = new Deno.Command("git", {
      args: ["ls-files", "--error-unmatch", file],
      stdout: "null",
      stderr: "null",
    });

    const output = await cmd.output();
    return output.success;
  } catch {
    return false;
  }
}

/**
 * Stages a file for commit.
 *
 * @param file - Path to the file
 * @returns Promise resolving to true if successful
 */
export async function stageFile(file: string): Promise<boolean> {
  try {
    const cmd = new Deno.Command("git", {
      args: ["add", file],
      stdout: "null",
      stderr: "null",
    });

    const output = await cmd.output();
    return output.success;
  } catch {
    return false;
  }
}
