# Honey: I Shrunk the AI

### Most of what an LLM emits is waste. Honey is a skill that stops paying for it.

---

Every token your AI generates costs money, latency, and carbon. The uncomfortable truth: most of those tokens didn't need to exist.

A coding agent writes a helper function where a one-liner would do. It wraps the answer in "Great question! Let me walk you through this…" It hands another agent a pretty-printed JSON blob that's 55% indentation. None of it makes the output more correct. All of it shows up on the bill.

**Honey** is a Claude skill that cuts the waste — reflexively, on every response — without cutting the substance.

## Three levers

Honey rests on one observation: **volume is cost, and most volume is waste.** It pulls three levers to remove it.

**1 — Less code.** The cheapest line is the one never written. Before writing anything, Honey walks a ladder: Does this need to exist at all? Can config or an existing call site do it? Does the stdlib already solve it? A language idiom? An installed dependency? Only when every rung fails does it write a fresh block — and even then, no speculative parameters, no "might need it later" branches, no abstraction with a single caller.

**2 — Less prose.** Most words around code are filler. No wind-up, no wind-down, no restating your question back to you. Fragments over paragraphs. Answer first, context only if it's load-bearing. The reader wanted the answer, not the throat-clearing.

**3 — Denser agent-to-agent messages.** When the reader is *another agent* — a subagent returning results, an orchestrator handing off work — human formatting is dead weight. Honey switches to the most token-efficient wire format the receiver parses losslessly: minified JSON, columnar records, keys-once layouts. A handoff that was 1,000 tokens of pretty JSON becomes 370.

## What it refuses to cut

This is the part that makes Honey usable in production rather than just clever.

Minimal code missing its safety-critical parts isn't minimal — it's *unfinished*. Honey never simplifies away input validation at trust boundaries, error handling that prevents data loss, auth checks, secrets handling, or accessibility basics. For user-facing work — landing pages, marketing sites, UI — visual polish *is* the requirement, not speculative bloat. The ladder trims dead structure, never how something looks.

And it never touches what you'd copy, paste, or run. Code blocks stay verbatim. Identifiers, paths, commands, versions, error messages — exact. "The auth middleware" is not the same as `requireAuth()`, and Honey knows the difference.

The rule: if compressing makes the reader work to recover the meaning, you didn't remove cost — you moved it. Stop there.

## It tunes itself to the request

Honey isn't one setting. It reads intensity from your phrasing:

- **lite** — you asked to "explain," "why," "should I." The explanation *is* the deliverable, so prose stays.
- **full** — you asked to "write," "fix," "build." Terse, fragments, get it done.
- **ultra** — "just," "quick," "one-liner." Answer-only — but still naming the one edge case that bites (`raises KeyError on a missing key — use .get`). Answer-only never means edge-case-blind.

And it steps *up* a mode, never down, when terseness would drop correctness. A subtle bug, a real tradeoff, a learner who needs the why — brevity that forces a follow-up round-trip costs more than it saved.

## Does it actually work?

The skeptic's question, and the right one. Honey ships with a benchmark harness, and the numbers held up across providers:

- **Cross-provider run** (Claude Opus 4.8 + GPT-5.5, 21 tasks × 5 variants × 3 runs): the Honey variant was the *only* one to hit 100% on both tests and quality on both models — while cutting tokens. The aggressive "caveman" baselines saved more tokens but regressed on quality. Honey held the line.
- **Agent-to-agent handoffs:** −63% tokens, no measurable quality loss.
- **Input pre-compression** (a deterministic, no-model prompt compressor): −26% input tokens, no quality loss on a live Opus + GPT panel.

The headline isn't "saves the most tokens." Plenty of crude tricks save more tokens by getting things wrong. The headline is **saves tokens while staying correct** — which is the only saving that counts.

## Why this matters beyond your invoice

Agentic coding is where this bites hardest. An agent loop generates *enormous* volume — code, plus prose about code, plus messages between sub-agents, every step. Multiply a 30% reduction across thousands of turns and the savings stop being a rounding error. They become the difference between an agent workflow that's economical and one that isn't.

There's a quieter benefit too. Terser output is often *clearer* output. When you strip the hedging and the narration, what's left is the decision, the code, and the one caveat that matters. Less to read, less to misread.

## The philosophy, in one line

> Write the minimum code that needs to exist, and say it in the fewest words that stay clear — but keep everything that's load-bearing exact.

That's it. Not "write less." Not "be terse." **Remove the waste, keep the substance.** The hard part — and the reason Honey is a disciplined skill rather than a vibe — is knowing the difference.

---

*Honey is built by [Green-PT](https://github.com/Green-PT). It runs as a Claude skill and applies reflexively to every response — code and prose alike.*
