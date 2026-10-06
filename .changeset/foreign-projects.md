---
"vyntra": minor
---

The projects of a Vitest config (`test.projects`, or a `vitest.workspace` file) and of a Jest config (`projects`) run as they are: each from its own folder, with its own config or none, by the name Vitest or Jest gives it. As there, they do not take the root config's options, except Vitest projects with `extends: true`; `inherit: false` does the same in a vyntra project.
