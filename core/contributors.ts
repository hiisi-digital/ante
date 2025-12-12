//----------------------------------------------------------------------------------------------------
// Copyright (c) 2025                    orgrinrt                    orgrinrt@ikiuni.dev
// SPDX-License-Identifier: MPL-2.0      https://mozilla.org/MPL/2.0 contact@hiisi.digital
//----------------------------------------------------------------------------------------------------

/**
 * Contributor management for ante.
 *
 * Handles extraction, selection, and formatting of contributors
 * for copyright headers based on configured strategies.
 */

import type { AnteConfig, Contributor, ContributorSelection } from "./config.ts";

export type { Contributor };

// TODO: Implement contributor selection strategies
// TODO: Implement contributor merging (existing + new)
// TODO: Implement contributor formatting

/**
 * Selects contributors for a file based on the configured strategy.
 */
export function selectContributors(
  _file: string,
  _config: AnteConfig,
): Promise<Contributor[]> {
  // TODO: Implement selection based on config.contributorSelection
  // - "commits": Most commits touching file
  // - "lines": Most lines changed
  // - "recent": Most recent contributors
  // - "manual": From config.manualContributors
  throw new Error("Not implemented");
}

/**
 * Merges existing contributors with new ones, avoiding duplicates.
 */
export function mergeContributors(
  existing: Contributor[],
  newContributors: Contributor[],
): Contributor[] {
  // TODO: Merge by email, preserving order
  const seen = new Set<string>();
  const result: Contributor[] = [];

  for (const c of [...existing, ...newContributors]) {
    if (!seen.has(c.email.toLowerCase())) {
      seen.add(c.email.toLowerCase());
      result.push(c);
    }
  }

  return result;
}

/**
 * Formats a contributor for display.
 */
export function formatContributor(contributor: Contributor): string {
  return `${contributor.name} <${contributor.email}>`;
}

/**
 * Gets the current git user as a contributor.
 */
export function getCurrentGitUser(): Promise<Contributor | null> {
  // TODO: Read from git config user.name and user.email
  return Promise.reject(new Error("Not implemented"));
}

/**
 * Gets contributors from git history for a file.
 */
export function getContributorsFromHistory(
  _file: string,
  _strategy: ContributorSelection,
  _maxContributors: number,
): Promise<Contributor[]> {
  // TODO: Parse git log for contributors
  return Promise.reject(new Error("Not implemented"));
}
