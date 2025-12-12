//----------------------------------------------------------------------------------------------------
// Copyright (c) 2025                    orgrinrt                    orgrinrt@ikiuni.dev
//                                      orgrinrt                 ort@hiisi.digital
// SPDX-License-Identifier: MPL-2.0      https://mozilla.org/MPL/2.0 contact@hiisi.digital
//----------------------------------------------------------------------------------------------------

/**
 * Glob pattern matching utilities.
 *
 * Provides functions for matching file paths against glob patterns,
 * supporting common glob syntax like single asterisk and double asterisk (globstar).
 */

/**
 * Matches a file path against a glob pattern.
 *
 * Supported patterns:
 * - Single asterisk: matches any characters except path separator
 * - Double asterisk (globstar): matches any characters including path separator
 * - Question mark: matches a single character except path separator
 *
 * @param path - The file path to test
 * @param pattern - The glob pattern to match against
 * @returns True if the path matches the pattern
 */
export function matchesGlob(path: string, pattern: string): boolean {
  const regex = globToRegex(pattern);
  return regex.test(path);
}

/**
 * Converts a glob pattern to a regular expression.
 *
 * @param pattern - The glob pattern to convert
 * @returns A RegExp that matches paths according to the glob pattern
 */
export function globToRegex(pattern: string): RegExp {
  // Handle empty pattern
  if (pattern === "") {
    return /^$/;
  }

  let regexStr = "";
  let i = 0;

  while (i < pattern.length) {
    const char = pattern[i];
    const nextChar = pattern[i + 1];

    if (char === "*" && nextChar === "*") {
      // Double asterisk (globstar)
      const prevChar = pattern[i - 1];
      const afterNext = pattern[i + 2];

      if ((prevChar === "/" || prevChar === undefined) && afterNext === "/") {
        // Pattern like "**/" at start or "/**/" in middle
        // Matches zero or more directories
        regexStr += "(?:.*\\/)?";
        i += 3; // Skip "**/""
      } else if ((prevChar === "/" || prevChar === undefined) && afterNext === undefined) {
        // Pattern like "/**" at end or just "**"
        // Matches anything remaining
        regexStr += ".*";
        i += 2; // Skip "**"
      } else if (prevChar === "/" && afterNext !== undefined) {
        // Pattern like "/**/something" - matches zero or more directories
        regexStr += "(?:.*\\/)?";
        i += 3; // Skip "**/"
      } else {
        // Just "**" in the middle of something, treat as matching anything
        regexStr += ".*";
        i += 2;
      }
    } else if (char === "*") {
      // Single asterisk - matches anything except /
      regexStr += "[^/]*";
      i++;
    } else if (char === "?") {
      // Question mark - matches single character except /
      regexStr += "[^/]";
      i++;
    } else if (char === ".") {
      // Escape dots
      regexStr += "\\.";
      i++;
    } else if (
      char === "+" || char === "^" || char === "$" || char === "{" ||
      char === "}" || char === "(" || char === ")" || char === "|" ||
      char === "[" || char === "]" || char === "\\"
    ) {
      // Escape other regex special characters
      regexStr += "\\" + char;
      i++;
    } else {
      regexStr += char;
      i++;
    }
  }

  return new RegExp("^" + regexStr + "$");
}

/**
 * Checks if any of the patterns match the given path.
 *
 * @param path - The file path to test
 * @param patterns - Array of glob patterns to match against
 * @returns True if any pattern matches the path
 */
export function matchesAnyGlob(path: string, patterns: string[]): boolean {
  return patterns.some((pattern) => matchesGlob(path, pattern));
}

/**
 * Filters an array of paths to only those matching at least one pattern.
 *
 * @param paths - Array of file paths to filter
 * @param includePatterns - Patterns that paths must match
 * @param excludePatterns - Patterns that cause paths to be excluded
 * @returns Array of paths that match include patterns and don't match exclude patterns
 */
export function filterPaths(
  paths: string[],
  includePatterns: string[],
  excludePatterns: string[] = [],
): string[] {
  return paths.filter((path) => {
    // Check if path matches any exclude pattern
    if (matchesAnyGlob(path, excludePatterns)) {
      return false;
    }
    // Check if path matches any include pattern
    return matchesAnyGlob(path, includePatterns);
  });
}
