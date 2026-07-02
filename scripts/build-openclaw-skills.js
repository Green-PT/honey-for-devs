#!/usr/bin/env node
// Generate the OpenClaw / ClawHub skill package (.openclaw/skills/) from the
// canonical skills/. OpenClaw skills are SKILL.md (frontmatter + body), the same
// format Honey already uses, with one difference: `description` must be a single
// line under 160 chars. The canonical descriptions are long (tuned for Claude's
// skill picker), so each ships a short one here. The body is copied verbatim from
// skills/<name>/SKILL.md so the ruleset never drifts; only the frontmatter is
// rewritten.
//
// Run:  node scripts/build-openclaw-skills.js
// tests/openclaw-skills.test.js fails if the committed copies are stale.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const HOMEPAGE = 'https://github.com/Green-PT/honey-for-devs';

const DESCRIPTIONS = {
  'honey': 'Write less code and say less about it: YAGNI, stdlib-first, terse prose. Cuts agent token cost on every coding and writing task.',
  'honey-review': 'Review a diff for over-engineering and verbosity. Terse delete-list of what to cut and the lines each saves. One-shot.',
  'honey-design': 'Same pixels, fewer tokens. For user-facing markup: keeps the full design, expresses it densely with CSS vars, shorthand, fluid units.',
  'honey-gain': "Show Honey's benchmark scoreboard: committed quality and token results per task tier vs Caveman, Ponytail, and no-skill. One-shot.",
  'honey-eco': "Report the session's Honey savings: output tokens, CO2, and CO2/$ saved vs a no-Honey baseline, via the committed EcoLogits port.",
  'honey-ccr': 'Compress-Cache-Retrieve huge repetitive array tool output before it hits context: keep a sample, cache the rest, leave a hash.',
  'honey-compress': 'Rewrite a memory or context file (CLAUDE.md, AGENTS.md, notes) into Honey-terse form to cut per-session input tokens. Backs up first.',
  'honey-hive': "Delegate search- and review-heavy work to Honey's read-only subagents so large reads return compressed instead of bloating context.",
  'honey-memory': 'Per-project persistent memory: save and recall durable facts across sessions as small frontmatter files, indexed in MEMORY.md.',
  'honey-loop': 'Cost discipline for recurring /loop runs: cache-aware pacing, event-driven-over-polling, no-change short-circuit, compact state handle, stop condition.',
  'honey-superpowers': 'Stack Honey onto Superpowers-style subagent workflows: dispatched subagents skip the session hook, so inject the levers into each dispatch prompt.',
};

const NAMES = Object.keys(DESCRIPTIONS);

function sourceBody(name) {
  const src = fs.readFileSync(path.join(ROOT, 'skills', name, 'SKILL.md'), 'utf8').replace(/\r\n/g, '\n');
  const fm = src.match(/^---\n[\s\S]*?\n---\n?/);
  if (!fm) throw new Error(`skills/${name}/SKILL.md has no frontmatter`);
  return src.slice(fm[0].length);
}

function render(name) {
  const desc = DESCRIPTIONS[name];
  if (desc.length > 160 || desc.includes('\n') || desc.includes('"')) {
    throw new Error(`description for ${name} must be one line, no quotes, under 160 chars`);
  }
  const frontmatter =
    `---\nname: ${name}\ndescription: "${desc}"\nhomepage: ${HOMEPAGE}\nlicense: MIT\n---\n`;
  return frontmatter + sourceBody(name);
}

function outPath(name) {
  return path.join(ROOT, '.openclaw', 'skills', name, 'SKILL.md');
}

module.exports = { DESCRIPTIONS, NAMES, render, outPath, sourceBody };

if (require.main === module) {
  for (const name of NAMES) {
    const p = outPath(name);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, render(name));
    console.log('wrote', path.relative(ROOT, p).replace(/\\/g, '/'));
  }
}
