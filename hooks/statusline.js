#!/usr/bin/env node
// Statusline badge. When Honey is active, shows the mode plus a live token-based
// CO2e and water estimate for this session (hooks/eco.js) and the CO2 saved vs a
// no-Honey baseline.
// When Honey is off, prints nothing. Never throws — a statusline must not error.
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");

const DIR = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), ".claude");

let input = null;
try {
  input = JSON.parse(fs.readFileSync(0, "utf8")); // CC statusline JSON on stdin
} catch {}

let mode = null;
try {
  const ws = (input && input.workspace) || {};
  mode = require("./honey-state.js").activeMode(ws.project_dir || ws.current_dir || (input && input.cwd));
} catch {}
if (!mode) {
  process.stdout.write("");
  process.exit(0);
}

let badge = `🍯 honey:${mode}`;
try {
  badge += ecoSuffix(mode, input);
} catch {} // any failure -> plain badge
process.stdout.write(badge);

// ---------------------------------------------------------------------------
function ecoSuffix(mode, input) {
  const eco = require("./eco.js");
  const cfg = eco.loadConfig();

  const tx = input && input.transcript_path;
  if (!tx || !fs.existsSync(tx)) return "";

  const perModel = tokensByModel(tx);

  let gco2 = 0, water = 0, tokens = 0, topModel = null, topTokens = 0;
  for (const [model, t] of Object.entries(perModel)) {
    const e = eco.estimate(model, t, cfg);
    gco2 += e.gco2;
    water += e.waterMl;
    tokens += t.output;
    if (t.output > topTokens) { topTokens = t.output; topModel = model; }
  }
  if (!tokens) return "";

  let s = ` · 🌿 ${g(gco2)} CO₂ · 💧 ${ml(water)}`;

  // CO₂ is measured from this session; the savings figure is a modelled counterfactual
  // from a committed bench stamp. Badge width can't carry the caveat, so it carries a
  // `~` and an `est.` marker and `/honey-eco` prints the full basis. No stamp for this
  // model -> no savings claim.
  const sv = eco.savingsInfo(cfg, mode, topModel);
  if (sv && sv.k > 0) {
    // Honey cuts output tokens; only those go through the estimator as saved. No $ here:
    // session cost is mostly input/cache, so cost x k would overclaim — `honey-usage
    // --savings` prices the saved output tokens instead.
    let saved = 0;
    for (const [model, t] of Object.entries(perModel)) saved += eco.estimate(model, t.output * sv.k, cfg).gco2;
    s += ` (est. saved ~${g(saved)})`;
  }
  return s;
}

// Sum token kinds per model. Transcripts are append-only, so cache the running
// sums per path and parse only the bytes appended since the last render — O(new)
// instead of re-reading the whole (unboundedly growing) file every statusline tick.
function tokensByModel(tx) {
  const cacheFile = path.join(DIR, ".honey-statusline-cache.json");
  let store = {};
  try { store = JSON.parse(fs.readFileSync(cacheFile, "utf8")); } catch {}

  const size = fs.statSync(tx).size;
  const prev = store[tx] && store[tx].v === 2 ? store[tx] : null; // v1 cached output only
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
    const t = (perModel[m.model] = perModel[m.model] || { input: 0, output: 0, cache_read: 0, cache_write: 0 });
    const u = m.usage;
    t.input += u.input_tokens || 0;
    t.output += u.output_tokens || 0;
    t.cache_read += u.cache_read_input_tokens || 0;
    t.cache_write += u.cache_creation_input_tokens || 0;
  }

  store[tx] = { v: 2, offset: from + consumed, perModel };
  try { fs.writeFileSync(cacheFile, JSON.stringify(store)); } catch {}
  return perModel;
}

function ml(v) {
  return v >= 1000 ? `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}L` : `${Math.round(v)}mL`;
}

function g(v) {
  if (v >= 1000) return `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}kg`;
  return v >= 100 ? `${Math.round(v)}g` : v >= 1 ? `${v.toFixed(1)}g` : `${v.toFixed(2)}g`;
}
