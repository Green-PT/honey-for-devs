// Honey hive — offline handoff benchmark.
//
// The hive subagents (hive-scout, hive-reviewer) return their results as Lever-3
// handoffs. This measures the real payloads they emit: every format is
// round-tripped losslessly BEFORE measurement, then sized with the same two
// tokenizers the ESON bench uses. No API, no model — fully reproducible.
//
//   node bench/hive/check.mjs
//
// Exits non-zero if any format fails to round-trip, or if the hive's default
// (columnar JSON) does not beat pretty JSON. That makes it a real pass/fail gate.

import { strict as assert } from "node:assert";
import { encode as esoEncode, decode as esoDecode } from "../../eso/index.js";
import { countTokens as claudeTokens } from "@anthropic-ai/tokenizer";
import { countTokens as o200kTokens } from "gpt-tokenizer/encoding/o200k_base";

// --- Canonical payloads the hive actually returns -------------------------

// hive-reviewer: the findings-relay shape (uniform record array).
const reviewerFindings = [
  { id: "F1", sev: "H", file: "app/auth.js", line: 42, kind: "no-rate-limit", msg: "login endpoint lacks rate limiting" },
  { id: "F2", sev: "M", file: "src/db.js", line: 88, kind: "sql-string", msg: "query built by string concatenation" },
  { id: "F3", sev: "L", file: "src/util.js", line: 12, kind: "unused-var", msg: "variable tmp is unused" },
  { id: "F4", sev: "H", file: "app/api.js", line: 130, kind: "missing-authz", msg: "admin route has no authorization check" },
  { id: "F5", sev: "M", file: "src/cache.js", line: 55, kind: "stale-ttl", msg: "cache TTL is never refreshed" },
  { id: "F6", sev: "L", file: "src/log.js", line: 7, kind: "console-log", msg: "stray console.log left in" },
  { id: "F7", sev: "H", file: "src/upload.js", line: 200, kind: "path-traversal", msg: "filename is not sanitized" },
  { id: "F8", sev: "M", file: "app/form.js", line: 64, kind: "no-validation", msg: "email field is not validated" },
  { id: "F9", sev: "L", file: "src/style.css", line: 3, kind: "unused-class", msg: "class .btn-old is unused" },
  { id: "F10", sev: "M", file: "src/api.js", line: 99, kind: "n-plus-one", msg: "N+1 query inside a loop" },
];

// hive-builder: a small change-manifest.
const builderChanges = [
  { id: "C1", file: "src/cache.js", action: "edit", lines: "+6 -2", summary: "add ttl refresh on hit" },
  { id: "C2", file: "test/cache.test.js", action: "edit", lines: "+8 -0", summary: "cover ttl refresh" },
  { id: "C3", file: "src/index.js", action: "edit", lines: "+1 -1", summary: "export refreshed cache" },
];

// hive-scout: an irregular locate map.
const scoutHits = [
  { id: "H1", sym: "requireAuth", file: "app/auth.js", line: 42, role: "def" },
  { id: "H2", sym: "requireAuth", file: "app/api.js", line: 130, role: "caller" },
  { id: "H3", sym: "requireAuth", file: "app/admin.js", line: 8, role: "caller" },
  { id: "H4", sym: "AUTH_TTL", file: "config/auth.json", line: 3, role: "config" },
  { id: "H5", sym: "requireAuth", file: "test/auth.test.js", line: 19, role: "test" },
];

// --- Format codecs (columnar is the hive default) -------------------------

const prettyJSON = {
  enc: (rows) => JSON.stringify(rows, null, 2),
  dec: (s) => JSON.parse(s),
};
const compactJSON = {
  enc: (rows) => JSON.stringify(rows),
  dec: (s) => JSON.parse(s),
};
const columnarJSON = {
  enc: (rows) => {
    const c = Object.keys(rows[0]);
    return JSON.stringify({ c, r: rows.map((row) => c.map((k) => row[k])), n: rows.length });
  },
  dec: (s) => {
    const { c, r } = JSON.parse(s);
    return r.map((vals) => Object.fromEntries(c.map((k, i) => [k, vals[i]])));
  },
};
const eso = {
  enc: (rows) => esoEncode({ findings: rows }),
  dec: (s) => esoDecode(s).findings,
};

// --- Measure --------------------------------------------------------------

function measure(label, rows, codecs) {
  console.log(`\n## ${label} (${rows.length} records)\n`);
  console.log("| Format | Bytes | vs pretty | Claude tok | o200k tok | round-trip |");
  console.log("|---|---:|---:|---:|---:|:--:|");
  const base = Buffer.byteLength(codecs.pretty.enc(rows));
  const out = {};
  for (const [name, codec] of Object.entries(codecs)) {
    const s = codec.enc(rows);
    const ok = (() => {
      try { assert.deepEqual(codec.dec(s), rows); return true; } catch { return false; }
    })();
    if (!ok) { console.error(`FAIL: ${label}/${name} did not round-trip losslessly`); process.exitCode = 1; }
    const bytes = Buffer.byteLength(s);
    out[name] = { bytes, claude: claudeTokens(s), o200k: o200kTokens(s), ok };
    const pct = name === "pretty" ? "0%" : `${Math.round(((bytes - base) / base) * 100)}%`;
    console.log(`| ${name} | ${bytes} | ${pct} | ${out[name].claude} | ${out[name].o200k} | ${ok ? "✓" : "✗"} |`);
  }
  return out;
}

const codecs = { pretty: prettyJSON, compact: compactJSON, columnar: columnarJSON, eso };

console.log("# Honey hive — handoff size (offline, reproducible)");
const rev = measure("hive-reviewer findings", reviewerFindings, codecs);
const sct = measure("hive-scout hits", scoutHits, codecs);
const bld = measure("hive-builder changes", builderChanges, codecs);

// --- Gate: the default (columnar) must beat pretty JSON on Claude tokens ---
for (const [label, m] of [["reviewer", rev], ["scout", sct], ["builder", bld]]) {
  const save = Math.round(((m.pretty.claude - m.columnar.claude) / m.pretty.claude) * 100);
  console.log(`\n${label}: columnar saves ${save}% Claude tokens vs pretty JSON.`);
  if (m.columnar.claude >= m.pretty.claude) {
    console.error(`FAIL: ${label} columnar did not beat pretty JSON`);
    process.exitCode = 1;
  }
}

console.log(process.exitCode ? "\nFAILED" : "\nOK — all formats lossless, columnar default beats pretty JSON.");
