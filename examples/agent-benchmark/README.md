# Agent benchmark

Pages that are hard to automate, one surface each (`scenarios.js`), for measuring vyntra's agent and catching its
regressions. Every scenario has two tests:

- `tests/`: the floor. A deterministic test solves it with locators and the browser's own API. It runs with
  `pnpm test` and in CI; a scenario it can not solve is a gap in the tools, not in the agent.
- `tests-agent/`: the score. The agent gets the scenario's task in words, and the page's status message decides. It
  runs live, with a model (`pnpm agent`, with the model's key and `VYNTRA_AI_PROVIDER` / `VYNTRA_AI_MODEL` set), and
  `pnpm scorecard` writes `.vyntra/scorecard.md`.

| Scenario | Surface |
| --- | --- |
| A plain form | Labelled fields and a button: the control |
| Shadow DOM | A button inside a custom element's shadow root |
| A form in an iframe | The fields live in another document |
| A native confirm dialog | `confirm()` must be accepted |
| A list that remounts | Rebuilt every 400 ms |
| A button enabled late | Disabled for 1.5 s |
| A custom select | A combobox of divs with ARIA roles |
| A menu shown on hover | Items exist only under the pointer |
| Drag and drop | A card moves only by dragging |
| A canvas-only control | Nothing in the accessibility tree |
| Infinite scroll | The item loads when the list is scrolled |

## Scores

| Date | Model | Score | Calls | Tokens | Changed |
| --- | --- | --- | ---: | ---: | --- |
| 2026-10-06 | deepseek/deepseek-v4-flash, anthropic/claude-opus-5.5 for vision | 11 of 11 | 34 | 182k | Vision: the agent asks for a screenshot and clicks a point of it |
| 2026-10-06 | deepseek/deepseek-v4-flash | 10 of 11 | 56 | 303k | Dialogs, iframes and drag for the agent; plain text named by its text |
| 2026-10-06 | deepseek/deepseek-v4-flash | 7 of 11 | 133 | 853k | The first run |

Vision runs set `VYNTRA_AI_VISION_MODEL`: the steps that carry a screenshot go to that model.

## The first run

2026-10-06, `deepseek/deepseek-v4-flash` through OpenRouter, effort medium: **7 of 11**, 133 model calls, 853k
tokens. Failed: the iframe (its content is not in the accessibility tree the agent reads), the native dialog (no tool
to accept it), drag and drop (no drag tool) and the canvas (needs vision). Each is a tool the agent lacks, not a
judgment it gets wrong; the failing scenarios also cost most of the tokens.
