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
| `open_session`, `observe`, `act`, `locate`, `screenshot`, `close_session` | Live sessions on the app, see below |
| `try_locator` | Opens a URL and tries a Playwright locator on it (`getByRole('button', { name: 'Add' })`): what matches, its text, whether it is visible; the accessibility tree when nothing does. Needs `playwright` |

## Live sessions

A coding agent can look at the app before it writes a test, the way the tests will see it:

| Tool | What it does |
| --- | --- |
| `open_session` | Starts the servers the config declares (the run's and the project's, as a test run does), opens the project's `baseURL` (or `url`, a path or a full URL) in a browser of its own, and answers its name (`s1`) and the page's accessibility tree. `project` picks a project; by default the first with the web engine |
| `observe` | The page once it stops changing: address, title, accessibility tree |
| `act` | One action, as a test would: `click`, `fill`, `press`, `select_option`, `set_checked`, `hover`, `goto`; answers the page after it |
| `locate` | How many elements a target matches, their text and visibility, and the code to write in the test when exactly one does |
| `screenshot` | The page, as an image |
| `close_session` | Closes it, and stops the servers no other session uses |

A target is a Playwright locator chain as text (`getByRole('button', { name: 'Add' })`) or `{ role, name }`,
`{ label }`, `{ placeholder }`, `{ text }`, `{ testId }`, with `nth` to pick one of several. `goto` opens only
`http` and `https` addresses, or paths of the app. Several sessions can be open at once, each with its own
browser context, so subagents work side by side: with more than one open, every call names its `session`.
`vyntra-mcp --max-sessions <n>` changes the limit (4).

Locators are read, not run: only chains of Playwright's locator methods with literal arguments are accepted.

The server speaks both eras of the protocol: requests that carry their version (revision 2026-07-28, stateless,
with `server/discover`), and clients that open with `initialize` (2025-11-25 and earlier).

## License

MIT
