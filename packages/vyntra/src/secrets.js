// Secret values a test registered (@vyntra/ai's secret()), kept per thread: everything the worker reports (errors,
// console output, attachments) and everything the AI steps send or write shows them as <secret:name>. A run that
// registers none pays one size check.
const state = require('./state');

// The secret values known in this thread, by name: what redact() hides. Shorter values would hide ordinary text.
const MIN_SECRET_LENGTH = 6;
state.secrets ??= new Map();

function registerSecret(name, value) {
  if (typeof value !== 'string' || value.length < MIN_SECRET_LENGTH) {
    throw new Error(`The secret ${name} needs a value of at least ${MIN_SECRET_LENGTH} characters`);
  }
  state.secrets.set(name, value);
}

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const escapeHtml = (text) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Text with every secret value known in this thread replaced by <secret:name>: as written, JSON-escaped,
// percent-encoded or HTML-escaped, in any letter case (CSS may change it). A transformed value (its last four
// characters, a hash) is another text and is not hidden.
function redact(text) {
  if (typeof text !== 'string' || state.secrets.size === 0) {
    return text;
  }
  return [...state.secrets]
    .sort(([, a], [, b]) => b.length - a.length)
    .reduce((result, [name, value]) => {
      const forms = new Set([value, JSON.stringify(value).slice(1, -1), encodeURIComponent(value), escapeHtml(value)]);
      const pattern = new RegExp([...forms].map(escapeRegExp).join('|'), 'gi');
      return result.replace(pattern, `<secret:${name}>`);
    }, text);
}

module.exports = { registerSecret, redact };
