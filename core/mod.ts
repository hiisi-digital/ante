//--------------------------------------------------------------------------------------------------
// Copyright (c) 2025-2026              orgrinrt                 orgrinrt@ikiuni.dev
//                                      orgrinrt                 ort@hiisi.digital
// SPDX-License-Identifier: MPL-2.0     https://mozilla.org/MPL/2.0        ort@hiisi.digital
//--------------------------------------------------------------------------------------------------

/**
 * Everything that does not need git.
 *
 * Configuration, header parsing and generation, column alignment, and the
 * selection of contributors from a history somebody else read. The git side is
 * `#git`, and the split is which of the two a function needs a repository for.
 *
 * @module
 */

export * from "./config.ts";
export * from "./contributors.ts";
export * from "./formatter.ts";
export * from "./glob.ts";
export * from "./header.ts";
export * from "./run.ts";
export { VERSION } from "./version.ts";
