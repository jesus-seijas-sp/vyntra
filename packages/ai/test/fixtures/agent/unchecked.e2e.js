const HTML = `<title>Todos</title><input aria-label="Title" /><button>Add</button><ul></ul>
<script>document.querySelector('button').onclick = () => {
  const item = document.createElement('li');
  item.textContent = document.querySelector('input').value;
  document.querySelector('ul').append(item);
};</script>`;

// Nothing after the act checks what it did: it is never recorded.
test('an act nothing checks', async ({ page, agent }) => {
  await page.setContent(HTML);
  await agent.act('add the todo Walk the dog');
});
