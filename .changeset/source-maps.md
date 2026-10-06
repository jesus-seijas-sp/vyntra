---
"vyntra": minor
---

Errors in compiled files (TypeScript and JSX through esbuild or TypeScript, a Jest `transform`) are reported at the lines of the source: stack traces, code frames and failure pages go through the source map the compiler leaves. Maps are decoded only for errors that are reported, so passing runs cost nothing more.
