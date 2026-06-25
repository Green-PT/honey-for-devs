"use strict";
// LogCompressor — shrink verbose, repetitive tool output (build logs, retry storms, progress
// spam) before it lands in context. Two transforms:
//   1. strip ANSI escape codes        — always lossless (pure formatting)
//   2. collapse consecutive repeats   — lines identical AFTER masking volatile fields
//      (timestamps, hex addrs, uuids) become one verbatim line + "(×N)". The run COUNT is
//      preserved (recoverable); the per-line volatile values are not — that's why the hook
//      stashes the original and gates this to `ultra`.
//
// Conservative by design: only CONSECUTIVE same-template lines collapse, so a stack trace
// (distinct frames) and interleaved output are never touched. Below a size gate it only
// strips ANSI. Fail-open: any throw → caller sends the original.

const ANSI = /\x1B\[[0-9;]*[A-Za-z]/g;
// mask only fields you'd never query for content — they vary per line and defeat dedup
const VOLATILE = [
  [/\b\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?\b/g, "⟨ts⟩"],
  [/\b\d{1,2}:\d{2}:\d{2}(?:\.\d+)?\b/g, "⟨t⟩"],
  [/\b0x[0-9a-fA-F]+\b/g, "⟨hex⟩"],
  [/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/g, "⟨uuid⟩"],
];
const MIN_RUN = 3; // shorter repeats may be signal — leave them
const GATE_LINES = 25; // below this, only strip ANSI (small output isn't worth collapsing)

function template(line) {
  let t = line;
  for (const [re, tok] of VOLATILE) t = t.replace(re, tok);
  return t;
}

// compress(text) -> { view, saved, dropped }  (saved/dropped in chars/lines)
function compress(text) {
  if (typeof text !== "string" || !text) return { view: text || "", saved: 0, dropped: 0 };
  const stripped = text.replace(ANSI, "");
  const lines = stripped.split("\n");
  if (lines.length < GATE_LINES) return { view: stripped, saved: text.length - stripped.length, dropped: 0 };

  const out = [];
  let dropped = 0;
  for (let i = 0; i < lines.length; ) {
    const tpl = template(lines[i]);
    let j = i + 1;
    while (j < lines.length && template(lines[j]) === tpl) j++;
    const n = j - i;
    if (n >= MIN_RUN) {
      out.push(`${lines[i]}  ⟨×${n}⟩`); // keep first verbatim, mark the count (⟨⟩: rare in real logs)
      dropped += n - 1;
    } else {
      for (let k = i; k < j; k++) out.push(lines[k]);
    }
    i = j;
  }
  const view = out.join("\n");
  return { view, saved: text.length - view.length, dropped };
}

// expand "(×N)" markers back to N copies of the line — in-context recovery of the COUNT.
// (Per-line volatile values still require the stashed original; this restores everything else.)
function expand(view) {
  return view.replace(/^(.*)  ⟨×(\d+)⟩$/gm, (_, line, n) => Array(Number(n)).fill(line).join("\n"));
}

module.exports = { compress, expand, template };
