#!/usr/bin/env node
"use strict";
// Cross-provider comparison: the four skill variants on two (or more) generation models,
// split by tier. Quality is panel-median judge (code/web) or lossless recovery (relay), shown
// as % of THAT provider's own baseline; tokens are output vs that provider's baseline.
//   node src/cross.js "Opus 4.8=panel-v1,relay-v1" "gpt-5.5=gpt55-v1"
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const ORDER = ["baseline", "caveman", "ponytail", "honey"];
const WEB = new Set(["landing-page", "ui-component"]);
const tierOf = (r) =>
  r.type === "relay" ? "relay" : r.type === "web" || WEB.has(r.category) ? "web" : "code";
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const qOf = (rs, tier) =>
  tier === "relay"
    ? mean(rs.map((r) => (r.accuracy ?? 0) * 100))
    : mean(rs.filter((r) => r.judge != null).map((r) => r.judge));

const providers = process.argv.slice(2).map((a) => {
  const eq = a.indexOf("=");
  const label = a.slice(0, eq);
  const recs = [];
  for (const s of a.slice(eq + 1).split(",")) {
    recs.push(...JSON.parse(fs.readFileSync(path.join(ROOT, "results", s.trim(), "results.json"), "utf8")).records);
  }
  return { label, recs };
});
if (providers.length < 2) {
  console.error('usage: node src/cross.js "Label=stampA,stampB" "Label2=stampC" ...');
  process.exit(1);
}

function tierStats(recs, tier) {
  const rs = recs.filter((r) => tierOf(r) === tier);
  const by = {};
  for (const r of rs) (by[r.variant] ||= []).push(r);
  const base = by.baseline || [];
  const baseOut = base.reduce((a, r) => a + r.usage.output, 0);
  const baseQ = qOf(base, tier);
  const out = {};
  for (const v of ORDER) {
    const vr = by[v];
    if (!vr || !vr.length) { out[v] = null; continue; }
    const q = qOf(vr, tier);
    const o = vr.reduce((a, r) => a + r.usage.output, 0);
    out[v] = {
      q: Math.round(q),
      qPct: baseQ ? Math.round((100 * q) / baseQ) : 0,
      tok: baseOut ? Math.round(100 * (o / baseOut - 1)) : 0,
      pass: Math.round((100 * vr.filter((r) => r.passed).length) / vr.length),
    };
  }
  return out;
}

const sgn = (x) => `${x >= 0 ? "+" : ""}${x}%`;
const cell = (s) =>
  s ? `${s.q} (${s.qPct}%) · ${sgn(s.tok)}${s.pass < 100 ? ` · ⚠tests ${s.pass}%` : ""}` : "—";

let md = `# Cross-provider: skills on ${providers.map((p) => p.label).join(" vs ")}\n\n`;
md += `Each cell: **quality** (panel-median judge, or lossless% for relay) as % of that\n`;
md += `provider's own baseline · **output tokens** vs that provider's baseline.\n`;

for (const [tier, title] of [["code", "Code"], ["web", "User-facing"], ["relay", "Agent-to-agent (Lever 3)"]]) {
  const stats = providers.map((p) => ({ label: p.label, s: tierStats(p.recs, tier) }));
  if (!stats.some((x) => ORDER.some((v) => x.s[v]))) continue;
  md += `\n## ${title}\n\n`;
  md += `| Variant | ${stats.map((x) => x.label).join(" | ")} |\n`;
  md += `|---------|${stats.map(() => "---").join("|")}|\n`;
  for (const v of ORDER) {
    md += `| ${v} | ${stats.map((x) => cell(x.s[v])).join(" | ")} |\n`;
  }
}

const out = path.join(ROOT, "results", "cross-provider.md");
fs.writeFileSync(out, md);
console.log(md);
console.log(`written -> ${path.relative(path.join(ROOT, ".."), out)}`);
