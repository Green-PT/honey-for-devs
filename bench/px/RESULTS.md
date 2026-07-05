# PX benchmark — text vs image tokens (`npm run bench:px`)

The honey-px read path: render dense read-only bulk to PNG pages
(pxpipe `renderTextToImages`, reflow — the same renderer `pxpipe export` uses)
and `Read` the images. Image tokens estimated with Anthropic's pixel formula
`ceil(w×h/750)`; text tokens with the same tokenizer pair as every other bench
here. Estimates, not billed usage — no API key run.

## Tokens (2026-07-04, pxpipe-proxy 0.8.0)

| corpus | chars | chars/tok | text tok (claude) | text tok (o200k) | pages | img tok (est) | saved |
|---|---:|---:|---:|---:|---:|---:|---:|
| dense JS (bin/eso.js) | 2,853 | 3.18 | 898 | 783 | 1 | 184 | **80%** |
| dense JS (eso/index.js) | 7,250 | 3.42 | 2,122 | 1,902 | 1 | 419 | **80%** |
| dense JSON (dict_array_100) | 13,734 | 3.15 | 4,355 | 4,986 | 1 | 770 | **82%** |
| dense JSON (time_series_50) | 8,991 | 2.68 | 3,360 | 3,765 | 1 | 502 | **85%** |
| md prose (skills/honey/SKILL.md) | 9,998 | 3.69 | 2,713 | 2,527 | 1 | 569 | **79%** |
| md prose (README.md) | 20,171 | 3.44 | 5,857 | 5,364 | 1 | 1,104 | **81%** |
| repo slab (eso/*.js joined) | 22,468 | 3.17 | 7,094 | 6,416 | 1 | 1,238 | **83%** |
| **TOTAL** | | | **26,399** | | | **4,786** | **82%** |

Wins shrink as chars/token rises (image cost is fixed by pixels); on this corpus
even markdown prose clears the bar. README render dropped 10 glyphs (emoji not
in the atlas) — another silent-loss channel to know about.

## Read-back check (in-session, Fable 5 — small n, self-scored)

Protocol: `pxpipe export` on eso/index.js + time_series_50 fixture (16,309
chars → 1 page, 994 img tok vs 4,408 text, −77.5%). The agent read ONLY the
PNG (neither file previously read as text in the session), stated concrete
facts, then grep-verified each against the source.

**14 claims → 12 correct, 2 wrong.** Correct: `!eson/1` header const, five
exact error strings (incl. `Section ${name} expected ${fields.length} cells,
got ${cells.length}`), all five config values from the JSON
(`min_items_to_analyze: 5`, `similarity_threshold: 0.8`, `last_fraction:
0.15`, …), `"transform": "smart_crusher"`, host-0/1/2 values.

**Both misses were long byte-exact strings, and both were silent
confabulations, not "can't read":**

- NAME regex read as `[A-Za-z0-9_-]` — actual `[A-Za-z0-9_.-]` (missed the `.`)
- timestamp offset read as `…020402400:00` — actual `…020402+00:00`

That is precisely pxpipe's documented failure mode (their blind-read audit:
~63% on dense identifiers) and why the skill's guards exist: never for files
you'll `Edit`, never trust an exact string seen only in an image — `Grep` it
first; `factsheet.txt` carries precision tokens as text.

## Ultra-flow micro-bench (in-session, Fable 5 — n=1 file)

The full `honey ultra` PX flow on one qualifying read (eso/index.test.js,
8,091 chars, never read as text in the session), both arms in claude tokens:

| arm | cost |
|---|---:|
| text `Read` | 2,714 |
| PX: `page-001.png` (1568×216 → 452) + `factsheet.txt` (124) + export report (~90) | **~666 (−75%)** |

Read-back: **9/10 grep-verified claims** — exact test name
(`preserves integers beyond Number.MAX_SAFE_INTEGER as BigInt`), the
`9007199254740993n` BigInt, `/Invalid ESON name|number/` regexes, the
`i < 5000` loop, the CLI `execFileSync(process.execPath, [cli, "encode"], …)`
shape. The miss is the sharpest confabulation example so far: the PRNG line
was read as the classic LCG `seed = (seed * 9301 + 49297) % 233280` — the file
actually uses **xorshift** (`seed ^= seed << 13; …`, seed `0x2545f491`); the
LCG constants appear nowhere in it. The reader pattern-matched "seed math" to
famous constants and invented them. Gist held; a specific line was silently
replaced by a plausible one — exactly why ultra's PX bullet requires
`Grep`-verifying any exact string before acting on it.

## Verdict

- **Token axis: real and large** (−79…85% here; pxpipe's own end-to-end
  measured bill cut is 59–70% — smaller because most requests aren't imaged).
- **Quality axis: gist-safe, byte-unsafe.** Comprehension of structure, error
  strings, and config values held; long identifiers corrupted silently at
  ~2/14 in this tiny sample.
- Not comparable to the lossless ESON/TOON deltas — different axis. PX sits
  beside CCR in the lossy tier: CCR drops rows recoverably, PX keeps all
  content in view at pixel prices with byte-exactness risk.
- Live multi-model panel below (was open; closed 2026-07-05).

## Live comprehension panel (2026-07-05, `node bench/px/comprehension.mjs`)

One corpus (eso/index.test.js), 10 questions with byte-exact expected answers,
normalized exact-match scoring — the deliberately adversarial axis, since
byte-exact recall is where PX is weakest. Image arm = pxpipe instruction
banner + PNG pages, **no factsheet** (answers must come from pixels).

| model | text arm | image arm | image-arm failure flavor |
|---|---:|---:|---|
| claude-fable-5 | 10/10 | **7/10** | test-name paraphrase, `5000`→`2000`, path |
| claude-opus-4-8 | 10/10 | 4/10 | seed confabulated `0x2565f9e1` (actual `0x2545f491`) |
| claude-sonnet-4-6 | 10/10 | 4/10 | `5000`→`42`; "Invalid JSON name" |
| claude-haiku-4-5-20251001 | 10/10 | 1/10 | invented `0x9e3779b9` (golden-ratio constant — not in file) |

Reading: every model is perfect from text; only Fable is usable from pixels,
and even Fable is **not byte-safe** (7/10 on adversarial exact-string probes —
consistent with pxpipe's 13/15 hex recall and their legibility audit). This
confirms the Fable-only guard, and that `factsheet.txt` — which carries
exactly these values as text — is load-bearing, not decorative. Misses are
plausible inventions, never "can't read".

**Refusal finding (API path):** claude-fable-5's safety layer refuses dense
renders depending on framing — a naked render with no context, or a user-voice
preface calling it a "dense PNG render", drew 3/3 `stop_reason: refusal`;
prepending pxpipe's own `prompt.txt` instruction banner resolved it (residual
refusals ~1-2/3 attempts, retried). **When passing PX renders over the raw
API, always include the export's `prompt.txt` banner.** In-harness (Claude
Code `Read` tool) no refusal was ever observed in this session's checks.
