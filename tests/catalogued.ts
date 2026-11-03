//--------------------------------------------------------------------------------------------------
// Copyright (c) 2026                   orgrinrt                 ort@hiisi.digital
// SPDX-License-Identifier: MPL-2.0     https://mozilla.org/MPL/2.0        ort@hiisi.digital
//--------------------------------------------------------------------------------------------------

/**
 * Whether the deliberately red tests run.
 *
 * A catalogued red states what green looks like for a gap nobody has closed yet.
 * It has to stay out of the ordinary run, or every run is red and nobody reads
 * the colour any more. It also has to be reachable, or nobody can tell whether
 * the gap is still there without editing source, and a gap that quietly closed
 * looks exactly like one that did not.
 *
 * `deno` has no flag for this. `--ignore` skips files and there is no `--ignored`
 * whatever a habit from another runtime suggests, so the switch is an
 * environment variable:
 *
 * ```bash
 * deno task test:catalogued
 * ```
 *
 * They are expected to fail. A green one is a gap that has closed, and the test
 * stops being catalogued and joins the ordinary suite.
 */
export const CATALOGUED: boolean = Deno.env.get("ANTE_CATALOGUED") === "1";
