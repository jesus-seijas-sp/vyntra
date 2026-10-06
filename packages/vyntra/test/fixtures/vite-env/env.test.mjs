import data, { version, name } from './data.json';

test('has Vite values, under process.env', () => {
  expect(import.meta.env.MODE).toBe('test');
  expect(import.meta.env.DEV).toBe(true);
  expect(import.meta.env.PROD).toBe(false);
  expect(import.meta.env.SSR).toBe(true);
  expect(import.meta.env.BASE_URL).toBe('/');
});

test('reads the VITE_ variables of the .env files, and no others', () => {
  expect(import.meta.env.VITE_API_URL).toBe('http://api.test');
  expect(import.meta.env.VITE_TITLE).toBe('My app at http://api.test');
  expect(import.meta.env.VITE_ONLY_IN_TESTS).toBe('yes');
  expect(import.meta.env.SECRET).toBeUndefined();
  expect(process.env.VITE_API_URL).toBeUndefined();
});

test('shares values with process.env and vi.stubEnv', () => {
  vi.stubEnv('VITE_API_URL', 'http://stubbed.test');
  expect(import.meta.env.VITE_API_URL).toBe('http://stubbed.test');
  vi.stubEnv('PROD', 'true');
  expect(import.meta.env.PROD).toBe(true);
  import.meta.env.VITE_SET = 'set';
  expect(process.env.VITE_SET).toBe('set');
  expect(Object.keys(import.meta.env)).toEqual(expect.arrayContaining(['MODE', 'VITE_API_URL']));
});

test('imports JSON keys by name', () => {
  expect([version, name]).toEqual(['1.2.3', 'pkg']);
  expect(data.default).toBe('kept in data');
  expect(data['with-dash']).toBe(1);
});
