---
"vyntra": minor
"@vyntra/web": minor
---

Coverage in browser mode: `--coverage` takes Chromium's V8 coverage of each page and maps it through the bundle's source map onto the project's files, the same lines, functions and branches as in Node. Code no test reaches is reported uncovered instead of being tree-shaken away. In Node, the coverage of compiled files (TypeScript) no longer counts the module itself as one of their functions.
