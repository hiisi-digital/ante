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
  for (const nameColumn of [2, 6, 10, 11, 12, 20, 40]) {
    for (const emailColumn of [nameColumn + 2, nameColumn + 10, nameColumn + 25, nameColumn + 60]) {
      for (const maxContributors of [1, 2, 5]) {
        for (const count of [1, 2, 5]) {
          for (const width of [40, 100]) {
            const config = shaped({ nameColumn, emailColumn, maxContributors, width });
            out.push({
              label: `nameColumn=${nameColumn} emailColumn=${emailColumn} ` +
                `max=${maxContributors} people=${count} width=${width}`,
              config,
              who: people(count),
            });
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
      const read = parseHeader(`${written}\n\nconst x = 1;\n`);

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
      const read = parseHeader(`${once}\n\nconst x = 1;\n`);
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
      const read = parseHeader(`${written}\n\nconst x = 1;\n`);
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
      "// See NOTICE for the third-party licences this ships with.",
      "// SPDX-FileCopyrightText: 2020 orgrinrt <ort@hiisi.digital>",
      closing,
    ].join("\n");
  }

  it("reports them rather than discarding them", () => {
    const read = parseHeader(`${odd()}\n\nconst x = 1;\n`);
    assertEquals(read?.extra, [
      "//",
      "// See NOTICE for the third-party licences this ships with.",
      "// SPDX-FileCopyrightText: 2020 orgrinrt <ort@hiisi.digital>",
    ]);
  });

  it("writes them back when the header is rebuilt", () => {
    const read = parseHeader(`${odd()}\n\nconst x = 1;\n`);
    assertEquals(updateHeader(read!, config, {}), odd());
  });

  it("keeps them when a contributor is added", () => {
    const read = parseHeader(`${odd()}\n\nconst x = 1;\n`);
    const grown = updateHeader(read!, config, {
      newContributor: { name: "someone", email: "someone@example.com" },
    });
    assertEquals(parseHeader(`${grown}\n\nconst x = 1;\n`)?.extra, read?.extra);
    assertEquals(
      parseHeader(`${grown}\n\nconst x = 1;\n`)?.contributors.length,
      2,
    );
  });

  it("reports none when the header carries nothing unusual", () => {
    const plain = generateHeader(config, people(2), 2020, 2026);
    assertEquals(parseHeader(`${plain}\n\nconst x = 1;\n`)?.extra, []);
  });
});
