'use strict';

/**
 * 2026-10-25 — the BUILT action (dist/index.js) runs against the REAL CLI tarball, so a subcommand the
 * CLI does not have goes red. MEASURED before: dist/index.js:27590 ran `coderifts check --base … --fail …`;
 * coderifts 8.8.0 answers "error: unknown command 'check'" (exit 1), and the repo had no test.
 *
 * Inputs reach the action as INPUT_<NAME> (what the runner sets); the CLI under test is
 * CODERIFTS_CLI_TARBALL, else `npm pack coderifts@latest`, installed on PATH so the action skips its install.
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ACTION = path.join(__dirname, '..', 'dist', 'index.js');
const SPEC = (paths) => `openapi: 3.0.3\ninfo: {title: t, version: '1'}\npaths:\n${paths.map((p) => `  ${p}:\n    get:\n      responses:\n        '200': {description: ok}\n`).join('')}`;
const sh = (cmd, args, opts = {}) => spawnSync(cmd, args, { encoding: 'utf8', ...opts });
let work; let binDir;
const git = (cwd, ...a) => { const r = sh('git', a, { cwd }); assert.equal(r.status, 0, `git ${a.join(' ')}: ${r.stderr}`); };

function installCli() {
  let tgz = process.env.CODERIFTS_CLI_TARBALL;
  if (!tgz) {
    const r = sh('npm', ['pack', 'coderifts@latest', '--silent'], { cwd: work });
    assert.equal(r.status, 0, r.stderr);
    tgz = path.join(work, r.stdout.trim().split('\n').pop());
  }
  const prefix = path.join(work, 'cli');
  assert.equal(sh('npm', ['install', '-g', '--prefix', prefix, '--no-audit', '--no-fund', tgz]).status, 0);
  return path.join(prefix, 'bin');
}

function repo(headPaths) {
  const dir = fs.mkdtempSync(path.join(work, 'repo-'));
  const origin = `${dir}-origin.git`;
  git(work, 'init', '-q', '--bare', origin);
  git(dir, 'init', '-q', '-b', 'main');
  git(dir, 'config', 'user.email', 't@example.invalid'); git(dir, 'config', 'user.name', 't');
  fs.mkdirSync(path.join(dir, 'api'));
  fs.writeFileSync(path.join(dir, 'api', 'openapi.yaml'), SPEC(['/a', '/b']));
  git(dir, 'add', '.'); git(dir, 'commit', '-q', '-m', 'base');
  git(dir, 'remote', 'add', 'origin', origin); git(dir, 'push', '-q', 'origin', 'main');
  git(dir, 'checkout', '-q', '-b', 'feature');
  fs.writeFileSync(path.join(dir, 'api', 'openapi.yaml'), SPEC(headPaths));
  git(dir, 'commit', '-q', '-am', 'head', '--allow-empty');
  return dir;
}

function runAction(dir, inputs) {
  const summary = path.join(dir, '..', `summary-${path.basename(dir)}.md`);
  fs.writeFileSync(summary, '');
  const env = { PATH: `${binDir}:${process.env.PATH}`, HOME: process.env.HOME, GITHUB_STEP_SUMMARY: summary,
    'INPUT_API-KEY': 'test-not-used', 'INPUT_BASE-BRANCH': 'main', 'INPUT_FAIL-ON-BREAKING': 'true', 'INPUT_SPEC-PATH': 'api/openapi.yaml', ...inputs };
  const r = sh(process.execPath, [ACTION], { cwd: dir, env });
  return { ...r, summary: fs.readFileSync(summary, 'utf8') };
}

describe('the built action × the real CLI', { timeout: 300000 }, () => {
  before(() => { work = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cr-action-'))); binDir = installCli(); });
  after(() => fs.rmSync(work, { recursive: true, force: true }));

  it('dist/index.js no longer calls `coderifts check`', () => {
    assert.doesNotMatch(fs.readFileSync(ACTION, 'utf8'), /\['check', '--base'/);
  });
  it('negative control: this CLI refuses `coderifts check`', () => {
    const r = sh(path.join(binDir, 'coderifts'), ['check', '--base', 'main']);
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /unknown command 'check'/);
  });
  it('a removed path, fail-on-breaking true → the step fails; the report reaches the job summary', () => {
    const r = runAction(repo(['/a']), {});
    assert.equal(r.status, 1, r.stdout + r.stderr);
    assert.match(r.stdout, /::error::Breaking API changes detected/);
    assert.doesNotMatch(r.stdout + r.stderr, /unknown command/);
    assert.match(r.summary, /CodeRifts API Governance Report/);
  });
  it('the same break, fail-on-breaking false → the step passes', () => {
    const r = runAction(repo(['/a']), { 'INPUT_FAIL-ON-BREAKING': 'false' });
    assert.equal(r.status, 0, r.stdout + r.stderr);
  });
  it('an unchanged contract → the step passes', () => {
    const r = runAction(repo(['/a', '/b']), {});
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /No breaking API changes detected/);
  });
});
