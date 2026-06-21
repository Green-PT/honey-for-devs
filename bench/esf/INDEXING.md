# Does numbering rows make a better structure?

Models: claude-sonnet-4-6, gpt-4.1 · 3 repeats · 50-record doc. `+n` = explicit position column.

| Variant | o200k tokens | vs JSON | Accuracy | deep-index | count-total | count-match | key-lookup |
|---|---:|---:|---:|---:|---:|---:|---:|
| JSON | 1671 | 0% | 30% | 0% | 50% | 0% | 100% |
| columnar | 1236 | -26% | 37% | 0% | 83% | 0% | 100% |
| columnar+n | 1338 | -20% | 80% | 100% | 100% | 0% | 100% |
| TOON | 1177 | -30% | 50% | 25% | 100% | 0% | 100% |
| ESF | 1084 | -35% | 63% | 58% | 100% | 0% | 100% |
| ESF+n | 1186 | -29% | 80% | 100% | 100% | 0% | 100% |

Deep-index and count-total should jump for `+n` variants if numbering helps;
the token delta vs the un-numbered variant is the price of that robustness.
