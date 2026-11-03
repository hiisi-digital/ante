//--------------------------------------------------------------------------------------------------
// Copyright (c) 2025-2026              orgrinrt                 orgrinrt@ikiuni.dev
//                                      orgrinrt                 ort@hiisi.digital
// SPDX-License-Identifier: MPL-2.0     https://mozilla.org/MPL/2.0        ort@hiisi.digital
//--------------------------------------------------------------------------------------------------

/**
 * Running a subprocess, on whichever runtime is present.
 *
 * `Deno.Command` is the only Deno API this package uses that the dnt shim does not
 * provide, at runtime or in its types. So every path here that asks git a question threw
 * `Deno is not defined` in the npm build, which is the build that exists so this can be
 * used from Node.
 *
 * That was not visible, because the build turned type-checking off with a note saying the
 * shim's `Deno.Command` typing was awkward. The type error was accurate: the property is
 * absent, and it is absent when it runs too.
 *
 * @module
 */

/** What a finished subprocess produced. */
export interface CommandOutput {
  /** Whether it exited zero. */
  readonly success: boolean;
  /** Whatever it wrote to standard output. */
  readonly stdout: string;
}

/**
 * Runs a program with arguments and collects its standard output.
 *
 * Never throws: a program that is missing, refuses to start, or exits non-zero all arrive
 * as `success: false`, because every caller here treats "git could not answer" the same
 * way as "git said no".
 *
 * @param program - The program to run
 * @param args - Its arguments
 * @returns Whether it succeeded, and what it printed
 *
 * @example
 * ```ts
 * import { run } from "@hiisi/ante";
 *
 * const version = await run("git", ["--version"]);
 * if (version.success) {
 *   console.log(version.stdout.trim());
 * }
 * ```
 */
export async function run(
  program: string,
  args: readonly string[],
): Promise<CommandOutput> {
  const deno = (globalThis as { Deno?: { Command?: unknown } }).Deno;

  if (typeof deno?.Command === "function") {
    try {
      const Command = deno.Command as new (
        program: string,
        options: { args: readonly string[]; stdout: "piped"; stderr: "null" },
      ) => { output(): Promise<{ success: boolean; stdout: Uint8Array }> };

      const output = await new Command(program, {
        args,
        stdout: "piped",
        stderr: "null",
      }).output();

      return {
        success: output.success,
        stdout: new TextDecoder().decode(output.stdout),
      };
    } catch {
      return { success: false, stdout: "" };
    }
  }

  // Node and Bun. `node:` specifiers resolve on all three, so this file needs no build
  // step and no second copy for the npm output.
  try {
    const { execFile } = await import("node:child_process");
    return await new Promise<CommandOutput>((resolve) => {
      execFile(
        program,
        [...args],
        { encoding: "utf8" },
        (error: unknown, stdout: string) => {
          resolve({ success: error === null, stdout: stdout ?? "" });
        },
      );
    });
  } catch {
    return { success: false, stdout: "" };
  }
}
