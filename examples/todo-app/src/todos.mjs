// What the app knows about todos, shared by the browser and the server.

export function cleanTitle(title) {
  const clean = String(title ?? '')
    .trim()
    .replace(/\s+/g, ' ');
  if (clean === '') {
    throw new Error('A todo needs a title');
  }
  if (clean.length > 100) {
    throw new Error('A title has at most 100 characters');
  }
  return clean;
}

export function summary(todos) {
  const left = todos.filter((todo) => !todo.done).length;
  if (todos.length === 0) {
    return 'Nothing to do';
  }
  return `${left} of ${todos.length} left`;
}
