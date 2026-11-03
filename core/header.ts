//--------------------------------------------------------------------------------------------------
// Copyright (c) 2025-2026              orgrinrt                 orgrinrt@ikiuni.dev
//                                      orgrinrt                 ort@hiisi.digital
// SPDX-License-Identifier: MPL-2.0     https://mozilla.org/MPL/2.0        ort@hiisi.digital
//--------------------------------------------------------------------------------------------------

/**
 * The header itself: reading one, writing one, and changing one in place.
 *
 * `updateHeader` is the path `fix` takes rather than regenerating from nothing,
 * because a header carries things the configuration cannot re-derive. A manual
 * contributor nobody has committed as, or a year range predating the repository,
 * survives an update and would not survive a rebuild.
 *
 * @module
 */

import type { Contributor, ResolvedConfig } from "./config.ts";
import { formatCopyrightLine, formatSpdxLine, generateSeparator } from "./formatter.ts";

/**
 * Represents a parsed copyright header.
 */
export interface ParsedHeader {
  /** The original raw text of the header */
  raw: string;
  /** Starting line number (1-indexed) */
  startLine: number;
  /** Ending line number (1-indexed) */
  endLine: number;
  /** The first copyright year */
  yearStart: number;
  /** The last copyright year (same as yearStart if single year) */
  yearEnd: number;
  /** List of contributors found in the header */
  contributors: Contributor[];
  /** SPDX license identifier */
  spdxLicense: string | null;
  /** License URL if present */
  licenseUrl: string | null;
  /** Maintainer email if present */
  maintainerEmail: string | null;
  /**
   * Lines inside the header that none of the patterns above accounted for.
   *
   * A header is free to carry more than this tool understands: a blank comment
   * line for spacing, a pointer at a NOTICE file, a second licence tag. They are
   * kept verbatim so that rewriting the header does not delete them, and they
   * are written back below the licence line.
   */
  extra: string[];
}

/**
 * Result of header validation.
 */
export interface HeaderValidation {
  /** Whether the header is valid */
  valid: boolean;
  /** List of issues found */
  issues: string[];
}

/**
 * The line patterns, built for one configuration.
 *
 * The comment prefix and the separator character are both configurable, so the
 * patterns cannot be constants: a project writing `#` headers would otherwise
 * have every one of them read as absent, and a header read as absent is a header
 * about to have a second one written above it.
 *
 * Passing no configuration gives the shipped defaults, widened: the separator
 * takes any of the three characters the tool has ever written, so a file keeps
 * reading after the setting changes under it.
 */
function patterns(config?: ResolvedConfig): {
  separator: RegExp;
  copyright: RegExp;
  contributor: RegExp;
  spdx: RegExp;
} {
  const prefix = quoted(config?.commentPrefix ?? DEFAULT_PREFIX);
  const chars = quoted(
    [...new Set(DEFAULT_SEPARATORS + (config?.separatorChar ?? ""))].join(""),
  );

  return {
    separator: new RegExp(`^${prefix}[${chars}]+$`),
    copyright: new RegExp(
      `^${prefix}\\s*Copyright\\s*\\(c\\)\\s*(\\d{4})(?:-(\\d{4}))?\\s+(.+?)\\s+(\\S+@\\S+)`,
      "i",
    ),
    // Where a contributor line sits is what tells it from a note, rather than
    // how far it is indented: the generator writes them in one run between the
    // copyright line and the licence line, and `parseHeader` only offers this
    // pattern lines inside that run. An indent guess cannot do the same job.
    // Too deep and a header written at a narrower name column loses every name
    // in it; too shallow and a note two spaces in is read as a credit.
    //
    // What is left for the pattern is that the line is indented at all and ends
    // in an address, with the name running up to the last run of whitespace
    // before it, which is what lets a name carry spaces of its own.
    contributor: new RegExp(`^${prefix}\\s+(.+?)\\s+(\\S+@\\S+)\\s*$`),
    // The tag alone claims the line. Everything after it is a tail this pattern
    // does not read, because `licenceOf` reads it: an expression can be a single
    // identifier, or `MIT OR Apache-2.0`, or a parenthesised expression with
    // spaces throughout, and a pattern shaped around one of those loses the
    // others. A licence line half-claimed is preserved verbatim and then has a
    // generated one written beside it, once per repair.
    spdx: new RegExp(`^${prefix}\\s*SPDX-License-Identifier:\\s*(.*)$`, "i"),
  };
}

