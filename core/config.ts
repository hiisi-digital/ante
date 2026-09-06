//--------------------------------------------------------------------------------------------------
// Copyright (c) 2025-2026              orgrinrt                 orgrinrt@ikiuni.dev
//                                      orgrinrt                 ort@hiisi.digital
// SPDX-License-Identifier: MPL-2.0     https://mozilla.org/MPL/2.0        ort@hiisi.digital
//--------------------------------------------------------------------------------------------------

/**
 * Where the configuration comes from, and what is derived rather than written.
 *
 * `ante.toml` is looked for first, because a project writes one only when it
 * means to configure ante there, and then the `ante` section of `deno.json` or
 * `package.json`. The SPDX identifier and its URL come from the manifest's own
 * `license` field, and the maintainer from git's config, so a project that has
 * already said those things once does not say them again.
 *
 * The types are generated from `schema/config.schema.json` into
 * `config.generated.ts`, so the schema and the types cannot disagree.
 *
 * @module
 */

// Re-export all generated types
export type {
  AnteConfig,
  Contributor,
  ContributorSelection,
  ResolvedConfig,
} from "./config.generated.ts";

export { CONFIG_BOUNDS, DEFAULT_CONFIG } from "./config.generated.ts";

import type { AnteConfig, ResolvedConfig } from "./config.generated.ts";
import { CONFIG_BOUNDS, DEFAULT_CONFIG } from "./config.generated.ts";
import { parse as parseToml } from "@std/toml";
import { run } from "./run.ts";

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
  // A compound expression names no single page. `MIT OR Apache-2.0` has an
  // entry for each half and none for the pair, so the guessed link would be a
  // 404 with spaces in it, and a url with spaces in it is not a url: the header
  // it lands in reads back as one long licence expression and then disagrees
  // with the configuration it was written from, permanently.
  if (!/^[A-Za-z0-9.+-]+$/.test(spdx)) return "";
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
    const output = await run("git", ["config", "--get", key]);
    if (output.success) {
      return output.stdout.trim();
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
export async function readJsonFile(path: string): Promise<Record<string, unknown>> {
  const content = await Deno.readTextFile(path);
  return JSON.parse(content);
}

async function readTomlFile(path: string): Promise<Record<string, unknown>> {
  const content = await Deno.readTextFile(path);
  return parseToml(content) as Record<string, unknown>;
}

/**
 * Pull the ante section out of a parsed config file.
 *
 * In a shared manifest (deno.json, package.json) the config lives under an
 * `ante` key, because the rest of the file belongs to someone else. In a
 * standalone `ante.toml` the whole file is ante's, so the top level is the
 * config. An `[ante]` table is still honoured there, so a single file can be
 * moved between the two shapes without being rewritten.
 */
function extractAnteSection(
  json: Record<string, unknown>,
  standalone: boolean,
): Partial<AnteConfig> {
  if (json.ante && typeof json.ante === "object") {
    return json.ante as Partial<AnteConfig>;
  }
  return standalone ? (json as Partial<AnteConfig>) : {};
}

/**
 * Find the project licence for a standalone config.
 *
 * `ante.toml` carries no licence of its own, so the SPDX identifier is read
 * from whichever manifest sits beside it. Cargo puts it under `[package]`;
 * the JSON manifests put it at the top level.
 */
async function findSiblingLicense(dir: string): Promise<string | undefined> {
  // Read a manifest's licence, or undefined if it is absent or unreadable.
  const licenseOf = async (name: string): Promise<string | undefined> => {
    const path = `${dir}/${name}`;
    if (!(await fileExists(path))) return undefined;
    try {
      if (name === "Cargo.toml") {
        const toml = await readTomlFile(path);
        const pkg = toml.package as Record<string, unknown> | undefined;
        return typeof pkg?.license === "string" ? pkg.license : undefined;
      }
      const json = await readJsonFile(path);
      return typeof json.license === "string" ? json.license : undefined;
    } catch {
      return undefined;
    }
  };

  // Checked in parallel, but resolved in order, so Cargo.toml still wins.
  const names = ["Cargo.toml", "deno.json", "deno.jsonc", "package.json"];
  const found = await Promise.all(names.map(licenseOf));
  return found.find((license) => license !== undefined);
}

/**
 * Loads configuration from a deno.json or package.json file.
 *
 * Search order:
 * 1. Explicit path if provided
 * 2. ante.toml in current directory or parents
 * 3. deno.json in current directory or parents
 * 4. deno.jsonc in current directory or parents
 * 5. package.json in current directory or parents
 *
 * `ante.toml` comes first because it is unambiguous: a project only writes one
 * when it means to configure ante there. It is also the way a Rust, Bash or any
 * other project with no JSON manifest configures ante.
 *
 * @param path - Optional explicit path to config file
 * @returns The loaded configuration merged with defaults
 */
export async function loadConfig(path?: string): Promise<ResolvedConfig> {
  let configPath: string | null = path ?? null;

  if (!configPath) {
    const cwd = Deno.cwd();
    configPath = await findConfigFile(cwd, [
      "ante.toml",
      "deno.json",
      "deno.jsonc",
      "package.json",
    ]);
  }

  let partial: Partial<AnteConfig> = {};
  let projectLicense: string | undefined;

  if (configPath) {
    const isToml = configPath.endsWith(".toml");
    try {
      const parsed = isToml ? await readTomlFile(configPath) : await readJsonFile(configPath);

      partial = extractAnteSection(parsed, isToml);

      // Look for project license
      if (typeof parsed.license === "string") {
        projectLicense = parsed.license;
      }

      // A standalone ante.toml carries no licence of its own, so read it from
      // whichever manifest sits beside it.
      if (!projectLicense && isToml) {
        const dir = configPath.slice(0, configPath.lastIndexOf("/")) || ".";
        projectLicense = await findSiblingLicense(dir);
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
 * Every numeric option the schema gives a range to is checked against it, and a
 * value outside its range throws rather than being clamped or passed through.
 * The ranges are not decoration: a width of 3 has no room for a name, and a name
 * column past the width puts the name outside the line, so what comes out is a
 * header nobody can read from a file that looked configured. Clamping would be
 * worse than either, since the file would say one thing and the output another.
 *
 * @param partial - Partial configuration object
 * @returns Complete configuration with defaults applied
 * @throws If a numeric option falls outside the range the schema declares
 */
export function resolveConfig(partial: Partial<AnteConfig>): ResolvedConfig {
  const merged: ResolvedConfig = {
    ...DEFAULT_CONFIG,
    ...partial,
    // Ensure arrays are not undefined
    manualContributors: partial.manualContributors ?? DEFAULT_CONFIG.manualContributors,
    include: partial.include ?? DEFAULT_CONFIG.include,
    exclude: partial.exclude ?? DEFAULT_CONFIG.exclude,
  };

  for (const [key, { min, max }] of Object.entries(CONFIG_BOUNDS)) {
    const value = (merged as Record<string, unknown>)[key];
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new Error(
        `ante config: ${key} has to be a number, and it is ${JSON.stringify(value)}.`,
      );
    }
    if (value < min || value > max) {
      throw new Error(
        `ante config: ${key} is ${value}, and it has to be between ${min} and ${max}.`,
      );
    }
  }

  return merged;
}
