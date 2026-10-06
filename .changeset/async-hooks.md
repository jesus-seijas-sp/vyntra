---
"vyntra": minor
---

Async hooks run: a Jest transformer with only `processAsync`, and Vite plugins' `resolveId`, `load` and async `transform` hooks (virtual modules included), on a helper thread the module hooks wait for. Plugin transforms now apply to every project ES module, not only the ones vyntra compiles, as in Vitest.
