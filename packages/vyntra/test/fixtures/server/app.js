const http = require('node:http');

// A small API for the tests of the server option: it prints what it serves.
const port = Number(process.env.PORT);
if (process.env.APP_CRASHES) {
  console.error('app: missing DATABASE_URL');
  process.exit(3);
}
const users = [{ id: 1, name: 'Ann' }];
http
  .createServer((request, response) => {
    console.log(`app: ${request.method} ${request.url}`);
    if (request.url === '/health') {
      response.end('ok');
    } else if (request.url === '/users') {
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify(users));
    } else {
      response.statusCode = 404;
      response.end();
    }
  })
  .listen(port, () => console.log(`app: listening on ${port}`));
