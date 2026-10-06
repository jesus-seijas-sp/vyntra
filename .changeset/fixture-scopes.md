---
"vyntra": minor
---

Fixtures can be shared: `{ scope: 'file' }` sets one up once per file, `{ scope: 'worker' }` once per worker, torn down when it ends. `[value, { option: true }]` fixtures take their value from the new `use` config option, whose values every test can destructure.
