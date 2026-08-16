---
name: honey-review
description: "Review a diff for over-engineering and verbosity. Terse delete-list of what to cut and the lines each saves. One-shot."
homepage: https://github.com/Green-PT/honey-for-devs
license: MIT
---

# Honey Review

Read the diff (`git diff` or the named range). Report only what to **cut** and why — the reverse of Honey's two write-levers.

## Find

- **Over-engineering** (Lever 1) — code that needn't exist: speculative params, "might need it later" branches, single-caller abstractions, hand-rolled `itertools`/`pathlib`/`datetime`, a new dependency for four lines, a reimplemented existing util.
- **Over-verbosity** (Lever 2) — dead code, commented-out blocks, comments narrating what the code already says, redundant scaffolding.

## Never flag (the carve-out is load-bearing)

Input validation, error handling, auth, secrets handling, accessibility basics, and visual/UX polish on user-facing deliverables are **not** bloat. A test or assert proving non-trivial logic is **not** bloat. Don't suggest cutting them.

## Output — delete-list, one line per finding

```
path:line — cut <what>; <one-clause why> (−N lines)
```

- Ordered by lines saved, deepest first.
- End with one total line: `Total: −N lines across M findings.`
- Nothing to cut → say so in one line. Don't manufacture findings.
- Terse but human-readable (this is for a person, not an agent — that's `hive-reviewer`'s job).

Example:

```
src/util.py:12 — cut hand-rolled flatten; stdlib itertools.chain.from_iterable does it (−9 lines)
src/api.js:40 — cut unused `opts` param; no caller passes it (−3 lines)
Total: −12 lines across 2 findings.
```
