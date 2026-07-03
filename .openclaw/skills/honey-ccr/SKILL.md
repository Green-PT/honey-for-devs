---
name: honey-ccr
description: "Compress-Cache-Retrieve huge repetitive array tool output before it hits context: keep a sample, cache the rest, leave a hash."
homepage: https://github.com/Green-PT/honey-for-devs
license: MIT
---

# Honey CCR

The cheapest token is the one not sent. A 500-row log read for one error line
costs 500 rows of context. CCR keeps the rows that carry signal and caches the
rest — recoverable by hash, so nothing is lost.

Borrowed from headroom's SmartCrusher. **Lossy by design** — only for data you
skim, never for payloads where every row matters (e.g. a code-review handoff
where the implementer needs all findings; use `eson encode` losslessly there).

## When to use

- A tool returns a **uniform JSON array** of many records (≥ ~5 items, redundant).
- You need to read it but mostly skim — logs, search hits, metrics, events.
- The full data stays reachable, so dropping the boring middle is safe.

## Don't use

- Small arrays (passes through untouched anyway) or non-array data.
- Any array where every element is load-bearing — encode it, don't crush it.

## How

```sh
tool-that-spews-json | eson crush          # → sampled view + sentinel; originals cached
eson retrieve <hash>                        # → the full original array, verbatim
```

`crush` prints the kept sample plus a sentinel
`{"_ccr":"<<ccr:HASH N_rows_offloaded>>"}`. When you need a dropped row, read the
hash from the sentinel and run `eson retrieve <hash>`.

- Cache dir: `.honey-ccr/` (override with `HONEY_CCR_DIR`).
- Below the size gate, `crush` returns the array unchanged with no sentinel — safe to pipe anything.
