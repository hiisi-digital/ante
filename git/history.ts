//--------------------------------------------------------------------------------------------------
// Copyright (c) 2025-2026              orgrinrt                 orgrinrt@ikiuni.dev
//                                      orgrinrt                 ort@hiisi.digital
// SPDX-License-Identifier: MPL-2.0     https://mozilla.org/MPL/2.0        ort@hiisi.digital
//--------------------------------------------------------------------------------------------------

/**
 * The staging area, and whether git knows a file at all.
 *
 * History reading proper lives in `core/contributors.ts`, next to the selection
 * that consumes it. What is here is what a hook needs: the staged file list and
 * a tracked check, neither of which has anything to do with contributors.
 *
 * @module
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
    const output = await run("git", [
      "diff",
      "--cached",
      "--name-only",
      `--diff-filter=${filter}`,
    ]);
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
    const output = await run("git", ["ls-files", "--error-unmatch", file]);
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
    const output = await run("git", ["add", file]);
    return output.success;
  } catch {
    return false;
  }
}
