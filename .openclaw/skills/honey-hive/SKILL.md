---
name: honey-hive
description: "Delegate search- and review-heavy work to Honey's read-only subagents so large reads return compressed instead of bloating context."
homepage: https://github.com/Green-PT/honey-for-devs
license: MIT
---

# Honey Hive

Delegate the token-heavy reading; keep the thinking. A subagent's return is injected back into your context — Honey's hive returns it as a compressed Lever-3 handoff, so the most expensive tokens in an agentic session shrink ~25–55% with no loss the orchestrator can use.

## When to delegate (any one holds)

- **Search-heavy** — "where is X / who calls Y / find all Z" across many files → `hive-scout`.
- **Review-heavy** — review a diff or file set for bugs and bloat → `hive-reviewer`.
- **Context-preserving** — the read would dump many files into your context but you need only the conclusions.
- **Parallel** — independent locate/review jobs that can run at once.

## When NOT to (work inline)

- One known file, a trivial edit, or content you already have in context.
- Dispatch + return overhead would exceed just reading it yourself (a file or two).
- You need the full file body, not a map.

The crew is read-only by design — they locate and review; you decide and edit.

## The crew

| Agent | Does | Returns |
|-------|------|---------|
| `hive-scout` | locate symbols / callers / configs / patterns | compact id-keyed JSON map |
| `hive-reviewer` | review diff/files for bugs + over-engineering + verbosity | columnar id-keyed JSON findings |

## Reading a hive return (Lever 3, in reverse)

Every return is compact/columnar JSON, records addressed by a stable `id`, with an `n` count. Read it as data:

- **Address by `id`**, never "the 3rd finding" — ordinal lookup misparses, frontier models included.
- **Aggregate in code** — to count or filter, do it programmatically; don't eyeball rows.
- **Check `n`** against the rows you received — a dense misparse is silent.
- **Safety carve-out** — auth / money / migration / delete findings come back explicit, not slugged. Treat them verbatim.

ESON is opt-in: ask for it only on a high-volume, cached review pipe you own end-to-end.
