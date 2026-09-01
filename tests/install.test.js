#!/usr/bin/env node
// Guards the install matrix in bin/install.js. OpenCode used to be a rule-file
// agent writing <project>/.opencode/AGENTS.md — a path OpenCode never reads on
// its own, so an install that skipped the opencode.json `instructions` step did
// nothing at all. It is a global CLI-style install now; keep it that way.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { CLI_AGENTS, RULE_AGENTS } = require('../bin/install');
const { NAMES } = require('../scripts/build-openclaw-skills');

const ROOT = path.join(__dirname, '..');

test('opencode installs globally, not as a per-repo rule file', () => {
  assert.ok(CLI_AGENTS.some((a) => a.id === 'opencode'), 'opencode missing from CLI_AGENTS');
  assert.ok(!RULE_AGENTS.some((a) => a.id === 'opencode'), 'opencode must not be a rule agent');
});

test('every agent id is unique across both lists', () => {
  const ids = [...CLI_AGENTS, ...RULE_AGENTS].map((a) => a.id);
  assert.equal(new Set(ids).size, ids.length, 'duplicate id — the wizard would list it twice');
});

test('every skill the opencode install copies exists', () => {
  for (const name of NAMES)
    assert.ok(fs.existsSync(path.join(ROOT, 'skills', name, 'SKILL.md')), `missing skills/${name}`);
});

test('every rule file an agent copies exists', () => {
  for (const a of RULE_AGENTS)
    assert.ok(fs.existsSync(path.join(ROOT, a.src)), `missing ${a.src} for ${a.id}`);
});
