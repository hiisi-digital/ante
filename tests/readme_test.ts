//----------------------------------------------------------------------------------------------------
// Copyright (c) 2025-2026                    Hiisi Digital                    ort@hiisi.digital
// SPDX-License-Identifier: MPL-2.0      https://mozilla.org/MPL/2.0      contact@hiisi.digital
//----------------------------------------------------------------------------------------------------

/**
 * Whether the readme's examples are true.
 *
 * A readme is the first thing anyone reads and nothing else in a suite touches
 * it, so an example goes stale the first time a signature moves and stays that
 * way until somebody tries it. Type checking each block against the real module
 * catches a renamed export, a changed argument order and an argument that no
 * longer exists, which is most of the ways one rots.
 *
 * Blocks marked `typescript` are checked. A `bash`, `json` or `jsonc` block is
 * not code this can compile and is skipped.
 *
 * @module
 */

import { assert, assertEquals } from "@std/assert";
import { fromFileUrl, join } from "@std/path";

const ROOT = fromFileUrl(new URL("../", import.meta.url));

/** Every fenced block in the readme carrying the given language tag. */
function blocks(markdown: string, language: string): string[] {
  const found: string[] = [];
  const fence = new RegExp("^```" + language + "\\s*$");
  let collecting: string[] | undefined;
  for (const line of markdown.split("\n")) {
    if (collecting === undefined) {
      if (fence.test(line.trim())) collecting = [];
      continue;
    }
    if (line.trim() === "```") {
      found.push(collecting.join("\n"));
      collecting = undefined;
      continue;
    }
    collecting.push(line);
  }
  return found;
}

/** Type checks one block as a module, importing the package the way the readme
 * says to. The import specifier in the block points at the published name, which
 * does not resolve from inside the repository, so it is rewritten to the local
 * entry point. That substitution is the one liberty taken here. */
async function checks(source: string): Promise<{ ok: boolean; why: string }> {
  const dir = await Deno.makeTempDir({ prefix: "ante-readme-" });
  try {
    const entry = join(ROOT, "mod.ts");
    const rewritten = source.replace(
      /from "(jsr:@hiisi\/ante|@hiisi\/ante|ante-cli)"/g,
      `from "${entry}"`,
    );
    const file = join(dir, "block.ts");
    await Deno.writeTextFile(file, rewritten);
    const { code, stderr } = await new Deno.Command(Deno.execPath(), {
      args: ["check", "--quiet", file],
      stdout: "null",
      stderr: "piped",
    }).output();
    return { ok: code === 0, why: new TextDecoder().decode(stderr) };
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
}

Deno.test("every typescript example in the readme type checks", async () => {
  const markdown = await Deno.readTextFile(join(ROOT, "README.md"));
  const examples = blocks(markdown, "typescript");

  // Without this the test passes on a readme whose fences were all renamed, or
  // on a regex that stopped matching, and reports that everything checks out.
  assert(
    examples.length >= 2,
    `expected the readme to carry typescript examples, found ${examples.length}`,
  );

  const results = await Promise.all(examples.map((example) => checks(example)));
  for (const [at, result] of results.entries()) {
    assert(result.ok, `readme typescript block ${at + 1} does not check:\n${result.why}`);
  }
});

Deno.test("the checker rejects an example that is wrong", async () => {
  // The control. Without it the test above passes against a checker that always
  // says yes, which is exactly what it would do if the rewrite silently produced
  // an empty file or the command's exit code stopped being read.
  const broken = await checks(
    'import { generateHeader } from "@hiisi/ante";\n' +
      "generateHeader();\n",
  );
  assertEquals(broken.ok, false);

  const sound = await checks(
    'import { hasValidHeader } from "@hiisi/ante";\n' +
      'const _: boolean = hasValidHeader("");\n',
  );
  assertEquals(sound.ok, true, sound.why);
});

Deno.test("the readme's fenced blocks are found, and the tags are the real ones", async () => {
  // A block whose language tag is misspelled is a block nobody checks and nobody
  // highlights, and it is invisible in a rendered readme.
  const markdown = await Deno.readTextFile(join(ROOT, "README.md"));
  const tags = new Set(
    [...markdown.matchAll(/^```([a-zA-Z]+)\s*$/gm)].map((m) => m[1]),
  );
  const known = new Set(["typescript", "bash", "json", "jsonc", "toml"]);
  for (const tag of tags) {
    assert(known.has(tag), `unknown fence language in the readme: ${tag}`);
  }
  assert(tags.has("typescript"));
  assert(tags.has("bash"));
});
