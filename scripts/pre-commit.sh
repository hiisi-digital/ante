#!/bin/sh
#----------------------------------------------------------------------------------------------------
# Copyright (c) 2025-2026              orgrinrt                 orgrinrt@ikiuni.dev
#                                      orgrinrt                 ort@hiisi.digital
# SPDX-License-Identifier: MPL-2.0     https://mozilla.org/MPL/2.0        ort@hiisi.digital
#----------------------------------------------------------------------------------------------------
#
# What ante runs on its own commits, named by `shook.toml`.
#
# Two commands rather than one, which is why this is a script rather than an
# argument list in the manifest: `run` takes an argv and never a shell, so a
# manifest cannot express "fix, and then stage what the fix changed". A file can,
# and it has the advantage of showing up in a diff where somebody can object to
# it.
#
# Run from source rather than through a binary called `ante`, because the `ante`
# on a path is as likely to be the Ante language compiler, which takes the same
# arguments and does nothing with them.

set -eu

deno run -R -W --allow-run --allow-env cli/mod.ts fix

# Only what was already staged. `git add -u` over the whole tree would sweep in
# unrelated edits somebody deliberately left out of the commit.
git diff --cached --name-only --diff-filter=ACM | while IFS= read -r f; do
	[ -f "$f" ] && git add -- "$f"
done
