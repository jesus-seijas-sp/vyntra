# vyntra

A very fast test runner for Node.js with the API of Jest and Vitest, and no dependencies.

This repository holds vyntra and the packages that grow around it. To use vyntra, read
[its README](./packages/vyntra/README.md) or [the documentation](https://jesus-seijas-sp.github.io/vyntra/).

## Packages

| Package | npm | What it is |
| --- | --- | --- |
| [`packages/vyntra`](./packages/vyntra) | [`vyntra`](https://www.npmjs.com/package/vyntra) | The runner: Jest/Vitest compatible API, mocks, snapshots, coverage, projects, API testing, no dependencies |
| [`packages/mcp`](./packages/mcp) | `@vyntra/mcp` | MCP server for coding agents: run tests, read failure pages and the docs, try locators |
| [`packages/web`](./packages/web) | `@vyntra/web` | End-to-end web tests on Playwright: browser and page fixtures, web-first assertions, failure pages with a screenshot and a trace |

[`examples/todo-app`](./examples/todo-app) is a small app tested by one config: unit, API and end-to-end tests.

The runner is growing into one framework for unit, API and end-to-end tests with AI-assisted steps; the
engines for those are packages of their own here (`@vyntra/web`, `@vyntra/ai`, `@vyntra/mcp`). The
plan is in [docs/design/unified-testing.md](./docs/design/unified-testing.md).

## Development

```sh
pnpm install
pnpm test        # every package's tests
pnpm lint
```

A change must not make vyntra slower. CI runs the benchmark gate on every pull request and push: a synthetic suite
of 200 files and 3000 tests, run with the base and with the change alternately on the same machine, which fails when
the change is slower by more than 2% beyond the machine's noise. Run it yourself against any git ref:

```sh
node packages/vyntra/bench/gate.js --base origin/main
```

A change that should be released comes with a changeset: run `pnpm changeset`, pick the packages and
the kind of change, and commit the file it writes. To release, `pnpm version-packages` turns the pending
changesets into version bumps and changelog entries, and `pnpm release` publishes the packages whose new
version is not on npm yet.

## License

MIT
