# 🍯 Honey: I Shrunk the AI

### A cross-tool coding skill that makes AI agents write less code and say less about it — without losing correctness. Built by GreenPT.

---

Every token your coding agent emits costs three things: money, latency, and carbon. And here's the uncomfortable part — most of those tokens didn't need to exist.

An agent writes a 12-line helper where a one-liner from the standard library would do. It opens with "Great question! Let me walk you through this…" and closes with "Hope that helps!" It hands a sub-agent a pretty-printed JSON blob that's more than half whitespace and punctuation. None of that makes the work more correct. All of it shows up on the invoice — and in agentic loops, where an agent generates code *plus* prose *plus* inter-agent messages at every step, it compounds into the bulk of your bill.

**Honey (I Shrunk the AI)** is a skill that removes the waste — reflexively, on every response — while keeping everything that's load-bearing exact. It's built by [GreenPT](https://github.com/Green-PT) and lives at **[github.com/Green-PT/honey-for-devs](https://github.com/Green-PT/honey-for-devs)**. It works across **Claude Code, Cursor, GitHub Copilot, Codex, Gemini CLI, Windsurf, Cline, OpenClaw, and Kiro**.

This is the long read: the philosophy, the three levers, the benchmark numbers (with the honest caveats), and exactly how to install it.

---

## The premise: volume is cost, and most volume is waste

Two skills came before Honey and each picked one half of the problem. [Ponytail](https://github.com/DietrichGebert/ponytail) made agents write *minimal code*. [Caveman](https://github.com/JuliusBrussee/caveman) made them write *terse prose*. Honey combines both, then adds a third lever the others don't have — and, crucially, a set of safety carve-outs so that "minimal" never means "broken."

The thesis in one sentence:

> Write the minimum code that needs to exist, and say it in the fewest words that stay clear — but keep everything load-bearing exact.

The hard part isn't "write less." Anyone can truncate. The hard part is knowing the difference between waste and substance — and Honey is a disciplined skill precisely because it encodes that difference rather than leaving it to vibes.

---

## Lever 1 — Less code

Most code needn't exist. The cheapest line is the one you never write. Before writing anything, Honey walks a ladder and stops at the first rung that works:

1. **Does it need to exist at all?** Often the best move is no code — a config change, an existing call site, or deleting the requirement.
2. **Standard library** — don't hand-roll what `itertools`, `pathlib`, `collections`, or `datetime` already do.
3. **Language native** — an operator, a comprehension, a dict lookup instead of an if-ladder.
4. **An installed dependency** — use what the project already has; don't add one for four lines, don't reimplement one you already ship.
5. **One line** before reaching for a block.
6. **Minimum block** — no speculative parameters, no "might need it later" branches, no abstraction with a single caller.

Speculative generality is the single costliest agent habit. Code written for an imagined future requirement is pure overhead, and the requirement usually never arrives. Honey prefers editing what exists over adding; a new function, file, class, or layer has to earn its place.

---

## Lever 2 — Less prose

Most words around code are filler. The reader wanted the answer, not the throat-clearing.

- **Drop the wind-up and wind-down** — no "Great question!", no "hope this helps!", no restating your prompt back to you, no announcing what's about to happen.
- **Drop the hedging** — "use X," not "you might possibly consider perhaps X." State real uncertainty once, briefly.
- **Fragments and lists** over paragraphs when they carry the same information faster.
- **Don't narrate readable code** — explain the *why* and the non-obvious; skip the *what* the code already says.
- **Answer first.** Context only if it's load-bearing.

---

## Lever 3 — Denser agent-to-agent handoffs

When the reader is *another agent* rather than a human — a sub-agent returning results, an orchestrator handing off work — human formatting is dead weight. Pretty-printing JSON is roughly +55% tokens for nothing. So Honey switches to the most token-efficient format the receiver parses losslessly: compact or columnar JSON, or **ESO** (Efficient Structured Output), a zero-dependency, schema-first format where repeated record keys are emitted once and declared row counts catch truncated messages.

```bash
printf '%s' '{"from":"reviewer","findings":[{"sev":"H","issue":"expired token"}]}' | eso encode
eso decode < handoff.eso
```

This lever fires *only* between agents — never as a user-facing answer. It cuts handoff size by roughly half at zero loss of recovery.

---

## What Honey refuses to cut

This is the part that makes it safe for production rather than just clever. Minimal code that's missing its safety-critical parts isn't minimal — it's *unfinished*. Honey **never** compresses away:

- **Input validation** at trust boundaries — user input, network, files, env.
- **Error handling** that prevents data loss or corruption.
- **Security** — auth checks, escaping, secrets handling.
- **Accessibility basics** — labels, roles, keyboard paths.
- **Visual and UX polish when the deliverable is user-facing** — for landing pages, marketing sites, and UI components, polish *is* the requirement, not speculative bloat. Markup that looks unfinished isn't minimal.
- **Anything you explicitly asked for.**

And it never touches what you'd copy, paste, or run. Code blocks stay verbatim. Identifiers, paths, commands, versions, error messages — exact. "The auth middleware" is not the same thing as `requireAuth()`. The governing rule: if compressing makes the reader work to recover the meaning, you didn't remove cost — you moved it. Stop there. Lazy ≠ broken.

---

## Auto-intensity — it tunes itself to the request

Honey isn't one setting. It reads intensity from how you phrase the request, with no deliberation tax (it never burns reasoning tokens deciding *how* to comply — on reasoning models that would defeat the purpose):

- **lite** — you asked to "explain," "why," "should I." The explanation *is* the deliverable, so prose stays.
- **full** — you asked to "write," "fix," "build." Terse, fragments, ship it. This is the default.
- **ultra** — "just," "quick," "one-liner." Answer-only — but still naming the one edge case that bites (e.g. *raises `KeyError` on a missing key — use `.get`*). Answer-only never means edge-case-blind.

And it steps *up* a mode, never down, when terseness would drop correctness — a subtle bug, a real tradeoff, a learner who needs the why. Brevity that forces a follow-up round-trip costs more than it saved.

You can pin it manually: `/honey lite|full|ultra`, or `/honey off`.

---

## Does it actually work? The benchmark

The skeptic's question, and the right one. Honey ships a **reproducible benchmark** ([`bench/`](https://github.com/Green-PT/honey-for-devs/tree/main/bench)) so you don't take the numbers on faith: 23 tasks across three kinds of work — baseline vs Caveman vs Ponytail vs Honey — same model, same prompts, only the skill changes.

Correctness is objective: unit tests, structural and accessibility checks, and lossless round-trip recovery for agent handoffs. Quality is scored by a **4-model cross-family judge panel** (median of Opus 4.8 + Sonnet 4.6 + Haiku 4.5 + GPT-5.5) under a **neutral rubric that says nothing about length** — so a terse skill gets no thumb on the scale.

A single blended number hides the story, because the levers fire differently per task type. Quality is **% of baseline** (panel median; lossless recovery for handoffs); tokens are **generated output vs baseline**:

| Task tier | Caveman | Ponytail | **Honey** |
|-----------|:-------:|:--------:|:---------:|
| **Code** (14 unit-tested tasks) | 101% · −37% | 99% · +24% | **98% · −49%** |
| **User-facing** (7 landing/UI tasks) | 99% · −18% | 95% · −33% | **101% · −6%** |
| **Agent-to-agent** (2 handoff tasks) | 67% · −23% | 50% · −22% | **100% · −51%** |

Read the wins:

- **Code** — the deepest cut (−49% output) at essentially tied quality (98% vs 100%, within judge noise on tasks every variant passes). Ponytail's mandatory self-check actually *inflates* trivial code by +24%.
- **User-facing** — the carve-out keeps Honey from compressing polish, yet it still trims output (−6%) while earning the top quality score (101% of baseline) and the only 100% accessibility pass. Ponytail strips hardest and drops to 81% on the structural/a11y checklist.
- **Agent-to-agent** — under adversarial relay queries (ordinal, nested, absence, cross-field count) Honey is the **only variant that stays 100% lossless** while roughly halving handoff size (−51%). Caveman and Ponytail compress harder *and* lose recovery (67% / 50%). Its biggest, cleanest win.

The headline isn't "saves the most tokens" — crude tricks save more by getting things wrong. It's **saves tokens while staying correct**, which is the only saving that counts. The same pattern holds on GPT-5.5 ([full cross-provider table](https://github.com/Green-PT/honey-for-devs/blob/main/bench/results/cross-provider.md)).

Reproduce it yourself: `cd bench && npm run bench`.

---

## A note on honesty (because the repo insists on it)

Two things worth calling out, because Honey's repo does:

**The README corrects itself.** Earlier versions quoted flashier numbers (`92% / 78% / 73%` quality, `−57% / −65% / −70%` tokens) from an unpublished run. They don't reproduce. The committed harness produces the narrower, tier-dependent table above — and that's what's published now.

**One lever is shipped as a measured *negative* result.** Honey also explored compressing the *input* — stripping filler from prompts before they reach the model. On a hand-written verbose corpus it cut −16.5%. But measured on **266 real human-typed prompts** from 35 actual sessions, the cut was **2.5% total, median 0%** — because real prompts are already terse. The honest conclusion: the prompt is the wrong target; real input volume is tool output and re-pasted context, not human pleasantries. So that compressor ships as an opt-in CLI filter, *not* wired always-on, and is documented as a negative result. That's the spirit of the whole project: don't overstate.

---

## More than one skill — a family

The always-on core is a *writing style*. Around it sits a family of on-demand satellites and a *hive* of read-only sub-agents that return compressed handoffs:

| Name | What it does |
|------|--------------|
| `honey` | The core: three levers, applied reflexively. `/honey [lite\|full\|ultra\|off]` |
| `honey-design` | For user-facing UI — keeps the full rendered polish, cuts tokens by writing the design densely (CSS vars, shared classes, `clamp()`). Same pixels, fewer tokens: −19% output vs no skill. |
| `honey-review` | Reviews a diff for over-engineering + over-verbosity; terse delete-list. |
| `honey-eco` | This session's CO₂ / $ / tokens saved. |
| `honey-gain` | The committed benchmark scoreboard. |
| `honey-compress` | Rewrites a re-read memory file (CLAUDE.md, AGENTS.md) tersely to cut *input* tokens. |
| `honey-memory` | Maintains one committed per-project `PROJECT.md` so agents stop re-discovering the same facts every cold session. |
| `honey-ccr` | Crushes huge redundant array tool output (logs, scan results) to a sampled view — lossy but recoverable. |
| `hive-scout` / `hive-reviewer` / `hive-builder` | Read-only sub-agents that return compact, id-keyed JSON instead of narrated prose — the orchestrator's context comes back 44–53% smaller, zero loss. |

---

## The carbon badge

When Honey is active in Claude Code, the statusline shows a live CO₂ estimate and the CO₂/$ saved vs a no-Honey baseline:

```
🍯 honey:full · 🌿 44g CO₂ (saved ~26g · $0.18)
```

The estimate is a faithful port of [EcoLogits](https://github.com/genai-impact/ecologits) v0.8.2, with model parameters from EcoLogits' own registry and the carbon grid switched per provider (Anthropic on AWS, OpenAI on Azure, Google on GCP). The repo is candid that the underlying params are speculative — Anthropic discloses none — so treat the badge as a calibrated range, not a meter reading. That candor is the point.

---

## Install

### Claude Code (plugin marketplace — recommended)

```
/plugin marketplace add Green-PT/honey-for-devs
/plugin install honey@greenpt
```

Then `/honey` to turn it on (`/honey lite|full|ultra` for intensity, `/honey off` to stop). A 🍯 badge shows the active mode in your statusline.

### One-line installer (every agent, interactive wizard)

It asks which agents you use, whether to wire the CO₂ badge, whether to drop per-repo rule files, and your default mode — then sets up exactly that. Requires Node.js on your PATH. Safe to re-run.

macOS / Linux / WSL / Git Bash:

```bash
curl -fsSL https://raw.githubusercontent.com/Green-PT/honey-for-devs/main/install.sh | bash
```

Windows (PowerShell 5.1+):

```powershell
irm https://raw.githubusercontent.com/Green-PT/honey-for-devs/main/install.ps1 | iex
```

### Every supported platform

| Platform | Install |
|----------|---------|
| Claude Code | `/plugin marketplace add Green-PT/honey-for-devs` then `/plugin install honey@greenpt` |
| Codex | `codex plugin marketplace add Green-PT/honey-for-devs` then enable via `/plugins` |
| GitHub Copilot CLI | `copilot plugin marketplace add Green-PT/honey-for-devs` then `copilot plugin install honey@greenpt` |
| Gemini CLI | `gemini extensions install https://github.com/Green-PT/honey-for-devs` |
| OpenClaw | `clawhub install honey` |
| Cursor | copy `.cursor/rules/honey.mdc` into your project |
| Windsurf | copy `.windsurf/rules/honey.md` into your project |
| Cline | copy `.clinerules/honey.md` into your project |
| GitHub Copilot (editor) | copy `.github/copilot-instructions.md` into your project |
| Kiro | copy `.kiro/steering/honey.md` |
| OpenCode | copy `.opencode/AGENTS.md` into your project |
| Aider / Zed / any AGENTS.md reader | copy `AGENTS.md` into your project |

Full manual steps, flags, and uninstall are in [INSTALL.md](https://github.com/Green-PT/honey-for-devs/blob/main/INSTALL.md). To remove it: `/plugin uninstall honey@greenpt`, or run the one-liner with `--uninstall`.

---

## Why this matters

Agentic coding is where the savings stop being a rounding error. An agent loop generates enormous volume — code, prose about code, and messages between sub-agents, at every step. Multiply a 30–50% output reduction across thousands of turns and it becomes the difference between a workflow that's economical and one that isn't.

There's a quieter benefit, too. Terser output is often *clearer* output. Strip the hedging and the narration and what's left is the decision, the code, and the one caveat that matters. Less to read, less to misread.

Honey doesn't tell your agent to "write less." It teaches it to **remove the waste and keep the substance** — and ships the benchmark, the carve-outs, and even a negative result so you can check that it does.

---

**Honey is built by [GreenPT](https://github.com/Green-PT).** Repo: **[github.com/Green-PT/honey-for-devs](https://github.com/Green-PT/honey-for-devs)** · MIT licensed · works across nine coding tools. ⭐ it if it saves you a token.
