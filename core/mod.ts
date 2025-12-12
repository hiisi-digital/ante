//----------------------------------------------------------------------------------------------------
// Copyright (c) 2025                    orgrinrt                    orgrinrt@ikiuni.dev
//                                      orgrinrt                 ort@hiisi.digital
// SPDX-License-Identifier: MPL-2.0      https://mozilla.org/MPL/2.0 contact@hiisi.digital
//----------------------------------------------------------------------------------------------------

/**
 * Core module for ante - copyright header management.
 *
 * This module exports the main functionality for:
 * - Configuration loading and resolution
 * - Header parsing, generation, and updating
 * - Column-aligned formatting
 * - Contributor management
 */

export * from "./config.ts";
export * from "./contributors.ts";
export * from "./formatter.ts";
export * from "./glob.ts";
export * from "./header.ts";
export { VERSION } from "./version.ts";
