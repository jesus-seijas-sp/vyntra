---
"vyntra": minor
"@vyntra/web": minor
---

Snapshots in browser mode: `toMatchSnapshot` and `toMatchInlineSnapshot` work in browser pages, with `-u`, the page's results written by Node. DOM nodes now print as pretty-format's DOM plugins print them (attributes one per line, children indented), so stored Jest and Vitest snapshots of elements match; `NodeList` and `HTMLCollection` print as lists. New snapshot files of Vitest projects get Vitest's header and `suite > test` names. A failed test's snapshots it did not reach are no longer obsolete, so `-u` keeps them.
