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
        `A positional is a glob, or a directory to walk, and either way it narrows those patterns ` +
        `rather than replacing them. Use \`ante add\` to put a header on one file regardless.`,
    );
    this.name = "MatchedNothing";
    this.asked = asked;
    this.include = include;
  }
}

/**
 * The files a command should act on, given the positionals it was handed.
 *
 * A directory is walked with the configured include patterns, because
 * `ante check .` and `ante check src` are what a person types: nearly every
 * other checker in the ecosystem takes a path there. Anything else is a glob,
 * matched against the whole tree and then against those same patterns.
 *
 * **Both, not either.** A positional used to replace the include set, so a path
 * naming anything at all was acted on: `ante fix deno.json` wrote a header into
 * it, and since the comment prefix is one configured value rather than something
 * read off the file, the header it wrote was `//` whatever the file's language
 * used for a comment. The pre-commit hook hands over every staged path, so a
 * commit staging a manifest, a readme and a shell script had a `//` block put at
 * the top of all three, and the script it had just broken was the next thing git
 * ran. Narrowing is what a positional was always meant to do; `add` is the
 * command that acts on one named file regardless.
 *
 * **All of them, not the first.** Taking one positional and dropping the rest is
 * silent: the command reports success over however many it looked at, and the
 * ones it never opened are indistinguishable from ones that passed. The
 * pre-commit hook hands over every staged path at once, so a commit touching
 * three files had two of them go unheadered while the hook printed success.
 *
 * Throws {@linkcode MatchedNothing} rather than returning an empty list, naming
 * whichever positional matched nothing rather than reporting the set as empty.
 */
export async function filesToActOn(
  config: { include: string[]; exclude: string[] },
  asked?: string | readonly string[],
): Promise<string[]> {
  const wanted = asked === undefined ? [] : (typeof asked === "string" ? [asked] : [...asked]);

  if (wanted.length === 0) {
    const found = await findFilesRecursive(".", config.include, config.exclude);
    if (found.length === 0) throw new MatchedNothing(undefined, config.include);
    return found;
  }

  // Each positional is resolved on its own and the results are unioned, so one
  // naming a directory and another naming a file behave the way each would
  // alone. Resolved together, since they do not depend on each other.
  const each = await Promise.all(wanted.map(async (one) => {
    let kind: "directory" | "file" | "neither" = "neither";
    try {
      kind = (await Deno.stat(one)).isDirectory ? "directory" : "file";
    } catch {
      kind = "neither";
    }
    const files = kind === "directory"
      ? await findFilesRecursive(one, config.include, config.exclude)
      : (await findFilesRecursive(".", [one], config.exclude))
        .filter((file) => matchesAnyPattern(file, config.include));
    return { files, kind };
  }));

  // Checked in the order they were given, because a set that is non-empty
  // overall says nothing about the one that matched nothing, and that one is
  // the typo.
  //
  // A positional naming a file that exists and is not included is not one,
  // though, and it is what a hook hands over: a commit stages whatever it
  // stages, and a manifest among the sources is an ordinary commit rather than
  // a mistake. That is ante answering that the file is not its business, which
  // is a different sentence from "nothing matches", so it takes no files and
  // stops there. A path that is not a file at all still throws, since nothing
  // but a typo produces one.
  const empty = wanted.findIndex((_, at) => each[at].files.length === 0 && each[at].kind !== "file");
  if (empty !== -1) throw new MatchedNothing(wanted[empty], config.include);

  // Order follows the walk rather than the command line, and a path named twice
  // appears once.
  const all = new Set<string>();
  for (const found of each) for (const file of found.files) all.add(file);

  // Every positional named a file that is out of scope, so the run has nothing
  // to do and nothing to say about it. A hook handing over a commit of
  // manifests alone lands here, and it is a pass rather than a refusal.
  return [...all];
}
