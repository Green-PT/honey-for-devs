#!/usr/bin/env node
// .hermes/ is a Hermes plugin root (hermes plugins install Green-PT/honey-for-devs/.hermes).
// Its manifest and file copies come from scripts/build-hermes-skills.js; its behaviour
// (.hermes/__init__.py) is checked by tests/hermes_plugin_check.py against a stand-in
// for Hermes' plugin context, skipped when no Python is on PATH.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { pluginManifest, PLUGIN_COPIES } = require('../scripts/build-hermes-skills');

const ROOT = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');

test('committed Hermes plugin manifest matches the generator', () => {
  assert.equal(read('.hermes/plugin.yaml'), pluginManifest(), 'stale — run: node scripts/build-hermes-skills.js');
});

for (const [src, dest] of PLUGIN_COPIES) {
  test(`.hermes/${dest} is a current copy of ${src}`, () => {
    assert.equal(read(path.join('.hermes', dest)), read(src), 'stale — run: node scripts/build-hermes-skills.js');
  });
}

const python = ['python3', 'python'].find((c) => spawnSync(c, ['--version']).status === 0);
test('Hermes plugin registers its section, command, hook and every skill', { skip: !python && 'no python on PATH' }, () => {
  const r = spawnSync(python, ['-B', path.join(__dirname, 'hermes_plugin_check.py')], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stdout + r.stderr);
});
