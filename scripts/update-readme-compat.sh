#!/usr/bin/env bash
#----------------------------------------------------------------------------------------------------
# Copyright (c) 2025                    orgrinrt                    orgrinrt@ikiuni.dev
# SPDX-License-Identifier: MPL-2.0      https://mozilla.org/MPL/2.0 contact@hiisi.digital
#----------------------------------------------------------------------------------------------------

# update-readme-compat.sh
#
# Updates the README.md with a summary compatibility section based on test results.
# Called by the compat-check.yml workflow.
#
# Usage: ./scripts/update-readme-compat.sh <results-dir>

set -euo pipefail

RESULTS_DIR="${1:-all-results}"

# Count results for a runtime
count_results() {
  local runtime="$1"
  local smoke_pass=0
  local types_pass=0
  local tests_pass=0
  local total=0

  for result_file in "${RESULTS_DIR}"/result-${runtime}-*/results/${runtime}-*.json \
                     "${RESULTS_DIR}"/result-${runtime}-*/${runtime}-*.json \
                     "${RESULTS_DIR}"/${runtime}-*.json; do
    if [ -f "$result_file" ]; then
      total=$((total + 1))
      smoke=$(jq -r '.smoke // "unknown"' "$result_file")
      types=$(jq -r '.types // "unknown"' "$result_file")
      tests=$(jq -r '.tests // "unknown"' "$result_file")

      [ "$smoke" = "success" ] && smoke_pass=$((smoke_pass + 1))
      [ "$types" = "success" ] && types_pass=$((types_pass + 1))
      [ "$tests" = "success" ] && tests_pass=$((tests_pass + 1))
    fi
  done

  echo "${smoke_pass}:${types_pass}:${tests_pass}:${total}"
}

# Get status emoji based on pass/total ratio
get_status_emoji() {
  local pass="$1"
  local total="$2"

  if [ "$total" -eq 0 ]; then
    echo "❓"
  elif [ "$pass" -eq "$total" ]; then
    echo "✅"
  elif [ "$pass" -gt 0 ]; then
    echo "⚠️"
  else
    echo "❌"
  fi
}

# Count results for each runtime
DENO_RESULT=$(count_results "deno")
NODE_RESULT=$(count_results "node")
BUN_RESULT=$(count_results "bun")

# Parse Deno results
DENO_SMOKE="${DENO_RESULT%%:*}"
DENO_REST="${DENO_RESULT#*:}"
DENO_TYPES="${DENO_REST%%:*}"
DENO_REST="${DENO_REST#*:}"
DENO_TESTS="${DENO_REST%%:*}"
DENO_TOTAL="${DENO_REST##*:}"

# Parse Node results
NODE_SMOKE="${NODE_RESULT%%:*}"
NODE_REST="${NODE_RESULT#*:}"
NODE_TYPES="${NODE_REST%%:*}"
NODE_REST="${NODE_REST#*:}"
NODE_TESTS="${NODE_REST%%:*}"
NODE_TOTAL="${NODE_REST##*:}"

# Parse Bun results
BUN_SMOKE="${BUN_RESULT%%:*}"
BUN_REST="${BUN_RESULT#*:}"
BUN_TYPES="${BUN_REST%%:*}"
BUN_REST="${BUN_REST#*:}"
BUN_TESTS="${BUN_REST%%:*}"
BUN_TOTAL="${BUN_REST##*:}"

# Get status emojis
DENO_SMOKE_STATUS=$(get_status_emoji "$DENO_SMOKE" "$DENO_TOTAL")
DENO_TYPES_STATUS=$(get_status_emoji "$DENO_TYPES" "$DENO_TOTAL")
DENO_TESTS_STATUS=$(get_status_emoji "$DENO_TESTS" "$DENO_TOTAL")

NODE_SMOKE_STATUS=$(get_status_emoji "$NODE_SMOKE" "$NODE_TOTAL")
NODE_TYPES_STATUS=$(get_status_emoji "$NODE_TYPES" "$NODE_TOTAL")
NODE_TESTS_STATUS=$(get_status_emoji "$NODE_TESTS" "$NODE_TOTAL")

BUN_SMOKE_STATUS=$(get_status_emoji "$BUN_SMOKE" "$BUN_TOTAL")
BUN_TYPES_STATUS=$(get_status_emoji "$BUN_TYPES" "$BUN_TOTAL")
BUN_TESTS_STATUS=$(get_status_emoji "$BUN_TESTS" "$BUN_TOTAL")

# Create the compatibility section
cat > /tmp/compat-section.md << EOF
## Runtime Compatibility

| Runtime | Versions Tested | Smoke | Types | Tests |
|---------|-----------------|:-----:|:-----:|:-----:|
| **Deno** | 1.x, 2.x | ${DENO_SMOKE_STATUS} | ${DENO_TYPES_STATUS} | ${DENO_TESTS_STATUS} |
| **Node.js** | 18, 20, 22 | ${NODE_SMOKE_STATUS} | ${NODE_TYPES_STATUS} | ${NODE_TESTS_STATUS} |
| **Bun** | 1.0, 1.1, latest | ${BUN_SMOKE_STATUS} | ${BUN_TYPES_STATUS} | ${BUN_TESTS_STATUS} |

- **Smoke**: Basic import and function verification
- **Types**: TypeScript definitions work correctly
- **Tests**: Full unit test suite passes

> See [COMPATIBILITY.md](./COMPATIBILITY.md) for detailed version-by-version results.
EOF

# Check if the section already exists and update it
if grep -q "## Runtime Compatibility" README.md; then
  # Use awk to remove the old section and prepare for replacement
  awk '
    /^## Runtime Compatibility/ {
      skip=1
      print "___COMPAT_PLACEHOLDER___"
      next
    }
    /^## / && skip { skip=0 }
    !skip { print }
  ' README.md > /tmp/readme-temp.md

  # Replace placeholder with new content
  awk -v section_file="/tmp/compat-section.md" '
    /___COMPAT_PLACEHOLDER___/ {
      while ((getline line < section_file) > 0) print line
      next
    }
    { print }
  ' /tmp/readme-temp.md > README.md

  rm -f /tmp/readme-temp.md
else
  # Just append at end
  echo "" >> README.md
  cat /tmp/compat-section.md >> README.md
fi

rm -f /tmp/compat-section.md

echo "Updated README.md with compatibility section:"
echo "  Deno:    Smoke=${DENO_SMOKE_STATUS} Types=${DENO_TYPES_STATUS} Tests=${DENO_TESTS_STATUS}"
echo "  Node.js: Smoke=${NODE_SMOKE_STATUS} Types=${NODE_TYPES_STATUS} Tests=${NODE_TESTS_STATUS}"
echo "  Bun:     Smoke=${BUN_SMOKE_STATUS} Types=${BUN_TYPES_STATUS} Tests=${BUN_TESTS_STATUS}"
