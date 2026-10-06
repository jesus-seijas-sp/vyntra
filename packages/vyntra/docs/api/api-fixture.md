# The api fixture

| Member | What it does |
| --- | --- |
| `api.get(path, options?)`, `head`, `delete` | A request; `options`: `{ headers, query, timeout }` |
| `api.post(path, body?, options?)`, `put`, `patch` | With a body: JSON, unless a string, a `FormData`, `URLSearchParams`, `Blob` or bytes |
| `api.request(method, path, options?)` | Any method; `options.body` as above |
| `api.headers` | Headers sent with every request of the test (`api.headers.authorization = ...`) |
| The response | `{ status, ok, headers, body, text, url, method, duration }`: `body` parsed when the response is JSON |
