const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { findTopic } = require('../src/cli/guide');

const BIN = path.join(__dirname, '..', 'bin', 'vyntra.js');
const run = (args, cwd) => spawnSync(process.execPath, [BIN, ...args], { encoding: 'utf8', cwd });

describe('vyntra guide', () => {
  it('lists the topics', () => {
    const { status, stdout } = run(['guide']);
    expect(status).toBe(0);
    expect(stdout).toContain('# vyntra documentation');
    expect(stdout).toContain('- [Projects](guide/projects.md) `guide/projects`: A project is a part of the suite');
  });

  it('prints a topic by its name, short or full', () => {
    expect(run(['guide', 'projects']).stdout).toMatch(/^# Projects\n/);
    expect(run(['guide', 'api/config']).stdout).toMatch(/^# Configuration\n\nIn `vyntra.config.js`/);
    expect(findTopic('matchers')).toEqual({ topic: 'api/matchers' });
    expect(findTopic('fixture')).toEqual({ topic: 'api/api-fixture' });
  });

  it('suggests topics for one it does not have', () => {
    const { status, stderr } = run(['guide', 'mock']);
    expect(status).toBe(1);
    expect(stderr).toContain('No topic "mock". Did you mean guide/mocks, guide/module-mocks, api/mock-matchers');
  });

  it('ships the docs the website has', () => {
    const { status, stderr } = spawnSync(
      process.execPath,
      [path.join(__dirname, '..', 'scripts', 'build-docs.js'), '--check'],
      {
        encoding: 'utf8',
      }
    );
    expect(stderr).toBe('');
    expect(status).toBe(0);
  });
});

describe('vyntra init --agents', () => {
  it('writes the skill, and keeps one that is there', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vyntra-init-'));
    const first = run(['init', '--agents'], dir);
    expect(first.status).toBe(0);
    expect(first.stdout).toContain(`Wrote ${path.join('.claude', 'skills', 'vyntra', 'SKILL.md')}.`);
    const skill = fs.readFileSync(path.join(dir, '.claude', 'skills', 'vyntra', 'SKILL.md'), 'utf8');
    expect(skill).toMatch(/^---\nname: vyntra\ndescription: /);
    expect(run(['init', '--agents'], dir).status).toBe(1);
    expect(run(['init', '--agents', '--force'], dir).status).toBe(0);
    expect(run(['init', '--agents', '--dir', 'skills/testing'], dir).status).toBe(0);
    expect(fs.existsSync(path.join(dir, 'skills', 'testing', 'SKILL.md'))).toBe(true);
  });
});
