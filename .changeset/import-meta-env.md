---
"vyntra": minor
---

`import.meta.env` works as in Vitest: it reads `process.env` (so `vi.stubEnv` changes both), over Vite's values (`MODE: 'test'`, `DEV`, `PROD`, `SSR`, `BASE_URL`) and the `VITE_` variables of the project's `.env` files (`envDir` and `envPrefix` from the Vite config). JSON files can be imported by name: `import { version } from './package.json'`.
