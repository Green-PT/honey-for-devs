# Honey memory — cold-start benchmark (fixture)

Memory file: 248 Claude tok. 6 cold-start questions (4 greppable, 2 intent), 5 distinct source files to rediscover.

## Per cold session — context tokens to answer the greppable facts

| Path | Claude tok | GPT tok |
|---|---:|---:|
| Rediscover from source (5 files) | 497 | 436 |
| Read memory file once | 248 | 224 |
| **Δ per session** | **-50%** | **-49%** |

Memory is read once per session, source is re-grepped every cold session,
so the saving recurs. The more facts reused per session, the better memory
does; on a tiny question set a large always-loaded file can lose (the index
tax) — that crossover is the honest boundary of the skill.

## Intent facts — the part memory uniquely enables

- "Why is the cache TTL 300 seconds?" — **not recoverable from source** (0 repo-wide hits); memory is the only source.
- "Why is authz a single middleware instead of per-route?" — **not recoverable from source** (0 repo-wide hits); memory is the only source.

## Correctness gate

- ✅ all 6 asked facts present in the memory file
- ✅ all 4 greppable facts derivable from their source (fair fixture)
- ✅ all 2 intent facts absent from source (memory is their only source)

All checks passed.
