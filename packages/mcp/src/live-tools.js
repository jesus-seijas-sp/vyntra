const { observe, locate, perform, ACTIONS } = require('./page');

// The tools of live sessions: a coding agent opens the app as the project's tests see it, looks at it, acts on it,
// finds the locator a test should use, and sees it, with several sessions at once for subagents.

const text = (value) => ({ type: 'text', text: value });

const SESSION = {
  type: 'string',
  description: 'The session, as open_session named it (s1, s2...). Needed when several are open',
};
const TARGET = {
  description:
    "The element: a Playwright locator chain as text (getByRole('button', { name: 'Add' })), or { role, name } " +
    '(preferred), { label }, { placeholder }, { text } or { testId }, with nth to pick one of several',
  anyOf: [
    { type: 'string' },
    {
      type: 'object',
      properties: {
        role: { type: 'string' },
        name: { type: 'string' },
        label: { type: 'string' },
        placeholder: { type: 'string' },
        text: { type: 'string' },
        testId: { type: 'string' },
        nth: { type: 'integer' },
      },
      additionalProperties: false,
    },
  ],
};

const MAX_MATCHES = 10;

function createLiveTools(sessions) {
  const openSession = {
    name: 'open_session',
    title: 'Open a session on the app',
    description:
      "Opens the app in a browser as the project's tests see it: starts the servers the config declares (shared with other sessions, stopped with the last one), on the project's baseURL, at `url` (a path, or a full URL). Answers the session's name and the page as its accessibility tree. Use several sessions for several agents at once.",
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: "Where to start: a path of the app ('/settings'), or a full URL" },
        project: { type: 'string', description: 'The project of the config to use (by default the first web one)' },
        headed: { type: 'boolean', description: 'Show the browser window' },
      },
      additionalProperties: false,
    },
    async call(args) {
      const session = await sessions.start(args);
      const where = session.baseURL ? ` on ${session.baseURL}` : '';
      return {
        content: [text(`Session ${session.id}${where}.\n\n${await observe(session.page)}`)],
        structuredContent: { session: session.id, project: session.project, baseURL: session.baseURL ?? null },
      };
    },
  };

  const observeTool = {
    name: 'observe',
    title: 'Look at the page',
    description: "The session's page once it stops changing: its address, title and accessibility tree.",
    inputSchema: { type: 'object', properties: { session: SESSION }, additionalProperties: false },
    async call(args) {
      return { content: [text(await observe(sessions.get(args.session).page))] };
    },
  };

  const act = {
    name: 'act',
    title: 'Act on the page',
    description: `Does one action on the session's page, as a test would, then answers the page as it is after it. Actions: ${ACTIONS.join(', ')}. fill and select_option take a value (select_option: the option's label), press a key (Enter, Tab, Control+A; on the target, or the page without one), set_checked true or false, goto a path or a URL.`,
    inputSchema: {
      type: 'object',
      properties: {
        session: SESSION,
        action: { type: 'string', enum: ACTIONS },
        target: TARGET,
        value: {
          description: 'The text to fill, the option, the key, true or false, or the URL',
          anyOf: [{ type: 'string' }, { type: 'boolean' }],
        },
      },
      required: ['action'],
      additionalProperties: false,
    },
    async call(args) {
      const { page } = sessions.get(args.session);
      if (args.action !== 'goto' && args.action !== 'press' && args.target === undefined) {
        throw new Error(`${args.action} needs a target`);
      }
      await perform(page, args);
      return { content: [text(`Done.\n\n${await observe(page)}`)] };
    },
  };

  const locateTool = {
    name: 'locate',
    title: 'Find the locator for a test',
    description:
      "Tries a target on the session's page, as an end-to-end test would find it: how many elements match, their text and whether they are visible, and the code to write in the test when exactly one matches. With none or several, says how to narrow it.",
    inputSchema: {
      type: 'object',
      properties: { session: SESSION, target: TARGET },
      required: ['target'],
      additionalProperties: false,
    },
    async call(args) {
      const { page } = sessions.get(args.session);
      const { locator, code } = locate(page, args.target);
      const count = await locator.count();
      const lines = [`Matches: ${count}`];
      const shown = Math.min(count, MAX_MATCHES);
      for (let i = 0; i < shown; i += 1) {
        const element = locator.nth(i);
        // eslint-disable-next-line no-await-in-loop -- one element after the other, in the page's order
        const [content, visible] = await Promise.all([element.textContent(), element.isVisible()]);
        lines.push(
          `  ${i + 1}. ${visible ? 'visible' : 'hidden'}: ${JSON.stringify((content ?? '').replace(/\s+/g, ' ').trim())}`
        );
      }
      if (count === 1) {
        lines.push('', `In a test: ${code}`);
      } else if (count === 0) {
        lines.push(
          '',
          'Nothing matches: the accessibility tree has the roles and names to use.',
          '',
          await observe(page)
        );
      } else {
        lines.push('', `Several match: name one more exactly, or pick one with nth (${code}.nth(0)).`);
      }
      return { content: [text(lines.join('\n'))], structuredContent: { count, code: count === 1 ? code : null } };
    },
  };

  const screenshot = {
    name: 'screenshot',
    title: 'See the page',
    description: "A screenshot of the session's page, as an image.",
    inputSchema: {
      type: 'object',
      properties: {
        session: SESSION,
        fullPage: { type: 'boolean', description: 'The whole page, not only the window' },
      },
      additionalProperties: false,
    },
    async call(args) {
      const { page } = sessions.get(args.session);
      const image = await page.screenshot({ fullPage: args.fullPage === true, timeout: 10_000 });
      return { content: [{ type: 'image', data: image.toString('base64'), mimeType: 'image/png' }, text(page.url())] };
    },
  };

  const closeSession = {
    name: 'close_session',
    title: 'Close a session',
    description: 'Closes a session, and stops the servers it started when no other session uses them.',
    inputSchema: { type: 'object', properties: { session: SESSION }, additionalProperties: false },
    async call(args) {
      const session = await sessions.close(args.session);
      return { content: [text(`Closed ${session.id}${sessions.list()}.`)] };
    },
  };

  return [openSession, observeTool, act, locateTool, screenshot, closeSession];
}

module.exports = { createLiveTools };
