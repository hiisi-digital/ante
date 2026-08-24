//----------------------------------------------------------------------------------------------------
// Copyright (c) 2025-2026                    orgrinrt                    orgrinrt@ikiuni.dev
//                                      orgrinrt                 ort@hiisi.digital
// SPDX-License-Identifier: MPL-2.0      https://mozilla.org/MPL/2.0 contact@hiisi.digital
//----------------------------------------------------------------------------------------------------

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
    // The indent has to be deep enough that ordinary prose in a header cannot be
    // mistaken for a contributor. A line reading `//  ported from libfoo, ask
    // bugs@libfoo.org` is a note, and taking it for a contributor would push a
    // real one off the end of the list. Ten columns is the floor, and the
    // address has to end the line.
    //
    // The name runs up to the last run of whitespace before the address, which
    // is what lets a name carry spaces of its own. It is the loosest of the
    // three patterns and is therefore tried last.
    contributor: new RegExp(`^${prefix}\\s{10,}(.+?)\\s+(\\S+@\\S+)\\s*$`),
    // The url and the address are both optional, and so is the whitespace that
    // would separate them. A bare `SPDX-License-Identifier: MIT` is the form the
    // spec's own examples show and the form every tagged tree already carries,
    // and requiring a tail left it unrecognised, preserved verbatim, and then
    // duplicated by the line this tool writes beside it.
    spdx: new RegExp(
      `^${prefix}\\s*SPDX-License-Identifier:\\s*(\\S+)(?:\\s+(https?://\\S+))?(?:\\s+(\\S+@\\S+))?\\s*$`,
      "i",
    ),
  };
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
      continue;
    }

    // Check for SPDX line
    const spdxMatch = here.match(line.spdx);
    if (spdxMatch) {
      spdxLicense = spdxMatch[1];
      licenseUrl = spdxMatch[2] || null;
      maintainerEmail = spdxMatch[3] || null;
      continue;
    }

    // Check for contributor continuation line
    const contributorMatch = here.match(line.contributor);
    if (contributorMatch) {
      contributors.push({
        name: contributorMatch[1],
        email: contributorMatch[2],
      });
      continue;
    }

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

  // The limit bounds how long a fresh header gets. It never shortens one that
  // is already there: a name in the file is somebody credited, and no
  // configuration change, and no line this tool misread as a contributor, gets
  // to take a credit away.
  const room = {
    ...config,
    maxContributors: Math.max(config.maxContributors, contributors.length),
  };

  return generateHeader(
    room,
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
 * @param content - The file content to check
 * @returns The shebang line if present, or null
 */
function extractShebang(content: string): { shebang: string; rest: string } | null {
  if (content.startsWith("#!")) {
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
): string {
  // Handle shebang preservation
  const shebangResult = extractShebang(content);

  if (shebangResult) {
    // File has a shebang - process the rest and prepend shebang at the end
    const restWithHeader = replaceHeaderInContent(
      shebangResult.rest,
      newHeader,
      existingHeader,
    );
    return shebangResult.shebang + "\n" + restWithHeader;
  }

  return replaceHeaderInContent(content, newHeader, existingHeader);
}

/**
 * Internal function to replace header without shebang handling.
 */
function replaceHeaderInContent(
  content: string,
  newHeader: string,
  existingHeader?: ParsedHeader,
): string {
  if (existingHeader) {
    // Replace existing header
    const lines = content.split("\n");
    const afterHeader = lines.slice(existingHeader.endLine);

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
