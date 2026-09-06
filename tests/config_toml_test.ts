//--------------------------------------------------------------------------------------------------
// Copyright (c) 2025-2026              orgrinrt                 orgrinrt@ikiuni.dev
//                                      orgrinrt                 ort@hiisi.digital
// SPDX-License-Identifier: MPL-2.0     https://mozilla.org/MPL/2.0        ort@hiisi.digital
//--------------------------------------------------------------------------------------------------

import { loadConfig } from "#core";
import { assertEquals, assertNotEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";

/**
 * Run a body inside a throwaway directory, with the process cwd moved into it.
 *
 * loadConfig searches upward from the cwd, so every case here needs a real
 * directory on disk rather than a fixture string.
 */
async function inTempDir(
  files: Record<string, string>,
  body: () => Promise<void>,
): Promise<void> {
  const dir = await Deno.makeTempDir({ prefix: "ante_toml_" });
  const cwd = Deno.cwd();
  try {
    await Promise.all(
      Object.entries(files).map(([name, content]) => Deno.writeTextFile(`${dir}/${name}`, content)),
    );
    Deno.chdir(dir);
    await body();
  } finally {
    Deno.chdir(cwd);
    await Deno.remove(dir, { recursive: true });
  }
}

describe("ante.toml", () => {
  it("reads a standalone file whose top level is the config", async () => {
    await inTempDir({
      "ante.toml": [
        `width = 120`,
        `maxContributors = 7`,
        `maintainerEmail = "someone@example.com"`,
        `spdxLicense = "MPL-2.0"`,
      ].join("\n"),
    }, async () => {
      const cfg = await loadConfig();
      assertEquals(cfg.width, 120);
      assertEquals(cfg.maxContributors, 7);
      assertEquals(cfg.maintainerEmail, "someone@example.com");
      assertEquals(cfg.spdxLicense, "MPL-2.0");
    });
  });

  it("honours an [ante] table inside the standalone file", async () => {
    await inTempDir({
      "ante.toml": `[ante]\nwidth = 88\nmaxContributors = 2\n`,
    }, async () => {
      const cfg = await loadConfig();
      assertEquals(cfg.width, 88);
      assertEquals(cfg.maxContributors, 2);
    });
  });

  it("reads array values, which is what include and exclude are", async () => {
    await inTempDir({
      "ante.toml": `include = ["src/**/*.rs"]\nexclude = ["target/**"]\n`,
    }, async () => {
      const cfg = await loadConfig();
      assertEquals(cfg.include, ["src/**/*.rs"]);
      assertEquals(cfg.exclude, ["target/**"]);
    });
  });

  it("takes the licence from a sibling Cargo.toml when the file omits it", async () => {
    await inTempDir({
      "ante.toml": `width = 100\n`,
      "Cargo.toml": `[package]\nname = "demo"\nversion = "0.1.0"\nlicense = "MPL-2.0"\n`,
    }, async () => {
      const cfg = await loadConfig();
      assertEquals(cfg.spdxLicense, "MPL-2.0");
      assertEquals(cfg.licenseUrl, "https://mozilla.org/MPL/2.0");
    });
  });

  it("prefers an explicit spdxLicense over the sibling manifest", async () => {
    await inTempDir({
      "ante.toml": `spdxLicense = "Apache-2.0"\n`,
      "Cargo.toml": `[package]\nname = "demo"\nlicense = "MPL-2.0"\n`,
    }, async () => {
      const cfg = await loadConfig();
      assertEquals(cfg.spdxLicense, "Apache-2.0");
    });
  });

  it("wins over a deno.json sitting in the same directory", async () => {
    await inTempDir({
      "ante.toml": `width = 111\n`,
      "deno.json": `{"ante":{"width":222}}`,
    }, async () => {
      const cfg = await loadConfig();
      assertEquals(cfg.width, 111);
    });
  });

  it("falls back to defaults when the toml is malformed rather than throwing", async () => {
    await inTempDir({
      "ante.toml": `width = = = broken\n`,
    }, async () => {
      const cfg = await loadConfig();
      assertEquals(cfg.width, 100);
    });
  });

  it("still reads deno.json when no ante.toml is present", async () => {
    await inTempDir({
      "deno.json": `{"ante":{"width":133},"license":"ISC"}`,
    }, async () => {
      const cfg = await loadConfig();
      assertEquals(cfg.width, 133);
      assertEquals(cfg.spdxLicense, "ISC");
    });
  });
});

describe("ante.toml negative controls", () => {
  // Each of these fails if the feature silently does nothing, which is the way
  // a config loader is most likely to break: returning defaults and looking fine.
  it("does not return the default width when the file sets another", async () => {
    await inTempDir({ "ante.toml": `width = 77\n` }, async () => {
      const cfg = await loadConfig();
      assertNotEquals(cfg.width, 100, "ante.toml was ignored; width is still the default");
    });
  });

  it("does not read a top-level key out of a JSON manifest", async () => {
    // Only a standalone toml treats the top level as config. In deno.json the
    // config must be under `ante`, because the rest of the file is not ours.
    await inTempDir({ "deno.json": `{"width":999}` }, async () => {
      const cfg = await loadConfig();
      assertEquals(cfg.width, 100);
    });
  });
});