/**
 * The three fields on a licence line, taken from its tail.
 *
 * Read from the right, because that is the end that is fixed. The address, if
 * there is one, is last; the url, if there is one, is before it; and everything
 * still standing is the licence expression, spaces and all.
 */
function licenceOf(tail: string): {
  licence: string | null;
  url: string | null;
  email: string | null;
} {
  let rest = tail.trim();
  let email: string | null = null;
  let url: string | null = null;

  const address = rest.match(/(?:^|\s)(\S+@\S+)$/);
  if (address) {
    email = address[1];
    rest = rest.slice(0, rest.length - address[1].length).trim();
  }

  const link = rest.match(/(?:^|\s)(https?:\/\/\S+)$/);
  if (link) {
    url = link[1];
    rest = rest.slice(0, rest.length - link[1].length).trim();
  }

  return { licence: rest === "" ? null : rest, url, email };
}

/** The comment prefix a project gets without saying anything. */
const DEFAULT_PREFIX = "//";

/** Every separator character the tool has written, so old files keep reading. */
const DEFAULT_SEPARATORS = "-=*";

/** A literal, safe to drop into a pattern. */
function quoted(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&");
}

/**
 * How many lines the block at the top of `content` runs to, or nothing.
 *
 * A block is a run of lines between two separators, whatever is written inside
 * it. That is a weaker question than `parseHeader` asks, and it is the one to
 * ask before writing: a block this tool cannot read is still a block, and
 * putting a fresh header above it leaves the file with two.
 */
export function headerExtent(
  content: string,
  config?: ResolvedConfig,
): number | undefined {
  const line = patterns(config);
  const lines = content.split("\n");
  if (lines.length === 0 || !line.separator.test(lines[0])) return undefined;

  for (let i = 1; i < lines.length; i++) {
    if (line.separator.test(lines[i])) return i + 1;
  }
  return undefined;
}

/**
 * What the block at the top of `content` says that this tool did not claim.
 *
 * Everything between the two separators, less the lines the patterns read as a
 * copyright, a credit or a licence. For a block written by somebody else's
 * convention that is all of it, which is the point: a notice and a licence
 * pointer are what a project is obliged to carry, and the run that adopts this
 * tool has to leave every line of them legible.
 */
export function interiorOf(
  content: string,
  config?: ResolvedConfig,
): string[] {
  const ends = headerExtent(content, config);
  if (ends === undefined) return [];

  const read = parseHeader(content, config);
  if (read !== null) return read.extra;

  return content.split("\n").slice(1, ends - 1);
}

/**
 * Parses a copyright header from file content.
 *
 * @param content - The file content to parse
 * @returns The parsed header, or null if no valid header found
 */
