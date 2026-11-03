//--------------------------------------------------------------------------------------------------
// Copyright (c) 2026                   orgrinrt                 ort@hiisi.digital
// SPDX-License-Identifier: MPL-2.0     https://mozilla.org/MPL/2.0        ort@hiisi.digital
//--------------------------------------------------------------------------------------------------

/**
 * The instrument the conservation sweeps are read through.
 *
 * A check that can report a false green is worse than no check, because the
 * suite then says the thing held and nobody looks again. So the one this repo
 * leans on is itself pinned: what it must catch, and what it must wave through.
 *
 * @module
 */

import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { addresses, destroyed } from "./conservation.ts";

describe("the conservation check", () => {
  it("compares whole lines, so a longer one does not cover a deleted one", () => {
    // Substring containment reads the first of these as surviving, because its
    // text sits inside the second. It is the failure the instrument is most
    // able to hide, since the deleted line looks accounted for.
    const before = [
      "Copyright (c) 2015, Google Inc.",
      "Copyright (c) 2015, Google Inc. All rights reserved.",
    ];
    const after = "Copyright (c) 2015, Google Inc. All rights reserved.\n";

    assertEquals(destroyed(before, after), ["Copyright (c) 2015, Google Inc."]);
  });

  it("waves a line through when it is there with the comment mark still on", () => {
    const before = ["a notice worth keeping"];
    const after = "// a notice worth keeping\n";

    assertEquals(destroyed(before, after, { prefix: "//" }), []);
  });

  it("counts a licence the project did not configure, and not the one it did", () => {
    const mine = "SPDX-License-Identifier: MPL-2.0";
    const theirs = "SPDX-License-Identifier: ISC";
    const after = `${mine}\n`;

    assertEquals(destroyed([mine, theirs], after, { licence: "MPL-2.0" }), [theirs]);
    // Without a configured licence named, no declaration is anybody's to judge.
    assertEquals(destroyed([mine, theirs], after), []);
  });

  it("takes an address as attribution surviving, wherever on the line it lands", () => {
    const before = ["  Ada Lovelace   ada@example.com"];
    const after = "// Copyright (c) 2026   Ada Lovelace   ada@example.com\n";

    assertEquals(destroyed(before, after), []);
  });

  it("counts a name the contributor limit did not drop, and not one it did", () => {
    const before = ["a  a@x.dev", "b  b@x.dev"];
    const after = "a  a@x.dev\n";

    assertEquals(destroyed(before, after, { limit: 1 }), []);
    assertEquals(destroyed(before, after), ["b  b@x.dev"]);
  });

  it("reads an address and a link off a line, without the punctuation after them", () => {
    assertEquals(
      addresses("see https://example.com/notice, or write to legal@example.com."),
      ["https://example.com/notice", "legal@example.com"],
    );
  });
});
