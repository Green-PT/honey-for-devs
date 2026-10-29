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

// Hermes resolves its home as HERMES_HOME, else %LOCALAPPDATA%\hermes on native
// Windows, else ~/.hermes. A hard-coded ~/.hermes installed into a folder Hermes
// on Windows never reads.
test('hermes home follows HERMES_HOME, then the platform default', () => {
  const { hermesHome } = require('../bin/install');
  const home = require('os').homedir();
  assert.equal(hermesHome({ HERMES_HOME: '/srv/h' }, 'linux'), '/srv/h');
  assert.equal(hermesHome({ HERMES_HOME: 'D:\\h', LOCALAPPDATA: 'C:\\L' }, 'win32'), 'D:\\h');
  assert.equal(hermesHome({ LOCALAPPDATA: 'C:\\L' }, 'win32'), path.join('C:\\L', 'hermes'));
  assert.equal(hermesHome({}, 'win32'), path.join(home, 'AppData', 'Local', 'hermes'));
  assert.equal(hermesHome({}, 'darwin'), path.join(home, '.hermes'));
  // Hermes expands ~ and $VARS in HERMES_HOME and treats a blank one as unset.
  assert.equal(hermesHome({ HERMES_HOME: '~/h' }, 'linux'), home + '/h');
  assert.equal(hermesHome({ HERMES_HOME: '$BASE/h', BASE: '/b' }, 'linux'), '/b/h');
  assert.equal(hermesHome({ HERMES_HOME: '  ' }, 'darwin'), path.join(home, '.hermes'));
});

// Skill-only installs copy SKILL.md files, so a skill that runs bin/check.js
// needs the checker next to it — nothing else on disk provides it.
for (const [id, envKey, skillsDir] of [
  ['hermes', 'HERMES_HOME', (d) => path.join(d, 'skills')],
  ['opencode', 'XDG_CONFIG_HOME', (d) => path.join(d, 'opencode', 'skills')],
]) {
  test(`${id}: install ships check.js next to every skill that runs it, uninstall removes it`, () => {
    const os = require('os');
    const cp = require('child_process');
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), `honey-${id}-`));
    // HOME/USERPROFILE too, so even a build that ignores envKey stays in tmp.
    const env = { ...process.env, HOME: tmp, USERPROFILE: tmp, [envKey]: tmp };
    const installer = path.join(ROOT, 'bin', 'install.js');
    try {
      cp.execFileSync(process.execPath, [installer, '--only', id], { env, stdio: 'pipe' });
      const users = NAMES.filter((s) =>
        fs.readFileSync(path.join(ROOT, 'skills', s, 'SKILL.md'), 'utf8').includes('bin/check.js'));
      assert.ok(users.length >= 2, 'expected honey-compress and honey-memory to run bin/check.js');
      for (const s of users) {
        const checker = path.join(skillsDir(tmp), s, 'check.js');
        assert.ok(fs.existsSync(checker), `missing ${checker}`);
        const a = path.join(tmp, 'a.md');
        const b = path.join(tmp, 'b.md');
        fs.writeFileSync(a, 'Never run `rm -rf` on 3 hosts, see https://x.io. Some wordy filler text here.\n');
        fs.writeFileSync(b, 'Never run `rm -rf` on 3 hosts, see https://x.io.\n');
        cp.execFileSync(process.execPath, [checker, 'fidelity', a, b], { stdio: 'pipe' });
      }
      cp.execFileSync(process.execPath, [installer, '--uninstall', '--only', id], { env, stdio: 'pipe' });
      for (const s of users) assert.ok(!fs.existsSync(path.join(skillsDir(tmp), s)), `${s} left behind`);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
}
