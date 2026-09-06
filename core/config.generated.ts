//--------------------------------------------------------------------------------------------------
// Copyright (c) 2025-2026              orgrinrt                 orgrinrt@ikiuni.dev
//                                      orgrinrt                 ort@hiisi.digital
// SPDX-License-Identifier: MPL-2.0     https://mozilla.org/MPL/2.0        ort@hiisi.digital
//--------------------------------------------------------------------------------------------------

/** AUTO-GENERATED FILE - DO NOT EDIT. Run `deno task codegen` to regenerate. */

/** Represents a contributor in a copyright header. */
export interface Contributor {
  /** The contributor's display name. */
  name: string;
  /** The contributor's email address. */
  email: string;
}

/** Strategy for selecting which contributors to display. */
export type ContributorSelection = "commits" | "lines" | "recent" | "manual";

/** Configuration for ante copyright header management. */
export interface AnteConfig {
  /**
   * Total line width for header lines, including the comment prefix. The separator lines and
   * content will be padded/truncated to fit this width. Recommended values are 80 (traditional
   * terminal width) or 100 (modern editors). @default 100
   */
  width?: number;
  /**
   * The character used to build separator lines at the top and bottom of the header block.
   * Common choices are '-', '=', or '*'. @default "-"
   */
  separatorChar?: string;
  /**
   * The comment prefix to use for header lines. This should match the target language's line
   * comment syntax. Examples: '//' for TypeScript/JavaScript/Rust, '#' for Python/Shell, '--'
   * for Lua/SQL. @default "//"
   */
  commentPrefix?: string;
  /**
   * The column position (0-indexed) where contributor names should start in the copyright
   * lines. Content before this position includes the copyright notice and year. @default 40
   */
  nameColumn?: number;
  /**
   * The column position (0-indexed) where contributor email addresses should start in the
   * copyright lines. This should be greater than nameColumn to allow space for names. @default
   * 65
   */
  emailColumn?: number;
  /**
   * The column position (0-indexed) where the license URL should start in the SPDX line. This
   * is typically aligned with nameColumn for visual consistency. @default 40
   */
  licenseUrlColumn?: number;
  /**
   * The column position (0-indexed) where the maintainer contact should start in the SPDX line.
   * This appears after the license URL. @default 75
   */
  maintainerColumn?: number;
  /**
   * The SPDX license identifier to include in headers. If not specified, this is derived from
   * the 'license' field in your deno.json or package.json. See https://spdx.org/licenses/ for
   * valid identifiers.
   */
  spdxLicense?: string;
  /**
   * The URL pointing to the license text. If not specified, this is automatically derived from
   * the spdxLicense. For example, 'MPL-2.0' becomes 'https://mozilla.org/MPL/2.0'.
   */
  licenseUrl?: string;
  /**
   * The contact email for the project maintainer, displayed in the SPDX line. If not specified,
   * this is read from git config user.email. This is typically a project or organization email,
   * not a personal contributor email.
   */
  maintainerEmail?: string;
  /**
   * Maximum number of contributors to display in the header. When a file has more contributors
   * than this limit, only the top N (by the chosen strategy) are shown. Set to 1 for
   * single-author headers. @default 3
   */
  maxContributors?: number;
  /**
   * Strategy for selecting which contributors to display when a file has more contributors than
   * maxContributors. Options: - 'commits': Contributors with the most commits touching this
   * file - 'lines': Contributors who changed the most lines in this file - 'recent': Most
   * recent contributors to this file - 'manual': Use the manualContributors list instead of git
   * history @default "commits"
   */
  contributorSelection?: ContributorSelection;
  /**
   * Explicit list of contributors to use when contributorSelection is 'manual'. This bypasses
   * git history entirely. Useful for files that were migrated from another repository or for
   * organization-level attribution.
   */
  manualContributors?: Contributor[];
  /**
   * Glob patterns for files that should have copyright headers. Files matching any of these
   * patterns will be processed by ante. Use standard glob syntax with '**' for recursive
   * matching.
   */
  include?: string[];
  /**
   * Glob patterns for files to exclude from processing. Files matching any of these patterns
   * will be skipped, even if they match an include pattern. Exclude patterns take precedence
   * over include patterns.
   */
  exclude?: string[];
}

/** Default values for all configuration options. */
export const DEFAULT_CONFIG: Required<AnteConfig> = {
  width: 100,
  separatorChar: "-",
  commentPrefix: "//",
  nameColumn: 40,
  emailColumn: 65,
  licenseUrlColumn: 40,
  maintainerColumn: 75,
  spdxLicense: "",
  licenseUrl: "",
  maintainerEmail: "",
  maxContributors: 3,
  contributorSelection: "commits",
  manualContributors: [],
  include: ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx"],
  exclude: ["**/node_modules/**", "**/dist/**", "**/build/**", "**/coverage/**"],
};

/**
 * The range each numeric option is declared to hold, straight from the schema.
 *
 * The schema is where the ranges are written and it is not consulted at
 * runtime, so a bound that lived only there was a comment. Emitting it here
 * puts it somewhere the loader can read, which is the same reason the types
 * are generated rather than written twice.
 */
export const CONFIG_BOUNDS: Readonly<Record<string, { min: number; max: number }>> = {
  width: { min: 60, max: 200 },
  nameColumn: { min: 20, max: 100 },
  emailColumn: { min: 40, max: 150 },
  licenseUrlColumn: { min: 20, max: 100 },
  maintainerColumn: { min: 50, max: 150 },
  maxContributors: { min: 1, max: 10 },
};

/** Fully resolved configuration with all values populated. */
export type ResolvedConfig = Required<AnteConfig>;
