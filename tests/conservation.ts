//--------------------------------------------------------------------------------------------------
// Copyright (c) 2026                   orgrinrt                 ort@hiisi.digital
// SPDX-License-Identifier: MPL-2.0     https://mozilla.org/MPL/2.0        ort@hiisi.digital
//--------------------------------------------------------------------------------------------------

/**
 * The conservation property, shared by the two suites that assert it.
 *
 * `roundtrip_test.ts` asserts it over blocks built from shapes we chose, and
 * `corpus_test.ts` asserts it over 244 harvested from vendored source. Both ask
 * the same question, so the question lives here rather than twice.
 */

/** Every address and link in a line, which is what attribution comes down to. */
export function addresses(line: string): string[] {
  return [...line.matchAll(/\S+@\S+|https?:\/\/\S+/g)].map((one) => one[0].replace(/[.,;]+$/, ""));
}

/** How much of the block the tool is entitled to have changed. */
export interface Allowance {
  /**
   * The contributor limit, when one is in play. Addresses past it are dropped
   * on purpose, which is the one deletion this tool makes deliberately.
   */
  limit?: number;
  /** The comment prefix to take off a line before comparing it. */
  prefix?: string;
  /**
   * The licence the project configured.
   *
   * A file declaring that licence has its declaration rewritten by the tool,
   * which is the tool doing what it was asked. A file declaring a different one
   * is somebody else's, and replacing its declaration is a statement about
   * their code rather than ours, so that line is counted.
   */
  licence?: string;
}

/**
 * Every line of `before` whose content `after` no longer carries.
 *
 * A line survives if it is still there word for word, which is what happens to
 * anything this tool does not model. A line it does model is rewritten into its
 * own form, and what has to come through that is the attribution: every address
 * the line carried is still somewhere in the header.
 *
 * The licence a line declared is deliberately not in this. A project's
 * configured licence is what the tool writes, so a file declaring a different
 * one has it replaced, and whether that is right for a vendored file is a
 * question this property is not the place to settle.
 */
export function destroyed(
  before: readonly string[],
  after: string,
  how: Allowance = {},
): string[] {
  const dropped = new Set(
    how.limit === undefined ? [] : before.flatMap(addresses).slice(how.limit),
  );
  const bare = how.prefix === undefined
    ? undefined
    : new RegExp(`^${how.prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s?`);

  // Whole lines, not substrings. A deleted line whose text happens to sit
  // inside a longer one that stayed reads as surviving under containment, and
  // an instrument that can report a false green is worse than none.
  const standing = new Set(
    after.split("\n").map((one) => (bare === undefined ? one : one.replace(bare, "")).trim()),
  );

  return before.filter((one) => {
    const text = (bare === undefined ? one : one.replace(bare, "")).trim();
    if (text === "" || standing.has(text)) return false;

    // Unanchored, because a caller that does not name a prefix hands these in
    // with the comment marker still on the front.
    const declared = text.match(/SPDX-License-Identifier:\s*(\S+)/i);
    if (declared !== null) {
      return how.licence !== undefined && declared[1] !== how.licence;
    }

    const links = addresses(one);
    if (links.length === 0) return true;
    return !links.filter((one) => !dropped.has(one)).every((one) => after.includes(one));
  });
}
