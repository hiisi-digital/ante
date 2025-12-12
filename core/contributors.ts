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
import { getGitConfig } from "./config.ts";

export type { Contributor };

/**
 * Contributor with commit statistics for ranking.
 */
interface ContributorStats {
  contributor: Contributor;
  commits: number;
  linesChanged: number;
  lastCommitDate: Date;
}

/**
 * Selects contributors for a file based on the configured strategy.
 *
 * @param file - Path to the file
 * @param config - The configuration
 * @returns Promise resolving to array of selected contributors
 */
export async function selectContributors(
  file: string,
  config: AnteConfig,
): Promise<Contributor[]> {
  if (config.contributorSelection === "manual") {
    return config.manualContributors?.slice(0, config.maxContributors) ?? [];
  }

  const stats = await getContributorStats(file);

  if (stats.length === 0) {
    // Fallback to current git user
    const current = await getCurrentGitUser();
    return current ? [current] : [];
  }

  // Sort by the selected strategy
  const sorted = sortByStrategy(stats, config.contributorSelection ?? "commits");

  // Return top N contributors
  return sorted
    .slice(0, config.maxContributors ?? 3)
    .map((s) => s.contributor);
}

/**
 * Sorts contributors by the specified strategy.
 */
function sortByStrategy(
  stats: ContributorStats[],
  strategy: ContributorSelection,
): ContributorStats[] {
  const sorted = [...stats];

  switch (strategy) {
    case "commits":
      sorted.sort((a, b) => b.commits - a.commits);
      break;
    case "lines":
      sorted.sort((a, b) => b.linesChanged - a.linesChanged);
      break;
    case "recent":
      sorted.sort((a, b) => b.lastCommitDate.getTime() - a.lastCommitDate.getTime());
      break;
    case "manual":
      // Manual doesn't use stats, but keep original order if called
      break;
  }

  return sorted;
}

/**
 * Gets contributor statistics from git history for a file.
 */
async function getContributorStats(file: string): Promise<ContributorStats[]> {
  try {
    // Get git log with author info, commit count per author
    const cmd = new Deno.Command("git", {
      args: [
        "log",
        "--follow",
        "--format=%aN|%aE|%aI",
        "--numstat",
        "--",
        file,
      ],
      stdout: "piped",
      stderr: "null",
    });

    const output = await cmd.output();
    if (!output.success) {
      return [];
    }

    const text = new TextDecoder().decode(output.stdout);
    return parseGitLog(text);
  } catch {
    return [];
  }
}

/**
 * Parses git log output into contributor statistics.
 */
function parseGitLog(logText: string): ContributorStats[] {
  const statsMap = new Map<string, ContributorStats>();
  const lines = logText.split("\n");

  let currentAuthor: { name: string; email: string; date: Date } | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Check for author line (format: name|email|date)
    if (trimmed.includes("|") && trimmed.includes("@")) {
      const parts = trimmed.split("|");
      if (parts.length >= 3) {
        currentAuthor = {
          name: parts[0],
          email: parts[1],
          date: new Date(parts[2]),
        };

        // Initialize or update stats
        const key = currentAuthor.email.toLowerCase();
        if (!statsMap.has(key)) {
          statsMap.set(key, {
            contributor: { name: currentAuthor.name, email: currentAuthor.email },
            commits: 0,
            linesChanged: 0,
            lastCommitDate: currentAuthor.date,
          });
        }
        const stats = statsMap.get(key)!;
        stats.commits++;
        if (currentAuthor.date > stats.lastCommitDate) {
          stats.lastCommitDate = currentAuthor.date;
        }
      }
      continue;
    }

    // Check for numstat line (format: additions \t deletions \t filename)
    if (currentAuthor && /^\d+\s+\d+/.test(trimmed)) {
      const match = trimmed.match(/^(\d+)\s+(\d+)/);
      if (match) {
        const additions = parseInt(match[1], 10);
        const deletions = parseInt(match[2], 10);
        const key = currentAuthor.email.toLowerCase();
        const stats = statsMap.get(key);
        if (stats) {
          stats.linesChanged += additions + deletions;
        }
      }
    }
  }

  return Array.from(statsMap.values());
}

/**
 * Merges existing contributors with new ones, avoiding duplicates.
 * New contributors are added at the end.
 *
 * @param existing - Current list of contributors
 * @param newContributors - Contributors to add
 * @returns Merged list without duplicates
 */
export function mergeContributors(
  existing: Contributor[],
  newContributors: Contributor[],
): Contributor[] {
  const seen = new Set<string>();
  const result: Contributor[] = [];

  for (const c of [...existing, ...newContributors]) {
    const key = c.email.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      result.push(c);
    }
  }

  return result;
}

/**
 * Formats a contributor for display (name <email> format).
 *
 * @param contributor - The contributor to format
 * @returns Formatted string
 */
export function formatContributor(contributor: Contributor): string {
  return `${contributor.name} <${contributor.email}>`;
}

/**
 * Gets the current git user as a contributor.
 *
 * @returns The current git user, or null if not configured
 */
export async function getCurrentGitUser(): Promise<Contributor | null> {
  const name = await getGitConfig("user.name");
  const email = await getGitConfig("user.email");

  if (!name || !email) {
    return null;
  }

  return { name, email };
}

/**
 * Gets contributors from git history for a file.
 *
 * @param file - Path to the file
 * @param strategy - Selection strategy
 * @param maxContributors - Maximum number to return
 * @returns Promise resolving to array of contributors
 */
export async function getContributorsFromHistory(
  file: string,
  strategy: ContributorSelection,
  maxContributors: number,
): Promise<Contributor[]> {
  const stats = await getContributorStats(file);

  if (stats.length === 0) {
    return [];
  }

  const sorted = sortByStrategy(stats, strategy);
  return sorted.slice(0, maxContributors).map((s) => s.contributor);
}

/**
 * Gets the year range for a file from git history.
 *
 * @param file - Path to the file
 * @returns Object with firstYear and lastYear, or null if not in git
 */
export async function getFileYearRange(
  file: string,
): Promise<{ firstYear: number; lastYear: number } | null> {
  try {
    // Get first commit date
    const firstCmd = new Deno.Command("git", {
      args: ["log", "--follow", "--format=%aI", "--reverse", "--", file],
      stdout: "piped",
      stderr: "null",
    });
    const firstOutput = await firstCmd.output();

    // Get last commit date
    const lastCmd = new Deno.Command("git", {
      args: ["log", "-1", "--format=%aI", "--", file],
      stdout: "piped",
      stderr: "null",
    });
    const lastOutput = await lastCmd.output();

    if (!firstOutput.success || !lastOutput.success) {
      return null;
    }

    const firstText = new TextDecoder().decode(firstOutput.stdout).trim();
    const lastText = new TextDecoder().decode(lastOutput.stdout).trim();

    const firstLine = firstText.split("\n")[0];
    const lastLine = lastText.split("\n")[0];

    if (!firstLine || !lastLine) {
      return null;
    }

    const firstDate = new Date(firstLine);
    const lastDate = new Date(lastLine);

    return {
      firstYear: firstDate.getFullYear(),
      lastYear: lastDate.getFullYear(),
    };
  } catch {
    return null;
  }
}
