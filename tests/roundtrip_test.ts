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

import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { type Contributor, generateHeader, parseHeader, updateHeader } from "#core";
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

describe("a line in the header this tool did not write", () => {
  /** A header with one line spliced in under the copyright line. */
  function spliced(config: ResolvedConfig, note: string, who: Contributor[]): string {
    const written = generateHeader(config, who, 2020, 2026).split("\n");
    const closing = written.pop() as string;
    return `${[written[0], note, ...written.slice(1), closing].join("\n")}\n\nx;\n`;
  }

  /** The addresses that survive one repair of a header with `note` spliced in. */
  function survivors(
    config: ResolvedConfig,
    note: string,
    who: Contributor[],
  ): Set<string> {
    const read = parseHeader(spliced(config, note, who), config);
    const again = parseHeader(`${updateHeader(read!, config, {})}\n\nx;\n`, config);
    return new Set(again?.contributors.map((one) => one.email));
  }

  /** The indent at which a line starts where the generator writes names. */
  function shallower(config: ResolvedConfig): number {
    return config.nameColumn - config.commentPrefix.length;
  }

  it("never costs a contributor, at any indent short of the name column", () => {
    // A note is told from a contributor by its indent and a trailing address.
    // What must not follow from a wrong guess is somebody losing their credit:
    // a misread note pushes a real name past the limit and the next repair
    // writes the header without it.
    //
    // So the assertion is the addresses, not the count. A count cannot tell a
    // note read as a contributor from a note read as a contributor that also
    // evicted Alan.
    const config = shaped({ maxContributors: 3 });
    const who = people(3);
    const lost: string[] = [];

    for (const indent of [0, 2, 10, shallower(config) - 1]) {
      const note = `//${" ".repeat(indent)}Formerly maintained by old-team@example.com`;
      const kept = survivors(config, note, who);
      for (const one of who) {
        if (!kept.has(one.email)) lost.push(`indent=${indent} lost ${one.email}`);
      }
    }

    assertEquals(lost, []);
  });

  it("does cost one when the line sits at the name column itself", () => {
    // The residue, recorded rather than repaired. At the column names are
    // written at, ending in an address, a line is a contributor line by every
    // signal there is, and one indented further is the second field of one.
    // Nothing distinguishes it, so a note written there takes a place and the
    // limit drops the last real name.
    //
    // The limit is the documented promise and it is kept. What it costs is
    // this, and it costs it only to a note somebody indented to the width of
    // the contributor column.
    const config = shaped({ maxContributors: 3 });
    const who = people(3);
    const note = `//${" ".repeat(shallower(config))}Formerly maintained by old@example.com`;
    const kept = survivors(config, note, who);

    assertEquals(kept.has("old@example.com"), true);
    assertEquals(kept.has(who[2].email), false);
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
    const note = `//${" ".repeat(shallower(config))}Formerly maintained by old@example.com`;
    const kept = survivors(config, note, who);

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

describe("the column the name is written at", () => {
  it("is where a contributor line is looked for, whatever the prefix leaves of it", () => {
    // The indent the parser requires is what the column leaves after the
    // prefix, rather than a fixed number. The prefix is free-form text, so a
    // long one against a narrow column leaves less room than any fixed floor
    // would allow for, and the header then reads back with one contributor in
    // it while looking correct on the page.
    const missed: string[] = [];

    for (const nameColumn of BOUNDS.nameColumn) {
      for (const commentPrefix of ["//", "#", "<!--", "REM ", ";;;;;;;;;;;;;;"]) {
        const config = shaped({
          nameColumn,
          emailColumn: within(nameColumn + 25, BOUNDS.emailColumn),
          commentPrefix,
        });
        const written = generateHeader(config, people(3), 2020, 2026);
        const read = parseHeader(`${written}\n\nconst x = 1;\n`, config);
        if (read?.contributors.length !== 3) {
          missed.push(
            `nameColumn=${nameColumn} prefix=${commentPrefix} read ${read?.contributors.length}`,
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

  it("hands the old lines to `extra` when it is widened under a written header", () => {
    // Recorded rather than repaired. A header written at one column and read at
    // a wider one has contributor lines indented less far than the parser now
    // looks, so they read as lines it does not model. They are preserved
    // verbatim and the header stays a fixed point, which is the property that
    // matters; what is lost is that the names stop being names to the tool
    // until somebody commits again.
    const narrow = shaped({ nameColumn: 20, emailColumn: 45 });
    const wide = shaped({ nameColumn: 60, emailColumn: 90 });
    const written = generateHeader(narrow, people(3), 2020, 2026);
    const read = parseHeader(`${written}\n\nx;\n`, wide);

    assertEquals(read?.contributors.length, 1);
    assertEquals(read?.extra.length, 2);

    const repaired = updateHeader(read!, wide, {});
    const again = parseHeader(`${repaired}\n\nx;\n`, wide);
    assertEquals(again?.extra, read?.extra);
    assertEquals(updateHeader(again!, wide, {}), repaired);
  });
});
