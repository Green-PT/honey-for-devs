"use strict";
// Aggregate per-(variant,task,run) records into the headline table + a markdown report.

const fs = require("fs");
const path = require("path");

const pricing = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "pricing.json"), "utf8"));

function rateFor(model) {
  const hit = pricing.rates.find((r) => model.toLowerCase().includes(r.match));
  return hit || pricing._default;
}

// Cache-aware cost: cached input (skill prompt re-read) bills at ~10% of fresh input.
function dollars(model, freshIn, cacheIn, outTok) {
  const r = rateFor(model);
  return (freshIn * r.in + cacheIn * r.in * 0.1 + outTok * r.out) / 1e6;
}

const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const stdev = (xs) => {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
};
const pct = (x) => `${(x * 100).toFixed(0)}%`;
const signedPct = (x) => `${x >= 0 ? "+" : ""}${(x * 100).toFixed(0)}%`;

// records: [{variant, task, run, usage:{input,output}, passed, judge, gco2}]
function aggregate(records, order, model) {
  const byVariant = {};
  for (const r of records) (byVariant[r.variant] ||= []).push(r);

  const rows = {};
  for (const v of order) {
    const rs = byVariant[v] || [];
    const freshIn = rs.reduce((a, r) => a + r.usage.input, 0);
    const cacheIn = rs.reduce((a, r) => a + (r.usage.cache_read || 0), 0);
    const outTok = rs.reduce((a, r) => a + r.usage.output, 0);
    const judges = rs.filter((r) => r.judge != null).map((r) => r.judge);
    rows[v] = {
      variant: v,
      n: rs.length,
      passRate: mean(rs.map((r) => (r.passed ? 1 : 0))),
      judge: mean(judges),
      judgeSd: stdev(judges), // per-record spread: a small judge gap inside ±sd is noise, not a win
      input: freshIn,
      cacheIn,
      output: outTok,
      gco2: rs.reduce((a, r) => a + (r.gco2 || 0), 0),
      usd: dollars(model, freshIn, cacheIn, outTok), // cached steady-state
      usdCold: dollars(model, freshIn + cacheIn, 0, outTok), // cold session: skill prompt billed fresh
    };
  }
  return rows;
}

function table(rows, order) {
  const base = rows.baseline;
  const rel = (x, b) => (b ? x / b - 1 : 0);
  const qVs = (x, b) => (b ? x / b : 0);

  // Headline reduction is OUTPUT tokens — the volume each skill directly controls, and
  // caching-independent. Input is dominated by the cacheable, one-time skill prompt.
  const header =
    "| Variant | Tests pass | Judge ±sd | Judge vs base | Output tok | Output vs base | $ (cached) | $ (cold) | CO₂ (g) |\n" +
    "|---------|-----------:|----------:|--------------:|-----------:|---------------:|-----------:|---------:|--------:|";
  const lines = order
    .filter((v) => rows[v] && rows[v].n)
    .map((v) => {
      const r = rows[v];
      const q = base && base.judge ? pct(qVs(r.judge, base.judge)) : "—";
      const ov = base ? signedPct(rel(r.output, base.output)) : "—";
      const j = `${r.judge.toFixed(0)} ±${r.judgeSd.toFixed(0)}`;
      return `| ${v} | ${pct(r.passRate)} | ${j} | ${q} | ${r.output.toLocaleString()} | ${ov} | $${r.usd.toFixed(3)} | $${r.usdCold.toFixed(3)} | ${r.gco2.toFixed(1)} |`;
    });
  return [header, ...lines].join("\n");
}

module.exports = { aggregate, table };
