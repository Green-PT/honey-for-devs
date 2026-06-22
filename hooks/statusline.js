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

  const perModel = tokensByModel(tx);

  let gco2 = 0, tokens = 0;
  for (const [model, out] of Object.entries(perModel)) {
    gco2 += eco.estimate(model, out, cfg).gco2;
    tokens += out;
  }
  if (!tokens) return "";

  const k = eco.savingsFactor(cfg, mode);
  const usd = input.cost && input.cost.total_cost_usd;

  let s = ` · 🌿 ${g(gco2)} CO₂`;
  const saved = `~${g(gco2 * k)}` + (usd ? ` · $${(usd * k).toFixed(2)}` : "");
  if (k > 0) s += ` (saved ${saved})`;
  return s;
}

// Sum output tokens per model. Transcripts are append-only, so cache the running
// sums per path and parse only the bytes appended since the last render — O(new)
// instead of re-reading the whole (unboundedly growing) file every statusline tick.
function tokensByModel(tx) {
  const cacheFile = path.join(DIR, ".honey-statusline-cache.json");
  let store = {};
  try { store = JSON.parse(fs.readFileSync(cacheFile, "utf8")); } catch {}

  const size = fs.statSync(tx).size;
  const prev = store[tx];
  const perModel = prev && prev.offset <= size ? { ...prev.perModel } : {};
  const from = prev && prev.offset <= size ? prev.offset : 0;

  const fd = fs.openSync(tx, "r");
  let text;
  try {
    const buf = Buffer.alloc(size - from);
    if (buf.length) fs.readSync(fd, buf, 0, buf.length, from);
    text = buf.toString("utf8");
  } finally { fs.closeSync(fd); }

  const consumed = text.lastIndexOf("\n") + 1; // whole lines only
  for (const line of text.slice(0, consumed).split("\n")) {
    if (!line) continue;
    let o;
    try { o = JSON.parse(line); } catch { continue; }
    const m = o.message;
    if (!m || m.role !== "assistant" || !m.usage) continue;
    perModel[m.model] = (perModel[m.model] || 0) + (m.usage.output_tokens || 0);
  }

  store[tx] = { offset: from + consumed, perModel };
  try { fs.writeFileSync(cacheFile, JSON.stringify(store)); } catch {}
  return perModel;
}

function g(v) {
  if (v >= 1000) return `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}kg`;
  return v >= 100 ? `${Math.round(v)}g` : v >= 1 ? `${v.toFixed(1)}g` : `${v.toFixed(2)}g`;
}
