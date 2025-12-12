//----------------------------------------------------------------------------------------------------
// Copyright (c) 2025                    orgrinrt                    orgrinrt@ikiuni.dev
//                                      orgrinrt                 ort@hiisi.digital
// SPDX-License-Identifier: MPL-2.0      https://mozilla.org/MPL/2.0 contact@hiisi.digital
//----------------------------------------------------------------------------------------------------

/**
 * CLI entry point for ante.
 *
 * Provides commands for managing copyright headers:
 * - init: Set up configuration and install git hooks
 * - check: Verify headers are present and valid
 * - fix: Add or update headers across files
 * - add: Add header to a specific file
 */

import { loadConfig, VERSION } from "#core";
import { add } from "./commands/add.ts";
import { runCheck } from "./commands/check.ts";
import { runFix } from "./commands/fix.ts";
import { runInit } from "./commands/init.ts";

// VERSION is imported from #core and read from deno.json

/** Available commands */
type Command = "init" | "check" | "fix" | "add" | "help" | "version";

/**
 * Parsed CLI arguments.
 */
interface ParsedArgs {
  command: Command | null;
  args: string[];
  flags: {
    help: boolean;
    version: boolean;
    verbose: boolean;
    dryRun: boolean;
    yes: boolean;
    force: boolean;
    glob?: string;
    format?: "human" | "json";
  };
}

/**
 * Prints usage information.
 */
function printUsage(): void {
  console.log(`
ante - Copyright header management tool

USAGE:
  ante <command> [options]

COMMANDS:
  init              Set up configuration and install git hooks
  check [glob]      Verify headers are present and valid
  fix [glob]        Fix all headers to match configuration
  add <file>        Add header to a specific file
  help              Show this help message
  version           Show version information

OPTIONS:
  -h, --help        Show help for a command
  -v, --verbose     Show verbose output
  -y, --yes         Skip interactive prompts (init)
  --dry-run         Show what would be done without making changes
  --force           Overwrite existing headers (add)
  --format <fmt>    Output format: human (default), json

EXAMPLES:
  ante init                    # Set up ante in your project
  ante check                   # Check all files
  ante check "src/**/*.ts"     # Check specific files
  ante fix                     # Fix all headers
  ante add src/new-file.ts     # Add header to one file
`);
}

/**
 * Prints version information.
 */
function printVersion(): void {
  console.log(`ante v${VERSION}`);
}

/**
 * Parses command line arguments.
 */
function parseArgs(args: string[]): ParsedArgs {
  const result: ParsedArgs = {
    command: null,
    args: [],
    flags: {
      help: false,
      version: false,
      verbose: false,
      dryRun: false,
      yes: false,
      force: false,
    },
  };

  let i = 0;
  while (i < args.length) {
    const arg = args[i];

    if (arg === "-h" || arg === "--help") {
      result.flags.help = true;
    } else if (arg === "-V" || arg === "--version") {
      result.flags.version = true;
    } else if (arg === "-v" || arg === "--verbose") {
      result.flags.verbose = true;
    } else if (arg === "--dry-run") {
      result.flags.dryRun = true;
    } else if (arg === "-y" || arg === "--yes") {
      result.flags.yes = true;
    } else if (arg === "--force") {
      result.flags.force = true;
    } else if (arg === "--format" && i + 1 < args.length) {
      const fmt = args[++i];
      if (fmt === "human" || fmt === "json") {
        result.flags.format = fmt;
      }
    } else if (!arg.startsWith("-")) {
      if (result.command === null) {
        const cmd = arg.toLowerCase();
        if (
          cmd === "init" ||
          cmd === "check" ||
          cmd === "fix" ||
          cmd === "add" ||
          cmd === "help" ||
          cmd === "version"
        ) {
          result.command = cmd;
        } else {
          // Treat as positional arg (e.g., glob pattern or file path)
          result.args.push(arg);
        }
      } else {
        result.args.push(arg);
      }
    }
    i++;
  }

  return result;
}

/**
 * Main CLI entry point.
 *
 * @param args - Command line arguments (typically Deno.args)
 * @returns Exit code (0 for success, non-zero for errors)
 */
export async function main(args: string[]): Promise<number> {
  const parsed = parseArgs(args);

  // Handle global flags
  if (parsed.flags.version || parsed.command === "version") {
    printVersion();
    return 0;
  }

  if (parsed.flags.help || parsed.command === "help" || parsed.command === null) {
    printUsage();
    return parsed.command === null && !parsed.flags.help ? 1 : 0;
  }

  // Load configuration for commands that need it
  const config = await loadConfig();

  // Dispatch to command handlers
  switch (parsed.command) {
    case "init": {
      try {
        await runInit({
          yes: parsed.flags.yes,
          skipHooks: false,
        });
        return 0;
      } catch (error) {
        console.error("init failed:", error instanceof Error ? error.message : error);
        return 1;
      }
    }

    case "check": {
      try {
        const result = await runCheck(config, {
          glob: parsed.args[0] ?? parsed.flags.glob,
          verbose: parsed.flags.verbose,
          format: parsed.flags.format ?? "human",
        });
        return result.failedFiles > 0 ? 1 : 0;
      } catch (error) {
        console.error("check failed:", error instanceof Error ? error.message : error);
        return 1;
      }
    }

    case "fix": {
      try {
        const results = await runFix(config, {
          glob: parsed.args[0] ?? parsed.flags.glob,
          dryRun: parsed.flags.dryRun,
          verbose: parsed.flags.verbose,
        });
        const modified = results.filter((r) => r.modified).length;
        if (parsed.flags.verbose || modified > 0) {
          console.log(`Fixed ${modified} file(s)`);
        }
        return 0;
      } catch (error) {
        console.error("fix failed:", error instanceof Error ? error.message : error);
        return 1;
      }
    }

    case "add": {
      if (parsed.args.length === 0) {
        console.error("add requires a file path");
        return 1;
      }
      return add(
        {
          file: parsed.args[0],
          force: parsed.flags.force,
        },
        config,
      );
    }

    default:
      printUsage();
      return 1;
  }
}

// Run if executed directly
if (import.meta.main) {
  const code = await main(Deno.args);
  Deno.exit(code);
}
