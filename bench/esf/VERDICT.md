# Agent-to-Agent Structured Output: Verdict

Goal: find the best **token efficiency × comprehension quality** structure for agent-to-agent
messages. Measured deterministically (tokens, losslessness) and empirically (model accuracy).

## Efficiency — 5 handoff documents, o200k tokens (`npm run bench:formats`)

| Format | Valid JSON? | vs compact JSON |
|---|:--:|---:|
| JSON (pretty) | yes | **+55%** ← models' default; the real waste |
| JSON (compact) | yes | 0% |
| TOON | no | −20% |
| JSON (columnar) | yes | −22% |
| ESF | no | **−28%** |

## Quality — model comprehension (`bench/esf/comprehension*.mjs`)

Claude Haiku 4.5 + GPT-4.1-mini, 3 repeats. Accuracy by access pattern, 50-record doc:

| Probe (access pattern) | JSON | columnar | TOON | ESF | Verdict |
|---|---:|---:|---:|---:|---|
| key-lookup (find by field, read field) | 100% | 100% | 100% | 100% | **tie** |
| column-match (filter row, read other col) | 100% | 100% | 100% | 100% | **tie** |
| nested-cell (reach into nested object) | 100% | 100% | 100% | 100% | **tie** — incl. ESF JSON-cells |
| nested-array (indexed array element) | 100% | 100% | 100% | 100% | **tie** |
| deep-index (the *Nth* row by position) | 17% | 8% | 8% | 8% | all fail — model limit |
| aggregate (count matching rows) | 42% | 50% | 75% | 50% | all noisy — model limit |

On a small doc, **all formats scored 100%** (saturated).

## Conclusions

1. **Quality is not a format differentiator for realistic access.** Every format reads at
   100% for key-lookup, field-match, and nested extraction — the patterns agents actually
   use. ESF's compact JSON cells did **not** hurt comprehension; the feared weakness is real
   only in theory.
2. **The only failures are model limitations, format-independent.** Positional "Nth item"
   access and counting-across-rows fail in *every* format (including plain JSON). Do not
   design agent messages that depend on either — use stable keys, not ordinals.
3. **Since quality ties, optimize tokens.** That makes **ESF** the efficiency winner
   (−28%, no measured quality cost) and **columnar JSON** the best *quality-adjusted* pick
   (−22% while staying valid JSON: every model and stdlib parses it, nothing new to teach).
4. **TOON is not worth choosing:** it ties columnar JSON on tokens but isn't valid JSON, so
   it carries format-novelty risk for no efficiency gain.
5. **Biggest practical win for most teams:** stop emitting pretty-printed JSON (+55%). Going
   compact is free; going columnar/ESF adds ~20–28% on top.

## The one fixable gap: number your rows (`bench/esf/indexing.mjs`)

Positional access ("the Nth row") fails in every plain format (8–25%). Adding an explicit
1-based `n` column fixes it outright, for ~+6–9% tokens:

| Variant | vs JSON | deep-index (positional) | count-total | count-match (filtered) | key-lookup |
|---|---:|---:|---:|---:|---:|
| ESF | −35% | 17% | 100% | unreliable | 100% |
| **ESF+n** | **−29%** | **100%** | 100% | unreliable | 100% |
| columnar | −26% | 25% | 100% | unreliable | 100% |
| **columnar+n** | **−20%** | **100%** | 100% | unreliable | 100% |

Numbering does **not** fix `count-match` (count rows matching a filter): that is an
irreducible model weakness in *every* structure — offload such counts to code, never ask
the model to tally rows.

## Validation: frontier models + primer cost

**Frontier models (Claude Sonnet 4.6 + GPT-4.1).** Conclusions hold: key-lookup 100% for
all formats; `+n` lifts positional access to 100% while un-numbered JSON/columnar stay at
0% (model strength alone does not fix positional access — the structure must). `count-match`
is **0% even on frontier models** — filtered counting is irreducible; do it in code.

**Primer cost (`bench/esf/primer-cost.mjs`).** ESF's token win excludes the cost of teaching
the model the format. Minimal primers: JSON 0 tok, columnar 50 tok, ESF 126 tok (ESF +76).
Average ESF saving over columnar is 66 tok/msg — but carried almost entirely by large record
arrays (+203 on 100 findings; scalar envelopes are −4, i.e. ESF *loses*). Break-even vs
columnar: **~2 messages with prompt caching, never without caching, never for scalar-heavy
traffic.** ESF's net advantage is real only for high-volume, cached, record-array-heavy pipes.

## Recommendation

- **Best general-purpose structure: `ESF+n`** — −29% tokens and 100% on every access pattern
  except filtered-counting. It beats un-numbered columnar JSON on *both* tokens and robustness.
- **Best valid-JSON option: `columnar+n`** (−20%) — same robustness, parseable by any stdlib.
- **Pure key-lookup pipelines** (no positional/ordinal access): drop the `n` column —
  **ESF** (−35%) or **columnar JSON** (−26%).
- **Always:** compact (never pretty, +55%); address records by stable key; do filtered
  counts/aggregates in code, not in the model.

Caveats: two small/cheap models, deterministic synthetic corpus. Re-run with your own
models and payloads via `ESF_MODELS=… node bench/esf/indexing.mjs`.
