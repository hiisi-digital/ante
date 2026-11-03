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

# Only what was already staged, on both halves.
#
# `fix` with no arguments walks everything the config's include and exclude
# allow, so it rewrote files somebody had deliberately left out of the commit
# and the re-staging below then swept them in: one commit on this branch
# carries twenty-four files of header reformatting nobody asked for, under a
# subject about staging. Its positional arguments are the glob set, so naming
# the staged paths is the whole fix.
#
# And `-z`, because without it git quotes a name with a non-ASCII byte or a
# control character in it, `caf\303\251.ts` for `café.ts`, and every consumer
# of that line then works on a path that does not exist. The commit that
# registered this hook claimed the paths were passed null-separated; they were
# not, and this is that claim made true.
staged="$(mktemp)"
trap 'rm -f "$staged"' EXIT
git diff --cached -z --name-only --diff-filter=ACM > "$staged"

# Nothing staged is not an error, and it is also not a licence to run over the
# whole tree, which is what an empty argument list would mean to `fix`.
[ -s "$staged" ] || exit 0

xargs -0 deno run -R -W --allow-run --allow-env cli/mod.ts fix < "$staged"

# `--pathspec-from-file` with the nul flag takes the same list without a shell
# loop, so a name git had to quote is one git reads back itself.
git add --pathspec-from-file="$staged" --pathspec-file-nul
