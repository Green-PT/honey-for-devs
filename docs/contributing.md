# Contributing

## How it stays in sync

The skill is authored **once** in [`skills/honey/SKILL.md`](../skills/honey/SKILL.md).
Every per-platform rule file (and `AGENTS.md`) is generated from it:

```bash
node scripts/build-rules.js          # regenerate all rule files
node scripts/build-rules.js --check  # CI: fail if any copy drifted
```

The OpenClaw (`.openclaw/skills/`) and Hermes (`.hermes/skills/`) skill packages
are generated the same way from `skills/`; rerun
`node scripts/build-openclaw-skills.js` / `node scripts/build-hermes-skills.js`
after changing a skill. `tests/openclaw-skills.test.js` and
`tests/hermes-skills.test.js` fail if a committed copy is stale. The Hermes generator
also writes the Hermes plugin's `.hermes/plugin.yaml`, `.hermes/COMPACT.md` and
`.hermes/bin/check.js`; `.hermes/__init__.py` is hand-written and
`tests/hermes-plugin.test.js` checks both.
