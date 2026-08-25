# `ante`

<div align="center" style="text-align: center;">

[![GitHub Stars](https://img.shields.io/github/stars/hiisi-digital/ante.svg)](https://github.com/hiisi-digital/ante/stargazers)
[![JSR Version](https://img.shields.io/jsr/v/@hiisi/ante)](https://jsr.io/@hiisi/ante)
[![npm Version](https://img.shields.io/npm/v/ante-cli)](https://www.npmjs.com/package/ante-cli)
[![GitHub Issues](https://img.shields.io/github/issues/hiisi-digital/ante.svg)](https://github.com/hiisi-digital/ante/issues)
![License](https://img.shields.io/github/license/hiisi-digital/ante?color=%23009689)

> Copyright headers as a maintained artifact. Checked, fixed and kept consistent across a whole tree.

</div>

## What it is

`ante` maintains the copyright header at the top of a source file. Year ranges,
contributor lists, the SPDX identifier and the column alignment are all derived
rather than typed in, and re-derived when the file changes. It runs as a command
line tool and as a library, and the two share the same code.

```typescript
//----------------------------------------------------------------------------------------------------
// Copyright (c) 2020-2025               orgrinrt                    orgrinrt@ikiuni.dev
//                                       contributor2                email@example.com
// SPDX-License-Identifier: MPL-2.0      https://mozilla.org/MPL/2.0 contact@hiisi.digital
//----------------------------------------------------------------------------------------------------
```

The format is configuration. Column positions, line width, separator character
and how contributors are chosen come from `deno.json`, `package.json` or a
standalone `ante.toml`, whichever the project already has.

## Status

Under active development, so the api hasn't settled and breaking changes should
be expected. We'll do our best to document migrations where they're needed.

Two things to know about 0.2.3. A field that overruns its column keeps two
spaces after it rather than one, so the first `fix` after upgrading reformats
existing headers once and then holds still. And `ParsedHeader` carries a new
`extra` field, which is a break for anything constructing one by hand.

## Contents

| Piece                            | What it is for                                                                              |
| :------------------------------- | :------------------------------------------------------------------------------------------ |
| `ante check`                     | Verifies headers and exits non-zero when any is wrong. The thing a hook or a pipeline runs. |
| `ante fix`                       | Rewrites every header to match the configuration.                                           |
| `ante add`                       | Puts a header on one named file.                                                            |
| `ante init`                      | Writes a configuration and installs the git hooks.                                          |
| `loadConfig` / `resolveConfig`   | Reads the configuration from whichever manifest holds it, and fills in what is derivable.   |
| `generateHeader`                 | Builds a header from a configuration, a contributor list and a year.                        |
| `parseHeader` / `hasValidHeader` | Reads a header back out of a file, and answers whether one is there and correct.            |

## Installation

The command is `ante` on every runtime. The flags are the permissions it needs
and nothing more: it reads the tree, writes headers back, and asks `git` who
touched a file.

```bash
# deno
deno install --global --allow-read --allow-write --allow-run=git \
  --name ante jsr:@hiisi/ante/cli

# node 18+, and bun, which installs from the same package
npm install -g ante-cli
bun install -g ante-cli
```

Or without installing anything:

```bash
deno run --allow-read --allow-write --allow-run=git jsr:@hiisi/ante/cli <command>
npx ante-cli <command>
bunx ante-cli <command>
```

The `./cli` entry point arrives with 0.2.3. Until that is out, the deno lines
above resolve against 0.2.2, which exports the library and not the command, and
they fail. npm is further behind at 0.1.7, so a node or bun install today gets an
older build than this page describes. Both catch up at the next release. The name
is pinned with `--name` because deno takes `cli` for a generic file stem and
would otherwise fall back to the directory it came from.

As a library, `jsr:@hiisi/ante` on deno and `ante-cli` on node, both exporting
the same names:

```typescript
import { generateHeader, loadConfig } from "jsr:@hiisi/ante";
```

Or as a dependency:

```jsonc
// deno.json
{
  "imports": {
    "@hiisi/ante": "jsr:@hiisi/ante@^0.2"
  }
}

// package.json
{
  "devDependencies": {
    "ante-cli": "^0.1"
  }
}
```

## Command line

```bash
ante init                  # Set up config and install git hooks
ante check                 # Verify headers (exits non-zero if issues found)
ante check "src/**/*.ts"   # Check specific files
ante fix                   # Fix all headers to match config
ante add src/new-file.ts   # Add header to a specific file
ante --help                # Show help
```

As project scripts:

```jsonc
// deno.json
{
  "tasks": {
    "copyright:check": "deno run -R -W --allow-run=git jsr:@hiisi/ante/cli check",
    "copyright:fix": "deno run -R -W --allow-run=git jsr:@hiisi/ante/cli fix"
  }
}

// package.json
{
  "scripts": {
    "copyright:check": "ante check",
    "copyright:fix": "ante fix"
  }
}
```

## Configuration

An `ante` section in `deno.json` or `package.json` holds it:

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

### ante.toml, for projects with no JSON manifest

A rust crate, a bash library or a c project has no `deno.json` or
`package.json` to put an `ante` section in. Those get an `ante.toml` instead,
where the whole file is the configuration:

```toml
width = 100
maintainerEmail = "contact@example.com"
maxContributors = 3
contributorSelection = "commits"
include = ["src/**/*.rs"]
exclude = ["target/**"]
```

Same keys, same schema, same defaults. An `[ante]` table is also accepted, so
one file can move between the standalone and embedded shapes unchanged.

`ante.toml` is searched for ahead of the JSON manifests, because a project only
writes one when it means to configure ante there. It carries no `license` of its
own, so the SPDX identifier is read from whichever manifest sits beside it:
`[package] license` in a `Cargo.toml`, or the top-level `license` in a JSON
manifest. Setting `spdxLicense` in the toml overrides that.

Most keys have a default worth keeping. `spdxLicense` and `licenseUrl` are both
derived from the manifest's own `license` field, so neither usually needs
setting.

### Configuration keys

| Option                 | Default                       | Description                         |
| :--------------------- | :---------------------------- | :---------------------------------- |
| `width`                | `100`                         | Total line width for headers        |
| `separatorChar`        | `"-"`                         | Character used for separator lines  |
| `commentPrefix`        | `"//"`                        | Comment prefix for header lines     |
| `nameColumn`           | `40`                          | Column position where name starts   |
| `emailColumn`          | `65`                          | Column position where email starts  |
| `licenseUrlColumn`     | `40`                          | Column for license URL in SPDX line |
| `maintainerColumn`     | `75`                          | Column for maintainer in SPDX line  |
| `spdxLicense`          | from `license`                | SPDX license identifier             |
| `licenseUrl`           | derived                       | URL for the license                 |
| `maintainerEmail`      | from git                      | Maintainer contact email            |
| `maxContributors`      | `3`                           | Max contributors shown in header    |
| `contributorSelection` | `"commits"`                   | How to pick contributors            |
| `manualContributors`   | `[]`                          | Explicit contributor list           |
| `include`              | `["**/*.ts", ...]`            | Files to process                    |
| `exclude`              | `["**/node_modules/**", ...]` | Files to skip                       |

### Contributor selection

| Strategy  | Description                                      |
| :-------- | :----------------------------------------------- |
| `commits` | Contributors with most commits touching the file |
| `lines`   | Contributors with most lines changed             |
| `recent`  | Most recent contributors                         |
| `manual`  | Use `manualContributors` list                    |

## Library

The same pieces the command line is built from, exported.

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

`parseHeader` reads an existing header back into its parts and `updateHeader`
edits those parts, which is the path `fix` takes rather than regenerating from
nothing. A file outside a git repository gets no contributors and no year range,
and both calls answer with that rather than failing.

## Git hooks

The `init` command installs a pre-commit hook that:

1. Checks staged `.ts` files for copyright headers
2. Creates headers for files that don't have one
3. Adds the current git user as a contributor if not already present
4. Updates year ranges when files are modified in a new year
5. Stages the changes automatically

```bash
ante init
```

This writes hook scripts to `.githooks/` and configures git to use them. `init`
also installs a commit-msg hook that rejects commit messages not in Conventional
Commits format (`type: subject`).

## Years

A file created and last modified in the same year gets a single year, `2025`. One
modified across years gets a range, `2020-2025`, and the end of that range moves
on its own the first time the file is touched in a new year.

## Support

Whether you use this project, have learned something from it, or just like it,
please consider supporting it by buying me a coffee, so I can dedicate more time
on open-source projects like this :)

<a href="https://buymeacoffee.com/orgrinrt" target="_blank"><img src="https://www.buymeacoffee.com/assets/img/custom_images/orange_img.png" alt="Buy Me A Coffee" style="height: auto !important;width: auto !important;" ></a>

## License

> The project is licensed under the **Mozilla Public License 2.0**.

`SPDX-License-Identifier: MPL-2.0`

> You can check out the full license [here](https://github.com/hiisi-digital/ante/blob/main/LICENSE)

## Runtime compatibility

Development happens on deno 2 and that's what the test suite runs under. Node
and bun both consume the npm build, and `deno task test:node` builds it and then
runs a smoke test, a git test and a types check against it, so those three are
covered on whatever node version the machine happens to have.

None of it runs on a schedule, so there's no live matrix. There is a
[snapshot][compat] from december 2025 that went version by version across all
three runtimes, kept for the detail rather than as a current answer. It reports
a lot of red on the node and bun rows, against a build two minor versions old,
so read it as history.

[compat]: https://github.com/hiisi-digital/ante/blob/main/COMPATIBILITY.md
