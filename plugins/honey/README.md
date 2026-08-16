# 🍯 Honey (I Shrunk the AI)

<p align="center">
  <img src="https://media3.giphy.com/media/v1.Y2lkPTc5MGI3NjExbHRsNndobm8wM3F1c3pqNnhxODF6NDY2a2t3YjN5OHFoYmtvZXg0dCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/JUh0yTz4h931K/giphy.gif" alt="Honey, I shrunk the AI" width="480">
</p>

**Write less code and say less about it.** Honey (I Shrunk the AI) by
[GreenPT](https://github.com/Green-PT) is a
cross-tool coding skill that cuts AI coding-agent token usage and LLM API costs —
making agents emit less code *and* less prose without losing correctness. It works
with **Claude (claude.ai and the API), Claude Code, Cursor, GitHub Copilot, Codex, Gemini CLI, Windsurf, Cline,
OpenClaw, Kiro, Kilo Code, and Hermes Agent**. Three independent levers, applied reflexively:

1. **Less code** — YAGNI first. Walk a ladder (does it need to exist? → stdlib →
   language native → existing dependency → one line → minimum block) and stop at
   the first rung that works. The cheapest line is the one you never write.
2. **Less prose** — drop the wind-up, the hedging, the narration of code that
   already speaks for itself. Answer first.
3. **Denser agent-to-agent handoffs** — when the reader is another agent, not a
   human, hand it the most token-efficient format it parses losslessly (compact /
   columnar JSON, or [ESON](eso/SPEC.md)). Cuts handoff size ~in half at zero loss
   of recovery. Fires only here — never as a user-facing answer.

Honey combines what [Ponytail](https://github.com/DietrichGebert/ponytail)
(minimal code) and [Caveman](https://github.com/JuliusBrussee/caveman) (terse
prose) do separately, then goes further:

- **Auto-intensity** — `lite` / `full` / `ultra` chosen reflexively from the
  request, with no deliberation tax (it never spends reasoning tokens deciding
  *how* to comply — that would defeat the purpose on reasoning models).
- **Safety carve-outs** — input validation, error handling, auth, secrets,
  migrations, deletes, and anything you explicitly asked for are **never**
  compressed. Lazy ≠ broken.
- **A skill family, not one prompt** — an always-on core plus on-demand satellites
  (review, eco, gain, compress) and a *hive* of read-only subagents that return
  compressed handoffs. See [Skills & subagents](#skills--subagents).

## Why

Volume is cost. In agentic coding sessions, the volume of generated code and
prose is what runs up the bill — and most of it is waste.

This repo ships a **reproducible benchmark** ([`bench/`](bench/)) so you don't have
to take the numbers on faith: 23 tasks across three kinds of work — baseline vs
[Caveman](https://github.com/JuliusBrussee/caveman) vs
[Ponytail](https://github.com/DietrichGebert/ponytail) vs Honey — same model, same
prompts, only the skill changes. Correctness is objective (unit tests, structural /
accessibility checks, and lossless round-trip recovery for agent handoffs); quality
is scored by a **4-model cross-family judge panel** (median of Opus 4.8 + Sonnet 4.6
+ Haiku 4.5 + GPT-5.5) under a **neutral rubric** that says nothing about length, so a
terse skill gets no thumb on the scale. The figures below are the committed results
(Claude Opus 4.8, 3 runs each) — run `cd bench && npm run bench` to reproduce.

Every number is a **paired per-task delta** vs baseline — runs collapse by median,
tasks pair up, and the figure is the median of those paired deltas with a two-sided
Wilcoxon `p`. Not a ratio of arm totals: that is dominated by whichever task happens
to be longest, and it is how token-saving tools end up publishing numbers nobody can
reproduce. Endpoints and the run ladder are pre-registered in
[`bench/METHODOLOGY.md`](bench/METHODOLOGY.md).

On **Claude Opus 5** (23 tasks × 3 runs, 207 cells, zero refusals or truncation —
[`full-opus5-lean`](bench/results/full-opus5-lean/)):

| | Δ LOC | Δ output | Δ cost | Tests |
|---|------:|---------:|-------:|------:|
| **Honey** | **−71%** (p<0.001) | **−38%** (p<0.001) | **−24%** (p<0.001) | **100%** |

Honey is the only arm with no failing cell — the no-skill baseline fails four. And the
cut is **larger on the newer model, not smaller**: −71% LOC on Opus 5 against −39% on
Opus 4.8. That runs against the 2026 prompting guidance that newer models need less
instruction, which we tested directly and rejected — see
[`METHODOLOGY.md`](bench/METHODOLOGY.md#lean-prompt-ablation).

A single blended number hides the story, because the levers fire differently per
task type. Honey on Opus 4.8, where the full competitor set was run — **Δ LOC**
measures Lever 1 directly, **Δ output** measures the tokens (code *and* the prose
around it):

| Task tier | tasks | Δ LOC | Δ output |
|-----------|------:|------:|---------:|
| **Code** | 14 | **−53%** (p=0.002) | **−39%** (p=0.007) |
| **User-facing** | 7 | −23% (p=0.022) | −7% (p=0.673 — a tie) |
| **Agent-to-agent** | 2 | — (no code) | −49% (n=2, no p) |
| whole suite | 23 | **−43%** (p<0.001) | **−29%** (p=0.020) |

Against the competitors on the whole suite (judge win/loss/tie by exact sign test):

| Variant | Δ LOC | Δ output | Judge W/L/T | Tests |
|---------|------:|---------:|------------:|------:|
| Caveman | −28% (p<0.001) | −22% (p<0.001) | 3/16/2, **p=0.004** | 94% |
| Ponytail | −33% (p=0.028) | −7% (ns, p=0.267) | 1/19/1, **p<0.001** | 90% |
| **Honey** | **−43%** (p<0.001) | **−29%** (p=0.020) | 8/11/2, p=0.648 | **100%** |

- **Code** — the deepest cut (−39%) at 100% unit-test pass. Ponytail's mandatory
  self-check *inflates* trivial code (+60% on Opus, +92% on GPT-5.5).
- **User-facing** — the carve-out keeps Honey from compressing polish: the output
  delta here is a **statistical tie**, and Honey holds the only 100% accessibility
  pass while Ponytail drops to 81% on the structural/a11y checklist.
- **Agent-to-agent** — under adversarial relay queries (ordinal, nested, absence,
  cross-field count) Honey is the **only variant that stays 100% lossless** while
  roughly halving handoff size; Caveman and Ponytail compress harder *and* lose
  recovery (67% / 50%). Its biggest, cleanest win — on 2 tasks, so no p-value.
- **Quality is a tie overall** (p=0.648) — fewer tokens at no measurable quality
  cost, not higher quality. But the whole-suite tie is two opposing effects
  cancelling: on Opus, Honey **wins user-facing 6/0/1 (p=0.031)** and **loses the
  code judge 2/11/1 (p=0.022)** — on tasks where every variant passes 100% of the
  unit tests, so that is a stylistic penalty for terseness, not a correctness one.
  Neither effect replicates on GPT-5.5 (p=0.375 / p=1.000), so treat the code-judge
  dip as suggestive, not established. Caveman's judge *mean* also ties baseline
  exactly — but paired, it loses 16 of 23 tasks (p=0.004). Means hide that; sign
  tests don't.
- **The dollar saving is unproven at this sample size.** −21% on Opus is p=0.104 —
  not significant on 23 tasks. Output volume is down; the bill is not yet a claim.

The output cut holds on GPT-5.5 (−20%, p=0.004; full two-provider table in
[`bench/README.md`](bench/README.md#results)), but there **cost comes out +14% (ns)**
because no prompt caching engaged in that arm, so every task paid the skill prompt
fresh. Honey is the only variant with no test regressions across all three tiers on
Opus.

### End-to-end agentic measurement (Cline harness)

`npm run bench` makes **one API call** per task — clean for isolating the output lever, but it
never exercises an agent loop, tool schemas, or multi-turn context growth, where a real agent's
token bill actually lives. [`bench/src/cline-bench.js`](bench/src/cline-bench.js)
(`npm run bench:cline`) runs each task *through* the [Cline](https://cline.bot) CLI headless, so
the measured tokens are end-to-end agentic — harness prompt and every loop iteration included.
Honey is injected as a Cline **rule**, recommended as the per-turn-cheap
[`skills/honey/cline-rule.md`](skills/honey/cline-rule.md) (the operational core; the full
`SKILL.md` re-sent every turn inflates input). See [`bench/README.md`](bench/README.md#harness-benchmark-cline).

## ESON — Efficient Structured Object Notation

Honey includes [ESON](eso/SPEC.md), a zero-dependency, schema-first format for
agent handoffs. Repeated record keys are emitted once; declared row counts catch
truncated messages; JSON-compatible cells preserve types. ESON is developed in
its own repo — **[Green-PT/honey-eson](https://github.com/Green-PT/honey-eson)**:
the normative spec, JS + Python reference implementations, conformance vectors,
the canonical LLM primer, the Honey Wire Profile, and negotiation. Honey vendors
the codec in [`eso/`](eso/).

The reproducible [ESON/TOON/JSON benchmark](bench/eso/RESULTS.md) measures bytes,
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

> **Known limitation (upstream):** Claude Code builds affected by
> [anthropics/claude-code#68951](https://github.com/anthropics/claude-code/issues/68951)
> (a regression present since ~2.1.121, still open) ignore a PostToolUse hook's
> `updatedToolOutput` for the built-in Bash tool. On those versions the entry-time
> hook runs and stashes the original, but the model still receives the raw
> uncompressed output — honey warns once at session start when it detects an
> affected version. Piping explicitly (`some-tool | eson crush`) is unaffected:
> compression happens before the output leaves the tool. Separately, the hooks
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
(`npm run bench:px`, [results](bench/px/RESULTS.md)): **−79…85%**, −82% average
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

## Input precompression — a measured negative result

The three levers above cut **output**. There's symmetric waste on the **input** side —
filler, pleasantries, and repeated sentences in the prompt itself.
[`hooks/precompress.js`](hooks/precompress.js) is a deterministic, **no-model** compressor
that strips them before the prompt reaches the LLM, protecting code, paths, URLs,
double-quoted strings, and numbers **verbatim** (it never touches a token you'd need exact).

```bash
printf '%s' 'Hi! Could you please write a function `add(a, b)` that returns their sum? Thanks so much in advance!' | node hooks/precompress-cli.js
# -> write a function `add(a, b)` that returns their sum? in advance!
```

It's safe and lossless (35/35 property checks; on 10 unit-tested tasks the model's output
passes **100%→100%** from full vs compressed prompts), and on *chatty* prompts it cuts a lot —
**−16.5% median** on a hand-written verbose corpus.

**But that corpus flatters it.** Measured on **266 real human-typed prompts** from 35 actual
sessions ([`bench/input/RESULTS.md`](bench/input/RESULTS.md)), the cut is **2.5% total, median
0%** — 219 of 266 prompts compress to nothing, because real prompts are already terse and carry
almost no filler. Deterministic no-model compression can't catch *reworded* restatement (that
needs a model), so this is the real ceiling, not a tuning problem.

The honest conclusion: **the prompt is the wrong target.** Real input volume in agentic coding
is tool output (CCR's domain) and re-pasted context across turns — not human pleasantries. This
ships as a CLI filter for the chatty-prompt case; it is **not** wired always-on, because on real
traffic it would save ~nothing. Kept here as a measured negative result, in the repo's spirit of
not overstating. Reproduce: `node bench/input/tokens.mjs`.

## Skills & subagents

Honey is one always-on core plus a family of on-demand tools. The core is a
*writing style* (it must be the default to pay off); the rest are *actions* you
reach for at a specific moment.

| Name | Kind | What it does |
|------|------|--------------|
| `honey` | core skill (always-on) | the three levers, applied reflexively to every response — plus loop cost discipline for recurring `/loop` runs. `/honey [lite\|full\|ultra\|off]` |
| `honey-chat` | standalone prompt | Honey for plain Claude — the terse-prose core, no tools required. Paste [`skills/honey-chat/SKILL.md`](skills/honey-chat/SKILL.md) into a claude.ai Project's custom instructions, a Style, or an API system prompt (~500 tokens) |
| `honey-design` | satellite skill | for user-facing UI (landing pages, components): keeps the full rendered polish, cuts tokens by writing the design densely (CSS vars, shared classes, `clamp()`) — same pixels, fewer tokens |
| `honey-review` | satellite skill | review a diff for over-engineering + over-verbosity; terse delete-list |
| `honey-eco` | satellite skill | this session's CO₂ / $ / tokens saved, from the committed EcoLogits port |
| `honey-gain` | satellite skill | the committed benchmark scoreboard (reads `bench/results/` at runtime) |
| `honey-debt` | satellite skill | harvest every `honey:` shortcut marker into a debt ledger, flagging the ones with no revisit trigger — so a deliberate simplification can't quietly go permanent |
| `honey-compress` | satellite skill | rewrite a re-read memory file (CLAUDE.md, AGENTS.md) tersely to cut *input* tokens; backs up the original |
| `honey-memory` | satellite skill | create + maintain one committed per-project `PROJECT.md` so agents stop re-discovering the same facts every cold session; stores only stable, not-in-the-code context, kept honest by living in git |
| `honey-ccr` | satellite skill | crush huge redundant array tool output (logs, scan results) to a sampled view; lossy-but-recoverable via `eson crush`/`retrieve` |
| `honey-px` | satellite skill | read huge dense *read-only* bulk as rendered PNG pages (`npx pxpipe-proxy export`) — image tokens scale with pixels, not chars: **up to −85%** on token-dense content (Fable-class readers only); lossy on exact strings, never for files you'll edit |
| `honey-loop` | satellite skill | cost discipline for recurring `/loop` runs: cache-aware pacing (skip the 300s dead zone), event-driven-over-polling, no-change short-circuit, compact state handle, stop condition |
| `honey-superpowers` | satellite skill | stack Honey onto Superpowers-style subagent workflows: the Honey directive to inject into each dispatch prompt (worker + reviewer variants). On Claude Code the plugin's `SubagentStart` hook injects it automatically |
| `honey-hive` | guide skill | decide when to delegate to the hive vs. work inline |
| `hive-scout` | subagent (haiku, read-only) | locate symbols / callers / configs; returns a compact id-keyed JSON map |
| `hive-reviewer` | subagent (haiku, read-only) | review a diff/files; returns columnar id-keyed JSON findings |
| `hive-builder` | subagent (sonnet, ≤2 files) | make a surgical edit under the ladder; returns a compact change-manifest |

The **hive** is Lever 3 with a runtime: each subagent returns a compressed handoff,
so the result injected back into the orchestrator's context is **−44–53%** smaller
with zero loss (`npm run bench:hive`). Live, the skills hold up too — honey −86%,
honey-review −70%, hive-reviewer −43% output tokens at passing correctness
(`npm run bench:skills`). See [`bench/hive/RESULTS.md`](bench/hive/RESULTS.md) and
[`bench/skills/RESULTS.md`](bench/skills/RESULTS.md).

On **user-facing** work — where the core skill *spends* tokens because polish is the
spec — `honey-design` keeps the same rendered polish for **−19% output tokens** vs no
skill (judge 92 vs 90), beating the core skill on both axes across 7 landing-page/UI
tasks. See [`bench/results/honey-design.md`](bench/results/honey-design.md).

> **Honesty note.** Earlier versions of this README quoted `92% / 78% / 73%` quality
> and `−57% / −65% / −70%` tokens from an unpublished run. Those don't reproduce —
> the real quality spread is far narrower and the token savings are tier-dependent
> (and Ponytail *adds* tokens on simple code).
>
> A second correction, 2026-07-29: the figures before that were **ratios of arm
> totals** (`sum(honey)/sum(baseline)`), which one long task can dominate. Everything
> above is now a paired per-task median with a p-value. That moved honey's headline
> from −15% to **−29%** — the old method was understating it — but it also retired
> two numbers that turned out to be outlier artifacts: Ponytail's "−22% output" is
> really −7% (ns), and Caveman's "tied quality" is a 16-of-23-task loss (p=0.004).
> Method and pre-registered endpoints: [`bench/METHODOLOGY.md`](bench/METHODOLOGY.md).
> Regenerate any figure offline with
> `node bench/src/report.js --stamp full-opus48 --by-type`.

## Install

### Claude Code (plugin marketplace)

```
/plugin marketplace add Green-PT/honey-for-devs
/plugin install honey@greenpt
```

Then `/honey` **once** to turn it on (`/honey lite|full|ultra` to set intensity,
`/honey off` to stop). The state persists across sessions — a SessionStart hook
re-activates it every session until you run `/honey off`. A 🍯 badge shows the
active mode in your statusline. If your client autocompletes `/honey` to
`honey:honey`, that's the same command.

### Plain Claude (claude.ai / API) — no install

The chat edition, [`skills/honey-chat/SKILL.md`](skills/honey-chat/SKILL.md)
(~500 tokens), is the terse-prose core with the agent-harness levers removed —
nothing in it needs tools. Two ways to use it:

- **Project custom instructions or a Style (recommended):** paste the file in.
  Instructions become part of the system prompt, so Honey applies to **every
  message in every conversation** — always on, no triggering needed. The prefix
  is prompt-cached, and the ~500 input tokens are repaid many times over by the
  halved output.
- **Uploaded Skill (paid plans):** zip the `honey-chat/` folder and upload it as
  a Skill. Cheaper at rest (only the description stays in context) but loads
  only when Claude judges it relevant — for an always-on writing style, Project
  instructions are the better default.

On the API, use the file as (part of) your `system` prompt. Pin intensity by
appending one line: `Default to honey ultra` or `Default to honey lite`.

### One-line installer (interactive wizard)

In a terminal it asks which agents you use, whether to wire the CO₂ badge, drop
per-repo rule files, and your default mode — then sets up exactly that. The wizard
prompts on `/dev/tty`, so it works through `curl | bash`. CI/pipes and `--yes`
fall back to auto-detect.

macOS / Linux / WSL / Git Bash:

```bash
curl -fsSL https://raw.githubusercontent.com/Green-PT/honey-for-devs/main/install.sh | bash
```

Windows (PowerShell 5.1+):

```powershell
irm https://raw.githubusercontent.com/Green-PT/honey-for-devs/main/install.ps1 | iex
```

Windows (`irm | iex`) runs non-interactive; clone and run `node bin/install.js`
for the wizard. Add `bash -s -- --yes` to skip prompts. Requires Node.js on your
PATH. Safe to re-run; skips tools you don't have.

### Every supported platform

| Platform | Install |
|----------|---------|
| Claude Code | `/plugin marketplace add Green-PT/honey-for-devs` then `/plugin install honey@greenpt` |
| Codex | `codex plugin marketplace add Green-PT/honey-for-devs` then enable via `/plugins` |
| GitHub Copilot CLI | `copilot plugin marketplace add Green-PT/honey-for-devs` then `copilot plugin install honey@greenpt` |
| Gemini CLI | `gemini extensions install https://github.com/Green-PT/honey-for-devs` |
| OpenClaw | `clawhub install honey` (companions: `clawhub install honey-review`, …) |
| Hermes Agent | `node bin/install.js --only hermes` — copies `.hermes/skills/` into `~/.hermes/skills/`; activate with `/honey` (workspace `AGENTS.md` is always-on) |
| Cursor | copy `.cursor/rules/honey.mdc` into your project |
| Windsurf | copy `.windsurf/rules/honey.md` into your project |
| Cline | copy `.clinerules/honey.md` into your project (token-conscious: the compact `skills/honey/cline-rule.md`) |
| GitHub Copilot (editor) | copy `.github/copilot-instructions.md` into your project |
| Kiro | copy `.kiro/steering/honey.md` (project or `~/.kiro/steering/`) |
| OpenCode | copy `.opencode/AGENTS.md` into your project, then register it in `opencode.json` (`"instructions": [".opencode/AGENTS.md"]`) — or copy it to global `~/.config/opencode/AGENTS.md`. OpenCode does not auto-load a nested `.opencode/AGENTS.md`. |
| Kilo Code | copy `.kilo/rules/honey.md` into your project (auto-discovered; `.kilocode/rules/` also works) |
| Aider / Zed / any AGENTS.md reader | copy `AGENTS.md` into your project |

All of these are also handled automatically by the one-line installer. See
[INSTALL.md](INSTALL.md) for manual steps, flags, and uninstall.

## Carbon badge (Claude Code)

When Honey is active, the statusline also shows a live **CO₂ estimate** for the
session and the **CO₂/$ saved** vs a no-Honey baseline:

```
🍯 honey:full · 🌿 44g CO₂ (saved ~26g · $0.18)
```

(Illustrative — a ~2k-output-token Opus session.) The estimate is a faithful port
of [EcoLogits](https://github.com/genai-impact/ecologits) v0.8.2 (verified to match
the package exactly). **Model params come from EcoLogits' own registry**
([`hooks/eco-models.json`](hooks/eco-models.json), exported by
[`scripts/build-eco-models.py`](scripts/build-eco-models.py)) — matched by exact id,
falling back to a per-family alias for frontier models too new for the registry.
**Grid switches per provider** — Anthropic on AWS Trainium (~500 gCO₂/kWh), OpenAI
on Azure (~400), Google on GCP (~330). Aliases, grids, and per-mode savings live in
[`hooks/eco-config.json`](hooks/eco-config.json).

The badge itself renders **only in Claude Code** (it reads Claude Code's
transcript, where every model is a Claude model). The provider switching matters
for [`scripts/eco_report.py`](scripts/eco_report.py), which runs against any
transcript — Codex/Gemini CLIs would each need their own statusline hook to show
a live badge there.

> Params are **speculative** — Anthropic discloses none. EcoLogits' raw coefficient
> is a **single-stream (batch-size-1) upper bound** — it gives one request the whole
> GPU set for the full generation (for Opus, ~1.9 tok/s, ~30× slower than reality),
> which alone is ~1.4 kg per 1M output tokens. Production serves many requests
> concurrently, so the badge divides that ceiling by an effective batch concurrency
> (`serving_concurrency`, default 32 — calibrated so modeled throughput matches real
> ~50–70 tok/s serving) to show realistic **served** impact. `eco_report.py` prints
> both the served figure and the single-stream ceiling. Treat these as a range, not
> a meter reading.

For the full breakdown (usage + embodied + primary energy) run the real package:

```bash
pip install ecologits
python scripts/eco_report.py        # newest session, or --transcript PATH
```

## honey-usage — actual token usage across your coding agents

`honey-usage` ([`bin/usage.js`](bin/usage.js), inspired by
[tokscale](https://github.com/junhoyeo/tokscale)) reads the session data your
coding agents already write to disk and reports **actual token usage** —
tokens, approximate USD, and served CO₂ — per app and model. Zero dependencies,
no network, nothing leaves your machine.

| App | Source |
|---|---|
| `claude` (Claude Code) | `$CLAUDE_CONFIG_DIR` or `~/.claude` — `projects/**/*.jsonl` |
| `codex` (Codex CLI) | `$CODEX_HOME` or `~/.codex` — `sessions/**/*.jsonl` |
| `opencode` (OpenCode) | `($XDG_DATA_HOME` or `~/.local/share)/opencode/opencode.db` (system `sqlite3`) |

Apps without data are skipped; adding another is a small scanner returning
`{app, model, ts, input, output, cacheRead, cacheWrite, cost}` records.

```bash
honey-usage                                  # table by app + model, totals row
honey-usage --json                           # same aggregation as JSON
honey-usage --daily --since 2026-08-01       # per-day breakdown, date-filtered
honey-usage --client codex,opencode --today  # scope by app and local day
```

```
APP     MODEL        INPUT      OUTPUT   CACHE-R      CACHE-W     USD     CO2
claude  claude-opus-5  85,540  4,296,591  1,814,741,458  44,864,917  $1295.62  94.45kg
...
```

Details that keep the numbers honest:

- **Dedup** — Claude Code repeats assistant records across retries and
  continuations; each `(message.id, requestId)` counts once, globally.
- **Cache-aware cost** — rates from [`bench/pricing.json`](bench/pricing.json)
  (cache writes/reads billed as multipliers on the input rate; unknown models
  fall back to `_default`, so treat $ as approximate). Codex's
  `cached_input_tokens` are split out of `input_tokens` and priced as cache
  reads; OpenCode rows use the app's own recorded cost.
- **CO₂** — the same served EcoLogits estimate as the badge
  ([`hooks/eco.js`](hooks/eco.js)), from output tokens; the badge's caveats
  apply.
- **Savings are ledger-gated** — the default report has no "saved" column: it
  shows what was actually spent, and app logs don't record whether Honey was
  active. `honey-usage --savings` claims savings **only** for sessions the
  SessionStart hook logged to `$CLAUDE_CONFIG_DIR/.honey-usage-ledger.jsonl`
  (Claude Code, since Honey was installed — history before that is never
  claimed), and only for models with a committed bench stamp
  ([`hooks/eco-config.json`](hooks/eco-config.json) `savings_provenance`).
  Everything else is footnoted, not estimated. The figures stay modeled
  counterfactuals (`est. modeled from bench/results/… — not measured`), same
  basis as the badge.

## How it stays in sync

The skill is authored **once** in [`skills/honey/SKILL.md`](skills/honey/SKILL.md).
Every per-platform rule file (and `AGENTS.md`) is generated from it:

```bash
node scripts/build-rules.js          # regenerate all rule files
node scripts/build-rules.js --check  # CI: fail if any copy drifted
```

The OpenClaw (`.openclaw/skills/`) and Hermes (`.hermes/skills/`) skill packages
are generated the same way from `skills/`; rerun
`node scripts/build-openclaw-skills.js` / `node scripts/build-hermes-skills.js`
after changing a skill. `tests/openclaw-skills.test.js` and
`tests/hermes-skills.test.js` fail if a committed copy is stale.

## License

MIT — see [LICENSE](LICENSE).

The carbon-estimation data and coefficients in `hooks/eco-models.json` and
`hooks/eco.js` are derived from [EcoLogits](https://github.com/genai-impact/ecologits)
and remain under the **MPL-2.0**. See [NOTICE](NOTICE) for details.
