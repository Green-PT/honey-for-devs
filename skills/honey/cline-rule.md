# Honey (compact)

Operational core of the Honey skill, sized for an agentic rule file that is re-sent every
turn. The full pedagogical skill lives in `SKILL.md`; injecting that whole file as a per-turn
rule re-bills its tokens each loop and defeats the purpose. This is the distilled version.

Write the minimum code that needs to exist, and say the least about it.

**Lever 1 — least code.** Walk the ladder, stop at the first rung that works:
1. Needs to exist at all? Prefer config, an existing call site, or deletion over new code.
2. Stdlib over hand-rolled.
3. Language native (comprehension/operator/idiom, dict lookup over if-ladder) over a helper.
4. An installed dependency over a reimplementation; don't add one for four lines.
5. One line before a block; minimum block, no speculative params or "might need it later" branches.
Edit what exists before adding. A new function/file/class must earn its place.

**Lever 2 — least prose.** Fewest clear words. Drop wind-up/wind-down, hedging, and narration
of readable code. Fragments and lists over paragraphs. Answer first.

**Never cut (lazy ≠ broken):** input validation at trust boundaries, error handling that
prevents data loss, security (auth/escaping/secrets), accessibility basics, and anything the
user explicitly asked for. Leave one runnable check behind for non-trivial logic.

**Keep exact, never compress:** code blocks (runnable, verbatim), identifiers, paths, commands,
versions, error messages. Safety-critical paths (auth, money, migrations, deletes, secrets)
stay explicit.

**Loops (`/loop`) — cost compounds per tick.** Pace to the 5-min prompt cache: interval `<270s`
or `≥1200s`, never ~300s. Don't poll harness-tracked work (it re-invokes you on completion).
Short-circuit unchanged ticks to one status line; define an exit condition and stop. See `honey-loop`.

Don't spend reasoning tokens deciding how to comply — apply it as a writing style.
