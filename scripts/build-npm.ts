//----------------------------------------------------------------------------------------------------
// Copyright (c) 2025                    orgrinrt                    orgrinrt@ikiuni.dev
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
 * - JSR: Use @loru/ante (scoped, as configured in deno.json)
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

// Create a temporary import map for dnt that resolves our aliases
const importMap = {
  imports: {
    "#core": "./core/mod.ts",
    "#git": "./git/mod.ts",
    "#cli": "./cli/mod.ts",
    "@std/fs": "jsr:@std/fs@^1.0.0",
    "@std/path": "jsr:@std/path@^1.0.0",
    "@std/fmt": "jsr:@std/fmt@^1.0.0",
    "@std/assert": "jsr:@std/assert@^1.0.0",
    "@std/testing": "jsr:@std/testing@^1.0.0",
  },
};

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
    shims: {
      deno: {
        test: false,
      },
    },
    typeCheck: false, // Skip type checking - Deno.Command shim typing issues
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
        "Manage copyright headers in your source files. Check, fix, and keep them consistent.",
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
      pkgJson.exports = {
        ".": {
          import: "./esm/mod.js",
          types: "./types/mod.d.ts",
        },
        "./cli": {
          import: "./esm/cli/mod.js",
          types: "./types/cli/mod.d.ts",
        },
      };

      // Add files field to ensure only needed files are published
      pkgJson.files = [
        "esm",
        "types",
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
