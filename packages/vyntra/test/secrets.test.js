const { registerSecret, redact } = require('../src/secrets');
const { serializeError } = require('../src/run/serialize-error');

describe('secrets', () => {
  const VALUE = 'S3cr3t+Va/l"ue';
  registerSecret('token', VALUE);

  it('hides a value as written, in another letter case, and encoded', () => {
    expect(redact(`a ${VALUE} b`)).toBe('a <secret:token> b');
    expect(redact(VALUE.toUpperCase())).toBe('<secret:token>');
    expect(redact(encodeURIComponent(VALUE))).toBe('<secret:token>');
    expect(redact(JSON.stringify({ value: VALUE }))).toBe('{"value":"<secret:token>"}');
    expect(redact('S3cr3t+Va/l&quot;ue')).toBe('<secret:token>');
  });

  it('hides it from the errors a test reports', () => {
    const error = serializeError(new Error(`rejected ${VALUE}`, { cause: new Error(VALUE) }));
    expect(error.message).toBe('rejected <secret:token>');
    expect(error.cause.message).toBe('<secret:token>');
    expect(error.stack).not.toContain(VALUE);
  });

  it('refuses a value short enough to hide ordinary text', () => {
    expect(() => registerSecret('pin', '1234')).toThrow('The secret pin needs a value of at least 6 characters');
  });
});
