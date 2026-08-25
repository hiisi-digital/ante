//----------------------------------------------------------------------------------------------------
// Copyright (c) 2025-2026                    orgrinrt                    orgrinrt@ikiuni.dev
//                                      orgrinrt                 ort@hiisi.digital
// SPDX-License-Identifier: MPL-2.0      https://mozilla.org/MPL/2.0 contact@hiisi.digital
//----------------------------------------------------------------------------------------------------

/**
 * Package version.
 *
 * A constant rather than a read of `deno.json`, because the config sits beside
 * this module in a clone and nowhere else. Installed from jsr the module lives
 * behind an `https:` URL; built into an npm or bun distribution the config is
 * not shipped at all. This was a static import, so the failure was not a wrong
 * version but a package that could not be loaded.
 *
 * The duplication is real and is pinned by `tests/version_test.ts`, so the two
 * cannot drift apart without the suite saying so.
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
export const VERSION: string = "0.2.3";
