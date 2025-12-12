#!/usr/bin/env bash
#----------------------------------------------------------------------------------------------------
# Copyright (c) 2025                    orgrinrt                    orgrinrt@ikiuni.dev
# SPDX-License-Identifier: MPL-2.0      https://mozilla.org/MPL/2.0 contact@hiisi.digital
#----------------------------------------------------------------------------------------------------

# generate-compat-report.sh
#
# Generates COMPATIBILITY.md from test result JSON files.
# Called by the compat-check.yml workflow.
#
# Usage: ./scripts/generate-compat-report.sh <results-dir> <run-number> <run-url>

set -euo pipefail

RESULTS_DIR="${1:-all-results}"
RUN_NUMBER="${2:-0}"
RUN_URL="${3:-#}"

# Helper function to get emoji for test outcome
get_emoji() {
  case "$1" in
    success) echo "✅" ;;
    failure) echo "❌" ;;
    skipped) echo "➖" ;;
    *) echo "❓" ;;
  esac
}

# Start generating the file
cat > COMPATIBILITY.md << 'EOF'
# Runtime Compatibility Matrix

This document shows the compatibility status of `@hiisi/ante` across different JavaScript runtimes and versions.

> **Legend:** ✅ = Passing | ❌ = Failing | ➖ = Skipped | ❓ = Unknown

## Summary

EOF

# Count overall stats
total_pass=0
total_fail=0
total_tests=0

# Process each runtime type
for runtime in deno node bun; do
  case $runtime in
    deno) printf "## Deno\n\n" >> COMPATIBILITY.md ;;
    node) printf "## Node.js\n\n" >> COMPATIBILITY.md ;;
    bun) printf "## Bun\n\n" >> COMPATIBILITY.md ;;
  esac

  echo "| Version | Actual | Smoke | Types | Test Suite |" >> COMPATIBILITY.md
  echo "|---------|--------|:-----:|:-----:|:----------:|" >> COMPATIBILITY.md

  # Find all result files for this runtime
  found_results=false
  for result_file in "${RESULTS_DIR}"/result-${runtime}-*/results/${runtime}-*.json \
                     "${RESULTS_DIR}"/result-${runtime}-*/${runtime}-*.json \
                     "${RESULTS_DIR}"/${runtime}-*.json; do
    if [ -f "$result_file" ]; then
      found_results=true
      version=$(jq -r '.version' "$result_file")
      actual=$(jq -r '.actualVersion // "-"' "$result_file")
      smoke=$(jq -r '.smoke // "unknown"' "$result_file")
      types=$(jq -r '.types // "unknown"' "$result_file")
      tests=$(jq -r '.tests // "unknown"' "$result_file")

      smoke_emoji=$(get_emoji "$smoke")
      types_emoji=$(get_emoji "$types")
      tests_emoji=$(get_emoji "$tests")

      echo "| $version | $actual | $smoke_emoji | $types_emoji | $tests_emoji |" >> COMPATIBILITY.md

      # Update stats
      total_tests=$((total_tests + 1))
      if [ "$smoke" = "success" ] && [ "$types" = "success" ]; then
        if [ "$tests" = "success" ] || [ "$tests" = "unknown" ]; then
          total_pass=$((total_pass + 1))
        else
          total_fail=$((total_fail + 1))
        fi
      else
        total_fail=$((total_fail + 1))
      fi
    fi
  done

  if [ "$found_results" = false ]; then
    echo "| - | - | ❓ | ❓ | ❓ |" >> COMPATIBILITY.md
  fi

  echo "" >> COMPATIBILITY.md
done

# Update summary at the top
summary_file=$(mktemp)
cat > "$summary_file" << EOF
# Runtime Compatibility Matrix

This document shows the compatibility status of \`@hiisi/ante\` across different JavaScript runtimes and versions.

> **Legend:** ✅ = Passing | ❌ = Failing | ➖ = Skipped | ❓ = Unknown

## Summary

**Overall:** ${total_pass}/${total_tests} runtime versions passing

| Category | Description |
|----------|-------------|
| **Smoke** | Basic import and function call verification |
| **Types** | TypeScript type definitions work correctly |
| **Test Suite** | Full unit test suite passes |

EOF

# Replace the header section with updated summary
tail -n +12 COMPATIBILITY.md > "${summary_file}.tail"
cat "$summary_file" "${summary_file}.tail" > COMPATIBILITY.md
rm -f "$summary_file" "${summary_file}.tail"

# Add footer
cat >> COMPATIBILITY.md << 'EOF'
---

## Test Details

### Test Categories

- **Smoke Test**: Verifies that the package can be imported and core functions (`hasValidHeader`, `generateHeader`, `loadConfig`) work correctly.
- **Types Check**: Verifies that TypeScript type definitions are correct and can be consumed by TypeScript projects.
- **Test Suite**: Runs the full unit test suite including:
  - Configuration parsing and resolution
  - Header parsing, generation, and validation
  - Contributor handling
  - Glob pattern matching
  - Column-aligned formatting

### Runtime Notes

- **Deno**: Tests run directly against TypeScript source code
- **Node.js**: Tests run against the transpiled npm package using Node's built-in test runner
- **Bun**: Tests run against the transpiled npm package using Bun's runtime

### Known Limitations

- E2E tests that require `Deno.Command` are excluded from Node.js/Bun testing
- Integration tests that use temporary directories may behave differently across runtimes
- Some older runtime versions may have limited ES2022 support

---

EOF

# Add timestamp and workflow link
echo "_Last updated: $(date -u '+%Y-%m-%d %H:%M:%S UTC')_" >> COMPATIBILITY.md
echo "_Workflow run: [#${RUN_NUMBER}](${RUN_URL})_" >> COMPATIBILITY.md

echo "Generated COMPATIBILITY.md:"
echo "=========================="
cat COMPATIBILITY.md
