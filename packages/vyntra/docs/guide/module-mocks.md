# Module mocks

`vi.mock(path, factory)` (or `jest.mock`) replaces a module with what the factory returns, for the test file and everything it loads. The calls are moved to the top of the file, before its imports, as Jest and Vitest do:

```js
import { describe, expect, it, vi } from 'vitest';
import { sendWelcome } from './signup.js';
import { sendMail } from './mailer.js';

vi.mock('./mailer.js', () => ({ sendMail: vi.fn() }));

it('sends a welcome mail', async () => {
  await sendWelcome('ann@example.com');
  expect(sendMail).toHaveBeenCalledWith('ann@example.com', 'Welcome!');
});
```

- **Keep part of the module:** the factory gets `importOriginal` in ES modules; `jest.requireActual(path)` works anywhere.
- **Values for the factory:** `vi.hoisted(() => ...)` runs before the mocks, so its values can be used in factories.
- **No factory:** vyntra uses the file in a `__mocks__` folder next to the module (or at the root of the project, for packages), or mocks every function of the real module (automock).
- **Modules that do not exist:** `jest.mock('virtual', factory, { virtual: true })`.
- **Not hoisted:** `vi.doMock` and `vi.doUnmock` apply from where they are called.

```js
const { spy } = vi.hoisted(() => ({ spy: vi.fn() }));

vi.mock('./dep.js', async (importOriginal) => ({
  ...(await importOriginal()),
  save: spy,
}));
```

Mocks are forgotten when the file ends: other files get the real modules.
