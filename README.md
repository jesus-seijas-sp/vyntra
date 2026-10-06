# vyntra

A very fast test runner for Node.js with the API of Jest and Vitest, and no dependencies.

This repository holds vyntra and the packages that grow around it. To use vyntra, read
[its README](./packages/vyntra/README.md) or [the documentation](https://jesus-seijas-sp.github.io/vyntra/).

## Packages

| Package | npm | What it is |
| --- | --- | --- |
| [`packages/vyntra`](./packages/vyntra) | [`vyntra`](https://www.npmjs.com/package/vyntra) | The runner: Jest/Vitest compatible API, mocks, snapshots, coverage, no dependencies |

The runner is growing into one framework for unit, API and end-to-end tests with AI-assisted steps; the
engines for those will be packages of their own here (`@vyntra/web`, `@vyntra/ai`, `@vyntra/mcp`). The
plan is in [docs/design/unified-testing.md](./docs/design/unified-testing.md).

## Development

```sh
pnpm install
pnpm test        # every package's tests
pnpm lint
```

A change that should be released comes with a changeset: run `pnpm changeset`, pick the packages and
the kind of change, and commit the file it writes. To release, `pnpm version-packages` turns the pending
changesets into version bumps and changelog entries, and `pnpm release` publishes the packages whose new
version is not on npm yet.

## License

MIT
