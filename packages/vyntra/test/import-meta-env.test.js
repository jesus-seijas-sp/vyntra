const { runFixture } = require('./helpers/run-fixture');
const { rewriteImportMetaEnv, installImportMetaEnv, parseEnvFile } = require('../src/import-meta-env');

describe('import.meta.env', () => {
  it('gives project modules Vite values, the VITE_ variables of .env files, and named JSON imports', () => {
    const { statuses } = runFixture('vite-env');
    expect(Object.values(statuses)).toEqual(['passed', 'passed', 'passed', 'passed', 'passed']);
  });

  it('is rewritten where it is, on the same line', () => {
    expect(rewriteImportMetaEnv('const a = import.meta.env.MODE;\nimport.meta.url;')).toBe(
      "const a = globalThis[Symbol.for('vyntra.importMetaEnv')].MODE;\nimport.meta.url;"
    );
  });

  it('is not SSR in a document environment', () => {
    installImportMetaEnv({});
    const env = globalThis[Symbol.for('vyntra.importMetaEnv')];
    const { document } = globalThis;
    try {
      globalThis.document = {};
      expect(env.SSR).toBe(false);
    } finally {
      globalThis.document = document;
    }
  });
});

/* eslint-disable no-template-curly-in-string -- dotenv's ${VAR}, not template literals, is what these test */
describe('parseEnvFile', () => {
  it('reads values as dotenv does', () => {
    const text = [
      '# comment',
      'export A=1',
      'B = two words # trailing',
      'C="line\\nbreak"',
      "D='${A} kept'",
      'E=${A}-${MISSING}-${FROM_PROCESS}',
      'F=',
    ].join('\n');
    expect(parseEnvFile(text, { FROM_PROCESS: 'p' })).toEqual({
      A: '1',
      B: 'two words',
      C: 'line\nbreak',
      D: '${A} kept',
      E: '1--p',
      F: '',
    });
  });
});
