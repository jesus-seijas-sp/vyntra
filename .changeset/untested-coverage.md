---
"vyntra": minor
---

With `collectCoverageFrom` (or Vitest's `coverage.include`), the coverage report lists the files it matches that no test loaded, at zero, as Jest and Vitest do. Coverage of a project reached through a symlinked folder (macOS's `/var`) is no longer lost, and its test files no longer show in the report.
