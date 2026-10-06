import { cleanTitle, summary } from '/todos.mjs';

// The page: a list of todos kept by the API, under the list named in the URL (?list=...).
const list = new URLSearchParams(window.location.search).get('list') ?? 'default';
const endpoint = `/api/lists/${encodeURIComponent(list)}/todos`;
const form = document.querySelector('form');
const alert = document.querySelector('[role="alert"]');
const items = document.querySelector('ul');
const status = document.querySelector('[role="status"]');

async function request(method, path, body) {
  const response = await fetch(`${endpoint}${path}`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body && JSON.stringify(body),
  });
  return response.status === 204 ? null : response.json();
}

function render(todos) {
  items.replaceChildren(
    ...todos.map((todo) => {
      const item = document.createElement('li');
      item.className = todo.done ? 'todo done' : 'todo';
      const label = document.createElement('label');
      const box = document.createElement('input');
      box.type = 'checkbox';
      box.checked = todo.done;
      box.addEventListener('change', async () => {
        await request('PATCH', `/${todo.id}`, { done: box.checked });
        load();
      });
      label.append(box, ` ${todo.title}`);
      const remove = document.createElement('button');
      remove.textContent = 'Delete';
      remove.setAttribute('aria-label', `Delete ${todo.title}`);
      remove.addEventListener('click', async () => {
        await request('DELETE', `/${todo.id}`);
        load();
      });
      item.append(label, remove);
      return item;
    })
  );
  status.textContent = summary(todos);
}

async function load() {
  render(await request('GET', ''));
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    const title = cleanTitle(form.title.value);
    alert.hidden = true;
    await request('POST', '', { title });
    form.reset();
    load();
  } catch (error) {
    alert.textContent = error.message;
    alert.hidden = false;
  }
});

load();
