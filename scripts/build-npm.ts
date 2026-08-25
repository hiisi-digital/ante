//----------------------------------------------------------------------------------------------------
// Copyright (c) 2025-2026                    orgrinrt                    orgrinrt@ikiuni.dev
//                                      orgrinrt                 ort@hiisi.digital
// SPDX-License-Identifier: MPL-2.0      https://mozilla.org/MPL/2.0 contact@hiisi.digital
//----------------------------------------------------------------------------------------------------

/**
 * Build script for npm package.
 *
 * This script uses dnt (Deno to Node Transform) to build an npm-compatible
 * package from our Deno source. It reads metadata from deno.json and generates
 * appropriate package.json and compiled JavaScript.
 *
 * Naming strategy:
 * - npm: Use unscoped name "ante-cli" (since "ante" is squatted)
 * - JSR: Use @hiisi/ante (scoped, as configured in deno.json)
 *
 * Run with: deno run -A scripts/build-npm.ts
 */

import { build, emptyDir } from "jsr:@deno/dnt@0.41.3";

// Package naming configuration
const NPM_PACKAGE_NAME = "ante-cli"; // Unscoped for npm (ante is squatted)
const NPM_BIN_NAME = "ante"; // The actual CLI command name

const denoJson = JSON.parse(await Deno.readTextFile("deno.json"));
const outDir = "./npm";

await emptyDir(outDir);

// The import map dnt is given is deno.json's own, not a second copy of it.
//
// It used to be written out here by hand, and the two disagreed: this list named five
// `@std` packages and deno.json named six. dnt therefore met a bare `@std/toml` specifier
// it could not resolve, left it in the output as written, and declared no dependency for
// it. The built package's `dependencies` was `{}` while its code imported `@std/toml`, so
// `npm install ante-cli` produced something that threw `ERR_MODULE_NOT_FOUND` on first
// use. Nothing caught it because nothing had ever run the built package.
const importMap = { imports: denoJson.imports as Record<string, string> };

const importMapPath = "./npm_import_map.json";
await Deno.writeTextFile(importMapPath, JSON.stringify(importMap, null, 2));

try {
  await build({
    entryPoints: [
      "./mod.ts",
      {
        name: "./cli",
        path: "./cli/mod.ts",
      },
    ],
    outDir,
    importMap: importMapPath,
    // The whole shim, not the test-only form. This code calls `Deno.cwd`, `Deno.stat`,
    // `Deno.readTextFile` and `Deno.Command` at runtime, and `{ test: false }` puts the
    // shim nowhere, so the built package threw `Deno is not defined` from `loadConfig` on
    // the first call. That is the package's own config loader, in the package that exists
    // to be used from Node.
    shims: {
      deno: true,
    },
    // The built output is type-checked. It was not, on the reasoning that the shim's
    // declarations lack `Deno.Command` while its runtime has it. Neither half held: the
    // runtime does not have it either, and the file cited as checking so did not exist.
    // Nothing reaches for `Deno.Command` any more, because `core/run.ts` picks whichever
    // spawn its runtime actually offers, so the check that was turned off to hide the
    // problem goes back on now the problem is gone.
    typeCheck: "both",
    scriptModule: false, // ESM only - CLI uses top-level await
    test: false,
    skipSourceOutput: true,
    compilerOptions: {
      lib: ["ES2022"],
      target: "ES2022",
    },
    package: {
      name: NPM_PACKAGE_NAME,
      version: denoJson.version,
      description:
        "Copyright headers as a maintained artifact. Checked, fixed and kept consistent across a whole tree.",
      license: denoJson.license,
      type: "module",
      repository: {
        type: "git",
        url: "git+https://github.com/hiisi-digital/ante.git",
      },
      bugs: {
        url: "https://github.com/hiisi-digital/ante/issues",
      },
      homepage: "https://github.com/hiisi-digital/ante#readme",
      keywords: [
        "copyright",
        "license",
        "header",
        "spdx",
        "cli",
        "pre-commit",
        "git-hooks",
        "automation",
      ],
      engines: {
        node: ">=18",
      },
      // Binary configuration - this is what makes `npm install -g ante-cli`
      // register the `ante` command
      bin: {
        [NPM_BIN_NAME]: "./esm/cli/mod.js",
      },
    },
    postBuild(): void {
      // Copy files that should be included in the npm package
      Deno.copyFileSync("LICENSE", `${outDir}/LICENSE`);
      Deno.copyFileSync("README.md", `${outDir}/README.md`);

      // Copy schema directory for config validation/IDE support
      Deno.mkdirSync(`${outDir}/schema`, { recursive: true });
      Deno.copyFileSync(
        "schema/config.schema.json",
        `${outDir}/schema/config.schema.json`,
      );

      // Add shebang to CLI entry point for proper binary execution
      const cliPath = `${outDir}/esm/cli/mod.js`;
      const cliContent = Deno.readTextFileSync(cliPath);
      if (!cliContent.startsWith("#!")) {
        Deno.writeTextFileSync(cliPath, `#!/usr/bin/env node\n${cliContent}`);
      }

      // Update the generated package.json with additional fields
      const pkgJsonPath = `${outDir}/package.json`;
      const pkgJson = JSON.parse(Deno.readTextFileSync(pkgJsonPath));

      // Add exports field for proper ESM resolution
      // `types` first, because export conditions are matched in order and
      // typescript takes the first that applies. Behind `import` it is reached
      // only through the fallback to a sibling `.d.ts`, which is the same thing
      // that hid these paths naming a directory the build does not emit.
      pkgJson.exports = {
        ".": {
          types: "./esm/mod.d.ts",
          import: "./esm/mod.js",
        },
        "./cli": {
          types: "./esm/cli/mod.d.ts",
          import: "./esm/cli/mod.js",
        },
      };

      // The legacy pair, for a consumer on `moduleResolution: "node"`, which
      // reads neither `exports` nor `module` and otherwise resolves nothing at
      // all. `main` names the esm entry because that is the only entry there is:
      // this package is esm only, so a commonjs consumer needs a dynamic import
      // either way and there is nothing here that would change that.
      pkgJson.main = "./esm/mod.js";
      pkgJson.types = "./esm/mod.d.ts";

      // Add files field to ensure only needed files are published
      // dnt emits declarations beside the javascript in `esm`, so there is no
      // `types` directory and naming one leaves every `types` condition pointing
      // at nothing. It resolved anyway, through typescript's fallback to a
      // sibling `.d.ts`, which is why nothing noticed.
      pkgJson.files = [
        "esm",
        "schema",
        "README.md",
        "LICENSE",
      ];

      Deno.writeTextFileSync(pkgJsonPath, JSON.stringify(pkgJson, null, 2) + "\n");

      console.log(`\nPackage configuration:`);
      console.log(`  Name: ${NPM_PACKAGE_NAME}`);
      console.log(`  Binary command: ${NPM_BIN_NAME}`);
      console.log(`  Version: ${denoJson.version}`);
    },
  });
} finally {
  // Clean up temporary import map
  try {
    await Deno.remove(importMapPath);
  } catch {
    // Ignore cleanup errors
  }
}

console.log("\nnpm package built successfully in ./npm");
console.log("\nTo publish:");
console.log("  cd npm && npm publish");
console.log("\nUsers can install with:");
console.log("  npm install -g ante-cli");
console.log("  # Then run:");
console.log("  ante --help");
