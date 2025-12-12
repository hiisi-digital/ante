//----------------------------------------------------------------------------------------------------
// Copyright (c) 2025                    orgrinrt                    orgrinrt@ikiuni.dev
// SPDX-License-Identifier: MPL-2.0      https://mozilla.org/MPL/2.0 contact@hiisi.digital
//----------------------------------------------------------------------------------------------------

/**
 * CLI command: init
 *
 * Sets up ante configuration in deno.json and installs git hooks.
 */

import type { AnteConfig } from "#core";
import { deriveLicenseUrl, loadConfig } from "#core";
import { installHook } from "#git";

/**
 * Options for the init command.
 */
export interface InitOptions {
  /** Skip interactive prompts and use defaults */
  yes?: boolean;
  /** Skip git hook installation */
  skipHooks?: boolean;
  /** Target directory (defaults to cwd) */
  dir?: string;
}

/**
 * Result of the init command.
 */
export interface InitResult {
  /** Whether config was created or updated */
  configUpdated: boolean;
  /** Whether hooks were installed */
  hooksInstalled: boolean;
  /** Path to the config file */
  configPath: string;
}

/**
 * Finds an existing config file or determines where to create one.
 */
async function findOrCreateConfigPath(dir: string): Promise<string> {
  const candidates = ["deno.json", "deno.jsonc", "package.json"];
  const paths = candidates.map((filename) => `${dir}/${filename}`);

  // Check all candidates in parallel
  const results = await Promise.all(
    paths.map(async (path) => {
      try {
        const stat = await Deno.stat(path);
        return stat.isFile ? path : null;
      } catch {
        return null;
      }
    }),
  );

  // Return the first existing file, or default to deno.json
  const found = results.find((r) => r !== null);
  return found ?? `${dir}/deno.json`;
}

/**
 * Reads a JSON file.
 */
async function readJsonFile(path: string): Promise<Record<string, unknown>> {
  try {
    const content = await Deno.readTextFile(path);
    return JSON.parse(content);
  } catch {
    return {};
  }
}

/**
 * Writes a JSON file with pretty formatting.
 */
async function writeJsonFile(
  path: string,
  content: Record<string, unknown>,
): Promise<void> {
  const json = JSON.stringify(content, null, 2);
  await Deno.writeTextFile(path, json + "\n");
}

/**
 * Detects the license from an existing config file.
 */
function detectLicense(config: Record<string, unknown>): string | null {
  if (typeof config.license === "string") {
    return config.license;
  }
  return null;
}

/**
 * Creates the default ante config section.
 */
function createDefaultAnteConfig(license?: string): Partial<AnteConfig> {
  const config: Partial<AnteConfig> = {
    width: 100,
    maxContributors: 3,
    contributorSelection: "commits",
  };

  if (license) {
    config.spdxLicense = license;
    config.licenseUrl = deriveLicenseUrl(license);
  }

  return config;
}

/**
 * Runs the init command.
 */
export async function runInit(options: InitOptions = {}): Promise<InitResult> {
  const targetDir = options.dir ?? Deno.cwd();
  const configPath = await findOrCreateConfigPath(targetDir);

  console.log(`Initializing ante in ${targetDir}...`);

  // Read existing config
  const existingConfig = await readJsonFile(configPath);
  let configUpdated = false;

  // Check if ante section already exists
  if (!existingConfig.ante) {
    const license = detectLicense(existingConfig);
    const anteConfig = createDefaultAnteConfig(license ?? undefined);

    existingConfig.ante = anteConfig;
    await writeJsonFile(configPath, existingConfig);
    configUpdated = true;

    console.log(`  Created ante configuration in ${configPath}`);
  } else {
    console.log(`  ante configuration already exists in ${configPath}`);
  }

  // Install hooks unless skipped
  let hooksInstalled = false;
  if (!options.skipHooks) {
    try {
      // Load the full resolved config for hook generation
      const resolvedConfig = await loadConfig(configPath);
      await installHook(targetDir, resolvedConfig);
      hooksInstalled = true;
      console.log("  Installed git hooks to .githooks/");
      console.log("  Configured git to use .githooks/ as hooks path");
    } catch (error) {
      console.error(
        "  Warning: Failed to install git hooks:",
        error instanceof Error ? error.message : error,
      );
    }
  } else {
    console.log("  Skipped git hook installation");
  }

  console.log("");
  console.log("Done! ante is now configured.");

  if (hooksInstalled) {
    console.log("");
    console.log("The pre-commit hook will automatically:");
    console.log("  - Add copyright headers to new TypeScript files");
    console.log("  - Add you as a contributor when you modify files");
    console.log("  - Update year ranges when files change");
  }

  return {
    configUpdated,
    hooksInstalled,
    configPath,
  };
}

/**
 * Prompts the user for configuration values interactively.
 * Currently a stub - returns defaults.
 */
export async function promptForConfig(): Promise<Partial<AnteConfig>> {
  // For now, return defaults. Interactive prompts can be added later.
  await Promise.resolve();
  return createDefaultAnteConfig();
}
