import { greet, env } from 'cjs-greeter';
import { page } from 'vitest/browser';

test('imports a CommonJS package, as React is', () => {
  expect(greet('Ann')).toBe('hi Ann');
  expect(env).toBe('test');
});

test('takes a screenshot', async () => {
  document.body.innerHTML = '<h1>Shot</h1>';
  const file = await page.screenshot();
  expect(file).toMatch(/__screenshots__\/packages\.test\.js\/screenshot-\d+\.png$/);
});
