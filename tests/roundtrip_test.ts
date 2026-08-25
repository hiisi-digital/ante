//----------------------------------------------------------------------------------------------------
// Copyright (c) 2025-2026                    orgrinrt                    orgrinrt@ikiuni.dev
//                                      orgrinrt                 ort@hiisi.digital
// SPDX-License-Identifier: MPL-2.0      https://mozilla.org/MPL/2.0 contact@hiisi.digital
//----------------------------------------------------------------------------------------------------

/**
 * The round trip, swept.
 *
 * A header is written by {@link generateHeader} and read back by
 * {@link parseHeader}, and every command in the tool composes those two: `check`
 * reads and compares, `fix` reads, updates and writes. So the composition being
 * the identity is not a nicety, it is the thing that decides whether a repair
 * loses a contributor.
 *
 * The columns, the width and the contributor limit are all configurable, and the
 * defaults sit comfortably inside the region where the round trip holds. That is
 * why a single-point test passed for as long as it did. The sweep goes either
 * side of every boundary instead.
 */

import { assertEquals, assertStringIncludes } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import {
  type Contributor,
  deriveLicenseUrl,
  generateHeader,
  parseHeader,
  replaceHeader,
  resolveConfig,
  rewriteHeader,
  updateHeader,
} from "#core";
import { DEFAULT_CONFIG } from "#core";
import type { ResolvedConfig } from "#core";

/** A configuration built from the defaults with the swept fields replaced. */
function shaped(over: Partial<ResolvedConfig>): ResolvedConfig {
  return {
    ...DEFAULT_CONFIG,
    spdxLicense: "MPL-2.0",
    licenseUrl: "https://mozilla.org/MPL/2.0",
    maintainerEmail: "contact@hiisi.digital",
    ...over,
  };
}

/**
 * The ends of every configurable range, from `schema/config.schema.json`.
 *
 * The sweep runs the extremes rather than a comfortable middle, because the
 * middle is where the round trip held for as long as nobody looked. A shape
 * outside these is not one a project can ask for, so it is not swept.
 */
const BOUNDS = {
  width: [60, 100, 200],
  nameColumn: [20, 40, 100],
  emailColumn: [40, 150],
  licenseUrlColumn: [20, 100],
  maintainerColumn: [50, 150],
  maxContributors: [1, 3, 10],
} as const;

/** A column pulled back inside the range the schema permits. */
function within(value: number, [low, high]: readonly [number, number]): number {
  return Math.min(high, Math.max(low, value));
}

/** Names either side of the width at which one overruns its column. */
const NAMES = [
  "a",
  "orgrinrt",
  "Ada Lovelace",
  "Jean-Baptiste Grenouille",
  "A Name That Is Considerably Longer Than Any Column",
];

function people(count: number): Contributor[] {
  return NAMES.slice(0, count).map((name, at) => ({
    name,
    email: `p${at}@example.com`,
  }));
}

/** Every shape the sweep covers, as a flat list so a failure names itself. */
function shapes(): { label: string; config: ResolvedConfig; who: Contributor[] }[] {
  const out: { label: string; config: ResolvedConfig; who: Contributor[] }[] = [];
  for (const nameColumn of BOUNDS.nameColumn) {
    for (const gap of [2, 25, 50]) {
      const emailColumn = within(nameColumn + gap, BOUNDS.emailColumn);
      for (const maxContributors of BOUNDS.maxContributors) {
        for (const count of [1, 3, 5]) {
          for (const width of BOUNDS.width) {
            for (const commentPrefix of ["//", "#", "--", ";;"]) {
              for (const separatorChar of ["-", "=", "*", "~"]) {
                const config = shaped({
                  nameColumn,
                  emailColumn,
                  maxContributors,
                  width,
                  commentPrefix,
                  separatorChar,
                  // The licence line has the same two-field geometry as a
                  // copyright line and the same overrun, so it is swept
                  // alongside rather than separately. Its two columns have
                  // ranges of their own, so they follow the contributor columns
                  // only as far as those ranges allow.
                  licenseUrlColumn: within(nameColumn, BOUNDS.licenseUrlColumn),
                  maintainerColumn: within(emailColumn + 10, BOUNDS.maintainerColumn),
                });
                out.push({
                  label: `nameColumn=${nameColumn} emailColumn=${emailColumn} ` +
                    `max=${maxContributors} people=${count} width=${width} ` +
                    `prefix=${commentPrefix} sep=${separatorChar}`,
                  config,
                  who: people(count),
                });
              }
            }
          }
        }
      }
    }
  }
  return out;
}

