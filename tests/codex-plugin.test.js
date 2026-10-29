#!/usr/bin/env node
// The Codex plugin package (plugins/honey/) is generated from the repo root by
// scripts/build-codex-plugin.js. These tests fail if the committed copy is stale
// (ruleset drift), if the marketplace stops pointing at it, or if a real
// directory degrades back into a symlink — Codex drops those on install.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { OUT, manifest } = require('../scripts/build-codex-plugin');

const ROOT = path.join(__dirname, '..');

test('committed Codex manifest matches the generator', () => {
  const onDisk = fs.readFileSync(path.join(OUT, '.codex-plugin', 'plugin.json'), 'utf8');
  assert.equal(onDisk, manifest(), 'stale — run: node scripts/build-codex-plugin.js');
});

test('every canonical skill is copied verbatim', () => {
  for (const name of fs.readdirSync(path.join(ROOT, 'skills'))) {
    const src = path.join(ROOT, 'skills', name, 'SKILL.md');
    if (!fs.existsSync(src)) continue;
    const copied = path.join(OUT, 'skills', name, 'SKILL.md');
    assert.ok(fs.existsSync(copied), `plugins/honey is missing ${name} — run the generator`);
    assert.equal(fs.readFileSync(copied, 'utf8'), fs.readFileSync(src, 'utf8'), `${name} drifted from skills/`);
  }
});

test('skills is a real directory, not a symlink', () => {
  // Codex copies the plugin into its cache and silently drops symlinks, which
  // installs a plugin with no skills at all and no error.
  assert.ok(!fs.lstatSync(path.join(OUT, 'skills')).isSymbolicLink(), 'plugins/honey/skills must be a real copy');
});

test('the plugin root carries bin/check.js for the skills that run it', () => {
  // honey-compress and honey-memory fall back to <plugin root>/bin/check.js when
  // CLAUDE_PLUGIN_ROOT is unexpanded, a Claude Code variable.
  const copied = path.join(OUT, 'bin', 'check.js');
  assert.ok(fs.existsSync(copied), 'plugins/honey/bin/check.js missing — run the generator');
  assert.equal(fs.readFileSync(copied, 'utf8'), fs.readFileSync(path.join(ROOT, 'bin', 'check.js'), 'utf8'));
});

test('the marketplace points at the subdirectory, never the repo root', () => {
  // `path: "./"` is what made `codex plugin add honey@greenpt` fail.
  const mkt = JSON.parse(fs.readFileSync(path.join(ROOT, '.agents', 'plugins', 'marketplace.json'), 'utf8'));
  const honey = mkt.plugins.find((p) => p.name === 'honey');
  assert.equal(honey.source.path, './plugins/honey');
});

test('the Codex manifest declares no hooks', () => {
  // codex features list -> plugin_hooks: removed. A hooks key can never fire.
  assert.equal(JSON.parse(manifest()).hooks, undefined);
});
