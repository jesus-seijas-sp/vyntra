const http = require('node:http');

const PAGE = `<!doctype html>
<title>Todos</title>
<h1>Todos</h1>
<label>New todo <input /></label>
<button>Add</button>
<ul></ul>
<script>
  document.querySelector('button').addEventListener('click', () => {
    const item = document.createElement('li');
    item.textContent = document.querySelector('input').value;
    document.querySelector('ul').append(item);
    document.querySelector('input').value = '';
  });
</script>`;

http
  .createServer((request, response) => {
    response.writeHead(200, { 'content-type': 'text/html' });
    response.end(PAGE);
  })
  .listen(Number(process.env.PORT));
