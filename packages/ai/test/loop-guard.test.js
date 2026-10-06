const { LoopGuard } = require('../src/loop-guard');

describe('the loop guard', () => {
  it('says how many turns are left, and keeps the last one for a verdict', () => {
    const guard = new LoopGuard(10);
    expect(guard.advice(0)).toEqual({ concludeOnly: false, text: null });
    expect(guard.advice(7).text).toBe('3 turns are left for this step: finish the goal, or call done or give_up.');
    expect(guard.advice(9)).toEqual({
      concludeOnly: true,
      text: 'This is the last turn of the step: call done if the page shows the goal is reached, otherwise give_up.',
    });
  });

  it('refuses only a repeat on the same page, and a success resets the count of failures', () => {
    const guard = new LoopGuard(25);
    const click = { name: 'click', input: { target: { role: 'button', name: 'Add' } } };
    guard.done(click, 'page A');
    expect(guard.repeated(click, 'page A')).toBe(true);
    expect(guard.repeated(click, 'page B')).toBe(false);
    [1, 2, 3].forEach(() => guard.failed());
    expect(guard.advice(4).text).toContain('3 actions in a row failed');
    guard.done(click, 'page B');
    expect(guard.advice(5).text).toBeNull();
  });
});
