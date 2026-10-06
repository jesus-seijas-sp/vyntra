// No test loads this file.
const greet = (name) => `hello ${name}`;

function shout(text) {
  return text.toUpperCase();
}

module.exports = { greet, shout, label: 'function => in a string' };
