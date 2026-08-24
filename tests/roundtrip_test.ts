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
 * The narrowest name column the format supports.
 *
 * A contributor line carries no year, so the only thing telling it apart from an
 * ordinary note in the header is how far it is indented. Ten columns after the
 * comment prefix is the floor, and a name column below that produces lines the
 * parser will not claim.
 *
 * The schema's own minimum is well above it, which is what keeps the floor
 * unreachable through configuration. `a name column the format cannot express`
 * is where that gap is held down.
 */
const NARROWEST = 12;

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

  it("never costs a contributor, however far the line is indented", () => {
    // A note is told from a contributor by its indent and a trailing address,
    // and that guess is sometimes wrong. What must not follow from a wrong
    // guess is somebody losing their credit: a misread note that pushes a real
    // name past the limit would delete it silently on the next repair.
    //
    // So the assertion is the addresses, not the count. A count cannot tell a
    // note read as a contributor from a note read as a contributor that also
    // evicted Alan.
    const config = shaped({ maxContributors: 3 });
    const who = people(3);
    const lost: string[] = [];

    for (const indent of [0, 2, 10, config.nameColumn, config.nameColumn + 10]) {
      const note = `//${" ".repeat(indent)}Formerly maintained by old-team@example.com`;
      const read = parseHeader(spliced(config, note, who), config);
      const again = parseHeader(
        `${updateHeader(read!, config, {})}\n\nx;\n`,
        config,
      );
      const kept = new Set(again?.contributors.map((one) => one.email));

      for (const one of who) {
        if (!kept.has(one.email)) lost.push(`indent=${indent} lost ${one.email}`);
      }
    }

    assertEquals(lost, []);
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

describe("a name column the format cannot express", () => {
  it("sits below every column the schema permits", () => {
    // The floor is a property of the format and the schema is what keeps it out
    // of reach. If a later schema lowered the minimum below the floor, the two
    // cases underneath this one would start describing shapes a project can
    // actually ask for.
    assertEquals(BOUNDS.nameColumn.every((column) => column > NARROWEST), true);
  });

  it("does not claim the contributor lines it writes below the floor", () => {
    // Recorded rather than repaired, and unreachable through configuration per
    // the case above. Nothing distinguishes a shallow contributor line from a
    // note somebody wrote in the header.
    const config = shaped({ nameColumn: NARROWEST - 1, emailColumn: 40 });
    const written = generateHeader(config, people(3), 2020, 2026);
    const read = parseHeader(`${written}\n\nconst x = 1;\n`, config);

    assertEquals(read?.contributors.length, 1);
  });

  it("claims all of them at the floor, which is the boundary", () => {
    const config = shaped({ nameColumn: NARROWEST, emailColumn: 40 });
    const written = generateHeader(config, people(3), 2020, 2026);
    const read = parseHeader(`${written}\n\nconst x = 1;\n`, config);

    assertEquals(read?.contributors.length, 3);
  });

  it("does read a deeply indented note ending in an address as one", () => {
    // The boundary, recorded rather than repaired. A contributor line carries no
    // year and no keyword, so the indent and the trailing address are all there
    // is to go on, and a note wearing both is a contributor line. Indenting a
    // note less far, which is what anybody writes, keeps it a note.
    //
    // The misread is the whole of what goes wrong: `never costs a contributor`
    // holds the part that would have mattered, which is that nobody is dropped
    // to make room for it.
    const config = shaped({ maxContributors: 3 });
    const written = generateHeader(config, people(3), 2020, 2026).split("\n");
    const closing = written.pop() as string;
    const note = `//${" ".repeat(10)}See NOTICE, ask legal@example.com`;
    const read = parseHeader(
      `${[...written, note, closing].join("\n")}\n\nx;\n`,
      config,
    );

    assertEquals(read?.contributors.length, 4);
    assertEquals(read?.extra, []);
  });

  it("does not read a note in the header as a contributor", () => {
    const config = shaped({});
    const written = generateHeader(config, people(2), 2020, 2026).split("\n");
    const closing = written.pop() as string;
    const note = "//  ported from libfoo, ask bugs@libfoo.org about it";
    const read = parseHeader(
      `${[written[0], note, ...written.slice(1), closing].join("\n")}\n\nx;\n`,
    );

    assertEquals(read?.contributors.map((one) => one.name), [
      "a",
      "orgrinrt",
    ]);
    assertEquals(read?.extra, [note]);
  });
});
