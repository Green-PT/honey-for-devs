---
name: honey-px
description: >-
  Read huge, dense, read-only text as rendered PNG pages instead of raw text —
  image tokens scale with pixels, not characters, so token-dense bulk (big
  files, vendored code, diffs, logs) costs ~60–75% less as an image. Use when
  you must skim or reason over thousands of lines you will NOT edit or
  byte-copy. Lossy on exact strings: never for files you'll Edit, secrets,
  hashes, or byte-exact values. Fable-class readers only.
license: MIT
---

# Honey PX

An image's token cost is fixed by its pixel area, not its character count.
Dense text packs ~3 chars per image-token vs ~1 as text, so a 90k-char file
read as PNG pages costs a fraction of the text read. `pxpipe export`
(teamchong/pxpipe) does the rendering; the agent `Read`s the pages.

**Lossy by design** — misreads of exact strings are *silent confabulations*,
not errors. The export writes a `factsheet.txt` carrying the verbatim
precision tokens (paths, SHAs, ids, numbers) as text alongside the images;
always read it too.

## When to use

- Bulk is **read-only reference**: skimming a big vendored file, a large diff
  for review context, docs, generated code — content you reason over, not
  byte-copy.
- **Dense** (code, JSON, logs) and **big** — worth it above ~6k chars; the
  export prints `% saved`, skip if it's low. Sparse prose loses money.
- The reader is **Fable-class**. Opus misreads ~7% of renders; other models
  degrade — read as text there.

## Don't use

- Files you will **Edit** — `old_string` must be byte-exact; imaged reads
  aren't. Read the real file (with `offset`/`limit`) before any edit.
- **Secrets, hashes, ids, numeric values you'll act on** — treat anything
  exact recalled from an image as unverified; re-`Grep` the source first.
- Anything the user asked to see verbatim, or that gets written back.
- Small or sparse content — the fixed pixel cost loses.

## How

```sh
npx pxpipe-proxy export --json --out <scratchpad> <file-or-dir>   # or --git / --diff <ref> / --stdin
```

Output dir `pxpipe-export-<hash>/` contains `page-*.png`, `factsheet.txt`,
`manifest.json` (token report). Then:

1. `Read` every `page-*.png` **and** `factsheet.txt`. If instead you pass the
   renders to a model over the raw API (subagent prompt, panel), include the
   export's `prompt.txt` banner — naked dense renders can trip
   `stop_reason: refusal` on Fable-class models; the banner prevents it.
2. Treat the manifest's `percentSaved` as the go/no-go — if it printed low,
   read the text instead.
3. Before acting on any exact string seen only in an image, verify it against
   the source with `Grep`.

Cheaper still is not reading at all — `Grep`/`offset`/`limit` (Lever 3b) and
`eson crush` (CCR) come first. PX is for when you genuinely need the whole
bulk in view.
