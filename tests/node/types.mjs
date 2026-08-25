//----------------------------------------------------------------------------------------------------
// Copyright (c) 2025                    orgrinrt                    orgrinrt@ikiuni.dev
//                                      orgrinrt                 ort@hiisi.digital
// SPDX-License-Identifier: MPL-2.0      https://mozilla.org/MPL/2.0 contact@hiisi.digital
//----------------------------------------------------------------------------------------------------

/**
 * The published types, resolved the way a consumer resolves them.
 *
 * The package is packed, installed into an empty project and imported by name,
 * so the `exports` map and its `types` conditions are what answer. Importing
 * `../../npm/esm/mod.js` by path answers from the file system instead and says
 * nothing about either, which is how every `types` condition came to point at a
 * directory dnt does not emit while the suite stayed green.
 *
 * `tsc --noEmit` is what checks them. Running the file under `tsx` executes it
 * and checks nothing.
 *
 * Two consumers are written: one correct, one with a deliberate type error. The
 * second is the control. Without it a run where nothing resolves at all reports
 * the same success as a run where everything does.
 *
 * Run with: node tests/node/types.mjs
 */

import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const HERE = fileURLToPath(new URL("../../", import.meta.url));
const NPM = join(HERE, "npm");

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  [OK] ${message}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${message}`);
    failed++;
  }
}

/** Run a command, and give back what it said and how it ended. */
function ran(cmd, args, cwd) {
  try {
    const out = execFileSync(cmd, args, { cwd, encoding: "utf8", stdio: "pipe" });
    return { code: 0, out };
  } catch (why) {
    return { code: why.status ?? 1, out: `${why.stdout ?? ""}${why.stderr ?? ""}` };
  }
}

console.log("Verifying the published types...");

const packed = ran("npm", ["pack", "--silent"], NPM);
if (packed.code !== 0) {
  console.error(`npm pack failed:\n${packed.out}`);
  process.exit(1);
}
const tarball = join(NPM, packed.out.trim().split("\n").pop());

const dir = mkdtempSync(join(tmpdir(), "ante_types_"));
writeFileSync(
  join(dir, "package.json"),
  JSON.stringify({ name: "consumer", private: true, type: "module" }),
);
writeFileSync(
  join(dir, "tsconfig.json"),
  JSON.stringify({
    compilerOptions: {
      module: "nodenext",
      moduleResolution: "nodenext",
      target: "es2022",
      strict: true,
      noEmit: true,
      skipLibCheck: true,
    },
    include: ["*.ts"],
  }),
);

// typescript is installed rather than reached through `npx`, which resolves
// `tsc` to an unrelated deprecated package that exits non-zero on everything and
// makes the control below pass for the wrong reason.
const installed = ran("npm", ["install", "--silent", tarball, "typescript"], dir);
assert(installed.code === 0, `the package installs (${installed.out.trim().slice(0, 120)})`);

const tsc = join(dir, "node_modules", ".bin", "tsc");

// Imported by name, so the `exports` map decides what is found.
writeFileSync(
  join(dir, "good.ts"),
  `import { generateHeader, hasValidHeader, loadConfig, stackedHeaders } from "ante-cli";\n` +
    `const ok: boolean = hasValidHeader("const x = 1;\\n");\n` +
    `const stacked: number = stackedHeaders("const x = 1;\\n");\n` +
    `const config = await loadConfig();\n` +
    `const header: string = generateHeader(config, [], 2026, 2026);\n` +
    `console.log(ok, stacked, header.length, config.width);\n`,
);

const good = ran(tsc, ["--noEmit"], dir);
assert(good.code === 0, `a correct consumer typechecks against the package name`);
if (good.code !== 0) console.error(good.out);

// The control. A wrong type has to be refused, or the run above proved only that
// nothing was checked.
writeFileSync(
  join(dir, "good.ts"),
  `import { hasValidHeader } from "ante-cli";\n` +
    `const wrong: number = hasValidHeader("const x = 1;\\n");\n` +
    `console.log(wrong);\n`,
);

const bad = ran(tsc, ["--noEmit"], dir);
assert(bad.code !== 0, "a wrong type is refused, so the check above was doing something");
assert(
  bad.out.includes("boolean") && bad.out.includes("number"),
  `and the refusal names both types (said: ${bad.out.trim().split("\n")[0] ?? ""})`,
);

// The declarations the `types` conditions name have to be there. A condition
// pointing at a path that does not exist resolves anyway, through typescript's
// fallback to a sibling `.d.ts`, and reports nothing.
const manifest = JSON.parse(
  ran("node", ["-p", "JSON.stringify(require('./node_modules/ante-cli/package.json'))"], dir).out,
);
for (const [name, entry] of Object.entries(manifest.exports ?? {})) {
  const declared = entry.types;
  const there = ran(
    "node",
    ["-e", `require('fs').statSync('node_modules/ante-cli/${declared}')`],
    dir,
  );
  assert(there.code === 0, `the ${name} export's types path exists: ${declared}`);
}
assert(
  typeof manifest.types === "string",
  "a top-level types field is there, which is all a node10 consumer reads",
);
assert(
  !(manifest.files ?? []).includes("types"),
  "and `files` names no directory the build does not emit",
);

console.log("");
console.log(`Results: ${passed} passed, ${failed} failed`);

const leftover = readdirSync(NPM).filter((f) => f.endsWith(".tgz"));
for (const f of leftover) ran("node", ["-e", `require('fs').unlinkSync('${join(NPM, f)}')`], NPM);

if (failed > 0) process.exit(1);
console.log("All type checks passed!");
