//----------------------------------------------------------------------------------------------------
// Copyright (c) 2025                    orgrinrt                    orgrinrt@ikiuni.dev
// SPDX-License-Identifier: MPL-2.0      https://mozilla.org/MPL/2.0 contact@hiisi.digital
//----------------------------------------------------------------------------------------------------

/**
 * Configuration module for ante.
 *
 * Handles loading, resolving, and deriving configuration from:
 * - deno.json / package.json "ante" section
 * - Git config (user.name, user.email)
 * - Sensible defaults
 *
 * Types are generated from schema/config.schema.json - see config.generated.ts
 */

// Re-export all generated types
export type {
  AnteConfig,
  Contributor,
  ContributorSelection,
  ResolvedConfig,
} from "./config.generated.ts";

export { DEFAULT_CONFIG } from "./config.generated.ts";

import type { AnteConfig, ResolvedConfig } from "./config.generated.ts";
import { DEFAULT_CONFIG } from "./config.generated.ts";

/**
 * Well-known SPDX license identifiers mapped to their canonical URLs.
 */
const LICENSE_URLS: Record<string, string> = {
  "MIT": "https://opensource.org/licenses/MIT",
  "MPL-2.0": "https://mozilla.org/MPL/2.0",
  "Apache-2.0": "https://www.apache.org/licenses/LICENSE-2.0",
  "GPL-3.0": "https://www.gnu.org/licenses/gpl-3.0.html",
  "GPL-3.0-only": "https://www.gnu.org/licenses/gpl-3.0.html",
  "GPL-3.0-or-later": "https://www.gnu.org/licenses/gpl-3.0.html",
  "GPL-2.0": "https://www.gnu.org/licenses/gpl-2.0.html",
  "GPL-2.0-only": "https://www.gnu.org/licenses/gpl-2.0.html",
  "LGPL-3.0": "https://www.gnu.org/licenses/lgpl-3.0.html",
  "LGPL-2.1": "https://www.gnu.org/licenses/lgpl-2.1.html",
  "BSD-2-Clause": "https://opensource.org/licenses/BSD-2-Clause",
  "BSD-3-Clause": "https://opensource.org/licenses/BSD-3-Clause",
  "ISC": "https://opensource.org/licenses/ISC",
  "Unlicense": "https://unlicense.org/",
  "WTFPL": "http://www.wtfpl.net/",
  "CC0-1.0": "https://creativecommons.org/publicdomain/zero/1.0/",
  "CC-BY-4.0": "https://creativecommons.org/licenses/by/4.0/",
  "CC-BY-SA-4.0": "https://creativecommons.org/licenses/by-sa/4.0/",
  "Zlib": "https://opensource.org/licenses/Zlib",
  "BSL-1.0": "https://opensource.org/licenses/BSL-1.0",
};

/**
 * Derives the license URL from an SPDX identifier.
 *
 * @param spdx - SPDX license identifier (e.g., "MIT", "MPL-2.0")
 * @returns The canonical URL for that license
 */
export function deriveLicenseUrl(spdx: string): string {
  if (!spdx) return "";
  return LICENSE_URLS[spdx] ?? `https://spdx.org/licenses/${spdx}.html`;
}

/**
 * Reads a value from git config.
 *
 * @param key - Git config key (e.g., "user.name", "user.email")
 * @returns The config value, or empty string if not set
 */
export async function getGitConfig(key: string): Promise<string> {
  try {
    const cmd = new Deno.Command("git", {
      args: ["config", "--get", key],
      stdout: "piped",
      stderr: "null",
    });
    const output = await cmd.output();
    if (output.success) {
      return new TextDecoder().decode(output.stdout).trim();
    }
  } catch {
    // Git not available or config not set
  }
  return "";
}

/**
 * Builds list of directories from startDir up to root.
 */
function getDirectoryChain(startDir: string): string[] {
  const dirs: string[] = [];
  let currentDir = startDir;

  while (true) {
    dirs.push(currentDir);
    const parentDir = currentDir.substring(0, currentDir.lastIndexOf("/"));
    if (parentDir === currentDir || parentDir === "") {
      break;
    }
    currentDir = parentDir;
  }

  return dirs;
}

