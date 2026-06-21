---
name: honey-compress
description: >-
  Rewrite a memory or context file (CLAUDE.md, AGENTS.md, a todo or notes file)
  into Honey-terse form so it costs fewer input tokens every session, without
  losing meaning. Backs up the original first. Use when asked to shrink or
  compress context files, trim CLAUDE.md, or cut per-session input cost. Prose
  only — never code, config, or data.
license: MIT
---

# Honey Compress

Apply Lever 2 to a file the agent re-reads every session. The cheapest token is the one not re-sent — a one-time rewrite that saves on every future load.

## Do

1. **Back up first.** Copy `FILE` → `FILE.original.md`. If that backup already exists, stop and ask — never clobber a restore point. If no backup can be written, refuse.
2. **Rewrite the prose tersely** — drop wind-up, hedging, narration, and redundancy; fragments over paragraphs; merge guidance that repeats.
3. **Preserve every distinct instruction** — terser words, identical rules. If unsure whether a line changes behavior, keep it verbatim.
4. **Report** original vs new line/byte count and the backup path.

## Keep exact — never compress

- Code blocks, commands, paths, identifiers, versions.
- Any **load-bearing directive** — MUST/NEVER rules, and anything touching auth, secrets, money, migrations, or deletes. Compressing an instruction that changes behavior moves cost, it doesn't remove it.

## Don't

- Don't touch code, config, or data files — prose context only.
- Don't merge two rules into one if they differ in effect.
- Don't compress a file you can't back up.

## Boundaries

Reversible by design — `FILE.original.md` is the restore path. Verify the rewrite still carries every rule before reporting done.
