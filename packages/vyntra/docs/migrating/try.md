# Try it first

Nothing has to change to try it, not even your dependencies: `npx` downloads vyntra to its cache and runs it in your project, next to your current runner.

```bash
npx vyntra
```

If every test passes, install it, so your `test` script and your imports find it and everyone runs the same version, and switch the script:

```bash
npm install --save-dev vyntra
```

If some fail, the sections below explain the usual reasons, from the most common to the rarest.
