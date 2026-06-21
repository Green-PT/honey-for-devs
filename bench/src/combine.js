#!/usr/bin/env node
"use strict";
// Merge several result sets into one report, split by task type. The code/web split is the
// point: easy code tasks saturate quality; user-facing web tasks are where it separates.
//   node src/combine.js opus48 web48
const fs = require("fs");
const path = require("path");
const { aggregate, table } = require("./report");

const ROOT = path.join(__dirname, "..");
const ORDER = ["baseline", "caveman", "ponytail", "honey"];
const WEB_CATS = new Set(["landing-page", "ui-component"]);
const typeOf = (r) => r.type || (WEB_CATS.has(r.category) ? "web" : "code");

const stamps = process.argv.slice(2);
if (!stamps.length) {
  console.error("usage: node src/combine.js <stamp> [<stamp> ...]");
  process.exit(1);
}

let model = "";
const records = [];
for (const s of stamps) {
  const j = JSON.parse(fs.readFileSync(path.join(ROOT, "results", s, "results.json"), "utf8"));
  model = model || j.meta.model;
  records.push(...j.records);
}

const code = records.filter((r) => typeOf(r) === "code");
const web = records.filter((r) => typeOf(r) === "web");
const relay = records.filter((r) => r.type === "relay");

const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const ORDER2 = ["baseline", "caveman", "ponytail", "honey"];

// Relay (Lever 3) has no prose judge — quality is lossless recovery by the receiver agent.
function relaySection(recs) {
  if (!recs.length) return "";
  const by = {};
  for (const r of recs) (by[r.variant] ||= []).push(r);
  const base = by.baseline || [];
  const baseOut = base.reduce((a, r) => a + r.usage.output, 0);
  let md =
    "## Agent-to-agent / Lever 3 (relay)\n\n" +
    "A neutral receiver agent answers questions using ONLY the handoff. **Lossless** = receiver " +
    "got every answer right; **Accuracy** = mean fraction correct. The win is fewer handoff " +
    "tokens at no loss of recovery.\n\n" +
    "| Variant | Lossless | Accuracy | Output tok | Output vs base |\n" +
    "|---------|---------:|---------:|-----------:|---------------:|\n";
  for (const v of ORDER2) {
    const rs = by[v];
    if (!rs || !rs.length) continue;
    const lossless = Math.round(100 * mean(rs.map((r) => (r.passed ? 1 : 0))));
    const acc = Math.round(100 * mean(rs.map((r) => r.accuracy ?? 0)));
    const out = rs.reduce((a, r) => a + r.usage.output, 0);
    const ov = baseOut ? `${out / baseOut - 1 >= 0 ? "+" : ""}${Math.round(100 * (out / baseOut - 1))}%` : "—";
    md += `| ${v} | ${lossless}% | ${acc}% | ${out.toLocaleString()} | ${v === "baseline" ? "—" : ov} |\n`;
  }
  return md + "\n";
}

const section = (title, recs, note) => {
  if (!recs.length) return "";
  const rows = aggregate(recs, ORDER, model);
  return `## ${title}\n\n${note ? note + "\n\n" : ""}${table(rows, ORDER)}\n`;
};

const nTasks = new Set(records.map((r) => r.task)).size;
const md =
  `# Honey benchmark — combined\n\n` +
  `model: \`${model}\` · ${nTasks} tasks · ${records.length} generations · sources: ${stamps.join(", ")}\n\n` +
  section("All tasks", records) +
  "\n" +
  section(
    "Code tasks only",
    code,
    "Self-contained functions with unit tests. Easy enough that every variant passes — the " +
      "quality axis saturates, so only token volume separates them."
  ) +
  "\n" +
  section(
    "User-facing tasks only (landing page + UI)",
    web,
    "Where polish IS the spec. **Tests pass** = structural + accessibility checklist " +
      "(labels, alt text, responsive, required sections). This is the quality-separating tier."
  ) +
  "\n" +
  relaySection(relay);

const out = path.join(ROOT, "results", "combined.md");
fs.writeFileSync(out, md);
console.log(md);
console.log(`\nwritten -> ${path.relative(path.join(ROOT, ".."), out)}`);
