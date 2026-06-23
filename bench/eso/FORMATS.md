# Agent-to-Agent Format Shootout

Generated 2026-06-23 with Node v22.13.0 on Apple M4 Pro.
All formats round-tripped losslessly before measurement. Lower tokens = cheaper; valid
JSON = no custom parser and lower comprehension risk. Token count is efficiency, not quality.

## Total (5 agent-handoff documents)

| Format | Valid JSON? | Bytes | o200k tokens | vs JSON | Claude tokens* | vs JSON |
|---|:--:|---:|---:|---:|---:|---:|
| JSON (compact) | yes | 17845 | 4395 | 0% | 4536 | 0% |
| JSON (pretty) | yes | 24385 | 6816 | +55% | 6702 | +48% |
| JSON (columnar) | yes | 13204 | 3440 | -22% | 3451 | -24% |
| TOON | no | 12711 | 3527 | -20% | 3484 | -23% |
| ESO | no | 11993 | 3151 | -28% | 3356 | -26% |

## Per Dataset (o200k tokens)

| Dataset | Format | Bytes | o200k tokens | vs JSON |
|---|---|---:|---:|---:|
| small review | JSON (compact) | 473 | 125 | 0% |
| small review | JSON (pretty) | 663 | 203 | +62% |
| small review | JSON (columnar) | 417 | 118 | -6% |
| small review | TOON | 370 | 111 | -11% |
| small review | ESO | 356 | 106 | -15% |
| large review | JSON (compact) | 11609 | 2931 | 0% |
| large review | JSON (pretty) | 15833 | 4547 | +55% |
| large review | JSON (columnar) | 8158 | 2244 | -23% |
| large review | TOON | 7725 | 2235 | -24% |
| large review | ESO | 7328 | 2040 | -30% |
| scalar envelope | JSON (compact) | 148 | 37 | 0% |
| scalar envelope | JSON (pretty) | 177 | 58 | +57% |
| scalar envelope | JSON (columnar) | 148 | 37 | 0% |
| scalar envelope | TOON | 129 | 36 | -3% |
| scalar envelope | ESO | 130 | 40 | +8% |
| nested context | JSON (compact) | 976 | 281 | 0% |
| nested context | JSON (pretty) | 1803 | 524 | +86% |
| nested context | JSON (columnar) | 836 | 254 | -10% |
| nested context | TOON | 1025 | 341 | +21% |
| nested context | ESO | 763 | 232 | -17% |
| tool results | JSON (compact) | 4639 | 1021 | 0% |
| tool results | JSON (pretty) | 5909 | 1484 | +45% |
| tool results | JSON (columnar) | 3645 | 787 | -23% |
| tool results | TOON | 3462 | 804 | -21% |
| tool results | ESO | 3416 | 733 | -28% |

## Reading the Result

- **JSON (pretty)** is the realistic baseline models emit unprompted — the most wasteful.
- **JSON (columnar)** keeps full JSON validity (every model + stdlib parses it) while
  deduping record keys. It captures most of the structural win with near-zero quality risk.
- **TOON / ESO** drop JSON punctuation too, so they edge columnar JSON on tokens, but
  require a custom parser and put comprehension at stake — the axis this size bench cannot
  measure. See `comprehension.mjs` (needs an API key) for that half.
- The efficiency gap between columnar JSON and ESO is the price of leaving JSON-land.
  If that gap is small, "just compress the JSON" may be the better quality-adjusted choice.

## Method

- TOON: `@toon-format/toon@2.3.0`. ESO: local `!eso/1` codec.
- Columnar JSON: uniform record arrays → `{"#c":[cols],"#r":[rows]}`, still valid JSON.
- OpenAI count: `gpt-tokenizer@3.4.0` o200k_base. Claude: `@anthropic-ai/tokenizer@0.0.4`.
- Run with `npm run bench:formats`.

* Anthropic's tokenizer is a legacy estimate, not an exact count for current Claude models.
