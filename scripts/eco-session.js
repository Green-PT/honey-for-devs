#!/usr/bin/env node
// Zero-dependency session CO2e + water report — the same numbers the statusline
// badge shows, on demand and not tied to stdin, with the full basis. Reuses the
// token-based estimator (hooks/eco.js) so the figure matches the badge exactly.
//
//   node scripts/eco-session.js [--transcript PATH] [--mode lite|full|ultra]
//
// Without --transcript it picks the newest *.jsonl under ~/.claude/projects.
// Without --mode it reads the active mode flag, falling back to full.
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const eco = require(path.join(__dirname, "..", "hooks", "eco.js"));

function arg(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function newestTranscript() {
  const base = path.join(process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), ".claude"), "projects");
  let newest = null, newestMtime = -1;
  const walk = (dir) => {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith(".jsonl")) {
        let m;
        try { m = fs.statSync(p).mtimeMs; } catch { continue; } // rotated away mid-walk
        if (m > newestMtime) { newestMtime = m; newest = p; }
      }
    }
  };
  walk(base);
  return newest;
}

function activeMode() {
  return require(path.join(__dirname, "..", "hooks", "honey-state.js")).readMode() || "full";
}

const tx = arg("--transcript") || newestTranscript();
if (!tx || !fs.existsSync(tx)) { console.error("no transcript found"); process.exit(1); }
const mode = arg("--mode") || activeMode();

const cfg = eco.loadConfig();
const perModel = {};
for (const line of fs.readFileSync(tx, "utf8").split("\n")) {
  if (!line) continue;
  let o; try { o = JSON.parse(line); } catch { continue; }
  const m = o.message;
  if (!m || m.role !== "assistant" || !m.usage) continue;
  const t = (perModel[m.model] = perModel[m.model] || { input: 0, output: 0, cache_read: 0, cache_write: 0 });
  const u = m.usage;
  t.input += u.input_tokens || 0;
  t.output += u.output_tokens || 0;
  t.cache_read += u.cache_read_input_tokens || 0;
  t.cache_write += u.cache_creation_input_tokens || 0;
}

const sum = { gco2: 0, gco2High: 0, waterMl: 0, waterMlExclHydro: 0, energyKwh: 0, effTokens: 0 };
let tokens = 0, topModel = null, topTokens = 0;
console.log(`transcript : ${tx}`);
console.log(`mode       : ${mode}`);
for (const [model, t] of Object.entries(perModel)) {
  if (!t.output) continue;
  const e = eco.estimate(model, t, cfg);
  for (const k of Object.keys(sum)) sum[k] += e[k];
  tokens += t.output;
  if (t.output > topTokens) { topTokens = t.output; topModel = model; }
  console.log(`  ${model.padEnd(28)} class ${e.class} (${cfg.classes[e.class].label})  ` +
    `in ${t.input} · out ${t.output} · cache-r ${t.cache_read} · cache-w ${t.cache_write}  -> ${e.gco2.toFixed(2)} g`);
}
if (!tokens) { console.error("no output tokens in transcript"); process.exit(1); }

console.log(`output tok : ${tokens.toLocaleString()}  (effective tokens: ${Math.round(sum.effTokens).toLocaleString()})`);
console.log(`energy     : ${(sum.energyKwh * 1000).toFixed(1)} Wh  (facility)`);
console.log(`CO2e       : ${sum.gco2.toFixed(2)} g  (high case ${sum.gco2High.toFixed(2)} g)`);
console.log(`water      : ${sum.waterMl.toFixed(0)} mL  (${sum.waterMlExclHydro.toFixed(0)} mL excl. hydro evaporation)`);

// The CO2-per-token figure above is computed from this session. The savings figure is
// NOT — it is a modelled counterfactual from a committed bench stamp, so it is labelled
// as one, and omitted entirely when no stamp covers this session's model.
const sv = eco.savingsInfo(cfg, mode, topModel);
if (sv) {
  let saved = 0;
  for (const [model, t] of Object.entries(perModel)) saved += eco.estimate(model, t.output * sv.k, cfg).gco2;
  console.log(`saved      : ~${saved.toFixed(2)} g CO2e  (assumes ${Math.round(sv.R * 100)}% fewer output tokens than a no-Honey run; input is not cut)`);
  console.log(`  basis    : ${sv.label}`);
} else {
  console.log(`saved      : —  (no committed bench stamp covers ${topModel || "this model"}; run bench/ on it rather than extrapolating)`);
}

console.log(`\nMethod: Llopis-Garcia (2026), Sustain. Prod. Consum. 70:320-347, doi:10.1016/j.spc.2026.11.003.`);
console.log(`Factors: SAEF v3.2.0 (CC BY 4.0), global-average grid and water. Closed models get their size`);
console.log(`class's mean of measured open-weight models; the paper calls the energy term best-case, with`);
console.log(`a 2.0-2.8x serving-regime range. Treat as an estimate, not a meter reading.`);
