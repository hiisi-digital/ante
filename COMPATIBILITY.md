# Runtime Compatibility Matrix

This document shows the compatibility status of `@hiisi/ante` across different JavaScript runtimes and versions.

> **Legend:** ✅ = Passing | ❌ = Failing | ➖ = Skipped | ❓ = Unknown

## Summary

**Overall:** 1/8 runtime versions passing

| Category       | Description                                 |
| -------------- | ------------------------------------------- |
| **Smoke**      | Basic import and function call verification |
| **Types**      | TypeScript type definitions work correctly  |
| **Test Suite** | Full unit test suite passes                 |

|---------|--------|:-----:|:-----:|:----------:|
| v1.x | 1.46.3 | ❌ | ❌ | ❌ |
| v2.x | 2.6.0 | ✅ | ✅ | ✅ |

## Node.js

| Version | Actual   | Smoke | Types | Test Suite |
| ------- | -------- | :---: | :---: | :--------: |
| 18      | v18.20.8 |  ✅   |  ❌   |     ❌     |
| 20      | v20.19.6 |  ✅   |  ❌   |     ❌     |
| 22      | v22.21.1 |  ✅   |  ❌   |     ❌     |

## Bun

| Version | Actual | Smoke | Types | Test Suite |
| ------- | ------ | :---: | :---: | :--------: |
| 1.0.0   | 1.0.0  |  ✅   |  ❌   |     ❌     |
| 1.1.0   | 1.1.0  |  ✅   |  ❌   |     ❌     |
| latest  | 1.3.4  |  ✅   |  ❌   |     ❌     |

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

_Last updated: 2025-12-12 13:48:07 UTC_
_Workflow run: [#6](https://github.com/hiisi-digital/ante/actions/runs/20168751705)_
