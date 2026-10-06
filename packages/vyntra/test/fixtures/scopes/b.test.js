const { test, counts } = require('./shared');

test('b: first', ({ row, database, greeting, baseURL }) => {
  expect(database.id).toBe(1);
  expect(row).toMatch(/^http:\/\/api\.test\/db\/table-\d\/row-\d$/);
  expect(greeting).toBe('hi');
  expect(baseURL).toBe('http://api.test');
});

test('b: second', ({ row, table }) => {
  expect(row.startsWith(table)).toBe(true);
  expect(counts).toMatchObject({ worker: 1, workerDown: 0 });
});
