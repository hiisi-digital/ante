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
import { run } from "../core/run.ts";

export { getContributorsFromHistory, getCurrentGitUser, getFileYearRange };

/**
 * Gets the list of staged files for a git commit.
 *
 * @param filter - Optional filter for file status (A=Added, C=Copied, M=Modified, etc.)
 * @returns Promise resolving to array of file paths
 */
export async function getStagedFiles(filter = "ACM"): Promise<string[]> {
  try {
    const cmdResult = await run("git", [
      "diff",
      "--cached",
      "--name-only",
      `--diff-filter=${filter}`,
    ]);

    const output = cmdResult;
    if (!output.success) {
      return [];
    }

    const text = output.stdout.trim();
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
    const cmdResult = await run("git", ["ls-files", "--error-unmatch", file]);

    const output = cmdResult;
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
    const cmdResult = await run("git", ["add", file]);

    const output = cmdResult;
    return output.success;
  } catch {
    return false;
  }
}
