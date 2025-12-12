//----------------------------------------------------------------------------------------------------
// Copyright (c) 2025                    orgrinrt                    orgrinrt@ikiuni.dev
// SPDX-License-Identifier: MPL-2.0      https://mozilla.org/MPL/2.0 contact@hiisi.digital
//----------------------------------------------------------------------------------------------------

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
  /** Total line width for header lines, including the comment ... @default 100 */
  width?: number;
  /** The character used to build separator lines at the top an... @default "-" */
  separatorChar?: string;
  /** The comment prefix to use for header lines. This should m... @default "//" */
  commentPrefix?: string;
  /** The column position (0-indexed) where contributor names s... @default 40 */
  nameColumn?: number;
  /** The column position (0-indexed) where contributor email a... @default 65 */
  emailColumn?: number;
  /** The column position (0-indexed) where the license URL sho... @default 40 */
  licenseUrlColumn?: number;
  /** The column position (0-indexed) where the maintainer cont... @default 75 */
  maintainerColumn?: number;
  /** The SPDX license identifier to include in headers. If not... */
  spdxLicense?: string;
  /** The URL pointing to the license text. If not specified, t... */
  licenseUrl?: string;
  /** The contact email for the project maintainer, displayed i... */
  maintainerEmail?: string;
  /** Maximum number of contributors to display in the header. ... @default 3 */
  maxContributors?: number;
  /** Strategy for selecting which contributors to display when... @default "commits" */
  contributorSelection?: ContributorSelection;
  /** Explicit list of contributors to use when contributorSele... */
  manualContributors?: Contributor[];
  /** Glob patterns for files that should have copyright header... */
  include?: string[];
  /** Glob patterns for files to exclude from processing. Files... */
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
  include: ["** /*.ts", "** /*.tsx", "** /*.js", "** /*.jsx"],
  exclude: ["** /node_modules/**", "** /dist/**", "** /build/**", "** /coverage/**"],
};

/** Fully resolved configuration with all values populated. */
export type ResolvedConfig = Required<AnteConfig>;
