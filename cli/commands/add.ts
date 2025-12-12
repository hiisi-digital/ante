//----------------------------------------------------------------------------------------------------
// Copyright (c) 2025                    orgrinrt                    orgrinrt@ikiuni.dev
// SPDX-License-Identifier: MPL-2.0      https://mozilla.org/MPL/2.0 contact@hiisi.digital
//----------------------------------------------------------------------------------------------------

/**
 * CLI command: add
 *
 * Adds a copyright header to a specific file.
 */

import type { AnteConfig } from "#core";

/**
 * Options for the add command.
 */
export interface AddOptions {
  /** Path to the file to add a header to */
  file: string;
  /** Force overwrite existing header */
  force?: boolean;
}

/**
 * Adds a copyright header to a specific file.
 *
 * @param options - Command options
 * @param config - Resolved configuration
 * @returns Exit code (0 for success, non-zero for failure)
 */
export function add(_options: AddOptions, _config: AnteConfig): Promise<number> {
  // TODO: Read the file content
  // TODO: Check if header already exists (unless force is true)
  // TODO: Get current git user as contributor
  // TODO: Determine year from file creation date or current date
  // TODO: Generate header using config
  // TODO: Prepend header to file content
  // TODO: Write file back
  // TODO: Print success message

  console.log("add command not yet implemented");
  return Promise.resolve(1);
}
