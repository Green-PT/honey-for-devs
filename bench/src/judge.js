"use strict";
// LLM-as-judge. Scores a reply 0-100 on correctness, completeness, and clarity for the
// stated task. Explicitly told NOT to reward length or penalize terseness — we are
// measuring whether the answer is good, not whether it is long.

const { complete } = require("./client");

// Rubric mode (env JUDGE_RUBRIC):
//   plain (default) — neutral: no instruction about length/terseness in either direction, so
//     honey's terseness gets no thumb on the scale. The only guardrails are correctness-
//     neutral (judge stated requirements; don't assume a stdlib fn is buggy) and apply to
//     every variant identically. This is the rubric the headline runs on.
//   aware — the older rubric that explicitly tells the judge not to penalize terseness and to
//     credit stdlib delegation. Kept so plain-vs-aware can be measured: if honey's lead only
//     shows under `aware`, the lead is the rubric, not the skill.
const RUBRIC = (process.env.JUDGE_RUBRIC || "plain").toLowerCase();

const PLAIN_CODE = `You are a strict, neutral code-review judge. Score a candidate answer to a
coding task from 0 to 100 on three things only:
- Correctness: does the code do what the task asks, including the stated edge cases?
- Completeness: is the required function/class present with the right signature and exports?
- Clarity: is it readable and unambiguous?

Correctness-neutral guardrails (apply to every answer equally):
- Judge ONLY against the task's stated requirements. Do not invent extra ones (e.g. if the
  task asks for a float only on even-length input, do not penalize an int on odd-length).
- Do NOT assume a standard-library function is buggy. If unsure of its behavior, treat it as correct.
Reply with ONLY a JSON object: {"score": <int 0-100>, "note": "<= 12 words"}`;

const AWARE_CODE = `You are a strict, neutral code-review judge. Score a candidate answer to a
coding task from 0 to 100 on three things only:
- Correctness: does the code do what the task asks, including the stated edge cases?
- Completeness: is the required function/class present with the right signature and exports?
- Clarity: is it readable and unambiguous?

Do NOT reward verbosity, pleasantries, or extra explanation. Do NOT penalize terseness,
fragments, or a missing intro — a correct one-line answer with no prose deserves ~100.
Judge substance, not tone or length.

Critical anti-bias rules:
- Delegating to a correct standard-library function is EXCELLENT engineering, not lower
  quality. A one-line stdlib solution that meets the spec scores as high as a longer
  hand-rolled one — never lower for "showing less work."
- Do NOT assume a stdlib function is buggy. If unsure of its behavior, treat it as correct.
- Judge ONLY against the task's stated requirements. Do not invent extra ones (e.g. if the
  task asks for a float only on even-length input, do not penalize an int on odd-length).
Reply with ONLY a JSON object: {"score": <int 0-100>, "note": "<= 12 words"}`;

const SYSTEM_CODE = RUBRIC === "aware" ? AWARE_CODE : PLAIN_CODE;

const SYSTEM_WEB = `You are a senior design engineer judging a user-facing web deliverable
(a landing page or UI component). Score the DELIVERABLE itself from 0 to 100 on:
- Visual design & polish: layout depth, hierarchy, spacing, color, typography — does it look
  finished and on-brand, or like unstyled scaffolding?
- Completeness: are all the requested sections/components actually present and fleshed out?
- Responsiveness & accessibility: sensible on mobile (media queries / fluid layout), labelled
  controls, alt text, semantic structure.

For a user-facing page, polish IS the requirement — a bare, correct-but-ugly page should score
LOW even if its HTML is valid. Judge the prose AROUND the code at zero weight: a reply with no
explanation but a beautiful page deserves ~100; a chatty reply with a plain page deserves low.
Reply with ONLY a JSON object: {"score": <int 0-100>, "note": "<= 12 words"}`;

function parseScore(text) {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return { score: null, note: "unparseable judge output" };
  try {
    const o = JSON.parse(m[0]);
    const s = Math.max(0, Math.min(100, Math.round(Number(o.score))));
    return { score: Number.isFinite(s) ? s : null, note: String(o.note || "") };
  } catch {
    return { score: null, note: "unparseable judge output" };
  }
}

async function judge({ model, taskPrompt, candidateOutput, type = "code" }) {
  const system = type === "web" ? SYSTEM_WEB : SYSTEM_CODE;
  const user = `TASK:\n${taskPrompt}\n\nCANDIDATE ANSWER:\n${candidateOutput}`;
  const { text } = await complete({ model, system, user, maxTokens: 200 });
  return parseScore(text);
}

module.exports = { judge, RUBRIC };
