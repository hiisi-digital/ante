//----------------------------------------------------------------------------------------------------
// Copyright (c) 2025                    orgrinrt                    orgrinrt@ikiuni.dev
//                                      orgrinrt                 ort@hiisi.digital
// SPDX-License-Identifier: MPL-2.0      https://mozilla.org/MPL/2.0 contact@hiisi.digital
//----------------------------------------------------------------------------------------------------

/**
 * Package version.
 *
 * This module exports the current version of the ante package.
 * The version is read from deno.json to ensure consistency.
 */

// Import version from deno.json
// Note: This works in Deno but requires --allow-read for the config file
import config from "../deno.json" with { type: "json" };

/**
 * The current version of the ante package.
 *
 * @example
 * ```ts
 * import { VERSION } from "@loru/ante";
 * console.log(`ante v${VERSION}`);
 * ```
 */
export const VERSION: string = config.version;
