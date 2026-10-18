---
name: honey-debt
description: "Harvest honey shortcut markers into a debt ledger."
version: 1.3.1
author: GreenPT
license: MIT
metadata:
  hermes:
    tags: [token-efficiency, coding]
---

# Honey Debt

Lever 1 trades code for a known ceiling. That trade is only honest if someone can
see it later. Every deliberate simplification carries a `shortcut:` comment naming its
ceiling and the trigger to revisit; this collects them into one ledger. Older code
may carry the previous `honey:` prefix — same convention, harvest both.

## Scan

```bash
P='(#|//|--|/\*) ?(shortcut|honey):'
if git rev-parse --git-dir >/dev/null 2>&1; then git grep --untracked -nE "$P"
else grep -rnE "$P" . --exclude-dir={node_modules,.git,dist,build,vendor}; fi
```

Each hit is one row. `git grep` skips everything gitignored. The comment prefix is
what keeps prose that merely mentions the convention out of the ledger.

## Output

One row per marker, grouped by file:

`<file>:<line> — <what was simplified>. ceiling: <the limit>. trigger: <when to revisit>.`

The convention is `shortcut: <ceiling>, <trigger>`, so both fields come straight from
the comment. Add `git blame -L<line>,<line> -- <file>` per row only if the user asks
who owns it.

Tag any marker with no trigger `no-trigger` — a ceiling without a revisit condition
is the shape that rots. End with:

`<N> markers, <M> with no trigger.`

Nothing found: `No shortcut debt. Clean ledger.`

## Boundaries

- **Report only.** Don't fix, refactor, or remove markers — the user decides what to
  pay down. Offer, don't act.
- **Don't invent debt.** A `TODO`/`FIXME` is not a `shortcut:` marker; mention the count
  separately at most once if it's large, don't fold it into the ledger.
- **Don't editorialise per row.** The ledger is data. Save any judgement for one
  closing line, and only if something is genuinely alarming.