describe("what is written is what is read back", () => {
  it("holds across every column, width and contributor count", () => {
    const broken: string[] = [];

    for (const { label, config, who } of shapes()) {
      const written = generateHeader(config, who, 2020, 2026);
      const read = parseHeader(`${written}\n\nconst x = 1;\n`, config);

      if (read === null) {
        broken.push(`${label}: did not parse at all`);
        continue;
      }

      const kept = who.slice(0, config.maxContributors);
      if (read.contributors.length !== kept.length) {
        broken.push(
          `${label}: ${kept.length} written, ${read.contributors.length} read back`,
        );
        continue;
      }
      for (let at = 0; at < kept.length; at++) {
        if (read.contributors[at].name !== kept[at].name) {
          broken.push(
            `${label}: name ${at} was ${JSON.stringify(kept[at].name)}, ` +
              `read ${JSON.stringify(read.contributors[at].name)}`,
          );
        }
        if (read.contributors[at].email !== kept[at].email) {
          broken.push(
            `${label}: email ${at} was ${kept[at].email}, read ${read.contributors[at].email}`,
          );
        }
      }

      if (read.yearStart !== 2020 || read.yearEnd !== 2026) {
        broken.push(`${label}: years read as ${read.yearStart}-${read.yearEnd}`);
      }
      if (read.spdxLicense !== "MPL-2.0") {
        broken.push(`${label}: spdx read as ${read.spdxLicense}`);
      }
      if (read.licenseUrl !== "https://mozilla.org/MPL/2.0") {
        broken.push(`${label}: licence url read as ${read.licenseUrl}`);
      }
      if (read.maintainerEmail !== "contact@hiisi.digital") {
        broken.push(`${label}: maintainer read as ${read.maintainerEmail}`);
      }
    }

    assertEquals(
      broken,
      [],
      `${broken.length} of ${shapes().length} shapes lose something:\n${
        broken.slice(0, 20).join("\n")
      }`,
    );
  });

  it("is a fixed point, so a second write changes nothing", () => {
    const broken: string[] = [];

    for (const { label, config, who } of shapes()) {
      const once = generateHeader(config, who, 2020, 2026);
      const read = parseHeader(`${once}\n\nconst x = 1;\n`, config);
      if (read === null) {
        broken.push(`${label}: did not parse at all`);
        continue;
      }
      const twice = generateHeader(
        config,
        read.contributors,
        read.yearStart,
        read.yearEnd,
      );
      if (twice !== once) {
        broken.push(
          `${label}:\n  first  ${JSON.stringify(once)}\n  second ${JSON.stringify(twice)}`,
        );
      }
    }

    assertEquals(
      broken,
      [],
      `${broken.length} of ${shapes().length} shapes are not fixed points:\n${
        broken.slice(0, 10).join("\n")
      }`,
    );
  });

  it("leaves a header alone when the update adds nothing", () => {
    const broken: string[] = [];

    for (const { label, config, who } of shapes()) {
      const written = generateHeader(config, who, 2020, 2026);
      const read = parseHeader(`${written}\n\nconst x = 1;\n`, config);
      if (read === null) {
        broken.push(`${label}: did not parse at all`);
        continue;
      }

      const untouched = updateHeader(read, config, {});
      if (untouched !== read.raw) {
        broken.push(`${label}: an empty update rewrote the header`);
      }

      const again = updateHeader(read, config, {
        newContributor: who[0],
        updateYear: 2026,
      });
      if (again !== read.raw) {
        broken.push(`${label}: re-adding the first contributor rewrote the header`);
      }
    }

    assertEquals(
      broken,
      [],
      `${broken.length} of ${shapes().length} shapes move under a no-op update:\n${
        broken.slice(0, 10).join("\n")
      }`,
    );
  });
});

