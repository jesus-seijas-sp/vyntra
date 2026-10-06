type Score = number;

export function grade(score: Score): string {
  if (score >= 90) {
    return 'A';
  }
  if (score >= 50) {
    return 'pass';
  }
  return 'fail';
}

export function unused(): number {
  return 42;
}

export const label = (score: Score) => (score > 0 ? `${grade(score)}!` : 'none');
