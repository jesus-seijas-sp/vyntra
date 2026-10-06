# FAQ

## Do I have to change my tests?

Usually not. vyntra runs Jest and Vitest tests as they are, including their imports and your Jest configuration. [Migrating](../migrating/introduction.md) lists the few differences.

## My tests call `process.send`.

Jest runs tests in child processes, where `process.send` exists. In vyntra's worker threads it is there too, and does nothing; with `--pool forks` it is the real one.

## What is not supported yet?

In browser mode: coverage and the WebdriverIO provider. [Migrating](../migrating/missing.md) has the whole list.

## My tests expect `NODE_ENV=test`.

Jest and Vitest set it when it is not set; vyntra leaves the environment as it is, as some applications do much more work under `test`. Set it for the run (`NODE_ENV=test npx vyntra`), or in `vyntra.config.js`: `env: { NODE_ENV: 'test' }`.

## Where is the cache, and can I delete it?

In `node_modules/.cache/vyntra`. Deleting it is always safe: the next run is slower while it fills it again. It is rebuilt by itself when your dependencies change.