describe("a header carrying lines this tool does not model", () => {
  const config = shaped({});

  /** A header with a blank comment line, a notice pointer and a second tag. */
  function odd(): string {
    const written = generateHeader(config, people(1), 2020, 2026).split("\n");
    const closing = written.pop() as string;
    return [
      ...written,
      "//",
      "// See NOTICE for the licences this ships with, or ask legal@example.com.",
      "// SPDX-FileCopyrightText: 2020 orgrinrt <ort@hiisi.digital>",
      closing,
    ].join("\n");
  }

  it("reports them rather than discarding them", () => {
    const read = parseHeader(`${odd()}\n\nconst x = 1;\n`, config);
    assertEquals(read?.extra, [
      "//",
      "// See NOTICE for the licences this ships with, or ask legal@example.com.",
      "// SPDX-FileCopyrightText: 2020 orgrinrt <ort@hiisi.digital>",
    ]);
  });

  it("writes them back when the header is rebuilt", () => {
    const read = parseHeader(`${odd()}\n\nconst x = 1;\n`, config);
    assertEquals(updateHeader(read!, config, {}), odd());
  });

  it("keeps them when a contributor is added", () => {
    const read = parseHeader(`${odd()}\n\nconst x = 1;\n`, config);
    const grown = updateHeader(read!, config, {
      newContributor: { name: "someone", email: "someone@example.com" },
    });
    assertEquals(parseHeader(`${grown}\n\nconst x = 1;\n`, config)?.extra, read?.extra);
    assertEquals(
      parseHeader(`${grown}\n\nconst x = 1;\n`, config)?.contributors.length,
      2,
    );
  });

  it("reports none when the header carries nothing unusual", () => {
    const plain = generateHeader(config, people(2), 2020, 2026);
    assertEquals(parseHeader(`${plain}\n\nconst x = 1;\n`, config)?.extra, []);
  });
});

