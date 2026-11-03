# What is in here

`headers.json` is 244 header blocks taken off the top of files in vendored
third-party source: openssl and aws-lc notices, kernel-style SPDX tags,
generated-file warnings, patent grants, and addresses in four different shapes.
Each entry carries the crate and version it came from, its file extension and its
line count, so a case that fails can be traced back to a real file rather than to
a shape somebody imagined.

It is here because the sweeps in `roundtrip_test.ts` build their blocks from
shapes we chose, and a suite like that can only find the ways we already thought
a header might be written. This corpus finds the rest. Running the conservation
property against the tree before `rewriteHeader` landed, 225 of the 244 lose a
line.

Some entries are more than a header. A few carry the module documentation that
followed the notice, or a full licence text where the file had one inline, and
that is deliberate: what the tool meets at the top of a real file is not always a
tidy block, and a corpus that trimmed them to tidy blocks would be testing the
easy case again.

Nothing here ships. `publish.exclude` names `tests/`, the npm build copies files
by name rather than sweeping, and `publish_test.ts` asserts both.
