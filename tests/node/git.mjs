//----------------------------------------------------------------------------------------------------
// Copyright (c) 2025                    orgrinrt                    orgrinrt@ikiuni.dev
// SPDX-License-Identifier: MPL-2.0      https://mozilla.org/MPL/2.0 contact@hiisi.digital
//----------------------------------------------------------------------------------------------------

/**
 * The git-backed paths, from Node, against the built npm package.
 *
 * These are what `Deno.Command` used to gate. The dnt shim does not provide it, at runtime
 * or in its types, so every one of them threw `Deno is not defined` in the npm build. That
 * went unnoticed because the build turned type-checking off with a note calling the shim's
 * typing awkward, and because nothing ever ran the built package.
 *
 * Needs the npm build first:
 *   deno task test:node
 */

import { execFileSync } from "node:child_process";

import { getGitConfig } from "../../npm/esm/mod.js";
import { getStagedFiles } from "../../npm/esm/git/mod.js";

/** What git itself says, asked directly rather than through the package. */
function gitSays(...args) {
  try {
    return execFileSync("git", args, { encoding: "utf8" }).trim();
  } catch {
    return "";
  }
}

let errors = 0;

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    errors++;
  } else {
    console.log(`PASS: ${message}`);
  }
}

try {
  // Compared against what git itself says, not merely checked for being a string.
  //
  // A weaker assertion passes without the fix, and that is the whole point: `getGitConfig`
  // catches its own errors and returns "" on failure, so under the old code it did not
  // throw on Node, it silently answered "" to every question. Headers would have been
  // written with no author and nothing would have said why. A control that put
  // `Deno.Command` back caught nothing until this assertion was sharpened.
  const expected = gitSays("config", "--get", "user.email");
  const email = await getGitConfig("user.email");
  assert(
    email === expected,
    `getGitConfig agrees with git itself (got "${email}", git says "${expected}")`,
  );
  assert(expected !== "", "and the value is non-empty, so the comparison means something");

  // And a question about this working tree.
  const staged = await getStagedFiles();
  const expectedStaged = gitSays("diff", "--cached", "--name-only", "--diff-filter=ACM");
  const expectedCount = expectedStaged === "" ? 0 : expectedStaged.split("\n").length;
  assert(
    Array.isArray(staged) && staged.length === expectedCount,
    `getStagedFiles agrees with git itself (got ${staged.length}, git says ${expectedCount})`,
  );

  // A key nothing sets, so the empty-result path runs too.
  const absent = await getGitConfig("ante.no.such.key");
  assert(absent === "", "an unset key is the empty string rather than a throw");
} catch (err) {
  console.error("CRITICAL: uncaught exception. This is what used to happen for all three:");
  console.error(err);
  errors++;
}

if (errors > 0) {
  console.error(`\nGit smoke test failed with ${errors} error(s).`);
  process.exit(1);
}
console.log("\nGit smoke test passed successfully!");
