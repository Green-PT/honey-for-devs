---
inclusion: always
---
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
- **Aggregate in code, never make the model count rows.** "how many match X" scores ~0% even on frontier models. Filter/tally in the program; pass the model the number.
- **Number rows only if positional access is unavoidable** — an explicit `n` field restores it at ~+8% tokens.

**Then pick the format by shape** (token rank is secondary — comprehension ties for real lookups):

- **Default → compressed JSON.** Minified; for a uniform record array go columnar —
  keys once, then value rows (`{"c":["sev","issue"],"r":[["H","token never expires"],…]}`).
  ~−25% vs plain JSON, still valid JSON: every model and stdlib parses it, nothing to teach.
- **Opt-in → ESF**, only for high-volume, **cached**, record-array-heavy pipes you own
  end-to-end. Buys a further ~6–10%, but costs a ~120-token format primer plus the bundled
  `esf` codec, and *loses* below a few messages or on small/scalar payloads:
  ```
  !esf/1
  findings[2]{sev,issue}
  H\ttoken never expires
  M\tno rate limiting
  ```

**Verify on read:** a dense misparse is *silent* — the reader may confabulate. Treat the
declared count (`[N]`) as a checksum. **Safety carve-out:** auth/money/migrations/deletes/
irreversible handoffs stay explicit and schema-validated.

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
