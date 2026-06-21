# Headroom SmartCrusher — measured on honey's tokenizers

Generated 2026-06-21. o200k = gpt-tokenizer; Claude = @anthropic-ai/tokenizer.
SmartCrusher is LOSSY (drops rows → CCR cache). Deltas are NOT comparable to lossless TOON/ESF/columnar.

## Part A — real recorded Rust-core fixtures (input → crushed output)

| Fixture | in o200k | out o200k | Δ | crushed? |
|---|---:|---:|---:|:--:|
| empty_array | 1 | 1 | 0% | passthrough |
| non_json_passthrough | 6 | 6 | 0% | passthrough |
| short_array_passthrough | 9 | 7 | -22% | yes |
| nulls_and_bools | 15 | 9 | -40% | yes |
| small_object_passthrough | 18 | 13 | -28% | yes |
| mixed_array | 81 | 27 | -67% | yes |
| number_array_40_changepoint | 120 | 31 | -74% | yes |
| nested_3deep_with_array | 297 | 206 | -31% | yes |
| string_array_25 | 300 | 166 | -45% | yes |
| nested_object_with_array | 393 | 272 | -31% | yes |
| duplicate_dicts_40 | 441 | 36 | -92% | yes |
| dict_array_30 | 602 | 237 | -61% | yes |
| dict_array_30_bias_high | 602 | 237 | -61% | yes |
| dict_array_30_bias_low | 602 | 237 | -61% | yes |
| time_series_50 | 1152 | 853 | -26% | yes |
| unicode_dict_array | 1242 | 343 | -72% | yes |
| dict_array_100_sequential | 2002 | 238 | -88% | yes |
| **TOTAL** | **7883** | **2919** | **-63%** | (o200k) |
| **TOTAL** | **7305** | **3056** | **-58%** | (Claude) |

## Part B — modeled on the shootout corpus (only ≥5-item uniform arrays trigger)

| Dataset | items | compact JSON o200k | crushed o200k | Δ | rows dropped→CCR |
|---|---:|---:|---:|---:|---:|
| large review (100 findings) | 100 | 2903 | 461 | -84% | 85 |
| tool results (25 results) | 25 | 1002 | 626 | -38% | 10 |

The other 3 shootout datasets (small review=3 findings, scalar envelope, nested context) are **passthrough** — below the 5-item / 200-token gate.
