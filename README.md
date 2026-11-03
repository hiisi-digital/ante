# `ante`

[![JSR Version](https://img.shields.io/jsr/v/@hiisi/ante)](https://jsr.io/@hiisi/ante) [![npm Version](https://img.shields.io/npm/v/ante-cli)](https://www.npmjs.com/package/ante-cli)

> Copyright headers as a maintained artifact, checked, fixed and kept consistent across a whole tree.

`ante` maintains the copyright header at the top of a source file. Year ranges, contributor lists, the SPDX identifier and the column alignment are derived and not typed in, and they are derived again when the file changes. It runs as a command line tool and as a library that share the same code, on deno, node 18 or newer, and bun.

```typescript
//--------------------------------------------------------------------------------------------------
// Copyright (c) 2020-2025              orgrinrt                 orgrinrt@ikiuni.dev
//                                      contributor2             email@example.com
// SPDX-License-Identifier: MPL-2.0     https://mozilla.org/MPL/2.0        contact@hiisi.digital
//--------------------------------------------------------------------------------------------------
```

The format is configuration, so column positions, line width, the separator character and how contributors are picked come from `deno.json`, `package.json` or a standalone `ante.toml`, whichever the project already has. Years come off the file's own git history, contributors off who touched it and how much, and the identifier off the manifest that already declares the licence.

## Usage

```bash
# deno
deno install --global --allow-read --allow-write --allow-run=git \
  --name ante jsr:@hiisi/ante/cli

# node 18+, and bun, which installs from the same package
npm install -g ante-cli
bun install -g ante-cli
```

The flags are the permissions it needs, which is reading the tree, writing headers back and asking `git` who touched a file. Without installing, `npx ante-cli <command>`, `bunx ante-cli <command>` and `deno run --allow-read --allow-write --allow-run=git jsr:@hiisi/ante/cli <command>` all work.

| Command | What it does |
|---|---|
| `ante init` | write a configuration into whichever manifest the project already has |
| `ante check [path]` | verify, exiting non-zero when a header is wrong, and a run matching no file is an error |
| `ante fix [path]` | rewrite every header to match the configuration |
| `ante add <file>` | put a header on one named file, whatever the configuration says |

A path or glob given to `check` or `fix` narrows what the configuration includes and doesn't replace it, so naming a file the configuration leaves out is a run with nothing to do. That suits a pre-commit hook, where whatever is staged is passed along.

An `ante` section in `deno.json` or `package.json` holds the configuration.

```json
{
  "name": "@your/package",
  "version": "1.0.0",
  "license": "MPL-2.0",
  "ante": {
    "width": 100,
    "maintainerEmail": "contact@example.com",
    "maxContributors": 3,
    "contributorSelection": "commits",
    "exclude": ["**/generated/**", "**/vendor/**"]
  }
}
```

A rust crate, a bash library or a c project has no such manifest, so those get an `ante.toml`, where the whole file is the configuration with the same keys and defaults, and an `[ante]` table is accepted as well.

```toml
width = 100
maintainerEmail = "contact@example.com"
maxContributors = 3
contributorSelection = "commits"
include = ["src/**/*.rs"]
exclude = ["target/**"]
```

`ante.toml` is searched for ahead of the JSON manifests, and since it carries no `license` the SPDX identifier is read from the manifest beside it, `[package] license` in a `Cargo.toml` or the top-level `license` in a JSON one, unless `spdxLicense` is set. `contributorSelection` is `commits` by default, `lines` counts changed lines, `recent` takes the latest to touch the file and `manual` ignores git and reads `manualContributors`. The other keys are `separatorChar`, `commentPrefix`, the columns `nameColumn`, `emailColumn`, `licenseUrlColumn` and `maintainerColumn`, `licenseUrl`, and `include` and `exclude`.

## On every commit

ante installs no hook and leaves `core.hooksPath` alone, since git gives one hook per event and a tool that claims it silently replaces whatever was there. Either command is what a hook or a pipeline step runs.

```bash
#!/bin/sh
ante fix && git add -u
```

Where a project runs [`git-shook`][shook] the same two lines go in a `shook.toml`, and ante then sits at the event beside whatever else the repository declares.

```toml
name = "ante"

[hooks.pre-commit]
run = ["sh", "scripts/pre-commit.sh"]
```

## As a library

The pieces are the ones the command line is built from. This reads a file, decides whether it wants a header, and writes one carrying the contributors git knows about.

```typescript
import {
  generateHeader,
  getFileYearRange,
  hasValidHeader,
  loadConfig,
  selectContributors,
} from "@hiisi/ante"; // "ante-cli" on node

const file = "src/example.ts";

// whichever of ante.toml, deno.json or package.json is there
const config = await loadConfig();

const content = await Deno.readTextFile(file);
if (!hasValidHeader(content)) {
  // both read git, so both are async and both need a repository
  const contributors = await selectContributors(file, config);
  const years = await getFileYearRange(file);

  const header = generateHeader(
    config,
    contributors,
    years?.firstYear ?? new Date().getFullYear(),
    years?.lastYear,
  );
  await Deno.writeTextFile(file, `${header}\n${content}`);
}
```

`parseHeader` reads an existing header back into its parts, `updateHeader` edits them, which is the path `fix` takes, and `rewriteHeader` puts the result over whatever was at the top and keeps every line it doesn't model. A file outside a git repository gets no contributors and no year range, and the calls answer with that and don't fail.

## Status

Under active development, so the api hasn't settled and breaking changes should be expected. Development and the suite run on deno 2, and node and bun consume the npm build, which `deno task test:node` builds and smoke tests, so there is no live matrix across the three. There is an older [snapshot][compat] of a version-by-version run, which is history and not a current answer.

The licence a file declares is not preserved, `ante` writes the one the project configured, so a vendored file saying `SPDX-License-Identifier: ISC` comes out with whatever the manifest says. That is a false statement about somebody else's code, so keep vendored trees out of `include` or in `exclude` until this is settled, and what `ante` should do instead (refuse, skip, carry the declaration through or keep stamping) is an open question.

## License

> The project is licensed under the **Mozilla Public License 2.0**.

`SPDX-License-Identifier: MPL-2.0`

> You can check out the full license [here](https://github.com/hiisi-digital/ante/blob/main/LICENSE)

[compat]: https://github.com/hiisi-digital/ante/blob/main/COMPATIBILITY.md
[shook]: https://github.com/orgrinrt/git-shook
