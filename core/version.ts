//--------------------------------------------------------------------------------------------------
// Copyright (c) 2025-2026              orgrinrt                 orgrinrt@ikiuni.dev
//                                      orgrinrt                 ort@hiisi.digital
// SPDX-License-Identifier: MPL-2.0     https://mozilla.org/MPL/2.0        ort@hiisi.digital
//--------------------------------------------------------------------------------------------------

/**
 * Package version.
 *
 * A constant rather than a read of `deno.json`, because the config sits beside
 * this module in a clone and nowhere else. Installed from jsr the module lives
 * behind an `https:` URL; built into an npm or bun distribution the config is
 * not shipped at all. Reading it from there fails to load the package rather
 * than reporting a wrong version.
 *
 * The duplication is real, and the suite pins the two together so they cannot
 * drift apart.
 */

/**
 * The current version of the ante package.
 *
 * @example
 * ```ts
 * import { VERSION } from "@hiisi/ante";
 * console.log(`ante v${VERSION}`);
 * ```
 */
export const VERSION: string = "0.3.0";
