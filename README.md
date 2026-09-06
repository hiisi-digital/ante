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

Three things to know about 0.3.0. A field that overruns its column keeps two
spaces after it rather than one, so the first `fix` after upgrading reformats
existing headers once and then holds still. `ParsedHeader` carries a new `extra`
field, which is a break for anything constructing one by hand. And a header block
written to somebody else's convention is now kept: whatever `ante` cannot model
in it comes through the rewrite verbatim, where earlier versions replaced the
whole block. If a tree has been through an older `fix`, its third-party notices
are worth a look before this one runs.

### One thing it does not keep

The licence a file declares is not preserved. `ante` writes the licence the
project configured, so a vendored file saying `SPDX-License-Identifier: ISC`
comes out saying whatever is in the manifest. Measured against 244 header blocks
taken from vendored source, 98 of them are in that class.

Nothing is deleted and it is stable across runs, and it is still the tool making
a false statement about somebody else's code, which is the one output here that
is expensive to find out about late. So keep vendored trees out of `include`, or
in `exclude`, until this settles. What `ante` should do instead is an open
question rather than an oversight: refuse the file, skip it, carry the
declaration through as a line it does not model, or keep stamping over it.

## Contents

| Piece                            | What it is for                                                                              |
| :------------------------------- | :------------------------------------------------------------------------------------------ |
| `ante check`                     | Verifies headers and exits non-zero when any is wrong. The thing a hook or a pipeline runs. |
| `ante check src`                 | The same over one directory. A run matching no file is an error, not a pass.                |
| `ante fix`                       | Rewrites every header to match the configuration.                                           |
| `ante add`                       | Puts a header on one named file.                                                            |
| `ante init`                      | Writes a configuration into whichever manifest the project already has.                     |
| `loadConfig` / `resolveConfig`   | Reads the configuration from whichever manifest holds it, and fills in what is derivable.   |
| `generateHeader`                 | Builds a header from a configuration, a contributor list and a year.                        |
| `parseHeader` / `hasValidHeader` | Reads a header back out of a file, and answers whether one is there and correct.            |
| `rewriteHeader`                  | Writes a header over whatever was at the top, keeping every line it does not model.         |

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

The `./cli` entry point is there as of 0.3.0, on both registries, so all six
lines above work. The name is pinned with `--name` because deno reads `cli` as a
generic file stem and would otherwise call the command after the directory it
came from.

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
    "@hiisi/ante": "jsr:@hiisi/ante@^0.3"
  }
}

// package.json
{
  "devDependencies": {
    "ante-cli": "^0.3"
  }
}
```

## Command line

```bash
ante init                  # Write the configuration
ante check                 # Verify headers (exits non-zero if issues found)
ante check src             # Check one directory
ante check "src/**/*.ts"   # Check specific files
ante fix                   # Fix all headers to match config
ante add src/new-file.ts   # Add header to a specific file
ante --help                # Show help
```

A directory or a glob narrows the configured include patterns rather than
replacing them, so a run never touches a file the configuration leaves out of
scope. `add` is the one that puts a header on a named file regardless.

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

## Running it on every commit

`ante check` exits non-zero when a header is wrong and `ante fix` writes them, so
either one is what a pre-commit hook or a pipeline step runs. ante does not
install a hook for you, and does not take `core.hooksPath`, because git gives one
hook per event and a tool that claims it silently replaces whatever was there.

```bash
#!/bin/sh
ante fix && git add -u
```

With no arguments `ante fix` takes the include and exclude patterns from the
config, so the hook and the command agree on which files are ante's business
without the hook restating it.

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