describe("nothing in a header is destroyed by repairing it", () => {
  /** The blocks a project already has, rendered in one configuration's marks.
   *
   * None of these were written by this tool and most of them it cannot read.
   * They are what is actually at the top of the files in a repository the day
   * somebody adds ante to it, and the first run has to leave every one of them
   * legible. A copyright notice and a licence pointer are what a project is
   * obliged to carry, so losing one is worse than any misalignment. */
  function corpus(config: ResolvedConfig): { name: string; block: string[] }[] {
    const mark = config.commentPrefix;
    const rule = mark + config.separatorChar.repeat(config.width - mark.length);
    const wrap = (name: string, lines: string[]) => ({
      name,
      block: [rule, ...lines.map((one) => `${mark} ${one}`), rule],
    });

    return [
      wrap("a corporate notice with no year", [
        "Copyright (c) Acme Corporation  legal@acme.example",
        "Licensed under the Acme Source Licence. See LICENCE-ACME for terms.",
      ]),
      wrap("a vendored third-party notice", [
        "Copyright 2016-2019 The libfoo Authors. All rights reserved.",
        "Use of this source code is governed by a BSD-style licence that can be",
        "found in the LICENSE file at https://libfoo.example/LICENSE",
      ]),
      wrap("a decorative banner that is not a header at all", [
        "renderer, hot path",
        "do not reorder the fields below without reading the layout note",
      ]),
      wrap("a licence tag written first, which is the kernel's ordering", [
        "SPDX-License-Identifier: MIT",
        "Copyright (c) 2020-2026  Ada  ada@example.com",
        "See NOTICE, or write to legal@example.com",
      ]),
      wrap("a notice with no licence line at all", [
        "Copyright (c) 2020-2026  Ada  ada@example.com",
        "See NOTICE, or write to legal@example.com",
      ]),
      wrap("a copyright line with no address", [
        "Copyright (c) 2020 Ada Lovelace",
      ]),
    ];
  }

  /** Every address in a line, which is what attribution comes down to. */
  function addresses(line: string): string[] {
    return line.match(/\S+@\S+/g) ?? [];
  }

  /**
   * Every line of `before` whose content `after` no longer carries.
   *
   * A line survives if it is still there word for word, which is what happens
   * to anything this tool does not model. A line it does model is rewritten
   * into its own form, and what has to come through that is the attribution:
   * every address the line carried is still somewhere in the header.
   *
   * The licence a line declared is deliberately not in this. A project's
   * configured licence is what the tool writes, so a file declaring a different
   * one has it replaced, and whether that is right for a vendored file is a
   * question this property is not the place to settle.
   */
  function destroyed(
    before: readonly string[],
    after: string,
    limit: number,
  ): string[] {
    // What the contributor limit deliberately drops is not counted here. It is
    // the one deletion this tool makes on purpose, it is documented, and
    // whether it should announce itself is `ante-silent-credit-drop` rather
    // than a property this sweep can settle.
    const dropped = new Set(
      before.flatMap(addresses).slice(limit),
    );

    return before.filter((one) => {
      if (one.trim() === "" || after.includes(one.trim())) return false;
      const carried = addresses(one).filter((address) => !dropped.has(address));
      if (addresses(one).length === 0) {
        return !/SPDX-License-Identifier:/i.test(one);
      }
      return !carried.every((address) => after.includes(address));
    });
  }

  it("survives the run that adopts the tool, whatever the block said", () => {
    // The create path: no header this tool can read, so it writes one. What it
    // must not do is write it over the top of what was there.
    const lost: string[] = [];

    for (const { label, config } of shapes()) {
      for (const { name, block } of corpus(config)) {
        const content = [...block, "", "export const a = 1;", ""].join("\n");
        const after = rewriteHeader(content, config, people(1), 2026, 2026);
        for (const gone of destroyed(block, after, config.maxContributors)) {
          lost.push(`${label} / ${name}: ${gone}`);
        }
      }
    }

    assertEquals(lost.slice(0, 4), [], JSON.stringify(lost.slice(0, 4), null, 1));
  });

  it("survives every later repair too, and settles", () => {
    // And the repair path, run twice, because a line that survives once and is
    // dropped on the second run is the same loss one commit later.
    const lost: string[] = [];

    for (const { label, config } of shapes()) {
      for (const { name, block } of corpus(config)) {
        const content = [...block, "", "export const a = 1;", ""].join("\n");
        const first = rewriteHeader(content, config, people(1), 2026, 2026);
        const read = parseHeader(first, config);
        const second = read === null
          ? rewriteHeader(first, config, people(1), 2026, 2026)
          : replaceHeader(first, updateHeader(read, config, {}), read, config);
        for (const gone of destroyed(block, second, config.maxContributors)) {
          lost.push(`${label} / ${name}: ${gone}`);
        }
      }
    }

    assertEquals(lost.slice(0, 4), [], JSON.stringify(lost.slice(0, 4), null, 1));
  });
});

