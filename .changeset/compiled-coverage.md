---
"vyntra": patch
---

Coverage of compiled files (TypeScript and JSX through esbuild or TypeScript) counts the lines of the source: V8's counts of the compiled code are moved through the compiler's source map, and what the map leaves out (types, comments) is not counted as code. They were applied to the source as they were, so the wrong lines showed as covered.
