// Phase 0 — input-compression bench gate. NO API.
// For each (fixture, applicable compressor): measure tokens before/after AND run an
// adversarial recovery probe. A compressor PASSES only if recovery is 100% — every
// ground-truth answer is still derivable from the compressed view (expanding dedup
// markers and retrieving any offloaded blocks). This gate governs every promotion.
//   node bench/input/recovery.mjs
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { encode } from "gpt-tokenizer";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const logc = require("../../hooks/logcompress.js");

const HERE = dirname(fileURLToPath(import.meta.url));
const fixtures = JSON.parse(readFileSync(join(HERE, "fixtures.json"), "utf8"));
const tok = (s) => encode(s).length;

// --- a session-scoped offload store, so a compressor can drop a block and a probe can
//     retrieve it by handle. Mirrors the eso crush/retrieve contract (fail-open: a missing
//     handle MUST fall back to original, never a dangling reference).
function makeStore() {
  const m = new Map();
  return {
    put(text) { const id = "h" + (m.size + 1); m.set(id, text); return id; },
    retrieve(id) { return m.get(id) ?? null },
  };
}

// --- deterministic probes: recover an answer from text, compare to ground truth ----------
function probe(text, q) {
  if (q.kind === "contains") return text.includes(q.arg) === q.expect;
  if (q.kind === "countMatch") {
    const re = new RegExp(q.arg, "gm");
    return (text.match(re) || []).length === q.expect;
  }
  throw new Error("unknown probe kind " + q.kind);
}

// --- compressors under test. Each: (content, type, store) -> { view, recover() }.
//     `recover()` returns text equivalent for probing (expands markers, pulls offloads).
//     `null` = not applicable to this fixture type (skipped, not failed).
const COMPRESSORS = {
  passthrough: (content) => ({ view: content, recover: () => content }),

  // whitespace: trailing-ws + blank-run collapse. Type-gated OFF for code (indentation
  // is load-bearing). Lossless for our probes on prose/log.
  whitespace: (content, type) => {
    if (type === "code") return null;
    const view = content.replace(/[^\S\n]+$/gm, "").replace(/\n{3,}/g, "\n\n");
    return { view, recover: () => view };
  },

  // logDedup: collapse a run of identical lines to one + a "(×N)" count marker.
  // Repetition count is preserved (recoverable), so a count probe still answers correctly.
  logDedup: (content, type) => {
    if (type !== "log") return null;
    const lines = content.split("\n");
    const out = [];
    for (let i = 0; i < lines.length; ) {
      let j = i;
      while (j < lines.length && lines[j] === lines[i]) j++;
      const n = j - i;
      out.push(n > 1 ? `${lines[i]}  (×${n})` : lines[i]);
      i = j;
    }
    const view = out.join("\n");
    const recover = () =>
      view.replace(/^(.*)  \(×(\d+)\)$/gm, (_, line, n) => Array(Number(n)).fill(line).join("\n"));
    return { view, recover };
  },

  // the real Phase 3 compressor: ANSI strip + volatile-field-normalized run collapse.
  // recover() expands the ×N count markers (in-context recovery); the hook additionally
  // stashes the original for the rare per-line-detail query.
  logCompress: (content, type) => {
    if (type !== "log") return null;
    const { view } = logc.compress(content);
    return { view, recover: () => logc.expand(view) };
  },
};

// --- run -------------------------------------------------------------------------------
const w = (s, n) => String(s).padEnd(n);
console.log(w("compressor", 14) + w("fixture", 18) + w("type", 7) + w("tok→", 12) + w("cut", 7) + "recovery");
let failed = 0, ran = 0;
for (const [name, fn] of Object.entries(COMPRESSORS)) {
  for (const fx of fixtures) {
    const store = makeStore();
    const r = fn(fx.content, fx.type, store);
    if (!r) continue; // not applicable
    ran++;
    const before = tok(fx.content), after = tok(r.view);
    const recovered = r.recover();
    const results = fx.queries.map((q) => probe(recovered, q));
    const ok = results.every(Boolean);
    if (!ok) failed++;
    console.log(
      w(name, 14) + w(fx.id, 18) + w(fx.type, 7) +
        w(`${before}→${after}`, 12) + w(((1 - after / before) * 100).toFixed(0) + "%", 7) +
        (ok ? `100% (${results.length}/${results.length})` : `FAIL (${results.filter(Boolean).length}/${results.length})`)
    );
  }
}
console.log("-".repeat(58));
console.log(`${ran} runs, ${failed} recovery failures`);
console.log(`GATE: ${failed === 0 ? "PASS ✅ (100% recovery)" : "FAIL ❌ — a compressor lost queryable info"}`);

// --- self-test: prove the gate has TEETH. A deliberately lossy compressor (drops all but
//     the first 3 lines, no offload) MUST be flagged as a recovery failure. If the gate
//     passes a lossy compressor, the gate itself is broken.
const lossy = (content) => {
  const view = content.split("\n").slice(0, 3).join("\n");
  return { view, recover: () => view }; // no retrieve path -> info is gone
};
let caught = 0, checked = 0;
for (const fx of fixtures) {
  const r = lossy(fx.content);
  checked++;
  if (!fx.queries.every((q) => probe(r.recover(), q))) caught++;
}
const teeth = caught === checked;
console.log(`SELF-TEST: lossy compressor flagged on ${caught}/${checked} fixtures — ${teeth ? "gate has teeth ✅" : "GATE BLIND ❌"}`);

process.exitCode = failed === 0 && teeth ? 0 : 1;
