const fs = require('node:fs');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const { spawn } = require('node:child_process');
const { copyFixture } = require('./helpers/run-fixture');
const { Watcher } = require('../src/cli/watch');

const BIN = path.join(__dirname, '..', 'bin', 'vyntra.js');

// A terminal for the watcher: keys pressed with press(), output kept.
function terminal() {
  const input = Object.assign(new EventEmitter(), {
    isTTY: true,
    setRawMode() {},
    setEncoding() {},
    resume() {},
    pause() {},
  });
  const out = {
    text: '',
    write: (chunk) => {
      out.text += chunk;
    },
  };
  return { input, out, press: (keys) => input.emit('data', keys) };
}

// A run that reports results as the watcher's runOnce would; records the arguments of every run.
function fakeRuns(root) {
  const calls = [];
  const runOnce = async (args, outcome) => {
    calls.push(args);
    const file = (name) => path.join(root, name);
    Object.assign(outcome, {
      config: { rootDir: root, include: ['**/*.test.js'], exclude: [] },
      results: [
        { path: file('a.test.js'), tests: [{ status: 'passed' }], errors: [], dependencies: [file('src/a.js')] },
        { path: file('b.test.js'), tests: [{ status: 'failed' }], errors: [], dependencies: [file('src/b.js')] },
      ],
    });
    return 1;
  };
  return { calls, runOnce };
}

const flush = () =>
  new Promise((resolve) => {
    setImmediate(resolve);
  });

describe('Watcher', () => {
  const root = path.join(__dirname, 'fixtures', 'watch');

  it('knows which tests a change touches', async () => {
    const { runOnce } = fakeRuns(root);
    const watcher = new Watcher(['--watch'], runOnce, terminal());
    await watcher.run(null);
    expect(watcher.affected([path.join(root, 'src/add.js')]).tests).toEqual([]);
    watcher.remember([
      { path: path.join(root, 'x.test.js'), tests: [], errors: [], dependencies: [path.join(root, 'src/add.js')] },
    ]);
    expect(watcher.affected([path.join(root, 'src/add.js')])).toEqual({
      all: false,
      tests: [path.join(root, 'x.test.js')],
    });
    expect(watcher.affected([path.join(root, 'add.test.js')]).tests).toEqual([path.join(root, 'add.test.js')]);
    expect(watcher.affected([path.join(root, 'package.json')]).all).toBe(true);
  });

  it('runs the failures, filters by file and by name, and quits on q', async () => {
    const { calls, runOnce } = fakeRuns(root);
    const io = terminal();
    const watcher = new Watcher(['--watch', '--no-color'], runOnce, io);
    await watcher.run(null);
    watcher.listen();
    io.press('f');
    await flush();
    expect(calls.at(-1)).toEqual(['--watch', '--no-color', path.join(root, 'b.test.js')]);
    io.press('t');
    io.press('adds\r');
    await flush();
    expect(calls.at(-1)).toEqual(['--watch', '--no-color', '-t', 'adds']);
    io.press('p');
    io.press('src/ mul\r');
    await flush();
    expect(calls.at(-1)).toEqual(['--watch', '--no-color', '-t', 'adds', 'src/', 'mul']);
    expect(io.out.text).toContain('Watching for changes (files: src/ mul, tests: adds) · Enter rerun');
    const done = watcher.done.promise;
    io.press('q');
    expect(await done).toBe(0);
  });
});

describe('vyntra --watch', () => {
  it('reruns the test files that import a changed module', async () => {
    const dir = copyFixture('watch');
    const child = spawn(process.execPath, [BIN, '--root', dir, '--watch', '--no-color'], {
      env: { ...process.env, CI: '', GITHUB_ACTIONS: '' },
    });
    let output = '';
    child.stdout.on('data', (chunk) => {
      output += chunk;
    });
    const until = (text) =>
      new Promise((resolve) => {
        const poll = setInterval(() => {
          if (output.includes(text)) {
            clearInterval(poll);
            resolve();
          }
        }, 20);
      });
    await until('Watching for changes');
    fs.writeFileSync(path.join(dir, 'src', 'mul.js'), 'export const mul = (a, b) => a * b * 1;\n');
    await until('RERUN  src/mul.js changed');
    await until('Tests  1 passed (1)');
    child.kill('SIGTERM');
    await new Promise((resolve) => {
      child.on('exit', resolve);
    });
    const rerun = output.slice(output.indexOf('RERUN'));
    expect(rerun).toContain('✓ mul.test.js');
    expect(rerun).not.toContain('add.test.js');
  }, 20000);
});
