const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const BIN = path.join(__dirname, '..', 'bin', 'vyntra-mcp.js');

// The server on a copy of a fixture, and a client that sends a request and waits for its answer.
function connect(fixture = 'failing') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vyntra-mcp-'));
  fs.cpSync(path.join(__dirname, 'fixtures', fixture), root, { recursive: true });
  const child = spawn(process.execPath, [BIN, '--root', root], { env: { ...process.env, CI: '' } });
  const waiting = new Map();
  let buffer = '';
  child.stdout.on('data', (chunk) => {
    buffer += chunk;
    const lines = buffer.split('\n');
    buffer = lines.pop();
    lines.forEach((line) => {
      const message = JSON.parse(line);
      waiting.get(message.id)?.(message);
    });
  });
  let next = 0;
  const request = (method, params) =>
    new Promise((resolve) => {
      next += 1;
      waiting.set(next, resolve);
      child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id: next, method, params })}\n`);
    });
  const modern = (method, params = {}) =>
    request(method, {
      ...params,
      _meta: {
        'io.modelcontextprotocol/protocolVersion': '2026-07-28',
        'io.modelcontextprotocol/clientInfo': { name: 'test', version: '1' },
        'io.modelcontextprotocol/clientCapabilities': {},
      },
    });
  const call = async (name, args = {}) => (await modern('tools/call', { name, arguments: args })).result;
  const close = () => child.stdin.end();
  return { root, request, modern, call, close };
}

describe('protocol', () => {
  it('answers the handshake of earlier clients', async () => {
    const { request, close } = connect();
    const { result } = await request('initialize', {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'old', version: '1' },
    });
    expect(result).toMatchObject({
      protocolVersion: '2025-06-18',
      capabilities: { tools: {} },
      serverInfo: { name: 'vyntra' },
    });
    expect(result.resultType).toBeUndefined();
    const { result: listed } = await request('tools/list', {});
    expect(listed.tools.map((tool) => tool.name)).toEqual([
      'run_tests',
      'list_failures',
      'read_failure',
      'guide',
      'try_locator',
    ]);
    close();
  });

  it('serves modern requests statelessly, and refuses a version it does not know', async () => {
    const { modern, request, close } = connect();
    const { result } = await modern('server/discover');
    expect(result).toMatchObject({ resultType: 'complete', supportedVersions: expect.arrayContaining(['2026-07-28']) });
    const refused = await request('tools/list', { _meta: { 'io.modelcontextprotocol/protocolVersion': '1900-01-01' } });
    expect(refused.error).toMatchObject({ code: -32022, data: { requested: '1900-01-01' } });
    expect((await modern('nope')).error.code).toBe(-32601);
    expect((await modern('tools/call', { name: 'nope' })).error).toEqual({
      code: -32602,
      message: 'Unknown tool: nope',
    });
    close();
  });
});

describe('tools', () => {
  it('runs the tests, says what failed, and gives the page that explains it', async () => {
    const { call, close } = connect();
    const run = await call('run_tests');
    expect(run.content[0].text).toMatch(
      /^Exit code 1: a test failed\. 1 passed, 1 failed, 0 flaky, 0 skipped, in 1 files\./
    );
    expect(run.structuredContent.failures).toEqual([
      expect.objectContaining({ title: 'cart.test.js > total > takes the discount off', status: 'failed' }),
    ]);
    const { page } = run.structuredContent.failures[0];
    expect(page).toMatch(/^\.vyntra\/failures\/cart-test-js-total-takes-the-discount-off-[0-9a-f]{8}\.md$/);
    const listed = await call('list_failures');
    expect(listed.structuredContent.failures[0].page).toBe(page);
    const read = await call('read_failure', { test: 'discount' });
    expect(read.content[0].text).toContain('Expected: 900\nReceived: 0');
    expect(read.content[0].text).toContain('log: discount: 10%');
    expect(read.content[0].text).toContain("npx vyntra cart.test.js -t 'total takes the discount off'");
    close();
  });

  it('reruns what failed', async () => {
    const { root, call, close } = connect();
    await call('run_tests');
    fs.writeFileSync(
      path.join(root, 'cart.js'),
      fs.readFileSync(path.join(root, 'cart.js'), 'utf8').replace('discount / 10', 'discount / 100')
    );
    const rerun = await call('run_tests', { lastFailed: true });
    expect(rerun.content[0].text).toMatch(/^Exit code 0: every test passed\. 1 passed, 0 failed, 0 flaky, 1 skipped/);
    close();
  });

  it('says why no tests ran', async () => {
    const { call, close } = connect();
    const run = await call('run_tests', { files: ['nothing-matches'] });
    expect(run.isError).toBe(true);
    expect(run.content[0].text).toMatch(/^No tests ran: the setup is broken[^\n]*\n\nNo test files found/);
    close();
  });

  it('gives the documentation', async () => {
    const { call, close } = connect();
    expect((await call('guide')).content[0].text).toContain('# vyntra documentation');
    expect((await call('guide', { topic: 'projects' })).content[0].text).toMatch(/^# Projects/);
    close();
  });

  it('tries a locator on a page, and shows the page when nothing matches', async () => {
    const { call, close } = connect();
    const url = `data:text/html,${encodeURIComponent('<title>Shop</title><button>Buy</button><button hidden>Pay</button>')}`;
    const found = await call('try_locator', { url, locator: "getByRole('button', { name: 'Buy' })" });
    expect(found.content[0].text).toContain('Matches: 1\n  1. visible: "Buy"');
    const missing = await call('try_locator', { url, locator: "getByText('Checkout')" });
    expect(missing.content[0].text).toContain('Matches: 0\n\nAccessibility tree:\n- button "Buy"');
    const refused = await call('try_locator', { url, locator: 'evaluate(() => 1)' });
    expect(refused).toMatchObject({
      isError: true,
      content: [{ text: expect.stringContaining('evaluate is not a locator method') }],
    });
    close();
  }, 30000);
});
