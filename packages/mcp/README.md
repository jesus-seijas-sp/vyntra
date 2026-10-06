# @vyntra/mcp

An MCP server for [vyntra](https://www.npmjs.com/package/vyntra): coding agents run a project's tests, read what
failed and why, look things up in the docs, and try locators on pages before writing end-to-end tests.

```sh
npm install --save-dev vyntra @vyntra/mcp
```

Register it with your MCP client, for the project it runs in. For Claude Code, in `.mcp.json`:

```json
{
  "mcpServers": {
    "vyntra": { "command": "npx", "args": ["vyntra-mcp"] }
  }
}
```

`vyntra-mcp --root <dir>` serves a project other than the current directory.

## Tools

| Tool | What it does |
| --- | --- |
| `run_tests` | Runs the tests (all; or `files`, `testNamePattern`, `projects`, `lastFailed`), and says what failed with the page that explains each |
| `list_failures` | The failed and flaky tests of the last run, without running anything |
| `read_failure` | A failure's page: the error and its source line, every attempt, the console, the command that reruns it; an API test's requests and responses; an end-to-end test's screenshot (as an image), accessibility tree, console, network and trace |
| `guide` | vyntra's documentation, a topic at a time |
| `try_locator` | Opens a URL and tries a Playwright locator on it (`getByRole('button', { name: 'Add' })`): what matches, its text, whether it is visible; the accessibility tree when nothing does. Needs `playwright` |

Locators are read, not run: only chains of Playwright's locator methods with literal arguments are accepted.

The server speaks both eras of the protocol: requests that carry their version (revision 2026-07-28, stateless,
with `server/discover`), and clients that open with `initialize` (2025-11-25 and earlier).

## License

MIT
