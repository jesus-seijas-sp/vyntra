import { add } from './src/math';

describe('add', () => {
  test('takes numbers', () => {
    expectTypeOf(add).parameter(0).toEqualTypeOf<number>();
  });

  test('returns a number', () => {
    const text: string = add(1, 2); // type-error: Type 'number' is not assignable to type 'string'.
  });
});
