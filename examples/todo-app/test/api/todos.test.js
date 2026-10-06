const { randomUUID } = require('node:crypto');
const { test: base, expect } = require('vyntra');

const todo = {
  type: 'object',
  required: ['id', 'title', 'done'],
  properties: { id: { type: 'integer' }, title: { type: 'string', minLength: 1 }, done: { type: 'boolean' } },
  additionalProperties: false,
};

// Every test on a list of its own.
const test = base.extend({
  todos: async (_, use) => use((path = '') => `/api/lists/${randomUUID()}/todos${path}`),
});

test('creates and lists todos', async ({ api, todos }) => {
  const list = todos();
  const created = await api.post(list, { title: '  Buy  milk ' });
  expect(created).toHaveStatus(201);
  expect(created.body).toMatchSchema(todo);
  expect(created.body.title).toBe('Buy milk');
  const listed = await api.get(list);
  expect(listed).toMatchSchema({ type: 'array', items: todo, minItems: 1 });
});

test('refuses a todo without a title', async ({ api, todos }) => {
  const response = await api.post(todos(), { title: ' ' });
  expect(response).toHaveStatus(422);
  expect(response.body).toEqual({ error: 'A todo needs a title' });
});

test('completes and deletes a todo', async ({ api, todos }) => {
  const list = todos();
  const { body } = await api.post(list, { title: 'Walk' });
  expect((await api.patch(`${list}/${body.id}`, { done: true })).body.done).toBe(true);
  expect(await api.delete(`${list}/${body.id}`)).toHaveStatus(204);
  expect(await api.delete(`${list}/${body.id}`)).toHaveStatus(404);
});
