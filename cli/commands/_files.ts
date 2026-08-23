//--------------------------------------------------------------------------------------------------
// Copyright (c) 2026                   orgrinrt                 ort@hiisi.digital
// SPDX-License-Identifier: MPL-2.0     https://mozilla.org/MPL/2.0        ort@hiisi.digital
//--------------------------------------------------------------------------------------------------

/**
 * Finding the files a command should act on.
 *
 * `check` and `fix` walk the tree the same way, and they had a copy each. Two
 * copies of a walk are two chances for one of them to start skipping something
 * the other still visits, which is the difference between a check that passes
 * and a fix that misses a file.
 *
 * @module
 */

import { matchesGlob } from "#core";

/** Whether a path matches any of the patterns. */
export /**
 * Checks if a path matches any of the given patterns.
 */
function matchesAnyPattern(path: string, patterns: string[]): boolean {
  return patterns.some((pattern) => matchesGlob(path, pattern));
}

/** Every file under `dir` that the include patterns take and the excludes leave. */
export /**
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
      if (matchesAnyPattern(path, excludePatterns)) {
        continue;
      }

      if (entry.isDirectory) {
        // Skip hidden directories
        if (entry.name.startsWith(".")) {
          continue;
        }
        const subFiles = await findFilesRecursive(
          path,
          includePatterns,
          excludePatterns,
        );
        files.push(...subFiles);
      } else if (entry.isFile) {
        if (matchesAnyPattern(path, includePatterns)) {
          files.push(path);
        }
      }
    }
  } catch {
    // Directory read failed - skip silently
  }

  return files;
}

