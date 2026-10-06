import { expect, it } from 'vitest';
import { grade, label } from './src/grade';

it('grades', () => {
  expect(grade(95)).toBe('A');
  expect(label(60)).toBe('pass!');
});
