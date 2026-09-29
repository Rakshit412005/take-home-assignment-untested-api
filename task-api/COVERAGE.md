# Test Execution and Coverage Report

## Overview

This report documents the test execution and code coverage results for the Task Manager API test suite, generated using the project's configured test commands.

All required coverage metrics exceed the 80% threshold specified in `ASSIGNMENT.md`.

## Execution Commands

The test suite and coverage reports were executed via `npm` from the `task-api` directory:

```bash
# Run test suite
npm test

# Run test suite with coverage report
npm run coverage
```

Coverage collection was generated using the project's existing `npm run coverage` command, which runs Jest with `--coverage` as defined in `package.json`.

## Test Results Summary

- **Test Suites:** 2 passed, 2 total
- **Tests:** 86 passed, 86 total
  - `tests/taskService.test.js`: 44 unit tests passed
  - `tests/tasks.api.test.js`: 42 integration tests passed
- **Snapshots:** 0 total

## Coverage Summary

| Metric | Project Coverage | Target Threshold | Status |
|---|---|---|---|
| Statements | 96.77% | 80% | Exceeds target |
| Branches | 94.18% | 80% | Exceeds target |
| Functions | 93.33% | 80% | Exceeds target |
| Lines | 96.45% | 80% | Exceeds target |

All four coverage metrics exceed the minimum 80% requirement.

## File Breakdown

```text
-----------------|---------|----------|---------|---------|-------------------
File             | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-----------------|---------|----------|---------|---------|-------------------
All files        |   96.77 |    94.18 |   93.33 |   96.45 |
 src             |   69.23 |       75 |       0 |   69.23 |
  app.js         |   69.23 |       75 |       0 |   69.23 | 10-11,17-18
 src/routes      |     100 |    95.83 |     100 |     100 |
  tasks.js       |     100 |    95.83 |     100 |     100 | 20
 src/services    |     100 |    94.73 |     100 |     100 |
  taskService.js |     100 |    94.73 |     100 |     100 | 24
 src/utils       |   96.29 |    94.87 |     100 |   96.29 |
  validators.js  |   96.29 |    94.87 |     100 |   96.29 | 31
-----------------|---------|----------|---------|---------|-------------------
```

## Uncovered Lines Explanation

- **`src/app.js` (lines 10-11, 17-18):** Lines 10-11 represent the global Express 500 error handler, triggered only during unhandled runtime exceptions. Lines 17-18 contain `app.listen()`, which executes only when `app.js` is invoked directly as the application entry point rather than imported by Supertest.
- **`src/routes/tasks.js` (line 20):** Fallback branch for `parseInt(page) || 1` when `page` evaluates to 0 or NaN.
- **`src/services/taskService.js` (line 24):** Guard check in `getStats()` verifying that task status exists in the status counter object.
- **`src/utils/validators.js` (line 31):** Branch validating non-standard ISO date strings during task updates.
