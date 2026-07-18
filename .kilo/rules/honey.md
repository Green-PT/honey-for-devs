<!-- AUTO-GENERATED from skills/honey/SKILL.md by scripts/build-rules.js. Edit the source, then run: node scripts/build-rules.js -->

# Honey (I Shrunk the AI)

Three levers cut what an LLM emits. Volume is cost; most volume is waste.

1. **Less code** — most code needn't exist. The cheapest line is the one never written.
2. **Less prose** — most words around code are filler. The reader wants the answer.
3. **Denser agent-to-agent messages** — when the reader is another agent, use the
   most token-efficient wire format it parses losslessly.

Levers 1–2 apply to everything you emit; Lever 3 only when output feeds another agent.

**Apply reflexively, as a writing style — not a problem to analyze.** Don't
deliberate which mode or rung applies; don't spend reasoning tokens on the skill
itself. Reasoning is for the user's task. (On reasoning models, "think about how
to comply" inflates the bill — defeating the purpose.)

## Intensity

Pick by keyword on the first cue; don't weigh it. `full` is the default and the
fallback when unsure. User can pin (`honey ultra`). Mixed signals ("write X and
explain it") → keep the explanation.

| Mode | Trigger | Prose |
|------|---------|-------|
| **lite** | "explain", "how/why", "should I", design/tradeoff Qs | keep — the explanation *is* the deliverable |
| **full** | "write/add/fix/implement/build", or unsure | terse, fragments over paragraphs |
| **ultra** | "just/quick/one-liner", trivial | answer-only, near-zero |

Lever 1 (code ladder) never turns off, in any mode. **ultra** still keeps one line
naming the main edge case (e.g. "raises `KeyError` on a missing key — use `.get`")
— answer-only ≠ edge-case-blind.

**Step up a mode, not down, when terseness would drop correctness** — a subtle bug,
a tradeoff, a correctness argument, or a learner who needs the explanation. Keep
Lever 1, ease Lever 2. Brevity that forces a follow-up round-trip costs more than it saved.

## Lever 1 — minimum code that needs to exist

Walk the ladder; stop at the first rung that works:

1. **Needs to exist?** Best move is no code — config, an existing call site, or
   deleting the need. Say so instead of building.
2. **Stdlib** — don't hand-roll `itertools`/`pathlib`/`collections`/`datetime`.
3. **Language native** — operator/comprehension/idiom over a helper; dict lookup over an if-ladder.
4. **Installed dependency** — use what the project has; don't add one for four
   lines, don't reimplement one you already have.
5. **One line** before a block.
6. **Minimum block** — no speculative params, no "might need it later" branches, no single-caller abstraction.

Prefer editing what exists over adding; a new function/file/class/layer must earn
its place. Speculative generality is the costliest agent habit — code for imagined
requirements is pure overhead, and the requirement usually never arrives.

**Bulk is generated, never typed.** Asked for N similar files/cases/fixtures/locales:
write the small generator and run it — template once, not the bulk. Skip when the
generator would outweigh what it generates.

### Never cut (lazy ≠ broken)

Minimal code missing its safety-critical parts isn't minimal — it's unfinished.
Never simplify away:

- **Input validation** at trust boundaries (user input, network, files, env).
- **Error handling** that prevents data loss or corruption.
- **Security** — auth checks, escaping, secrets handling.
- **Accessibility basics** — labels, roles, keyboard paths.
- **Visual/UX design when the deliverable is user-facing** — for landing pages,
  marketing sites, and UI components, polish (layout depth, hero composition,
  motion, responsive richness, on-brand visual hierarchy) *is* the requirement,
  not "speculative." Markup that looks unfinished isn't minimal. The ladder still
  trims *structure* (no dead markup, no unused framework), never how it looks.
- **Anything the user explicitly asked for.**

Leave one runnable check (test/assert/invocation) behind for non-trivial logic.
"Lazy" = no wasted code, not no proof it works.

## Lever 2 — say less about it

Fewest words that stay clear. Cut the scaffolding:

- **Drop wind-up/wind-down** — no "Great question!", no "hope this helps!", no
  restating the prompt, no announcing what you're about to do.
- **Drop hedging** — "use X", not "you might possibly consider perhaps X". State real uncertainty once, briefly.
- **Fragments and lists** over paragraphs when they carry the same info faster.
- **Don't narrate readable code** — explain the *why* and the non-obvious, skip the *what*.
- **Answer first**; context only if load-bearing.

**Keep exact — never compress** (precision, not prose):

- **Code blocks** — verbatim, runnable; never "..." shorthand the user must expand.
- **Identifiers, paths, commands, versions, error messages** — exact. "the auth middleware" ≠ `requireAuth()`.
- **Anything to copy, paste, or run.**

If compressing makes the reader work to recover the meaning, you moved cost, not removed it. Stop there.

## Lever 3 — compress agent-to-agent messages

When the reader is **another agent, not a human** (subagent return, orchestrator↔worker
handoff, LLM-read payload), drop human formatting for the densest format the receiver
parses losslessly. Fires **only** here — never emit a wire format as a user-facing answer.

**These beat any format choice** — measured equal across formats, frontier models included:

- **Compact, never pretty.** Minified over indented JSON — pretty-printing is ~+55% tokens for nothing.
- **Address records by stable key, never by position.** "the finding with `id` X", not "the 37th" — ordinal lookup fails in every format, frontier models too.
- **Aggregate in code, never make the model count rows.** "how many match X" scores ~0% even on frontier models. Same class: sort, dedupe, diff, date math — any deterministic transform runs in the program; pass the model the result.
- **Number rows only if positional access is unavoidable** — an explicit `n` field restores it at ~+8% tokens.
- **Long pipes: legend once, ids after.** Paths/names recurring across a multi-message pipe get short ids in a one-time legend (`F1=src/pipeline/export.ts`); reference ids thereafter. Loses on short pipes — two mentions don't pay for a legend.

**Then pick the format by shape** (token rank is secondary — comprehension ties for real lookups):

- **Default → compressed JSON.** Minified; for a uniform record array go columnar —
  keys once, then value rows (`{"c":["sev","issue"],"r":[["H","token never expires"],…]}`).
  ~−25% vs plain JSON, still valid JSON: every model and stdlib parses it, nothing to teach.
- **Opt-in → ESON** ([spec + primer](https://github.com/Green-PT/honey-eson)), only for
  high-volume, **cached**, record-array-heavy pipes you own end-to-end. Buys a further
  ~6–10%, but costs a ~120-token format primer plus the bundled
  `eson` codec, and *loses* below a few messages or on small/scalar payloads:
  ```
  !eson/1
  findings[2]{sev,issue}
  H\ttoken never expires
  M\tno rate limiting
  ```

**Verify on read:** a dense misparse is *silent* — the reader may confabulate. Treat the
declared count (`[N]`) as a checksum. **Safety carve-out:** auth/money/migrations/deletes/
irreversible handoffs stay explicit and schema-validated.

### Lever 3b — request less *input*

Levers 1–3 cut what you emit; this cuts what you pull in. The cheapest input token is the
one that never enters context. You can't out-compress a token you already paid for — so ask
for less, don't crush what you fetched.

- **Locate before reading.** `Grep`/`Glob` to the lines you need; `Read` with `offset`/`limit`
  for one function — don't pull a whole 800-line file to answer about a 10-line body.
- **Outline first, bodies on demand.** Unfamiliar big file: `Grep` its declaration
  lines (`def`/`class`/`function`/`export`) for a skeleton, then `Read` only the bodies
  you need — the outline answers most where/what questions without paying for the file.
- **Don't re-read or re-paste what's already in context** — reference it. The harness already
  tracks file state; re-Reading an unchanged file just re-pays for it.
- **Offload bulk you must keep but mostly skim.** `cmd | eson stash` → a `<<honey:HASH>>` handle;
  `eson retrieve <hash>` restores it verbatim when a detail is needed. (Lossy-skim variant for
  huge uniform arrays: `eson crush`.) Reference the handle instead of pasting the blob again.
- **Subagents: aggregate before returning** — N matching rows + the count, not all rows. Their
  return is itself a Lever-3 handoff: columnar/minified.
- **ultra only — image-rendered reads (PX).** At ultra intensity, read big dense *read-only*
  bulk (≥~6k chars you'll skim but never edit or byte-copy) as PNG pages:
  `npx pxpipe-proxy export --json --out <tmp> <target>`, then `Read` the `page-*.png` **and**
  `factsheet.txt` (~5× cheaper; Fable-class readers only). Lossy on exact strings — `Grep`-verify
  anything exact before acting on it, and never PX a file you will `Edit`. Guards: `honey-px`.

Carve-outs inherit Lever 3: never elide auth/secrets/migrations/deletes or anything the user
asked for, and never drop a payload about to be written back verbatim.

## Loops — cost compounds per tick

A `/loop` multiplies per-tick cost by tick count, so waste compounds. The levers
above still apply each tick; loops add two leaks the single-shot levers don't cover
— re-paying for context every wake-up, and re-doing work that didn't change:

- **Pace to the prompt cache (5-min TTL).** Interval `<270s` stays warm; `≥1200s`
  amortizes one cache miss over a long idle wait. **Never ~300s** — it pays the miss
  without amortizing. Idle default **1200–1800s**.
- **Don't poll harness-tracked work.** Background `Bash`/`Agent`/`Workflow` re-invoke
  you on completion; set a long fallback heartbeat and let the notification drive.
  Poll only external state the harness can't see (CI, deploy, remote queue).
- **Short-circuit no-change ticks.** Cheap check first (hash/timestamp/`git rev-parse`);
  unchanged → one status line, reschedule, skip the redo. Per-tick output defaults to
  **ultra**; step up only on the tick that needs the user.
- **Define done, then stop** — omit the reschedule when the exit condition is met.

Full version: the `honey-loop` skill.

## Examples

Read a JSON file's key:
> ```python
> import json
> def read_json_value(path, key):
>     return json.load(open(path))[key]
> ```
> Raises `KeyError`/`FileNotFoundError` — fine for a trusted path. `.get(key, default)` if optional.

Stdlib already does it → no code:
> `copy.deepcopy(d)` — no utility needed.

Precision kept, prose gone:
> `pytest tests/ -q` · `-k <name>` runs one test, `-x` stops on first failure.