export function parseHeader(
  content: string,
  config?: ResolvedConfig,
): ParsedHeader | null {
  const line = patterns(config);
  const lines = content.split("\n");

  // Header must start with a separator line
  if (lines.length === 0 || !line.separator.test(lines[0])) {
    return null;
  }

  let endLine = -1;
  let yearStart = 0;
  let yearEnd = 0;
  const contributors: Contributor[] = [];
  const extra: string[] = [];
  let spdxLicense: string | null = null;
  let licenseUrl: string | null = null;
  let maintainerEmail: string | null = null;
  /** Whether the scan is inside the run of names, which opens at the copyright
   * line and closes at the licence line. Outside it a line ending in an address
   * is somebody's note, and reading it as a credit is what pushes a real name
   * past the limit and deletes it on the next repair. */
  let crediting = false;

  // Scan for the closing separator
  for (let i = 1; i < lines.length; i++) {
    const here = lines[i];

    // Check for closing separator
    if (line.separator.test(here)) {
      endLine = i + 1; // 1-indexed
      break;
    }

    // Check for copyright line
    const copyrightMatch = here.match(line.copyright);
    if (copyrightMatch) {
      yearStart = parseInt(copyrightMatch[1], 10);
      yearEnd = copyrightMatch[2] ? parseInt(copyrightMatch[2], 10) : yearStart;
      contributors.push({
        name: copyrightMatch[3],
        email: copyrightMatch[4],
      });
      crediting = true;
      continue;
    }

    // Check for SPDX line
    const spdxMatch = here.match(line.spdx);
    if (spdxMatch) {
      const read = licenceOf(spdxMatch[1]);
      spdxLicense = read.licence;
      licenseUrl = read.url;
      maintainerEmail = read.email;
      crediting = false;
      continue;
    }

    // Check for contributor continuation line
    const contributorMatch = crediting ? here.match(line.contributor) : null;
    if (contributorMatch) {
      contributors.push({
        name: contributorMatch[1],
        email: contributorMatch[2],
      });
      continue;
    }

    // The run of names is contiguous, so the first line inside it that is not a
    // credit ends it. Otherwise a header whose licence tag comes first, which is
    // the kernel's ordering and what `reuse` writes, leaves the run open to the
    // closing separator and reads a note six lines down as somebody's name.
    crediting = false;

    // Nothing here recognises it, so keep it rather than lose it.
    extra.push(here);
  }

  // If we didn't find a closing separator, not a valid header
  if (endLine === -1) {
    return null;
  }

  // Extract the raw header text
  const headerLines = lines.slice(0, endLine);
  const raw = headerLines.join("\n");

  return {
    raw,
    startLine: 1,
    endLine,
    yearStart,
    yearEnd,
    contributors,
    spdxLicense,
    licenseUrl,
    maintainerEmail,
    extra,
  };
}

/**
 * Generates a new copyright header.
 *
 * @param config - The resolved configuration
 * @param contributors - List of contributors to include
 * @param yearStart - The starting year for the copyright
 * @param yearEnd - The ending year (optional, defaults to yearStart)
 * @param extra - Lines to keep verbatim below the licence line
 * @returns The generated header string
 */
export function generateHeader(
  config: ResolvedConfig,
  contributors: Contributor[],
  yearStart: number,
  yearEnd?: number,
  extra: string[] = [],
): string {
  const lines: string[] = [];

  // Opening separator
  lines.push(
    generateSeparator(config.width, config.separatorChar, config.commentPrefix),
  );

  // Copyright lines
  const effectiveYearEnd = yearEnd ?? yearStart;
  const yearPart = yearStart === effectiveYearEnd
    ? `${yearStart}`
    : `${yearStart}-${effectiveYearEnd}`;

  // Limit contributors
  const displayContributors = contributors.slice(0, config.maxContributors);

  // First contributor gets the year
  if (displayContributors.length > 0) {
    lines.push(
      formatCopyrightLine(
        config,
        yearPart,
        displayContributors[0].name,
        displayContributors[0].email,
      ),
    );

    // Additional contributors (no year)
    for (let i = 1; i < displayContributors.length; i++) {
      lines.push(
        formatCopyrightLine(
          config,
          "",
          displayContributors[i].name,
          displayContributors[i].email,
        ),
      );
    }
  }

  // SPDX line
  lines.push(formatSpdxLine(config));

  // Whatever the header carried that this tool does not model, kept as it was.
  lines.push(...extra);

  // Closing separator
  lines.push(
    generateSeparator(config.width, config.separatorChar, config.commentPrefix),
  );

  return lines.join("\n");
}

/**
 * Updates an existing header with new information.
 *
 * @param existingHeader - The parsed existing header
 * @param config - The resolved configuration
 * @param options - Update options
 * @returns The updated header string
 */
