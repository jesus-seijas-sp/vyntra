import { expect, test } from 'vitest';
import { page, userEvent, server } from 'vitest/browser';

const log = [];
const record = (event) => log.push(`${event.type}:${event.target.id || event.target.tagName}`);

test('keyboard: text, named keys and keys held down', async () => {
  document.body.innerHTML = '<input id="name" aria-label="Name">';
  await userEvent.type(page.getByLabelText('Name'), 'ab{Shift>}CD{/Shift}e');
  await userEvent.keyboard('{Backspace}');
  await expect.element(page.getByLabelText('Name')).toHaveValue('abCD');
});

test('tab moves the focus, shift+tab back', async () => {
  document.body.innerHTML = '<button id="one">One</button><button id="two">Two</button>';
  document.getElementById('one').focus();
  await userEvent.tab();
  expect(document.activeElement.id).toBe('two');
  await userEvent.tab({ shift: true });
  expect(document.activeElement.id).toBe('one');
});

test('selects options by value or label', async () => {
  document.body.innerHTML = `<select id="color" aria-label="Color"><option value="r">Red</option><option value="g">Green</option></select>
<select id="many" aria-label="Many" multiple><option value="a">A</option><option value="b">B</option><option value="c">C</option></select>`;
  const changes = [];
  document.getElementById('color').addEventListener('change', (event) => changes.push(event.target.value));
  await userEvent.selectOptions(page.getByLabelText('Color'), 'Green');
  await page.getByLabelText('Many').selectOptions(['a', 'c']);
  expect(changes).toEqual(['g']);
  expect([...document.getElementById('many').selectedOptions].map((option) => option.value)).toEqual(['a', 'c']);
});

test('hovers, double clicks, clears', async () => {
  log.length = 0;
  document.body.innerHTML = '<button id="b" style="margin: 100px">Twice</button><input id="i" aria-label="Field" value="x">';
  const button = document.getElementById('b');
  ['mouseenter', 'dblclick'].forEach((type) => button.addEventListener(type, record));
  await userEvent.hover(page.getByRole('button', { name: 'Twice' }));
  await userEvent.dblClick(page.getByRole('button', { name: 'Twice' }));
  await userEvent.clear(page.getByLabelText('Field'));
  expect(log).toEqual(['mouseenter:b', 'dblclick:b']);
  expect(document.getElementById('i').value).toBe('');
});

test('waits for the element a locator means, and says when it is ambiguous', async () => {
  document.body.innerHTML = '';
  setTimeout(() => {
    document.body.innerHTML = '<button id="late">Late</button>';
  }, 100);
  await userEvent.click(page.getByRole('button', { name: 'Late' }));
  document.body.innerHTML = '<button>Same</button><button>Same</button>';
  const both = page.getByRole('button', { name: 'Same' });
  await expect(userEvent.click(both)).rejects.toThrow();
});

test('sets the viewport, and screenshots an element', async () => {
  await page.viewport(500, 400);
  expect(window.innerWidth).toBe(500);
  document.body.innerHTML = '<h1 id="title">Title</h1>';
  const shot = await page.getByRole('heading').screenshot();
  expect(shot).toMatch(/screenshot-\d+\.png$/);
  expect(['playwright', 'webdriverio']).toContain(server.provider);
});
