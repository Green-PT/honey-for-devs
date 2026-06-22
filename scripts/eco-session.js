#!/usr/bin/env node
// Zero-dependency session CO2 report — the same numbers the statusline badge
// shows, on demand and not tied to stdin. Reuses the committed EcoLogits port
// (hooks/eco.js) so the figure matches the badge exactly. For the authoritative
// breakdown (embodied + ADPe + primary energy) run scripts/eco_report.py, which
// calls the real ecologits package.
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
  const dir = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), ".claude");
  try { return fs.readFileSync(path.join(dir, ".honey-active"), "utf8").trim() || "full"; } catch { return "full"; }
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
  perModel[m.model] = (perModel[m.model] || 0) + (m.usage.output_tokens || 0);
}

let gco2 = 0, ceiling = 0, tokens = 0, concurrency = 1;
console.log(`transcript : ${tx}`);
console.log(`mode       : ${mode}`);
for (const [model, out] of Object.entries(perModel)) {
  if (!out) continue;
  const e = eco.estimate(model, out, cfg);
  gco2 += e.gco2; ceiling += e.gco2Ceiling; tokens += out; concurrency = e.concurrency;
  console.log(`  ${model.padEnd(28)} ${String(out).padStart(8)} tok  -> ${e.gco2.toFixed(2)} g`);
}
if (!tokens) { console.error("no output tokens in transcript"); process.exit(1); }

const R = (cfg.savings_vs_baseline && cfg.savings_vs_baseline[mode]) || 0;
const k = eco.savingsFactor(cfg, mode);
console.log(`output tok : ${tokens.toLocaleString()}`);
console.log(`CO2eq      : ${gco2.toFixed(2)} g  (served, usage + embodied, JS port)`);
console.log(`saved (~${Math.round(R * 100)}% vs no-Honey): ${(gco2 * k).toFixed(2)} g CO2eq`);
console.log(`ceiling    : ${ceiling.toFixed(2)} g  (EcoLogits single-stream, /${concurrency} batching -> served)`);
console.log(`\nParams are speculative; served = single-stream ceiling / ${concurrency} (continuous batching). Treat as a range, not a meter reading.`);
