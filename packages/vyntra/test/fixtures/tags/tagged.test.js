describe('billing', { tags: ['billing'] }, () => {
  test('upgrades the plan', { tags: ['slow'] }, () => {});
  test('downgrades the plan', () => {});
});

test('signs in', { tags: 'auth' }, () => {});

test('lists the orders', () => {});

// Fails on its third run, as a flaky step might: --repeat-each 3 finds it.
let runs = 0;
test('passes twice', () => {
  runs += 1;
  if (runs === 3) {
    throw new Error('the third run failed');
  }
});
