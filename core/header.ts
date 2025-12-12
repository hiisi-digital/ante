//----------------------------------------------------------------------------------------------------
// Copyright (c) 2025                    orgrinrt                    orgrinrt@ikiuni.dev
// SPDX-License-Identifier: MPL-2.0      https://mozilla.org/MPL/2.0 contact@hiisi.digital
//----------------------------------------------------------------------------------------------------

/**
 * Header parsing, generation, and updating utilities.
 *
 * This module provides functions for:
 * - Parsing existing copyright headers from file content
 * - Generating new headers based on configuration
 * - Updating existing headers (year ranges, contributors)
 * - Validating header format and content
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

/** Regex to match separator lines */
const SEPARATOR_REGEX = /^\/\/[-=*]+$/;

/** Regex to match copyright line with year(s), name, and email (name can be multi-word) */
const COPYRIGHT_REGEX = /^\/\/\s*Copyright\s*\(c\)\s*(\d{4})(?:-(\d{4}))?\s+(.+?)\s{2,}(\S+@\S+)/i;

/** Regex to match contributor continuation line (no year, name can be multi-word) */
const CONTRIBUTOR_REGEX = /^\/\/\s{10,}(.+?)\s{2,}(\S+@\S+)/;

/** Regex to match SPDX license line */
const SPDX_REGEX = /^\/\/\s*SPDX-License-Identifier:\s*(\S+)\s+(https?:\/\/\S+)?\s*(\S+@\S+)?/i;

/**
 * Parses a copyright header from file content.
 *
 * @param content - The file content to parse
 * @returns The parsed header, or null if no valid header found
 */
export function parseHeader(content: string): ParsedHeader | null {
  const lines = content.split("\n");

  // Header must start with a separator line
  if (lines.length === 0 || !SEPARATOR_REGEX.test(lines[0])) {
    return null;
  }

  let endLine = -1;
  let yearStart = 0;
  let yearEnd = 0;
  const contributors: Contributor[] = [];
  let spdxLicense: string | null = null;
  let licenseUrl: string | null = null;
  let maintainerEmail: string | null = null;

  // Scan for the closing separator
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];

    // Check for closing separator
    if (SEPARATOR_REGEX.test(line)) {
      endLine = i + 1; // 1-indexed
      break;
    }

    // Check for copyright line
    const copyrightMatch = line.match(COPYRIGHT_REGEX);
    if (copyrightMatch) {
      yearStart = parseInt(copyrightMatch[1], 10);
      yearEnd = copyrightMatch[2] ? parseInt(copyrightMatch[2], 10) : yearStart;
      contributors.push({
        name: copyrightMatch[3],
        email: copyrightMatch[4],
      });
      continue;
    }

    // Check for contributor continuation line
    const contributorMatch = line.match(CONTRIBUTOR_REGEX);
    if (contributorMatch) {
      contributors.push({
        name: contributorMatch[1],
        email: contributorMatch[2],
      });
      continue;
    }

    // Check for SPDX line
    const spdxMatch = line.match(SPDX_REGEX);
    if (spdxMatch) {
      spdxLicense = spdxMatch[1];
      licenseUrl = spdxMatch[2] || null;
      maintainerEmail = spdxMatch[3] || null;
      continue;
    }
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
  };
}

/**
 * Generates a new copyright header.
 *
 * @param config - The resolved configuration
 * @param contributors - List of contributors to include
 * @param yearStart - The starting year for the copyright
 * @param yearEnd - The ending year (optional, defaults to yearStart)
 * @returns The generated header string
 */
export function generateHeader(
  config: ResolvedConfig,
  contributors: Contributor[],
  yearStart: number,
  yearEnd?: number,
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

  // Regenerate the header with updated info
  return generateHeader(config, contributors, yearStart, yearEnd);
}

/**
 * Checks if content has a valid copyright header.
 *
 * @param content - The file content to check
 * @returns True if a valid header is present
 */
export function hasValidHeader(content: string): boolean {
  const parsed = parseHeader(content);
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

  const parsed = parseHeader(content);

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
 * Replaces or prepends a header in file content.
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
export function hasContributor(content: string, email: string): boolean {
  const parsed = parseHeader(content);
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
): { yearStart: number; yearEnd: number } | null {
  const parsed = parseHeader(content);
  if (!parsed || parsed.yearStart === 0) {
    return null;
  }
  return { yearStart: parsed.yearStart, yearEnd: parsed.yearEnd };
}
