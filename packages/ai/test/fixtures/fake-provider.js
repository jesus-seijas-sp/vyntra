const fs = require('node:fs');

// A model for the tests, with no network: it judges "mentions <words>" claims by whether the input has the words, and
// drives the todo page of agent/ the way a person would. Every call is counted in $FAKE_CALLS.

const textOf = (message) =>
  typeof message.content === 'string'
    ? message.content
    : message.content.map((block) => block.text ?? block.content ?? '').join('\n');

let calls = 0;
const reply = (content, extra = {}) => ({
  message: { role: 'assistant', content },
  text: content.find((block) => block.type === 'text')?.text ?? '',
  toolCalls: content.filter((block) => block.type === 'tool_use').map(({ id, name, input }) => ({ id, name, input })),
  stopReason: 'end_turn',
  usage: { inputTokens: 100, outputTokens: 10 },
  ...extra,
});

const NO_TARGET = { role: null, name: null, label: null, placeholder: null, text: null, nth: null };
const toolUse = (name, input) => {
  calls += 1;
  return reply([{ type: 'tool_use', id: `call-${process.pid}-${calls}`, name, input }]);
};

function judge(text) {
  const input = /<input>\n([\s\S]*)\n<\/input>/.exec(text)[1];
  const claim = /<claim>(.*)<\/claim>/.exec(text)[1];
  const words = /mentions (.+)/.exec(claim)?.[1] ?? claim;
  if (claim.includes('nobody can tell')) {
    const json = { reasoning: 'Nothing here says either way.', verdict: 'inconclusive' };
    return reply([{ type: 'text', text: JSON.stringify(json) }], { json });
  }
  const pass = input.includes(words);
  const json = { reasoning: pass ? `It says ${words}.` : `Nothing says ${words}.`, verdict: pass ? 'holds' : 'fails' };
  return reply([{ type: 'text', text: JSON.stringify(json) }], { json });
}

function act(messages) {
  const goal = /Goal: add the todo (.+)/.exec(textOf(messages[0]))[1];
  const page = textOf(messages.at(-1));
  if (page.includes(`listitem: ${goal}`)) {
    return toolUse('done', { summary: `${goal} is in the list` });
  }
  if (page.includes(`textbox "Title": ${goal}`)) {
    const button = /button "([^"]+)"/.exec(page)[1];
    return toolUse('click', { target: { ...NO_TARGET, role: 'button', name: button } });
  }
  return toolUse('fill', { target: { ...NO_TARGET, role: 'textbox', name: 'Title' }, value: goal });
}

// Signs in: the username, then the password by its secret's name, then the button.
function signIn(messages) {
  const page = textOf(messages.at(-1));
  if (page.includes('status: Welcome')) {
    return toolUse('done', { summary: 'Signed in' });
  }
  if (!page.includes('textbox "Username": ada')) {
    return toolUse('fill', { target: { ...NO_TARGET, role: 'textbox', name: 'Username' }, value: 'ada' });
  }
  if (!JSON.stringify(messages).includes('type_secret')) {
    const name = /<secret:([\w.-]+)>/.exec(textOf(messages[0]))[1];
    return toolUse('type_secret', { target: { ...NO_TARGET, role: 'textbox', name: 'Password' }, secret: name });
  }
  return toolUse('click', { target: { ...NO_TARGET, role: 'button', name: 'Sign in' } });
}

// Tries what the rules forbid: a malformed call, then a file: URL, and gives up once both were refused.
function breakRules(messages) {
  const history = JSON.stringify(messages);
  if (history.includes('Navigation goes only to http and https')) {
    return toolUse('give_up', { reason: 'the runner refused both requests', category: 'unsupported' });
  }
  if (history.includes('was not run')) {
    return toolUse('goto', { url: 'file:///etc/passwd' });
  }
  return toolUse('click', { target: 'the button' });
}

// Stuck: clicks the same button that does nothing, until only done and give_up are offered.
function stuck(tools) {
  if (!tools.some((tool) => tool.name === 'click')) {
    return toolUse('give_up', { reason: 'the button does nothing', category: 'product' });
  }
  return toolUse('click', { target: { ...NO_TARGET, role: 'button', name: 'Nothing' } });
}

// Reads off the page: the first todo, a count it first gives in words (and as a number once told it does not fit),
// or a phone number the page does not show.
function read(messages) {
  const question = textOf(messages[0]);
  const answer = (json) => reply([{ type: 'text', text: JSON.stringify(json) }], { json });
  if (question.includes('phone number')) {
    return answer({ shown: false, value: null, missing: 'a phone number' });
  }
  if (question.includes('how many todos')) {
    return answer({ shown: true, value: messages.length > 1 ? 1 : 'one', missing: '' });
  }
  const value = /listitem: (.+)/.exec(question)?.[1] ?? '';
  return answer({ shown: true, value, missing: '' });
}

// Signs up with the email the goal names.
function signUp(messages) {
  const email = /sign up with the email (\S+)/.exec(textOf(messages[0]))[1];
  const page = textOf(messages.at(-1));
  if (page.includes('status: Welcome')) {
    return toolUse('done', { summary: 'Signed up' });
  }
  if (page.includes(`textbox "Email": ${email}`)) {
    return toolUse('click', { target: { ...NO_TARGET, role: 'button', name: 'Sign up' } });
  }
  return toolUse('fill', { target: { ...NO_TARGET, role: 'textbox', name: 'Email' }, value: email });
}

// Gives up on reaching the dashboard, for what the page shows: a server error, or a rejected sign-in.
function blocked(messages) {
  const page = textOf(messages.at(-1));
  if (page.includes('502')) {
    return toolUse('give_up', { reason: 'the app answers 502 Bad Gateway', category: 'environment' });
  }
  return toolUse('give_up', { reason: 'the sign-in was rejected', category: 'credentials' });
}

module.exports = {
  name: 'fake',
  async complete({ model, system, messages, tools, schema }) {
    if (process.env.FAKE_CALLS) {
      fs.appendFileSync(process.env.FAKE_CALLS, 'call\n');
    }
    // Everything the model was sent, for the tests to look for secret values in.
    if (process.env.FAKE_REQUESTS) {
      fs.appendFileSync(process.env.FAKE_REQUESTS, `${JSON.stringify({ model, system, messages, tools })}\n`);
    }
    if (tools && textOf(messages[0]).includes('Goal: reach the dashboard')) {
      return blocked(messages);
    }
    if (tools && textOf(messages[0]).includes('Goal: sign up')) {
      return signUp(messages);
    }
    if (tools && textOf(messages[0]).includes('Goal: make something happen')) {
      return stuck(tools);
    }
    if (tools && textOf(messages[0]).includes('Goal: open the local file')) {
      return breakRules(messages);
    }
    if (tools && textOf(messages[0]).includes('Goal: sign in')) {
      return signIn(messages);
    }
    if (tools) {
      return act(messages);
    }
    if (schema?.properties?.shown) {
      return read(messages);
    }
    return judge(textOf(messages.at(-1)));
  },
};
