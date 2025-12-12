# `ante`

<div align="center" style="text-align: center;">

[![GitHub Stars](https://img.shields.io/github/stars/hiisi-digital/ante.svg)](https://github.com/hiisi-digital/ante/stargazers)
[![JSR Version](https://img.shields.io/jsr/v/@loru/ante)](https://jsr.io/@loru/ante)
[![npm Version](https://img.shields.io/npm/v/ante-cli)](https://www.npmjs.com/package/ante-cli)
[![GitHub Issues](https://img.shields.io/github/issues/hiisi-digital/ante.svg)](https://github.com/hiisi-digital/ante/issues)
![License](https://img.shields.io/github/license/hiisi-digital/ante?color=%23009689)

> Manage copyright headers in your source files. Check, fix, and keep them consistent.

</div>

## What it does

`ante` adds and maintains copyright headers at the top of your source files. It
handles year ranges, contributor lists, license identifiers, and column-aligned
formatting. Works as a CLI tool or a library.

```typescript
//----------------------------------------------------------------------------------------------------
// Copyright (c) 2020-2025               orgrinrt                    orgrinrt@ikiuni.dev
//                                       contributor2                email@example.com
// SPDX-License-Identifier: MPL-2.0      https://mozilla.org/MPL/2.0 contact@hiisi.digital
//----------------------------------------------------------------------------------------------------
```

The header format is configurable. Column positions, line width, separator
characters, and contributor selection strategy are all controlled through your
`deno.json` (or `package.json`).

## Installation

### CLI (recommended)

```bash
# npm (Node.js 18+)
npm install -g ante-cli

# Then use:
ante init
ante check
ante fix
```

### Deno

```typescript
import { generateHeader, loadConfig } from "jsr:@loru/ante";
```

Or in `deno.json`:

```json
{
  "imports": {
    "@loru/ante": "jsr:@loru/ante@^0.1.0"
  }
}
```

Run directly without installing:

```bash
deno run -A jsr:@loru/ante/cli init
```

## CLI Usage

```bash
# Set up config and install git hooks
ante init

# Check if files have valid headers (exits non-zero if issues found)
ante check

# Fix all headers to match config
ante fix

# Add header to a specific file
ante add src/new-file.ts

# Show help
ante --help
```

Or add tasks to your `deno.json` / `package.json`:

```json
{
  "scripts": {
    "copyright:check": "ante check",
    "copyright:fix": "ante fix"
  }
}
```

## Configuration

Add an `ante` section to your `deno.json`:

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

Most values have sensible defaults. The `license` field from your `deno.json` is
used to derive `spdxLicense` and `licenseUrl` automatically.

### Configuration Options

| Option                 | Default                  | Description                           |
| :--------------------- | :----------------------- | :------------------------------------ |
| `width`                | `100`                    | Total line width for headers          |
| `separatorChar`        | `"-"`                    | Character used for separator lines    |
| `commentPrefix`        | `"//"`                   | Comment prefix (language-aware later) |
| `nameColumn`           | `40`                     | Column position where name starts     |
| `emailColumn`          | `65`                     | Column position where email starts    |
| `licenseUrlColumn`     | `40`                     | Column for license URL in SPDX line   |
| `maintainerColumn`     | `75`                     | Column for maintainer in SPDX line    |
| `spdxLicense`          | from `license`           | SPDX license identifier               |
| `licenseUrl`           | derived                  | URL for the license                   |
| `maintainerEmail`      | from git                 | Maintainer contact email              |
| `maxContributors`      | `3`                      | Max contributors shown in header      |
| `contributorSelection` | `"commits"`              | How to pick contributors              |
| `manualContributors`   | `[]`                     | Explicit contributor list             |
| `include`              | `["**/*.ts", ...]`       | Files to process                      |
| `exclude`              | `["**/node_modules/**"]` | Files to skip                         |

### Contributor Selection Strategies

| Strategy  | Description                                      |
| :-------- | :----------------------------------------------- |
| `commits` | Contributors with most commits touching the file |
| `lines`   | Contributors with most lines changed             |
| `recent`  | Most recent contributors                         |
| `manual`  | Use `manualContributors` list                    |

## Library API

```typescript
import { generateHeader, hasValidHeader, loadConfig, parseHeader, resolveConfig } from "@loru/ante";

// Load config from deno.json
const config = await loadConfig();

// Check if a file has a header
const content = await Deno.readTextFile("src/example.ts");
if (!hasValidHeader(content)) {
  // Generate and prepend a header
  const header = generateHeader(config, contributors, 2025);
  await Deno.writeTextFile("src/example.ts", header + "\n" + content);
}
```

## Git Hooks

The `init` command installs a pre-commit hook that:

1. Checks staged `.ts` files for copyright headers
2. Creates headers for files that don't have one
3. Adds the current git user as a contributor if not already present
4. Updates year ranges when files are modified in a new year
5. Stages the changes automatically

```bash
deno run -A jsr:@loru/ante/cli init
```

This writes hook scripts to `.githooks/` and runs `git config core.hooksPath .githooks`.

## Year Handling

- Single year when file is created and last modified in the same year: `2025`
- Range when modified across years: `2020-2025`
- The end year updates automatically when you modify a file in a new year

## Support

Whether you use this project, have learned something from it, or just like it,
please consider supporting it by buying me a coffee, so I can dedicate more time
on open-source projects like this :)

<a href="https://buymeacoffee.com/orgrinrt" target="_blank"><img src="https://www.buymeacoffee.com/assets/img/custom_images/orange_img.png" alt="Buy Me A Coffee" style="height: auto !important;width: auto !important;" ></a>

## License

> You can check out the full license [here](https://github.com/hiisi-digital/ante/blob/main/LICENSE)

This project is licensed under the terms of the **Mozilla Public License 2.0**.

`SPDX-License-Identifier: MPL-2.0`
