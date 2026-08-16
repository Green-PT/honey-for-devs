#!/usr/bin/env node
// Generate the Hermes Agent skill package (.hermes/skills/) from the canonical
// skills/. Hermes (NousResearch/hermes-agent) reads the portable SKILL.md
// standard from ~/.hermes/skills/, requiring `name`, `description`, `version`
// frontmatter with descriptions kept to one line under 60 chars. The body is
// copied verbatim from skills/<name>/SKILL.md (via build-openclaw-skills) so the
// ruleset never drifts; only the frontmatter is rewritten.
//
// Run:  node scripts/build-hermes-skills.js
// tests/hermes-skills.test.js fails if the committed copies are stale.

const fs = require('fs');
const path = require('path');
const { NAMES, sourceBody } = require('./build-openclaw-skills');

const ROOT = path.join(__dirname, '..');
const VERSION = require('../package.json').version;

const HERMES_DESCRIPTIONS = {
  'honey': 'Write less code and say less about it. Cuts token cost.',
  'honey-review': 'Review a diff for over-engineering; terse delete-list.',
  'honey-design': 'Same pixels, fewer tokens: dense CSS for user-facing UI.',
  'honey-gain': 'Honey benchmark scoreboard vs baseline and rival skills.',
  'honey-debt': 'Harvest honey shortcut markers into a debt ledger.',
  'honey-eco': 'Report session token and CO2 savings vs no-Honey baseline.',
  'honey-ccr': 'Compress-cache-retrieve huge array tool output.',
  'honey-px': 'Read huge read-only text as PNG pages; big input cut.',
  'honey-compress': 'Rewrite context files terse to cut per-session tokens.',
  'honey-hive': 'Delegate search/review to subagents; compressed returns.',
  'honey-memory': 'Per-project persistent memory files indexed in MEMORY.md.',
  'honey-loop': 'Cost discipline for recurring loop runs.',
  'honey-superpowers': 'Inject Honey levers into dispatched subagent prompts.',
};

function render(name) {
  const desc = HERMES_DESCRIPTIONS[name];
  if (!desc) throw new Error(`no Hermes description for ${name}`);
  if (desc.length > 60 || desc.includes('\n') || desc.includes('"')) {
    throw new Error(`description for ${name} must be one line, no quotes, under 60 chars`);
  }
  const frontmatter =
    `---\nname: ${name}\ndescription: "${desc}"\nversion: ${VERSION}\n` +
    `author: GreenPT\nlicense: MIT\nmetadata:\n  hermes:\n    tags: [token-efficiency, coding]\n---\n`;
  return frontmatter + sourceBody(name);
}

function outPath(name) {
  return path.join(ROOT, '.hermes', 'skills', name, 'SKILL.md');
}

module.exports = { HERMES_DESCRIPTIONS, NAMES, render, outPath };

if (require.main === module) {
  for (const name of NAMES) {
    const p = outPath(name);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, render(name));
    console.log('wrote', path.relative(ROOT, p).replace(/\\/g, '/'));
  }
}
