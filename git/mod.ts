//----------------------------------------------------------------------------------------------------
// Copyright (c) 2025-2026                    orgrinrt                    orgrinrt@ikiuni.dev
//                                      orgrinrt                 ort@hiisi.digital
// SPDX-License-Identifier: MPL-2.0      https://mozilla.org/MPL/2.0 contact@hiisi.digital
//----------------------------------------------------------------------------------------------------

/**
 * Everything that needs a repository.
 *
 * Reading history for contributors and year ranges, reading git's own config for
 * the maintainer, and installing the hooks.
 *
 * The reads answer with nothing outside a repository rather than failing, since
 * a file in a tarball is a normal thing to run over: `getStagedFiles` gives an
 * empty list and `isTrackedByGit` gives false. The installers are not in that
 * set and are not meant to be. `installHook` writes files and sets
 * `core.hooksPath`, and somewhere with no repository is somewhere it should
 * refuse.
 *
 * @module
 */

export * from "./history.ts";
export * from "./hooks.ts";
