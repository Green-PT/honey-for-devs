# Input precompressor — results

Deterministic (no-model) compression of the **user prompt** before it reaches the LLM.
Strips filler / redundant whitespace / duplicate sentences from prose only; protected
spans (fenced code, inline code, URLs, paths, double-quoted strings) pass verbatim.

Source: [`hooks/precompress.js`](../../hooks/precompress.js) · CLI: [`hooks/precompress-cli.js`](../../hooks/precompress-cli.js)

## TL;DR — measured negative result

It's safe (35/35) and lossless (100%→100% on unit-tested tasks), and cuts 16.5% median on a
*hand-written verbose corpus*. **But on 266 real human-typed prompts from 35 actual sessions it
cuts 2.5% total / median 0%** — 219/266 compress to nothing. Real prompts are already terse;
the verbose corpus was built to contain exactly what the compressor removes. The prompt is the
wrong target — real input volume is tool output (CCR) and re-pasted cross-turn context. Kept as
a documented negative result.

## Real-traffic reality check

```
266 real human-typed prompts (35 transcripts, deduped)
total prompt tokens:        53,121
after precompress:          51,807   ->  total cut 2.5%
median per-prompt cut:      0.0%     (mean 2.5%)
prompts cutting ≥3%:        43/266   (16%)
prompts cutting 0%:         219/266
absolute tokens saved:      1,314    (across all 266)
```

The synthetic-corpus numbers below (16.5% median) are the *best case*, not the expected case.
Repro: `node bench/input/realcheck.mjs` (reads local Claude Code transcripts).

## Free gates (no API) — PASS

| Gate | Tool | Result |
|------|------|--------|
| Safety: protected spans + digits survive, idempotent | `node hooks/precompress.test.js` | **35/35 checks** |
| Input-token cut (real tokenizer, 20-prompt corpus) | `node bench/input/tokens.mjs` | **22.1% total · 16.5% median** |

Range 5–48% on verbose prompts; the 3 terse controls cut 0–16% — a clean technical prompt has
little to strip, so the compressor is inert where it should be (no risk on already-dense input).
The cut depends on how much filler the prompt carries: stacked politeness + exact-duplicate
sentences compress most; rambling backstory and semantic restatement (reworded, not repeated)
are the realistic floor a no-model pass can't reach.

## Quality gate (live) — PASS

`node bench/input/quality.mjs` runs each prompt **full** vs **compressed** through the model
and scores the OUTPUT two ways: the bench's **real unit-test grader** (`grade.js`, objective)
and a cross-family **judge panel** (each reply scored against the original prompt — any drop =
info lost in compression). All runs: `MODEL=claude-opus-4-8`, panel `claude-opus-4-8 + gpt-5.5`,
`RUNS=3`.

### Run A — 20-prompt verbose corpus (judge-only)

median cut **16.5%** · median judge **Δ +0** · worst judge drop **−15** (`verbose-bullets`).
Quality preserved on the median; the lone −15 is **verified judge noise** — inspecting the
compressed `verbose-bullets` prompt, every requirement (one `@`, dot after, boolean, stdlib
only, plus the restatement) survives; only politeness was stripped, so one panel member simply
scored the terser version lower.

> Corpus prompts are **judge-only** (`task: null`). An earlier version mapped them to graded
> tasks and the objective column read as a regression — but that was an **artifact**: paraphrased
> prompts omit each task's signature/export contract, so even the *uncompressed* terse controls
> grade ~0% (correct code the test can't `require`). The grader now runs only where the contract
> exists (Run B). Lesson baked into the harness: never grade a compressed prompt that didn't
> already carry the contract.

### Run B — padded real prompts (objective + judge signal) ✅

Each graded task's **real `prompt.md`** (carries the contract → grades green) wrapped in verbose
filler, then compressed. Both arms contain the contract; only the filler differs, so any
objective drop is real compression damage.

| task | cut | test_full | test_comp | judge Δ |
|------|----:|----------:|----------:|--------:|
| median-bugfix | 14% | 100% | 100% | +0 |
| slugify | 16% | 100% | 100% | −1 |
| csv-column-sum | 11% | 100% | 100% | −1.5 |
| flatten | 12% | 100% | 100% | +3.5 |
| deep-merge | 15% | 100% | 100% | +1 |
| format-bytes | 20% | 100% | 100% | −0.5 |
| retry-backoff | 13% | 100% | 100% | +0 |
| chunk | 10% | 100% | 100% | −1.5 |
| parse-query | 13% | 100% | 100% | +0.5 |
| interval-merge | 13% | 100% | 100% | −1 |

**median cut 13% · test-pass 100%→100% · median judge Δ −0.25 · worst −1.5** → compressing a
verbose prompt preserves both **objective correctness** (every unit test still passes) and
quality. This is the decisive result.

```bash
ANTHROPIC_API_KEY=sk-... OPENAI_API_KEY=sk-... \
  MODEL=claude-opus-4-8 JUDGE_MODELS=claude-opus-4-8,gpt-5.5 RUNS=3 \
  node bench/input/gen-padded.mjs && CORPUS=corpus-padded.json node bench/input/quality.mjs
```

## Honest limits

- 6-prompt corpus, hand-written verbose prompts — enough to see the effect, not a leaderboard.
- The token cut is real and model-independent; the **quality-preservation** claim is the one
  that needs the live gate above before it can be quoted.
- Single-quoted strings are **not** protected (apostrophe vs quote is undecidable
  deterministically); double-quotes, code, paths, URLs are.
