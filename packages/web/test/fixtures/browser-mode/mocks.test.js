import { greet } from 'cjs-greeter';
import { compute } from './src/uses-math.js';
import { save, LIMIT } from './src/store.js';

vi.mock('cjs-greeter', () => ({ greet: () => 'mocked' }));

vi.mock('./src/math.js', async (importOriginal) => ({ ...(await importOriginal()), double: () => 40 }));

vi.mock('./src/store.js');

test('replaces a package with what the factory returns', () => {
  expect(greet('Ann')).toBe('mocked');
});

test('replaces part of a module everywhere it is imported, keeping the rest', () => {
  expect(compute(2)).toBe(41);
});

test('automocks a module without a factory', () => {
  expect(vi.isMockFunction(save)).toBe(true);
  save(1);
  expect(save).toHaveBeenCalledWith(1);
  expect(LIMIT).toBe(3);
});
