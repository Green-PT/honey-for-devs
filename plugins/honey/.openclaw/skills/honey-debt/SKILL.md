---
name: honey-debt
description: "Harvest every `honey:` shortcut marker into a debt ledger, flagging the ones with no revisit trigger. One-shot report, changes nothing."
homepage: https://github.com/Green-PT/honey-for-devs
license: MIT
---

# Honey Debt

Lever 1 trades code for a known ceiling. That trade is only honest if someone can
see it later. Every deliberate simplification carries a `honey:` comment naming its
ceiling and the trigger to revisit; this collects them into one ledger.

## Scan

```bash
grep -rnE '(#|//|--|/\*) ?honey:' . --exclude-dir={node_modules,.git,dist,build,vendor}
```

Each hit is one row. The comment prefix is what keeps prose that merely mentions the
convention out of the ledger.

## Output

One row per marker, grouped by file:

`<file>:<line> — <what was simplified>. ceiling: <the limit>. trigger: <when to revisit>.`

The convention is `honey: <ceiling>, <trigger>`, so both fields come straight from
the comment. Add `git blame -L<line>,<line> -- <file>` per row only if the user asks
who owns it.

Tag any marker with no trigger `no-trigger` — a ceiling without a revisit condition
is the shape that rots. End with:

`<N> markers, <M> with no trigger.`

Nothing found: `No honey: debt. Clean ledger.`

## Boundaries

- **Report only.** Don't fix, refactor, or remove markers — the user decides what to
  pay down. Offer, don't act.
- **Don't invent debt.** A `TODO`/`FIXME` is not a `honey:` marker; mention the count
  separately at most once if it's large, don't fold it into the ledger.
- **Don't editorialise per row.** The ledger is data. Save any judgement for one
  closing line, and only if something is genuinely alarming.
