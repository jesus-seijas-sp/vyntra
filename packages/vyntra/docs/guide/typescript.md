# TypeScript and ES modules

vyntra loads files with Node.js, so what Node.js runs, vyntra runs: CommonJS, ES modules (`.mjs`, or `"type": "module"`), and TypeScript (`.ts`, `.mts`, `.cts`) through the type stripping of Node.js 22.18 and later. There is no build step, and errors point at your lines.

What Node.js can not run is compiled with what your project already has: JSX, and TypeScript-only syntax (`enum`, parameter properties, decorators), go through its esbuild, sucrase or TypeScript, and decorator metadata (`emitDecoratorMetadata` in `tsconfig.json`) through its TypeScript. A Jest `transform` in your config compiles the files it matches instead. The output is kept in `node_modules/.cache/vyntra`.

In compiled files, stack traces and code frames show the lines of the compiled output: source maps are not applied yet. Without a transformer installed, type stripping removes types but does not compile `enum`, parameter properties or decorators.
