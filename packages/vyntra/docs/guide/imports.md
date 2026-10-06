# What files can import

Code written for a bundler (Vite, webpack) imports things Node.js refuses. vyntra accepts them as Vitest and Jest do, so the tests run without changing the code:

- **JSON.** `import data from './data.json'` works without `with { type: 'json' }`: the default export is the parsed file. `require('./data.json')` returns the data, as in Node.js. Named imports (`import { version } from './package.json'`) are not supported.
- **Stylesheets** (`.css`, `.scss`, `.sass`, `.less`, `.styl`, `.pcss`) are not read. Their default export answers every class name with the name itself, as a CSS module would: `styles.button` is `'button'`.
- **Images, fonts and media** (`.svg`, `.png`, `.jpg`, `.gif`, `.webp`, `.woff2`, `.mp4`, `.pdf`, `.txt`, `.md`...) export their path as the default, as a bundler exports their URL.
- **`import.meta.glob`**, Vite's: `import.meta.glob('./pages/*.ts')` becomes an object with a function per matching file that imports it. `{ eager: true }` gives the modules themselves, `{ import: 'default' }` one export of each, and `{ query: '?raw' }` their text. An array of patterns takes the files of all of them; `!` exclusions are not supported yet.
- **Imports without an extension** (`'./utils'`), and of a folder's `index` file, try the extensions of `moduleFileExtensions`, in ES modules too.
- **`'./file.js'` naming a TypeScript file.** When there is no `file.js`, vyntra loads `file.ts` (or `.tsx`; `.mjs` gives `.mts` and `.cjs` `.cts`), as TypeScript's `nodenext` resolution expects.
- **Aliases:** Jest's `moduleNameMapper`, Vite's `resolve.alias` (or vyntra's `alias`), and the `imports` of `package.json`, which Node.js resolves.
- **Named imports from CommonJS packages.** `import { join } from 'lodash'` gets every export of the package, even those Node.js can not detect in its source.
- **`__dirname`, `__filename` and `require`** in the ES modules vyntra compiles (TypeScript with a transformer installed, JSX, files with `import.meta.glob`), as Vitest gives them. In ES modules that Node.js runs as they are, use `import.meta.dirname` and `import.meta.filename`.
- **Type-only imports.** An import of a name that is only an interface or a type is dropped, as TypeScript drops it, even without `import type`. Node.js's type stripping alone would keep it and fail with "does not provide an export named".
- **Yarn Plug'n'Play.** Projects without `node_modules` run with Yarn's loader: `yarn vyntra`.

Packages in `node_modules` are loaded by Node.js as they are: vyntra does not compile them, unless a Jest `transform` and its `transformIgnorePatterns` say so.
