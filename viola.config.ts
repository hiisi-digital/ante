//--------------------------------------------------------------------------------------------------
// Copyright (c) 2026                   orgrinrt                 ort@hiisi.digital
// SPDX-License-Identifier: MPL-2.0     https://mozilla.org/MPL/2.0        ort@hiisi.digital
//--------------------------------------------------------------------------------------------------

/**
 * What this package has to be true of before anything may be committed.
 *
 * Deliberately harsher than the code currently is. A lint set tuned to what
 * already passes measures nothing, and the point of putting it here is that it
 * refuses work rather than describes it.
 *
 * @module
 */

import defaultLints from "@hiisi/viola-default-lints";
import typescript from "@hiisi/viola-grammar-ts";
import { report, viola, when } from "@hiisi/viola";

export default viola()
  .use(defaultLints)
  // the grammar is what turns a file into something a lint can ask questions
  // of. the alias defaults to the grammar's own id, so naming it "typescript"
  // said the same thing twice.
  .add(typescript)
  // anything a linter has any confidence in at all is a failure. a warning
  // is a finding nobody acts on, and a gate that warns is not a gate. the
  // floor was 50 and everything under it passed silently.
  .rule(report.error, when.confidence.atLeast(1))
  // tests are held to the same bar as source. a fixture that drifts is how a
  // suite stops measuring the thing it names.
  .rule(report.error, when.in("tests/**/*.ts"))
  // fixtures that are supposed to be wrong are the one exception, since being
  // wrong is their entire job.
  .rule(report.off, when.in("tests/compile_fail/**"))
  .rule(report.off, when.in("**/fixtures/**"))
  // a literal spelled out across several test cases is several tests each
  // asserting its own expected value. counting those toward a duplication
  // threshold asks for a shared constant, and a test comparing a constant to
  // itself has stopped testing anything. they still show in the locations
  // list, they just do not push a string over the threshold on their own.
  .set("duplicate-strings.countIn", [
    "**",
    "!**/*_test.ts",
    "!**/*.test.ts",
    "!**/tests/**",
    "!**/fixtures/**",
  ])
  // Most of what is left is somebody else's vocabulary rather than repetition
  // of ours. `user.email` and `core.hooksPath` are git config keys, `--follow`
  // and `--format=%aI` are git's own flags, and `deno.jsonc` is a filename deno
  // defines. `array`, `integer` and `Contributor[]` are type names inside
  // validation messages, where the point is that the message says the type. A
  // constant for any of these would replace a name the reader can look up with
  // one only this codebase knows.
  .set("duplicate-strings.ignoreStrings", [
    "array",
    "config",
    "core.hooksPath",
    "deno.jsonc",
    "integer",
    "user.email",
    "Contributor[]",
    "--follow",
    "--format=%aI",
    "(?:.*",
  ])
  // `run` and `main` are the conventional names for a command's entry point and
  // a test's runner. Several files having one each is the convention working,
  // not a collision: they are reached through their own module and never by
  // name from elsewhere.
  .set("similar-functions.ignoreFunctions", ["run", "main"])
  // `HeaderValidation` says whether a header is well formed; `FileCheckResult`
  // says what happened to one file, validation included. They overlap because
  // the second carries the first, and merging them would let a caller pass a
  // file result where a validation is wanted.
  .set("similar-types.ignoreTypes", ["HeaderValidation", "FileCheckResult"]);
