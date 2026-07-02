---
name: honey-superpowers
description: >-
  Stack Honey onto Superpowers-style workflows (subagent-driven-development,
  dispatching-parallel-agents, executing-plans) and any orchestration that
  dispatches fresh subagents. Dispatched subagents run in isolated context and
  do NOT inherit the session's Honey hook, so they emit full-fat code and verbose
  reports. Use when you are about to dispatch implementer/reviewer/fixer/parallel
  subagents: it gives the exact Honey directive to paste into each dispatch prompt,
  with a worker variant and a reviewer variant, so the levers apply inside the
  subagents too — where the multiplied cost actually is.
license: MIT
---

# Honey × Superpowers

Honey is turned on by the session's SessionStart hook — which lives in **your**
(the orchestrator's) context. Superpowers dispatches **fresh subagents with
isolated context**; they never inherit the hook. So every implementer, reviewer,
and fixer runs **Honey-off**: full-fat code (Lever 1 dark) and verbose reports
(Lever 2 dark) — multiplied per dispatch. That's the leak. Close it by pasting
the directive into the dispatch prompt itself.

The two skills already pull cost the same way Honey does — cheap model per task,
file handoffs over pasted text, one-line narration. **Don't fight them; stack on
top.** Honey adds what they don't: less code in the worker, terser reports both
ways.

## When it fires

Any time you are about to dispatch a subagent under a Superpowers-style workflow:

- `subagent-driven-development` — implementer / task-reviewer / fixer per task
- `dispatching-parallel-agents` — one agent per independent domain
- `executing-plans` — parallel-session execution
- any orchestrator → worker handoff with isolated context

## What to inject

**On Claude Code with the Honey plugin, skip the paste**: the plugin's
`SubagentStart` hook ([`hooks/honey-subagent.js`](../../hooks/honey-subagent.js))
injects the matching directive into every spawned subagent automatically
(reviewer-shaped agent types get the reviewer variant). The blocks below are for
other harnesses, or when the hook isn't installed.

Paste the matching block into the dispatch prompt body — inline text, not a Skill
call (invoking burns a round-trip; the subagent only needs the rules).

**Worker / implementer / fixer / parallel-domain agent:**

```
Apply Honey: write the minimum code that needs to exist — YAGNI, stdlib/native
before custom; no speculative params, branches, or single-caller abstractions.
Never cut validation, error handling, auth, or anything the task asked for.
Keep code, identifiers, paths, and the brief's exact spec values verbatim.
Report terse: status, commits, one-line test summary, concerns. No narration.
```

**Reviewer:**

```
Report findings tersely: id · severity · file:line · one-line fix. Don't narrate
or restate the diff. Honey governs your prose only — never your verdict or
severity. Flag everything you normally would; raise false positives for the
controller to adjudicate. Do not suppress or downgrade a finding to save words.
```

## Why the reviewer variant is different

Lever 1 (less code) and Lever 2 (less prose) compress what a *worker* emits. A
reviewer emits *judgments* — compress its prose, never its verdict. This matches
Superpowers' hard rule ("never tell a reviewer what not to flag") and Honey's own
safety carve-out (keep exact anything asked for; auth/money/migrations/deletes
stay explicit). A terser review is fine; a leniter review is a regression.

## Carve-outs (inherit Honey's)

Never elide, in any variant: input validation at trust boundaries, error handling
that prevents data loss, auth/escaping/secrets, accessibility basics, and anything
the task or plan explicitly mandated. Spec values (numbers, magic strings,
signatures, test cases) stay verbatim — that's Lever 2's "keep exact," and it's
also what the brief is the single source of truth for.

## What Honey can't shrink here

The skill prompts Superpowers loads into context are input tokens you've already
paid for — Honey can't out-compress them. They're lazy-loaded, so only triggered
skills cost anything. The big realized savings are the cheap-model-per-task rule
(Superpowers' own — don't skip it) plus Honey inside every dispatched subagent.
