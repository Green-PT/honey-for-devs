---
name: honey-compress
description: "Rewrite context files terse to cut per-session tokens."
version: 1.4.0
author: GreenPT
license: MIT
metadata:
  hermes:
    tags: [token-efficiency, coding]
---

# Honey Compress

Apply Lever 2 to a file the agent re-reads every session. The cheapest token is the one not re-sent — a one-time rewrite that saves on every future load.

## Do

1. **Back up first.** Copy `FILE` → `FILE.original.md`. If that backup already exists, stop and ask — never clobber a restore point. If no backup can be written, refuse.
2. **Rewrite the prose tersely** — drop wind-up, hedging, narration, and redundancy; fragments over paragraphs; merge guidance that repeats.
3. **Preserve every distinct instruction** — terser words, identical rules. If unsure whether a line changes behavior, keep it verbatim.
4. **Verify, then keep or undo.** Run `node "${CLAUDE_PLUGIN_ROOT}/bin/check.js" fidelity FILE.original.md FILE`.
   It fails if any number, code span, URL, negation or safety word was lost, or if the
   file didn't get smaller. On a failure, fix the named loss, or restore the backup
   (`cp FILE.original.md FILE`) when the fix would cost the savings. Never report a
   failing rewrite as done.
   (If `CLAUDE_PLUGIN_ROOT` is unexpanded, `bin/check.js` lives at the plugin root, two directories above this file; a skills-only install (Hermes, OpenCode) puts it next to this file as `check.js`; installed from npm it is `honey-check`.)
5. **Report** original vs new byte count (the check prints it) and the backup path.

## Keep exact — never compress

- Code blocks, commands, paths, identifiers, versions.
- Any **load-bearing directive** — MUST/NEVER rules, and anything touching auth, secrets, money, migrations, or deletes. Compressing an instruction that changes behavior moves cost, it doesn't remove it.

## Don't

- Don't touch code, config, or data files — prose context only.
- Don't merge two rules into one if they differ in effect.
- Don't compress a file you can't back up.

## Boundaries

Reversible by design — `FILE.original.md` is the restore path. The fidelity check is the floor, not the ceiling: it catches lost facts, not a reworded rule that changed meaning, so still read the diff.
