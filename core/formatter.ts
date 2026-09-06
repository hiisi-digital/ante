//--------------------------------------------------------------------------------------------------
// Copyright (c) 2025-2026              orgrinrt                 orgrinrt@ikiuni.dev
//                                      orgrinrt                 ort@hiisi.digital
// SPDX-License-Identifier: MPL-2.0     https://mozilla.org/MPL/2.0        ort@hiisi.digital
//--------------------------------------------------------------------------------------------------

/**
 * Putting text at a column, which is what makes a header line up.
 *
 * Columns are positions rather than widths, and content that overruns the next
 * one is not truncated: it pushes across, keeping the gap that separates two
 * fields, so a long name breaks the alignment of that line and nothing else.
 *
 * @module
 */

import type { ResolvedConfig } from "./config.ts";

/**
 * Column definition for formatted output.
 */
export interface Column {
  /** The text content to place in this column */
  content: string;
  /** The column position (0-indexed) where content should start */
  position: number;
}

/**
 * The narrowest run of spaces that still separates two fields.
 *
 * Columns are the intent and this is the floor, for a line whose content
 * overruns the column the next field was meant to start at. The parser takes any
 * run of whitespace, so this is what keeps such a line legible, not what keeps
 * it readable back.
 */
const MINIMUM_GAP = 2;

/**
 * Formats a line with content aligned to specified column positions.
 * Content is placed at each column position, with spaces filling gaps.
 * Content that overruns the next column pushes it across, keeping the minimum
 * gap that separates two fields.
 *
 * @param columns - Array of column definitions, should be sorted by position
 * @returns The formatted line string
 */
export function formatLine(columns: Column[]): string {
  if (columns.length === 0) {
    return "";
  }

  // Sort columns by position
  const sorted = [...columns].sort((a, b) => a.position - b.position);

  let result = "";
  let currentPos = 0;

  for (const col of sorted) {
    // Calculate padding needed to reach column position
    const paddingNeeded = col.position - currentPos;

    if (paddingNeeded >= MINIMUM_GAP) {
      result += " ".repeat(paddingNeeded);
      currentPos += paddingNeeded;
    } else if (currentPos > 0) {
      // The content before this one ran past where this one starts, so the
      // column is gone and the gap is all that is left of it.
      result += " ".repeat(MINIMUM_GAP);
      currentPos += MINIMUM_GAP;
    }

    result += col.content;
    currentPos += col.content.length;
  }

  return result;
}

/**
 * Generates a separator line.
 *
 * @param width - Total line width
 * @param char - Character to use for the separator (default: "-")
 * @param prefix - Comment prefix (default: "//")
 * @returns The separator line string
 */
export function generateSeparator(
  width: number,
  char = "-",
  prefix = "//",
): string {
  const separatorLength = width - prefix.length;
  if (separatorLength <= 0) {
    return prefix;
  }
  return prefix + char.repeat(separatorLength);
}

/**
 * Pads text with spaces so what follows it starts at the target column.
 *
 * Text already reaching the column pushes across, keeping the same minimum gap
 * {@link formatLine} keeps, so a line built out of these reads back the same way
 * as one built out of that.
 *
 * @param text - The text to pad
 * @param targetColumn - The target column position
 * @returns The padded text
 */
export function padToColumn(text: string, targetColumn: number): string {
  if (text.length >= targetColumn) {
    return text + " ".repeat(MINIMUM_GAP);
  }
  return text + " ".repeat(targetColumn - text.length);
}

/**
 * Formats a copyright line with proper column alignment.
 *
 * @param config - The resolved configuration
 * @param yearPart - Year or year range (e.g., "2025" or "2020-2025"), empty for continuation lines
 * @param name - Contributor name
 * @param email - Contributor email
 * @returns The formatted copyright line
 */
export function formatCopyrightLine(
  config: ResolvedConfig,
  yearPart: string,
  name: string,
  email: string,
): string {
  const prefix = config.commentPrefix;

  let lineStart: string;
  if (yearPart) {
    lineStart = `${prefix} Copyright (c) ${yearPart}`;
  } else {
    lineStart = prefix;
  }

  return formatLine([
    { content: lineStart, position: 0 },
    { content: name, position: config.nameColumn },
    { content: email, position: config.emailColumn },
  ]);
}

/**
 * Formats the SPDX license line with proper column alignment.
 *
 * @param config - The resolved configuration
 * @returns The formatted SPDX line
 */
export function formatSpdxLine(config: ResolvedConfig): string {
  const prefix = config.commentPrefix;
  const spdxPart = `${prefix} SPDX-License-Identifier: ${config.spdxLicense}`;

  return formatLine([
    { content: spdxPart, position: 0 },
    { content: config.licenseUrl, position: config.licenseUrlColumn },
    { content: config.maintainerEmail, position: config.maintainerColumn },
  ]);
}

/**
 * Trims a line to the configured width, if needed.
 *
 * @param line - The line to trim
 * @param width - Maximum width
 * @returns The trimmed line (without trailing spaces beyond width)
 */
export function trimToWidth(line: string, width: number): string {
  if (line.length <= width) {
    return line;
  }
  return line.substring(0, width);
}

/**
 * Pads or trims a line to exactly the configured width.
 *
 * @param line - The line to adjust
 * @param width - Target width
 * @returns The adjusted line
 */
export function adjustToWidth(line: string, width: number): string {
  if (line.length === width) {
    return line;
  }
  if (line.length > width) {
    return line.substring(0, width);
  }
  return line + " ".repeat(width - line.length);
}
