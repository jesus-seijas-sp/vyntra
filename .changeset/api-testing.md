---
"vyntra": minor
---

API testing: the built-in `api` fixture is an HTTP client for the test (JSON in and out, `use.baseURL` or the server's address, cookies kept for the test), and `toHaveStatus`, `toHaveHeader` and `toMatchSchema` (JSON Schema) check its responses. Every request and response is recorded, and the failure page of a test shows them with the server's output.
