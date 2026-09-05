//----------------------------------------------------------------------------------------------------
// Copyright (c) 2025-2026                    orgrinrt                    orgrinrt@ikiuni.dev
//                                      orgrinrt                 ort@hiisi.digital
// SPDX-License-Identifier: MPL-2.0      https://mozilla.org/MPL/2.0 contact@hiisi.digital
//----------------------------------------------------------------------------------------------------

/**
 * CLI command: init
 *
 * Sets up ante configuration in deno.json.
 */

import type { AnteConfig } from "#core";
import { deriveLicenseUrl } from "#core";
import { readJsonFile } from "#core";

/**
 * Options for the init command.
 */
interface InitOptions {
  /** Skip interactive prompts and use defaults */
  yes?: boolean;
  /** Target directory (defaults to cwd) */
  dir?: string;
}

/**
 * Result of the init command.
 */
interface InitResult {
  /** Whether config was created or updated */
  configUpdated: boolean;
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

  console.log("");
  console.log("Done! ante is now configured.");
  console.log("");
  console.log("Run `ante fix` to write headers, or `ante check` from a hook or a pipeline.");

  return {
    configUpdated,
    configPath,
  };
}