describe("a line in the header this tool did not write", () => {
  /** A header with one line spliced in at `at`, counted from the top. */
  function spliced(
    config: ResolvedConfig,
    note: string,
    who: Contributor[],
    at = 1,
  ): string {
    const written = generateHeader(config, who, 2020, 2026).split("\n");
    const closing = written.pop() as string;
    const lines = [...written.slice(0, at), note, ...written.slice(at), closing];
    return `${lines.join("\n")}\n\nx;\n`;
  }

  /** The addresses that survive one repair of a header with `note` spliced in. */
  function survivors(
    config: ResolvedConfig,
    note: string,
    who: Contributor[],
    at = 1,
  ): Set<string> {
    const read = parseHeader(spliced(config, note, who, at), config);
    const again = parseHeader(`${updateHeader(read!, config, {})}\n\nx;\n`, config);
    return new Set(again?.contributors.map((one) => one.email));
  }

  it("never costs a contributor, at any indent, above or below the run", () => {
    // What must not follow from a note being misread is somebody losing their
    // credit: a misread note pushes a real name past the limit, and the next
    // repair writes the header without it.
    //
    // So the assertion is the addresses, not the count. A count cannot tell a
    // note read as a contributor from a note read as a contributor that also
    // evicted Alan.
    const config = shaped({ maxContributors: 3 });
    const who = people(3);
    const lost: string[] = [];
    // Above the copyright line, and below the licence line. Every indent, up
    // past the width of the columns, because the indent decides nothing.
    const places = [1, 5];

    for (const at of places) {
      for (const indent of [0, 2, 10, 38, 50]) {
        const note = `//${" ".repeat(indent)}Formerly maintained by old@example.com`;
        const kept = survivors(config, note, who, at);
        for (const one of who) {
          if (!kept.has(one.email)) lost.push(`at=${at} indent=${indent} lost ${one.email}`);
        }
      }
    }

    assertEquals(lost, []);
  });

  it("does cost one when the line sits inside the run of names itself", () => {
    // The residue, recorded rather than repaired. Between the copyright line
    // and the licence line is where the names are written, and a line there,
    // indented, ending in an address, is a contributor line by every signal
    // there is. So a note written into that run takes a place and the limit
    // drops the last real name.
    //
    // The limit is the documented promise and it is kept. What it costs is
    // this, and it costs it only to a note somebody wrote between two credits.
    const config = shaped({ maxContributors: 3 });
    const who = people(3);
    const note = "//    Formerly maintained by old@example.com";
    const kept = survivors(config, note, who, 2);

    assertEquals(kept.has("old@example.com"), true);
    assertEquals(kept.has(who[2].email), false);
  });

  it("ends the run at a line that is not a credit, and loses nobody doing it", () => {
    // The run has to end somewhere other than the closing separator, because a
    // header whose licence tag comes first, which is the kernel's ordering,
    // would otherwise leave it open and read a note several lines down as
    // somebody's name. So the first line inside it that is not a credit ends
    // it.
    //
    // What that costs is here: the names below such a line stop being credits
    // and become lines the tool carries instead. They are all still in the
    // file, nobody is deleted, and the alignment is what suffers. That is the
    // better half of the trade, because a false credit can push a real one past
    // the limit and a demoted one cannot.
    const config = shaped({ maxContributors: 3 });
    const who = people(3);
    const note = "//Formerly maintained by old@example.com";
    const read = parseHeader(spliced(config, note, who, 2), config);

    assertEquals(read?.contributors.map((one) => one.email), [who[0].email]);
    assertEquals(read?.extra.length, 3);

    const repaired = updateHeader(read!, config, {});
    for (const one of who) assertStringIncludes(repaired, one.email);
    assertStringIncludes(repaired, "old@example.com");
  });

  it("holds the contributor limit on the path a repair takes", () => {
    // `generateHeader` applies the limit and is tested where it is declared.
    // What matters here is the path the tool actually walks on a file that
    // already has a header, which is parse, update, write, over and over. A
    // limit that only bounds a header being created is not a limit.
    const config = shaped({ maxContributors: 3 });
    let header = generateHeader(config, people(1), 2020, 2026);

    for (let at = 0; at < 8; at++) {
      const read = parseHeader(`${header}\n\nx;\n`, config);
      header = updateHeader(read!, config, {
        newContributor: { name: `P${at}`, email: `p${at}@example.com` },
      });
    }

    assertEquals(parseHeader(`${header}\n\nx;\n`, config)?.contributors.length, 3);
  });

  it("keeps every name when the limit has room for the misread one too", () => {
    const config = shaped({ maxContributors: 10 });
    const who = people(3);
    const note = "//    Formerly maintained by old@example.com";
    const kept = survivors(config, note, who, 2);

    for (const one of who) assertEquals(kept.has(one.email), true);
  });

  it("is written back once, not once per repair", () => {
    // A line the parser does not recognise is preserved verbatim, which is
    // right, and a line it does not recognise but writes anyway would be
    // preserved beside the copy it writes. Each repair would add another.
    const config = shaped({ maxContributors: 3 });
    const note = "// SPDX-License-Identifier: MPL-2.0";
    const once = updateHeader(parseHeader(spliced(config, note, people(2)), config)!, config, {});
    const twice = updateHeader(parseHeader(`${once}\n\nx;\n`, config)!, config, {});

    assertEquals(once, twice);
    assertEquals(
      once.split("\n").filter((line) => line.includes("SPDX-License-Identifier")).length,
      1,
    );
  });

  it("reads every shape of licence expression the spec admits", () => {
    // The tag claims the line and the tail is decomposed afterwards, which is
    // what lets an expression carry spaces. A pattern shaped around one of
    // these forms reads that one and sends the rest to `extra`, where the tool
    // writes a generated licence line beside each of them, once per repair.
    const config = shaped({});
    const forms = [
      "MIT",
      "MIT OR Apache-2.0",
      "Apache-2.0 WITH LLVM-exception",
      "GPL-2.0-or-later WITH Classpath-exception-2.0",
      "(MIT OR Apache-2.0) AND BSD-3-Clause",
    ];
    const missed: string[] = [];

    for (const licence of forms) {
      const header = [
        `//${"-".repeat(98)}`,
        "// Copyright (c) 2020-2026              Ada                      ada@example.com",
        `// SPDX-License-Identifier: ${licence}`,
        `//${"-".repeat(98)}`,
      ].join("\n");
      const read = parseHeader(`${header}\n\nx;\n`, config);
      if (read?.spdxLicense !== licence || read?.extra.length !== 0) {
        missed.push(`${licence} -> ${read?.spdxLicense} extra=${read?.extra.length}`);
      }
    }

    assertEquals(missed, []);
  });

  it("agrees with itself about a compound licence, which has no page of its own", () => {
    // The check compares what it reads back against what is configured, so a
    // licence line has to survive a round trip through the file. A derived link
    // for a compound expression would carry the expression's spaces into a url,
    // and a url with a space in it does not read back as a url: the whole tail
    // returns as one long licence and disagrees with the configuration for
    // good, with the commit hook refusing every commit and the repair command
    // reporting nothing to repair.
    const disagreed: string[] = [];

    for (
      const licence of [
        "MIT",
        "MIT OR Apache-2.0",
        "Apache-2.0 WITH LLVM-exception",
        "(MIT OR Apache-2.0) AND BSD-3-Clause",
      ]
    ) {
      // The url is derived here the way `loadConfig` derives it, from the
      // licence and nothing else, because that derivation is what puts a url in
      // the line at all and is therefore what the round trip has to survive.
      const config = resolveConfig({
        spdxLicense: licence,
        licenseUrl: deriveLicenseUrl(licence),
        maintainerEmail: "contact@hiisi.digital",
      });
      const written = generateHeader(config, people(1), 2020, 2026);
      const read = parseHeader(`${written}\n\nx;\n`, config);
      if (read?.spdxLicense !== licence) {
        disagreed.push(`${licence} read back as ${read?.spdxLicense}`);
      }
    }

    assertEquals(disagreed, []);
  });

  it("derives no link for an expression, and the usual one for a name", () => {
    assertEquals(deriveLicenseUrl("MIT"), "https://opensource.org/licenses/MIT");
    assertEquals(deriveLicenseUrl("MIT OR Apache-2.0"), "");
    assertEquals(deriveLicenseUrl("Apache-2.0 WITH LLVM-exception"), "");
    assertEquals(deriveLicenseUrl(""), "");
  });

  it("keeps the url and the address apart from the expression", () => {
    const config = shaped({});
    const header = [
      `//${"-".repeat(98)}`,
      "// Copyright (c) 2020-2026              Ada                      ada@example.com",
      "// SPDX-License-Identifier: MIT OR Apache-2.0   https://example.org/l  c@x.dev",
      `//${"-".repeat(98)}`,
    ].join("\n");
    const read = parseHeader(`${header}\n\nx;\n`, config);

    assertEquals(read?.spdxLicense, "MIT OR Apache-2.0");
    assertEquals(read?.licenseUrl, "https://example.org/l");
    assertEquals(read?.maintainerEmail, "c@x.dev");
  });

  it("reads a bare licence tag, which carries no url and no address", () => {
    // The form the spec's own examples show, and the form a tree tagged by
    // anything else already carries.
    const config = shaped({});
    const bare = [
      `//${"-".repeat(98)}`,
      "// Copyright (c) 2020-2026                    Ada                     ada@example.com",
      "// SPDX-License-Identifier: MIT",
      `//${"-".repeat(98)}`,
    ].join("\n");
    const read = parseHeader(`${bare}\n\nx;\n`, config);

    assertEquals(read?.spdxLicense, "MIT");
    assertEquals(read?.extra, []);
  });
});

