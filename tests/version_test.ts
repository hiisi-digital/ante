//--------------------------------------------------------------------------------------------------
// Copyright (c) 2025-2026              orgrinrt                 orgrinrt@ikiuni.dev
//                                      orgrinrt                 ort@hiisi.digital
// SPDX-License-Identifier: MPL-2.0     https://mozilla.org/MPL/2.0        ort@hiisi.digital
//--------------------------------------------------------------------------------------------------

/**
 * The reported version is the published one.
 *
 * `core/version.ts` used to reach the value by importing `../deno.json`, which
 * sits beside the module in a clone and nowhere else. Because the import was
 * static rather than a read, the consequence was not a wrong version: the module
 * could not be loaded at all from anywhere the config is absent, which is every
 * built distribution.
 *
 * The constant that replaced it can drift from the config, so this reads both
 * and compares. One line of duplication, checked.
 *
 * @module
 */

import { VERSION } from "#core";
import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";

describe("version", () => {
  it("matches the version the config publishes", async () => {
    const config = JSON.parse(
      await Deno.readTextFile(new URL("../deno.json", import.meta.url)),
    ) as { version?: string };
    assertEquals(VERSION, config.version, "core/version.ts and deno.json disagree");
  });

  it("is reachable from a copy that has no config beside it", async () => {
    // The defect in one line, and the setup is the whole test: the module has to
    // actually be somewhere else. A first version of this ran a probe in a
    // scratch directory but imported the module by its original URL, so
    // `../deno.json` still resolved and it passed against the very defect it was
    // written for. A static import resolves relative to the module, not the cwd.
    const dir = await Deno.makeTempDir({ prefix: "ante_version_" });
    try {
      const copy = `${dir}/version.ts`;
      await Deno.copyFile(new URL("../core/version.ts", import.meta.url), copy);
      await Deno.writeTextFile(
        `${dir}/probe.ts`,
        `import { VERSION } from "./version.ts";\nconsole.log(VERSION);\n`,
      );
      const { success, stdout, stderr } = await new Deno.Command(Deno.execPath(), {
        args: ["run", "--allow-read", `${dir}/probe.ts`],
        cwd: dir,
        stdout: "piped",
        stderr: "piped",
      }).output();
      const decoder = new TextDecoder();
      assertEquals(
        success,
        true,
        `the module does not load with no config beside it:\n${decoder.decode(stderr)}`,
      );
      assertEquals(decoder.decode(stdout).trim(), VERSION);
    } finally {
      await Deno.remove(dir, { recursive: true });
    }
  });
});
