---
"vyntra": minor
---

Projects: `projects` in the config splits the suite into parts with options of their own (files, environment, setup files, `use`, workers), run together and reported under their names, ordered by `dependsOn` (a project is skipped when one it depends on fails), each with its own workers within the run's `maxWorkers`. `--project` runs some of them. `globalSetup` and `globalTeardown` run once in the main process, for the run and for each project, as in Jest and vitest (read from their configs too), and the tests read what they provide with `inject()`.
