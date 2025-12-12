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
 */

// TODO: Implement loadConfig(path?: string) - find and load deno.json
// TODO: Implement resolveConfig(partial) - merge with defaults
// TODO: Implement deriveLicenseUrl(spdx: string) - map SPDX -> URL
// TODO: Implement getGitConfig(key: string) - read git config values

/**
 * Represents a contributor in a copyright header.
 */
export interface Contributor {
  /** The contributor's display name */
  name: string;
  /** The contributor's email address */
  email: string;
}

/**
 * Contributor selection strategy.
 */
export type ContributorSelection = "commits" | "lines" | "recent" | "manual";

/**
 * Configuration for ante copyright header management.
 * This interface is generated from schema/config.schema.json.
 */
export interface AnteConfig {
  /** Total line width for headers. Default: 100 */
  width: number;

  /** Character used for separator lines. Default: "-" */
  separatorChar: string;

  /** Comment prefix for the language. Default: "//" */
  commentPrefix: string;

  /** Column position where name starts (0-indexed). Default: 40 */
  nameColumn: number;

  /** Column position where email starts (0-indexed). Default: 65 */
  emailColumn: number;

  /** Column position for license URL in SPDX line (0-indexed). Default: 40 */
  licenseUrlColumn: number;

  /** Column position for maintainer contact in SPDX line (0-indexed). Default: 75 */
  maintainerColumn: number;

  /** SPDX license identifier. Default: from deno.json "license" or "MIT" */
  spdxLicense: string;

  /** License URL. Default: derived from SPDX identifier */
  licenseUrl: string;

  /** Maintainer contact email. Default: from git config user.email */
  maintainerEmail: string;

  /** Maximum contributors to show in header. Default: 3 */
  maxContributors: number;

  /** Strategy for selecting contributors. Default: "commits" */
  contributorSelection: ContributorSelection;

  /** Manual contributor list (used when contributorSelection is "manual") */
  manualContributors: Contributor[];

  /** File patterns to include. Default: ["**\/*.ts", "**\/*.tsx", "**\/*.js", "**\/*.jsx"] */
  include: string[];

  /** File patterns to exclude. Default: ["**\/node_modules\/**", "**\/dist\/**"] */
  exclude: string[];
}

/**
 * Fully resolved configuration with all values populated.
 * This is the config type used internally after loading and merging defaults.
 */
export type ResolvedConfig = AnteConfig;

/** Default configuration values */
export const DEFAULT_CONFIG: AnteConfig = {
  width: 100,
  separatorChar: "-",
  commentPrefix: "//",
  nameColumn: 40,
  emailColumn: 65,
  licenseUrlColumn: 40,
  maintainerColumn: 75,
  spdxLicense: "MIT",
  licenseUrl: "",
  maintainerEmail: "",
  maxContributors: 3,
  contributorSelection: "commits",
  manualContributors: [],
  include: ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx"],
  exclude: ["**/node_modules/**", "**/dist/**"],
};

/**
 * Loads configuration from a deno.json or package.json file.
 *
 * @param path - Optional path to config file. Searches upward if not provided.
 * @returns The loaded configuration merged with defaults.
 */
export function loadConfig(_path?: string): Promise<AnteConfig> {
  // TODO: Implement config file discovery and loading
  return Promise.resolve({ ...DEFAULT_CONFIG });
}

/**
 * Resolves a partial configuration by merging with defaults.
 *
 * @param partial - Partial configuration object
 * @returns Complete configuration with defaults applied
 */
export function resolveConfig(partial: Partial<AnteConfig>): AnteConfig {
  return { ...DEFAULT_CONFIG, ...partial };
}

/**
 * Derives the license URL from an SPDX identifier.
 *
 * @param spdx - SPDX license identifier (e.g., "MIT", "MPL-2.0")
 * @returns The canonical URL for that license
 */
export function deriveLicenseUrl(spdx: string): string {
  // TODO: Implement full SPDX -> URL mapping
  const urls: Record<string, string> = {
    "MIT": "https://opensource.org/licenses/MIT",
    "MPL-2.0": "https://mozilla.org/MPL/2.0",
    "Apache-2.0": "https://www.apache.org/licenses/LICENSE-2.0",
    "GPL-3.0": "https://www.gnu.org/licenses/gpl-3.0.html",
    "BSD-3-Clause": "https://opensource.org/licenses/BSD-3-Clause",
  };
  return urls[spdx] ?? `https://spdx.org/licenses/${spdx}.html`;
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