describe("where a name sits rather than how far it is indented", () => {
  it("reads every name back, at any column, under any prefix, with or without the config", () => {
    // A contributor line is one written between the copyright line and the
    // licence line. Nothing about its indent is load-bearing, which is what
    // lets a header written at one column be read at another, and lets a
    // caller who has no configuration to hand read one at all.
    //
    // An indent floor cannot do this. Fixed, it is too deep for a long prefix
    // against a narrow column and loses every name; derived from the column, it
    // is wrong for any header written before the column moved, and wrong on
    // every call that does not pass the config.
    const missed: string[] = [];

    for (const nameColumn of BOUNDS.nameColumn) {
      for (const commentPrefix of ["//", "#", "<!--", "REM ", ";;;;;;;;;;;;;;"]) {
        const config = shaped({
          nameColumn,
          emailColumn: within(nameColumn + 25, BOUNDS.emailColumn),
          commentPrefix,
        });
        const written = `${generateHeader(config, people(3), 2020, 2026)}\n\nconst x = 1;\n`;
        const named = parseHeader(written, config)?.contributors.length;
        const bare = commentPrefix === "//" ? parseHeader(written)?.contributors.length : 3;
        if (named !== 3 || bare !== 3) {
          missed.push(
            `nameColumn=${nameColumn} prefix=${commentPrefix} read ${named}, bare ${bare}`,
          );
        }
      }
    }

    assertEquals(missed, []);
  });

  it("does not read a note indented less far as a contributor", () => {
    const config = shaped({});
    const written = generateHeader(config, people(2), 2020, 2026).split("\n");
    const closing = written.pop() as string;
    const note = "//  ported from libfoo, ask bugs@libfoo.org about it";
    const read = parseHeader(
      `${[written[0], note, ...written.slice(1), closing].join("\n")}\n\nx;\n`,
      config,
    );

    assertEquals(read?.contributors.map((one) => one.name), ["a", "orgrinrt"]);
    assertEquals(read?.extra, [note]);
  });

  it("carries every name across when the column moves under a written header", () => {
    // Both ways. A project that widens or narrows its name column has headers
    // written at the old one in every file, and the next repair realigns them
    // rather than demoting the names in them to lines the tool does not model.
    const narrow = shaped({ nameColumn: 20, emailColumn: 45 });
    const wide = shaped({ nameColumn: 60, emailColumn: 90 });

    for (const [wrote, reads] of [[narrow, wide], [wide, narrow]] as const) {
      const written = generateHeader(wrote, people(3), 2020, 2026);
      const read = parseHeader(`${written}\n\nx;\n`, reads);

      assertEquals(read?.contributors.length, 3);
      assertEquals(read?.extra, []);

      const repaired = updateHeader(read!, reads, {});
      assertEquals(repaired, generateHeader(reads, people(3), 2020, 2026));
    }
  });
});