export function updateHeader(
  existingHeader: ParsedHeader,
  config: ResolvedConfig,
  options: {
    newContributor?: Contributor;
    updateYear?: number;
  },
): string {
  const yearStart = existingHeader.yearStart;
  let yearEnd = existingHeader.yearEnd;
  const contributors = [...existingHeader.contributors];

  // Update year if specified and different
  if (options.updateYear && options.updateYear > yearEnd) {
    yearEnd = options.updateYear;
  }

  // Add new contributor if not already present
  if (options.newContributor) {
    const exists = contributors.some(
      (c) => c.email.toLowerCase() === options.newContributor!.email.toLowerCase(),
    );
    if (!exists) {
      contributors.push(options.newContributor);
    }
  }

  return generateHeader(
    config,
    contributors,
    yearStart,
    yearEnd,
    existingHeader.extra,
  );
}

/**
 * Checks if content has a valid copyright header.
 *
 * @param content - The file content to check
 * @returns True if a valid header is present
 */
export function hasValidHeader(
  content: string,
  config?: ResolvedConfig,
): boolean {
  const parsed = parseHeader(content, config);
  return parsed !== null && parsed.contributors.length > 0;
}

/**
 * The contributors a header will not carry, because the limit is lower than the
 * number of them.
 *
 * `generateHeader` slices to `maxContributors` and says nothing, so a name goes
 * out of a file with no record anywhere that it was ever there. The limit is
 * wanted and the silence is not: a caller that asks first can say whose credit
 * it is about to drop.
 *
 * Order is the caller's. Whatever ranked them decided who is kept, and this
 * reports the tail of that same ranking.
 *
 * @param contributors - The contributors in the order they would be written
 * @param config - The resolved configuration
 * @returns Those past the limit, in the order they were given, or none
 */
export function omittedContributors(
  contributors: readonly Contributor[],
  config: ResolvedConfig,
): Contributor[] {
  return contributors.slice(config.maxContributors);
}

/**
 * How many header blocks sit at the top of a file, back to back.
 *
 * One is the ordinary answer and zero means there is no header. Anything above
 * one is a file that has been written to more than once by something that could
 * not see what was already there, and it is the shape `ante` itself shipped in
 * for two versions: `gate.ts` carried two identical blocks and `check` passed it,
 * because parsing stops at the first closing separator and everything below is
 * just content.
 *
 * Only the run at the top counts. A notice further down the file belongs to
 * whoever put it there.
 *
 * @param content - The file content to count blocks in
 * @param config - The resolved configuration
 * @returns The number of header blocks stacked at the top
 */
export function stackedHeaders(
  content: string,
  config?: ResolvedConfig,
): number {
  const line = patterns(config);
  let lines = content.split("\n");
  let found = 0;

  while (true) {
    const parsed = parseHeader(lines.join("\n"), config);
    if (parsed === null) return found;
    found++;
    lines = lines.slice(parsed.endLine);
    // A blank line between two blocks is what `fix` leaves behind, so the run
    // continues across them rather than stopping at the first one.
    while (lines.length > 0 && lines[0].trim() === "") lines = lines.slice(1);
    if (lines.length === 0 || !line.separator.test(lines[0])) return found;
  }
}

/**
 * The content with any header blocks beyond the first removed.
 *
 * Unchanged where there is one block or none, which is nearly always.
 *
 * The first is kept because it is the one `parseHeader` reads and the one every
 * other operation has been acting on, and because a stack is built by prepending,
 * so the first is the newest. What the extra blocks hold is not merged in: they
 * are duplicates of the survivor in every case observed, and merging would be
 * inventing a policy for a shape that should not exist.
 *
 * @param content - The file content to collapse
 * @param config - The resolved configuration
 * @returns The content with one header block, or exactly what came in
 */
