const http = require('node:http');

// A todo app; under BUG, the count forgets the todo just added.
const PAGE = `<!doctype html>
<title>Todos</title>
<input aria-label="Title" />
<button>Add</button>
<ul></ul>
<p role="status">0 todos</p>
<script>
  document.querySelector('button').addEventListener('click', () => {
    const item = document.createElement('li');
    item.textContent = document.querySelector('input').value;
    document.querySelector('ul').append(item);
    const count = document.querySelectorAll('li').length - ${process.env.BUG ? 1 : 0};
    document.querySelector('[role=status]').textContent = count + (count === 1 ? ' todo' : ' todos');
  });
</script>`;

http
  .createServer((request, response) => {
    response.writeHead(200, { 'content-type': 'text/html' });
    response.end(PAGE);
  })
  .listen(Number(process.env.PORT));
