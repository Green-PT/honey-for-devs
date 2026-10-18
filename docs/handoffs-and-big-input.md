# Agent handoffs and big inputs

ESON (Lever 3) plus the two tools for tool output too big to read whole: CCR and PX.

## ESON — Efficient Structured Object Notation

Honey includes [ESON](../eso/SPEC.md), a zero-dependency, schema-first format for
agent handoffs. Repeated record keys are emitted once; declared row counts catch
truncated messages; JSON-compatible cells preserve types. ESON is developed in
its own repo — **[Green-PT/honey-eson](https://github.com/Green-PT/honey-eson)**:
the normative spec, JS + Python reference implementations, conformance vectors,
the canonical LLM primer, the Honey Wire Profile, and negotiation. Honey vendors
the codec in [`eso/`](../eso/).

The reproducible [ESON/TOON/JSON benchmark](../bench/eso/RESULTS.md) measures bytes,
two tokenizer estimates, codec speed, and lossless recovery across five agent
handoff shapes. Run it with `npm run bench:eso`.

```bash
printf '%s' '{"from":"reviewer","findings":[{"sev":"H","issue":"expired token"}]}' | eson encode
eson decode < handoff.eson
```

### CCR — for huge, redundant array tool output

ESON is lossless, for handoffs where every row matters. **CCR** (Compress-Cache-Retrieve)
is the lossy-but-recoverable lever for the opposite case: a long uniform array you must
read but mostly skim — logs, scan results, event streams. It keeps an informative sample
(endpoints, anomalies/change-points, head/tail), caches the dropped rows locally, and
leaves a `<<ccr:HASH N_rows_offloaded>>` sentinel. Nothing is lost — `retrieve` restores
the original by hash on demand.

```bash
some-tool | eson crush          # → sampled view + sentinel; originals cached in .honey-ccr/
eson retrieve <hash>            # → the full original array, verbatim
```

Validated on a 90-row log (opus-4.8 + gpt-5.5): **−82% tokens**, crushed-only **96%**
answer accuracy, **100%** with retrieve — and the lone crushed miss was a refusal, not a
hallucination. Benches: `npm run bench:ccr` (tokens) and `npm run bench:ccr:comprehension`
(quality). The `honey-ccr` skill tells the agent when to reach for it.

> **Requirements:** the entry-time hook needs Claude Code **2.1.121+** (where
> PostToolUse `updatedToolOutput` arrived for built-in tools); honey warns once at
> session start on older builds. Piping explicitly (`some-tool | eson crush`) works
> everywhere: compression happens before the output leaves the tool. The hooks also
> need **Node >= 14** on the PATH Claude Code spawns them with — desktop-app
> sessions inherit the launchd PATH, not your shell profile, so a stale
> `/usr/local/bin/node` is common; the hook now warns instead of failing silently.

### PX — image-rendered reads for huge dense read-only bulk

**The intuition:** sending a file as text pays per character; sending an image
pays per pixel, no matter how much text is crammed into it. So a "photo of the
page" costs ~5× less than the page itself — and reading it has photo problems:
the gist survives, an exact serial number might not.

Concretely: dense text packs ~3 chars per image-token vs ~1 as text. **PX**
exploits the gap on the *read* path: when the agent must skim something huge it
will never edit (vendored code, a large diff, docs), it renders it to PNG pages
with [pxpipe](https://github.com/teamchong/pxpipe)'s `export` and `Read`s the
images instead of the text.

```bash
npx pxpipe-proxy export --json --out "$TMPDIR" src/   # → page-*.png + factsheet.txt + token report
```

**Measured: up to −85% tokens on a single read.** Repo-corpus bench
(`npm run bench:px`, [results](../bench/px/RESULTS.md)): **−79…85%**, −82% average
(26.4k Claude text tokens → 4.8k image est.); ~−75% all-in per read after the
factsheet + report overhead; pxpipe's own end-to-end proxy bill measures −59…70%
at whole-workload level.

**Comprehension is a Fable story.** The live 4-model panel
(`node bench/px/comprehension.mjs` — 10 byte-exact questions, text vs render):

| model | text | from render |
|---|---:|---:|
| Claude **Fable 5** | 10/10 | **7/10** |
| Claude Opus 4.8 | 10/10 | 4/10 |
| Claude Sonnet 4.6 | 10/10 | 4/10 |
| Claude Haiku 4.5 | 10/10 | 1/10 |

Only Fable-class models read renders usably — and even Fable is not byte-safe.
**Lossy on exact strings** — misreads are silent confabulations (Haiku answered a
seed question with `0x9e3779b9`, a constant that isn't in the file), so the export
ships verbatim precision tokens (paths, SHAs, numbers) as `factsheet.txt` text, and
the `honey-px` skill forbids it for files you'll edit, secrets, or non-Fable
readers. Over the raw API, prepend the export's `prompt.txt` banner — Fable's
safety layer refuses naked dense renders. Complementary to CCR: CCR drops
redundant rows recoverably; PX keeps everything in view at pixel prices. At
`/honey ultra` the core skill reaches for PX automatically on qualifying reads
(big, dense, read-only); at other intensities it stays on-demand via `honey-px`.
For the
full wire-level version (system prompt, tool docs, history), run the pxpipe proxy
itself — Honey and pxpipe stack.

Pick Honey when you want the best quality-per-token, especially in Claude Code.
