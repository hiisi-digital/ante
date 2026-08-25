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
   * Whether a copyright line is exempt. It is a field the tool owns and
   * rewrites, so a vendored file's own years going is the tool doing what it
   * was asked rather than losing something.
   */
  rewritesCopyright?: boolean;
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

  return before.filter((one) => {
    const text = (bare === undefined ? one : one.replace(bare, "")).trim();
    if (text === "" || after.includes(text)) return false;
    // Unanchored, because a caller that does not name a prefix hands these in
    // with the comment marker still on the front.
    if (/SPDX-License-Identifier:/i.test(text)) return false;
    if (how.rewritesCopyright && /\bCopyright\b/i.test(text)) return false;

    const links = addresses(one);
    if (links.length === 0) return true;
    return !links.filter((one) => !dropped.has(one)).every((one) => after.includes(one));
  });
}
