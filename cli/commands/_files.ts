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

/**
 * Thrown when a run matched no files at all.
 *
 * A run that looked at nothing and a run that looked at everything and found
 * nothing wrong print the same summary and, before this existed, returned the
 * same exit code. Operationally the first is the worse of the two, because it
 * reads as a pass in a hook and in continuous integration while certifying
 * nothing, so it is the one that has to be loud.
 */
export class MatchedNothing extends Error {
  /** What the run was pointed at, or `undefined` when it was the whole tree. */
  readonly asked: string | undefined;
  /** The include patterns the configuration carries. */
  readonly include: readonly string[];

  constructor(asked: string | undefined, include: readonly string[]) {
    const what = asked === undefined
      ? "the configured include patterns match no file"
      : `nothing matches ${JSON.stringify(asked)}`;
    super(
      `${what}. The configuration includes ${
        include.map((one) => JSON.stringify(one)).join(", ")
      }. ` +
        `A positional is a glob, or a directory to walk; a path that is neither matches only itself.`,
    );
    this.name = "MatchedNothing";
    this.asked = asked;
    this.include = include;
  }
}

/**
 * The files a command should act on, given the positional it was handed.
 *
 * A directory is walked with the configured include patterns, because
 * `ante check .` and `ante check src` are what a person types: nearly every
 * other checker in the ecosystem takes a path there. Anything else is a glob,
 * matched against the whole tree.
 *
 * Throws {@linkcode MatchedNothing} rather than returning an empty list.
 */
export async function filesToActOn(
  config: { include: string[]; exclude: string[] },
  asked?: string,
): Promise<string[]> {
  let root = ".";
  let include = config.include;

  if (asked !== undefined) {
    let directory = false;
    try {
      directory = (await Deno.stat(asked)).isDirectory;
    } catch {
      directory = false;
    }
    if (directory) {
      root = asked;
    } else {
      include = [asked];
    }
  }

  const found = await findFilesRecursive(root, include, config.exclude);
  if (found.length === 0) {
    throw new MatchedNothing(asked, config.include);
  }
  return found;
}