export function withoutStackedHeaders(
  content: string,
  config?: ResolvedConfig,
): string {
  if (stackedHeaders(content, config) < 2) return content;

  const line = patterns(config);
  const lines = content.split("\n");
  const first = parseHeader(content, config);
  if (first === null) return content;

  let at = first.endLine;
  while (true) {
    let next = at;
    while (next < lines.length && lines[next].trim() === "") next++;
    if (next >= lines.length || !line.separator.test(lines[next])) break;
    const parsed = parseHeader(lines.slice(next).join("\n"), config);
    if (parsed === null) break;
    at = next + parsed.endLine;
  }

  return [...lines.slice(0, first.endLine), ...lines.slice(at)].join("\n");
}

/**
 * Validates a header against the configuration.
 *
 * @param content - The file content to validate
 * @param config - The resolved configuration
 * @returns Validation result with any issues
 */
export function validateHeader(
  content: string,
  config: ResolvedConfig,
): HeaderValidation {
  const issues: string[] = [];

  const parsed = parseHeader(content, config);

  if (!parsed) {
    return { valid: false, issues: ["No valid header found"] };
  }

  const stacked = stackedHeaders(content, config);
  if (stacked > 1) {
    issues.push(
      `${stacked} header blocks are stacked at the top of the file; ` +
        `only the first is read, and the rest are content`,
    );
  }

  // Check year is valid
  const currentYear = new Date().getFullYear();
  if (parsed.yearStart > currentYear) {
    issues.push(`Year ${parsed.yearStart} is in the future`);
  }
  if (parsed.yearEnd > currentYear) {
    issues.push(`End year ${parsed.yearEnd} is in the future`);
  }
  if (parsed.yearEnd < parsed.yearStart) {
    issues.push(`End year ${parsed.yearEnd} is before start year ${parsed.yearStart}`);
  }

  // Check SPDX matches config
  if (config.spdxLicense && parsed.spdxLicense !== config.spdxLicense) {
    issues.push(
      `SPDX license '${parsed.spdxLicense}' does not match config '${config.spdxLicense}'`,
    );
  }

  // Check contributors exist
  if (parsed.contributors.length === 0) {
    issues.push("No contributors found in header");
  }

  return { valid: issues.length === 0, issues };
}

/**
 * Checks if content starts with a shebang line.
 *
 * A shebang names an interpreter, so what follows `#!` is a path. Rust's inner
 * attribute syntax opens the same two characters and then a bracket, and a file
 * beginning `#![no_std]` is not executable by anything. Reading one as a shebang
 * puts the header on the second line, where the check that placed it will not
 * find it again.
 *
 * The test is the two characters and a bracket, which is not the whole of rustc's
 * rule: it takes the next token after `#!`, so `#! [no_std]` with a space between
 * is a valid inner attribute and this still reads it as a shebang. Nobody writes
 * it that way, and the wider test wants a tokeniser rather than a prefix.
 *
 * @param content - The file content to check
 * @returns The shebang line if present, or null
 */
function extractShebang(content: string): { shebang: string; rest: string } | null {
  if (content.startsWith("#!") && !content.startsWith("#![")) {
    const newlineIndex = content.indexOf("\n");
    if (newlineIndex === -1) {
      return { shebang: content, rest: "" };
    }
    return {
      shebang: content.slice(0, newlineIndex),
      rest: content.slice(newlineIndex + 1),
    };
  }
  return null;
}

/**
 * A fresh header over whatever `content` already had at the top of it.
 *
 * The create path, as one function, because conservation is a property of the
 * whole of it rather than of either half: generating a header and replacing a
 * block are both correct on their own while the pair of them silently drops
 * what the block said. What it said travels as `extra`, so the block is
 * replaced and its lines are still there to read.
 */
