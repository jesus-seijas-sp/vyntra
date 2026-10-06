// The Model Context Protocol over stdio: one JSON-RPC message per line. Dual-era, as the specification allows: a
// request that carries its protocol version in _meta is served statelessly (revision 2026-07-28), and a client
// that opens with `initialize` gets the handshake of the earlier revisions.

const MODERN = ['2026-07-28'];
const LEGACY = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'];
const VERSION_KEY = 'io.modelcontextprotocol/protocolVersion';

const ERRORS = {
  parse: -32700,
  method: -32601,
  params: -32602,
  internal: -32603,
  version: -32022,
};

class ProtocolError extends Error {
  constructor(code, message, data) {
    super(message);
    this.code = code;
    this.data = data;
  }
}

// server: { info: { name, version }, instructions, tools: [{ name, description, inputSchema, call(args) }] },
// where call returns { content, structuredContent?, isError? }.
function createProtocol(server) {
  const byName = new Map(server.tools.map((tool) => [tool.name, tool]));
  const capabilities = { tools: {} };

  const handlers = {
    initialize: (params) => {
      const requested = params?.protocolVersion;
      return {
        protocolVersion: LEGACY.includes(requested) ? requested : LEGACY[0],
        capabilities,
        serverInfo: server.info,
        instructions: server.instructions,
      };
    },
    'server/discover': () => ({
      supportedVersions: [...MODERN, ...LEGACY],
      capabilities,
      _meta: { 'io.modelcontextprotocol/serverInfo': server.info },
      instructions: server.instructions,
    }),
    ping: () => ({}),
    'tools/list': () => ({
      tools: server.tools.map(({ name, title, description, inputSchema }) => ({
        name,
        title,
        description,
        inputSchema,
      })),
    }),
    'tools/call': async (params) => {
      const tool = byName.get(params?.name);
      if (!tool) {
        throw new ProtocolError(ERRORS.params, `Unknown tool: ${params?.name}`);
      }
      try {
        return await tool.call(params.arguments ?? {});
      } catch (error) {
        // What the model can act on: the tool failed, and why.
        return { content: [{ type: 'text', text: error.message }], isError: true };
      }
    },
  };

  // The answer to one message, or null for a notification.
  async function handle(message) {
    const { id, method, params } = message;
    if (id === undefined || id === null) {
      return null;
    }
    // eslint-disable-next-line no-underscore-dangle -- the protocol's name for request metadata
    const version = params?._meta?.[VERSION_KEY];
    try {
      if (version !== undefined && ![...MODERN, ...LEGACY].includes(version)) {
        throw new ProtocolError(ERRORS.version, 'Unsupported protocol version', {
          supported: [...MODERN, ...LEGACY],
          requested: version,
        });
      }
      const handler = Object.hasOwn(handlers, method) ? handlers[method] : null;
      if (!handler) {
        throw new ProtocolError(ERRORS.method, `Method not found: ${method}`);
      }
      const result = await handler(params);
      // A modern request's results say they are complete.
      return { jsonrpc: '2.0', id, result: MODERN.includes(version) ? { resultType: 'complete', ...result } : result };
    } catch (error) {
      const code = error instanceof ProtocolError ? error.code : ERRORS.internal;
      return {
        jsonrpc: '2.0',
        id,
        error: { code, message: error.message, ...(error.data ? { data: error.data } : {}) },
      };
    }
  }

  return { handle };
}

// Reads messages from `input` a line at a time, and writes the answers to `output`, in the order they finish.
function serve(server, input = process.stdin, output = process.stdout) {
  const { handle } = createProtocol(server);
  let buffer = '';
  const send = (message) => output.write(`${JSON.stringify(message)}\n`);
  input.setEncoding('utf8');
  input.on('data', (chunk) => {
    buffer += chunk;
    const lines = buffer.split('\n');
    buffer = lines.pop();
    lines
      .filter((line) => line.trim())
      .forEach((line) => {
        let message;
        try {
          message = JSON.parse(line);
        } catch {
          send({ jsonrpc: '2.0', id: null, error: { code: ERRORS.parse, message: 'Parse error' } });
          return;
        }
        handle(message).then((answer) => answer && send(answer));
      });
  });
}

module.exports = { createProtocol, serve, MODERN, LEGACY };