/**
 * Checks if a file exists and is a file (not directory).
 */
async function fileExists(path: string): Promise<boolean> {
  try {
    const stat = await Deno.stat(path);
    return stat.isFile;
  } catch {
    return false;
  }
}

/**
 * Searches upward from a directory to find a config file.
 *
 * @param startDir - Directory to start searching from
 * @param filenames - File names to look for
 * @returns Path to the found file, or null if not found
 */
async function findConfigFile(
  startDir: string,
  filenames: string[],
): Promise<string | null> {
  const dirs = getDirectoryChain(startDir);

  // Build all candidate paths
  const allPaths: Array<{ dir: string; filename: string; path: string }> = [];
  for (const dir of dirs) {
    for (const filename of filenames) {
      allPaths.push({ dir, filename, path: `${dir}/${filename}` });
    }
  }

  // Check all paths in parallel
  const results = await Promise.all(
    allPaths.map(async (entry) => ({
      ...entry,
      exists: await fileExists(entry.path),
    })),
  );

  // Find the first existing file, preferring earlier directories
  for (const dir of dirs) {
    for (const filename of filenames) {
      const match = results.find(
        (r) => r.dir === dir && r.filename === filename && r.exists,
      );
      if (match) {
        return match.path;
      }
    }
  }

  return null;
}

/**
 * Reads a JSON file and returns its parsed content.
 */
async function readJsonFile(path: string): Promise<Record<string, unknown>> {
  const content = await Deno.readTextFile(path);
  return JSON.parse(content);
}

/**
 * Loads configuration from a deno.json or package.json file.
 *
 * Search order:
 * 1. Explicit path if provided
 * 2. deno.json in current directory or parents
 * 3. deno.jsonc in current directory or parents
 * 4. package.json in current directory or parents
 *
 * @param path - Optional explicit path to config file
 * @returns The loaded configuration merged with defaults
 */
export async function loadConfig(path?: string): Promise<ResolvedConfig> {
  let configPath: string | null = path ?? null;

  if (!configPath) {
    const cwd = Deno.cwd();
    configPath = await findConfigFile(cwd, ["deno.json", "deno.jsonc", "package.json"]);
  }

  let partial: Partial<AnteConfig> = {};
  let projectLicense: string | undefined;

  if (configPath) {
    try {
      const json = await readJsonFile(configPath);

      // Look for ante config section
      if (json.ante && typeof json.ante === "object") {
        partial = json.ante as Partial<AnteConfig>;
      }

      // Look for project license
      if (json.license && typeof json.license === "string") {
        projectLicense = json.license;
      }
    } catch {
      // Failed to read config, use defaults
    }
  }

  // Build resolved config
  const resolved = resolveConfig(partial);

  // Derive spdxLicense from project license if not explicitly set
  if (!partial.spdxLicense && projectLicense) {
    resolved.spdxLicense = projectLicense;
  }

  // Derive licenseUrl from spdxLicense if not explicitly set
  if (!partial.licenseUrl && resolved.spdxLicense) {
    resolved.licenseUrl = deriveLicenseUrl(resolved.spdxLicense);
  }

  // Derive maintainerEmail from git if not explicitly set
  if (!partial.maintainerEmail) {
    const email = await getGitConfig("user.email");
    if (email) {
      resolved.maintainerEmail = email;
    }
  }

  return resolved;
}

/**
 * Resolves a partial configuration by merging with defaults.
 *
 * @param partial - Partial configuration object
 * @returns Complete configuration with defaults applied
 */
export function resolveConfig(partial: Partial<AnteConfig>): ResolvedConfig {
  return {
    ...DEFAULT_CONFIG,
    ...partial,
    // Ensure arrays are not undefined
    manualContributors: partial.manualContributors ?? DEFAULT_CONFIG.manualContributors,
    include: partial.include ?? DEFAULT_CONFIG.include,
    exclude: partial.exclude ?? DEFAULT_CONFIG.exclude,
  };
}
