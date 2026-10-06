const { format } = require('../expect/format');
const { mapStack } = require('../source-maps');
const { redact } = require('../secrets');

const MAX_AGGREGATED = 10;

const isErrorLike = (error) => error instanceof Error || typeof error?.message === 'string';

// Errors cross the worker boundary as plain objects.
function serializeError(error) {
  if (!isErrorLike(error)) {
    return { name: 'Error', message: redact(`thrown: ${format(error, { min: true })}`), stack: '' };
  }
  const result = {
    name: error.name || 'Error',
    message: redact(String(error.message)),
    stack: typeof error.stack === 'string' ? redact(mapStack(error.stack)) : '',
  };
  // An error of the environment the test needs (a model provider), not of the test: exit code 3.
  if (error.phase === 'environment') {
    result.phase = 'environment';
  }
  if (error.code !== undefined) {
    result.code = String(error.code);
  }
  if (error.cause !== undefined) {
    result.cause = serializeError(error.cause);
  }
  if (Array.isArray(error.errors) && error.errors.length > 0) {
    result.errors = error.errors.slice(0, MAX_AGGREGATED).map(serializeError);
  }
  return result;
}

module.exports = { serializeError };
