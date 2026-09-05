//----------------------------------------------------------------------------------------------------
// Copyright (c) 2025-2026                    orgrinrt                    orgrinrt@ikiuni.dev
//                                      orgrinrt                 ort@hiisi.digital
// SPDX-License-Identifier: MPL-2.0      https://mozilla.org/MPL/2.0 contact@hiisi.digital
//----------------------------------------------------------------------------------------------------

/**
 * Everything that needs a repository.
 *
 * Reading history for contributors and year ranges, and reading git's own config
 * for the maintainer.
 *
 * The reads answer with nothing outside a repository rather than failing, since
 * a file in a tarball is a normal thing to run over: `getStagedFiles` gives an
 * empty list and `isTrackedByGit` gives false.
 *
 * @module
 */

export * from "./history.ts";
