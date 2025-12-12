//----------------------------------------------------------------------------------------------------
// Copyright (c) 2025                    orgrinrt                    orgrinrt@ikiuni.dev
// SPDX-License-Identifier: MPL-2.0      https://mozilla.org/MPL/2.0 contact@hiisi.digital
//----------------------------------------------------------------------------------------------------

/**
 * Formatting utilities for copyright headers.
 *
 * Provides functions for column-aligned text formatting used in headers.
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
 * Formats a line with content aligned to specified column positions.
 * Content is placed at each column position, with spaces filling gaps.
 * If content overlaps the next column, a single space is used as minimum separator.
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

    if (paddingNeeded > 0) {
      result += " ".repeat(paddingNeeded);
      currentPos += paddingNeeded;
    } else if (currentPos > 0 && paddingNeeded <= 0) {
      // Content overlaps, add minimum single space
      result += " ";
      currentPos += 1;
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
 * Pads text with spaces to reach the target column position.
 *
 * @param text - The text to pad
 * @param targetColumn - The target column position
 * @returns The padded text
 */
export function padToColumn(text: string, targetColumn: number): string {
  if (text.length >= targetColumn) {
    return text + " "; // Minimum one space
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
