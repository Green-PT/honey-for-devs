---
name: honey-memory
description: >-
  Create and maintain one committed per-project memory file (PROJECT.md) so
  agents stop re-discovering the same facts every cold session. Stores only the
  stable, expensive-to-rediscover, not-in-the-code context — architecture +
  why, build/test/run commands, decisions and dead-ends — as human-readable
  markdown, versioned with the code so it can't silently rot. Use when asked to
  set up project memory/context, stop agents re-grepping the codebase, scaffold
  or refresh a PROJECT.md / CLAUDE.md memory section, or cut cold-start
  rediscovery cost. Prose context only — never code, config, or data.
license: MIT
---

# Honey Memory

Lever 2 applied to discovery cost. Every cold session re-greps the same things —
where auth lives, the build command, *why* X is shaped Y. One committed file
replaces N rediscovery round-trips with a single cached read, on every future
session. The cheapest token is the one not re-derived.

The win is per-session and recurring. The risk is staleness — a wrong cached
fact costs *more* than no file. So the file lives in git, next to the code that
can invalidate it, and is fixed in the same change that breaks it.

## Scaffold (create)

1. **One file per repo: `PROJECT.md` at the root**, committed (not `~/.claude`).
   If the repo already has `CLAUDE.md`/`AGENTS.md`, add/refresh a `## Memory`
   section there instead — don't add a second file.
2. **Back up before overwriting** an existing file: copy → `FILE.original.md`.
   If that backup already exists, stop and ask. Never clobber a restore point.
3. **Write only three kinds of fact** (derive by reading the repo):
   - **Architecture + conventions** an agent can't cheaply grep — where things
     live, and *why* (the intent, not the file list).
   - **Build / test / run** commands, env, and gotchas.
   - **Decisions and dead-ends** — choices made, paths tried and rejected. This
     is intent; it is never in the code.
4. **Report** what was written and the file path.

## Never store

- Anything **derivable from source** — code structure, symbol locations, past
  fixes, git history. Re-deriving is cheaper than maintaining, and never stale.
- **Secrets, tokens, credentials.** The file is committed.
- Transient state — open TODOs, this-week status. That rots fastest.

If a fact is stable + expensive-to-rediscover + not-in-the-code, write it.
Everything else, let agents derive on demand — caching it is where these
systems quietly lose money.

## Update

A markdown file does not update itself. Reliability = discipline, not infra:

- **Same-change rule (primary).** When code changes invalidate a fact, fix the
  fact in the same commit. Review catches drift because the file is in git.
- **On-demand refresh.** Re-read the repo and rewrite stale entries; show the
  diff. Don't blind-append — appending is how these files bloat and rot.
- Treat a fact as **superseded**, not accumulated: replace the old line, don't
  stack a new one beside it.

## One file vs many

Start with **one file**. Split only when it crosses ~150–200 lines or covers
clearly separable domains — then go to a thin index + topic files loaded on
demand. Below that, an index costs more (the always-loaded tax) than it saves.

## Keep terse

Apply Honey Lever 2 to the content — fragments over paragraphs, no narration of
what the code already says. A bloated memory file is a per-session input tax.
Keep it human-readable markdown: you (and reviewers) hand-edit it, so don't use
a wire format — staleness costs more than the tokens a dense format would save.

## Boundaries

Reversible — `FILE.original.md` is the restore path when overwriting. Verify
every written fact against the current code before reporting done; an unverified
fact is worse than an absent one.
