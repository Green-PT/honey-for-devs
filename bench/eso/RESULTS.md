# ESO vs TOON vs JSON

Generated 2026-06-21 with Node v22.13.0 on Apple M4 Pro.
All inputs round-tripped losslessly before measurement.

## Total Size

| Format | Bytes | vs JSON | o200k tokens | vs JSON | Claude tokens* | vs JSON |
|---|---:|---:|---:|---:|---:|---:|
| JSON | 17845 | 0% | 4395 | 0% | 4537 | 0% |
| TOON | 12711 | -29% | 3527 | -20% | 3485 | -23% |
| ESO | 11993 | -33% | 3156 | -28% | 3362 | -26% |

## Per Dataset

| Dataset | Format | Bytes | o200k tokens | Claude tokens* |
|---|---|---:|---:|---:|
| small review | JSON | 473 | 125 | 126 |
| small review | TOON | 370 | 111 | 113 |
| small review | ESO | 356 | 107 | 117 |
| large review | JSON | 11609 | 2931 | 3029 |
| large review | TOON | 7725 | 2235 | 2238 |
| large review | ESO | 7328 | 2041 | 2145 |
| scalar envelope | JSON | 148 | 37 | 38 |
| scalar envelope | TOON | 129 | 36 | 36 |
| scalar envelope | ESO | 130 | 41 | 43 |
| nested context | JSON | 976 | 281 | 296 |
| nested context | TOON | 1025 | 341 | 315 |
| nested context | ESO | 763 | 233 | 266 |
| tool results | JSON | 4639 | 1021 | 1048 |
| tool results | TOON | 3462 | 804 | 783 |
| tool results | ESO | 3416 | 734 | 791 |

## Codec Speed

Equal-weight mean across the five documents; median of five warmed rounds. Lower is better.

| Format | Encode µs/document | Decode µs/document |
|---|---:|---:|
| JSON | 5.28 | 7.36 |
| TOON | 36.87 | 101.01 |
| ESO | 17.96 | 21.82 |

## Reading the Result

- ESO used 28% fewer o200k tokens than JSON and 11% fewer than TOON over this corpus.
- Compact JSON won codec speed and the scalar-only case.
- ESO beat TOON on codec speed here. Its nested-context size advantage comes from
  compact JSON cells; this benchmark does not test whether models understand those
  cells as reliably as TOON's expanded nesting.

## Method

- JSON: compact `JSON.stringify` / `JSON.parse`.
- TOON: `@toon-format/toon@2.3.0`, default settings.
- ESO: local `!eso/1` codec.
- OpenAI count: `gpt-tokenizer@3.4.0`, `o200k_base`.
- Claude count: `@anthropic-ai/tokenizer@0.0.4`.
- Five deterministic agent-handoff shapes: small/large reviews, scalar envelope,
  nested context, and uniform tool results. Run with `npm run bench:eso`.

* Anthropic labels its tokenizer beta; it predates current Claude tokenizers. Treat
this column as a legacy estimate, not an exact count for current Claude models.
Token count alone does not measure model comprehension or task accuracy.
