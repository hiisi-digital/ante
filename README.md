# `ante`

<div align="center" style="text-align: center;">

[![GitHub Stars](https://img.shields.io/github/stars/hiisi-digital/ante.svg)](https://github.com/hiisi-digital/ante/stargazers)
[![JSR Version](https://img.shields.io/jsr/v/@hiisi/ante)](https://jsr.io/@hiisi/ante)
[![npm Version](https://img.shields.io/npm/v/ante-cli)](https://www.npmjs.com/package/ante-cli)
[![GitHub Issues](https://img.shields.io/github/issues/hiisi-digital/ante.svg)](https://github.com/hiisi-digital/ante/issues)
![License](https://img.shields.io/github/license/hiisi-digital/ante?color=%23009689)

> Copyright headers as a maintained artifact. Checked, fixed and kept consistent across a whole tree.

</div>

`ante` maintains the copyright header at the top of a source file. Year ranges,
contributor lists, the SPDX identifier and the column alignment are all derived
rather than typed in, and re-derived when the file changes. It runs as a command
line tool and as a library, and the two share the same code.

```typescript
//--------------------------------------------------------------------------------------------------
// Copyright (c) 2020-2025              orgrinrt                 orgrinrt@ikiuni.dev
//                                      contributor2             email@example.com
// SPDX-License-Identifier: MPL-2.0     https://mozilla.org/MPL/2.0        contact@hiisi.digital
//--------------------------------------------------------------------------------------------------
```

The format is configuration. Column positions, line width, separator character
and how contributors are chosen come from `deno.json`, `package.json` or a
standalone `ante.toml`, whichever the project already has.

## Usage

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

The four commands are what a project needs day to day. `check` verifies and exits
non-zero when a header is wrong, which is what a hook or a pipeline runs, and a
run matching no file is an error rather than a pass. `fix` rewrites every header
to match the configuration, `add` puts one on a single named file, and `init`
writes a configuration into whichever manifest the project already has.

```bash
ante init                  # a configuration, in the manifest that is there
ante check                 # verify, non-zero when something is off
ante check src             # one directory
ante check "src/**/*.ts"   # one glob
ante fix                   # rewrite every header to match the config
ante add src/new-file.ts   # header on one file
ante --help
```

A path or glob given to `check` or `fix` narrows what the configuration already
includes rather than replacing it, so naming a file the configuration leaves out
is a run with nothing to do rather than a run over that file. That is what a
pre-commit hook wants, since a commit stages whatever it stages and a manifest
or a readme among the sources is an ordinary commit. `add` is the one that acts
on a named file whatever the configuration says, which is what it is for.

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

An `ante` section in `deno.json` or `package.json` holds the configuration:

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

A rust crate, a bash library or a c project has no such manifest to put a
section in, so those get an `ante.toml` instead, where the whole file is the
configuration. Same keys, same schema, same defaults, and an `[ante]` table is
accepted too, so one file can move between the standalone and the embedded shape
unchanged.

```toml
width = 100
maintainerEmail = "contact@example.com"
maxContributors = 3
contributorSelection = "commits"
include = ["src/**/*.rs"]
exclude = ["target/**"]
```

`ante.toml` is searched for ahead of the JSON manifests, since a project only
writes one when it means to configure ante there. It carries no `license` of its
own, so the SPDX identifier is read from whichever manifest sits beside it,
`[package] license` in a `Cargo.toml` or the top-level `license` in a JSON
manifest, and setting `spdxLicense` in the toml overrides that.

### On every commit

`check` exits non-zero when a header is wrong and `fix` writes them, so either
one is what a pre-commit hook or a pipeline step runs. ante installs no hook and
does not touch `core.hooksPath`, because git gives one hook per event and a tool
that claims it silently replaces whatever was already there.

```bash
#!/bin/sh
ante fix && git add -u
```

With no arguments `fix` takes the include and exclude patterns from the
configuration, so the hook and the command agree on which files are ante's
business without the hook restating it.

Where a project runs [`git-shook`][shook], the same two lines are a `shook.toml`
entry instead, and then ante sits at the event beside whatever else the
repository declares rather than in place of it. ante carries its own, which is
what this repository runs on itself.

```toml
name = "ante"

[hooks.pre-commit]
run = ["sh", "scripts/pre-commit.sh"]
```

## Example

As a library the pieces are the ones the command line is built from, and they
compose the same way. Reading a file, deciding whether it wants a header, and
writing one that carries the contributors git knows about:

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
nothing. `rewriteHeader` puts the result over whatever was at the top and keeps
every line it does not model. A file outside a git repository gets no
contributors and no year range, and both calls answer with that rather than
failing.

## Motivation

A licence that asks for a notice on the file, and MPL-2.0 does, turns every
source file into something with a small piece of paperwork attached to it. The
year is only right until january, the contributor list is only right until
somebody else touches the file, and the alignment is only right until a name
longer than the last one arrives. So the notice is correct on the day it is
written and drifts from then on, quietly, in the one part of the file nobody
reads twice.

The usual answer is a template somebody pastes in, and it is the wrong shape,
because a template records what was true once where the thing wanted is a value
derived from the repository as it stands. `ante` derives it: the years come off
the file's own history, the contributors come off who touched it and how much,
the identifier comes off the manifest that already declares the licence. Nothing
in the header is typed by hand, so nothing in it can be stale in a way a rerun
does not fix.

What it costs is a pass over the tree, which a pre-commit hook narrows to the
staged files, and a decision about which files are in scope. That second one is
the part worth thinking about, since a header written over somebody else's
vendored source is a false statement rather than an untidy one.

## Extras

### Status

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

Since 0.3.0 the hook installer is gone with it, along with the commit-msg hook it
used to write, which was never a header tool's business. A clone that ran an
older `ante init` still has `.githooks` and a `core.hooksPath` pointing at it,
and neither goes away on its own.

### Runtimes

| Runtime | Installs from      | Minimum    | Differences                                  |
| :------ | :----------------- | :--------- | :------------------------------------------- |
| deno    | jsr, `@hiisi/ante` | 2          | none; this is where the suite runs           |
| node    | npm, `ante-cli`    | 18         | the npm build, so the same api through `dnt` |
| bun     | npm, `ante-cli`    | none known | the npm build, as node                       |

Development happens on deno 2 and that is what the test suite runs under. Node
and bun both consume the npm build, and `deno task test:node` builds it and then
runs a smoke test, a git test and a types check against it, so those three are
covered on whatever node version the machine happens to have. None of it runs on
a schedule, so there is no live matrix. There is a [snapshot][compat] from
december 2025 that went version by version across all three runtimes, kept for
the detail rather than as a current answer, and it reports a lot of red on the
node and bun rows against a build two minor versions old, so do read it as
history.

### Configuration

Most keys have a default worth keeping, and `spdxLicense` and `licenseUrl` are
both derived from the manifest's own `license` field, so neither usually needs
setting.

| Option                 | Default                       | What it decides                              |
| :--------------------- | :---------------------------- | :------------------------------------------- |
| `width`                | `100`                         | total line width, comment prefix included    |
| `separatorChar`        | `"-"`                         | character the separator lines are drawn with |
| `commentPrefix`        | `"//"`                        | comment prefix on every header line          |
| `nameColumn`           | `40`                          | column a contributor name starts at          |
| `emailColumn`          | `65`                          | column a contributor email starts at         |
| `licenseUrlColumn`     | `40`                          | column the licence url starts at             |
| `maintainerColumn`     | `75`                          | column the maintainer address starts at      |
| `spdxLicense`          | from `license`                | SPDX identifier written into the header      |
| `licenseUrl`           | derived                       | url the identifier links to                  |
| `maintainerEmail`      | from git                      | maintainer address on the SPDX line          |
| `maxContributors`      | `3`                           | how many contributors a header carries       |
| `contributorSelection` | `"commits"`                   | how those contributors are picked            |
| `manualContributors`   | `[]`                          | the list `manual` selection reads            |
| `include`              | `["**/*.ts", ...]`            | files a run walks                            |
| `exclude`              | `["**/node_modules/**", ...]` | files it skips                               |

`contributorSelection` takes one of four. `commits` picks whoever has the most
commits touching the file and is the default, `lines` counts changed lines
instead, `recent` takes the latest to touch it, and `manual` ignores git and
reads `manualContributors`.

### Years

A file created and last modified in the same year gets a single year, `2025`. One
modified across years gets a range, `2020-2025`, and the end of that range moves
on its own the first time the file is touched in a new year.

### Limitations

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

## Support

Feel free to contribute! If unsure about wasting work, the best practice is to throw in an issue describing what you'd do, and only then commit to writing a big PR, because chances are, it might not be something that belongs here. However, forks are always a valid choice and we'd encourage everyone to experiment and have their own takes on this. When doing this, do mind the license(s) though!

Whether you use this project, have learned something from it, or just like it, please consider supporting it by buying me a coffee, so I can dedicate more time on open-source projects like this :)

<a href="https://buymeacoffee.com/orgrinrt" target="_blank"><img src="https://www.buymeacoffee.com/assets/img/custom_images/orange_img.png" alt="Buy Me A Coffee" style="height: auto !important;width: auto !important;" ></a>

## License

> The project is licensed under the **Mozilla Public License 2.0**.

`SPDX-License-Identifier: MPL-2.0`

> You can check out the full license [here](https://github.com/hiisi-digital/ante/blob/main/LICENSE)

[compat]: https://github.com/hiisi-digital/ante/blob/main/COMPATIBILITY.md
[shook]: https://github.com/orgrinrt/git-shook
