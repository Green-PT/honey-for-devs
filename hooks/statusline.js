#!/usr/bin/env node
// Statusline badge. When Honey is active, shows the mode plus a live EcoLogits
// CO2 estimate for this session and the CO2/$ saved vs a no-Honey baseline.
// When Honey is off, prints nothing. Never throws — a statusline must not error.
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");

const DIR = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), ".claude");
const FLAG = path.join(DIR, ".honey-active");

let mode = null;
try {
  mode = fs.readFileSync(FLAG, "utf8").trim() || null;
} catch {}
if (!mode || mode === "off") {
  process.stdout.write("");
  process.exit(0);
}

let badge = `🍯 honey:${mode}`;
try {
  badge += ecoSuffix(mode);
} catch {} // any failure -> plain badge
process.stdout.write(badge);

// ---------------------------------------------------------------------------
function ecoSuffix(mode) {
  const eco = require("./eco.js");
  const cfg = eco.loadConfig();

  const input = JSON.parse(fs.readFileSync(0, "utf8")); // CC statusline JSON on stdin
  const tx = input && input.transcript_path;
  if (!tx || !fs.existsSync(tx)) return "";

  // Sum output tokens per model across the transcript.
  const perModel = {};
  for (const line of fs.readFileSync(tx, "utf8").split("\n")) {
    if (!line) continue;
    let o;
    try { o = JSON.parse(line); } catch { continue; }
    const m = o.message;
    if (!m || m.role !== "assistant" || !m.usage) continue;
    perModel[m.model] = (perModel[m.model] || 0) + (m.usage.output_tokens || 0);
  }

  let gco2 = 0, tokens = 0;
  for (const [model, out] of Object.entries(perModel)) {
    gco2 += eco.estimate(model, out, cfg).gco2;
    tokens += out;
  }
  if (!tokens) return "";

  // Savings: token reduction R implies baseline = actual/(1-R); impacts ~linear
  // in tokens, so saved CO2/$ scale by R/(1-R).
  const R = cfg.savings_vs_baseline[mode] || 0;
  const k = R / (1 - R);
  const usd = input.cost && input.cost.total_cost_usd;

  let s = ` · 🌿 ${g(gco2)} CO₂`;
  const saved = `~${g(gco2 * k)}` + (usd ? ` · $${(usd * k).toFixed(2)}` : "");
  if (k > 0) s += ` (saved ${saved})`;
  return s;
}

function g(v) {
  return v >= 100 ? `${Math.round(v)}g` : v >= 1 ? `${v.toFixed(1)}g` : `${v.toFixed(2)}g`;
}
