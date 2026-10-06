const http = require('node:http');
const { scenarios } = require('./scenarios');

// The benchmark's pages: the list at /, and each scenario at /e/<slug>.
const page = (title, body) => `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>${title}</title></head>
<body>
<h1>${title}</h1>
${body}
<p role="status"></p>
<script>function done(message) { document.querySelector('[role=status]').textContent = message; }</script>
</body>
</html>`;

const index = page(
  'Agent benchmark',
  `<ul>${scenarios.map((s) => `<li><a href="/e/${s.slug}">${s.name}</a>: ${s.surface}</li>`).join('')}</ul>`
);

http
  .createServer((request, response) => {
    const slug = /^\/e\/([\w-]+)$/.exec(request.url)?.[1];
    const scenario = scenarios.find((one) => one.slug === slug);
    if (request.url === '/' || scenario) {
      response.writeHead(200, { 'content-type': 'text/html' });
      response.end(scenario ? page(scenario.name, scenario.html) : index);
      return;
    }
    response.writeHead(404);
    response.end('Not found');
  })
  .listen(Number(process.env.PORT ?? 4700));