export function rewriteHeader(
  content: string,
  config: ResolvedConfig,
  contributors: Contributor[],
  yearStart: number,
  yearEnd: number,
): string {
  // Anybody the old block credited comes first, because they were there first.
  // Reading them costs nothing here and dropping them is the loss this whole
  // function exists to prevent: the block is being replaced, so a name only it
  // carried has nowhere else to be.
  const already = parseHeader(content, config)?.contributors ?? [];
  const seen = new Set<string>();
  const both: Contributor[] = [];
  for (const one of [...already, ...contributors]) {
    const key = one.email.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    both.push(one);
  }

  // A carried line whose addresses are all credited now would say the same
  // people twice, once in the run of names and once below the licence. That
  // happens to exactly the people who work on the file: a name demoted when the
  // run ended early comes back as a credit the next time they commit, and its
  // old line is still sitting there. Credited wins, because it is the form the
  // tool can read back.
  const credited = new Set(both.map((one) => one.email.toLowerCase()));
  const carried = interiorOf(content, config).filter((line) => {
    const found = line.match(/\S+@\S+/g);
    if (found === null) return true;
    return !found.every((one) => credited.has(one.toLowerCase()));
  });

  const header = generateHeader(config, both, yearStart, yearEnd, carried);
  return replaceHeader(content, header, undefined, config);
}

/**
 * Replaces or prepends a header in file content.
 *
 * Handles special cases:
 * - Shebang lines (#!) are preserved at the very top of the file
 * - Existing headers are replaced in-place
 * - New headers are inserted after any shebang
 *
 * @param content - The original file content
 * @param newHeader - The new header to insert
 * @param existingHeader - The existing header to replace (if any)
 * @returns The updated file content
 */
export function replaceHeader(
  content: string,
  newHeader: string,
  existingHeader?: ParsedHeader,
  config?: ResolvedConfig,
): string {
  // Handle shebang preservation
  const shebangResult = extractShebang(content);

  if (shebangResult) {
    // File has a shebang - process the rest and prepend shebang at the end
    const restWithHeader = replaceHeaderInContent(
      shebangResult.rest,
      newHeader,
      existingHeader,
      config,
    );
    return shebangResult.shebang + "\n" + restWithHeader;
  }

  return replaceHeaderInContent(content, newHeader, existingHeader, config);
}

/**
 * Internal function to replace header without shebang handling.
 */
function replaceHeaderInContent(
  content: string,
  newHeader: string,
  existingHeader?: ParsedHeader,
  config?: ResolvedConfig,
): string {
  // A block this tool could not read is still a block, and it is replaced
  // rather than written above. Otherwise a project whose old headers say
  // something the patterns do not recognise gets a second one prepended to
  // every file in it, on the run that was supposed to adopt the tool.
  const ends = existingHeader?.endLine ?? headerExtent(content, config);

  if (ends !== undefined) {
    const afterHeader = content.split("\n").slice(ends);

    // Ensure blank line after header
    const separator = afterHeader[0]?.trim() === "" ? "" : "\n";

    return newHeader + "\n" + separator + afterHeader.join("\n");
  }

  // Prepend new header with blank line
  const trimmedContent = content.trimStart();
  return newHeader + "\n\n" + trimmedContent;
}

/**
 * Checks if a contributor is present in the header.
 *
 * @param content - The file content
 * @param email - The contributor's email to search for
 * @returns True if the contributor is in the header
 */
export function hasContributor(
  content: string,
  email: string,
  config?: ResolvedConfig,
): boolean {
  const parsed = parseHeader(content, config);
  if (!parsed) {
    return false;
  }
  return parsed.contributors.some(
    (c) => c.email.toLowerCase() === email.toLowerCase(),
  );
}

/**
 * Extracts the year range from an existing header.
 *
 * @param content - The file content
 * @returns Object with yearStart and yearEnd, or null if no header
 */
export function getYearRange(
  content: string,
  config?: ResolvedConfig,
): { yearStart: number; yearEnd: number } | null {
  const parsed = parseHeader(content, config);
  if (!parsed || parsed.yearStart === 0) {
    return null;
  }
  return { yearStart: parsed.yearStart, yearEnd: parsed.yearEnd };
}
