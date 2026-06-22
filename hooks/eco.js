#!/usr/bin/env node
// Faithful port of EcoLogits v0.8.2 LLM impact model (genai-impact/ecologits, MIT).
// Mean-value path only — we want one number for the badge, not the +/-1.96 sigma band.
// Grid intensity comes from eco-config.json so the estimate reflects where Claude
// actually runs (AWS Trainium, PA/IN/MS ~500 gCO2/kWh), not EcoLogits' world mix.
//
// impacts() is the verbatim single-stream (batch-size-1) EcoLogits figure — an
// upper bound that assigns one request the whole GPU set for the full latency.
// estimate() divides that ceiling by eco-config.json's serving_concurrency to
// report realistic SERVED (continuously-batched) impact, and also returns the
// untouched ceiling. See the _serving_note in eco-config.json for the rationale.
// For the authoritative figure (embodied + ADPe + primary energy) run the real
// package via scripts/eco_report.py — this JS exists to keep the statusline fast
// and dependency-free.
"use strict";

const fs = require("fs");
const path = require("path");

// EcoLogits 0.8.2 constants — units: kWh, kgCO2eq, seconds, GB.
// These constants and the per-request impact methodology are derived from
// EcoLogits (genai-impact/ecologits) and are licensed MPL-2.0, not MIT.
// See NOTICE. Source: https://github.com/genai-impact/ecologits
const Q_BITS = 4;
const E_ALPHA = 8.91e-8, E_BETA = 1.43e-6; // GPU energy/token: alpha*activeB + beta
const L_ALPHA = 8.02e-4, L_BETA = 2.23e-2; // GPU latency/token: alpha*activeB + beta
const GPU_MEM = 80, GPU_EMB_GWP = 143;
const SRV_GPUS = 8, SRV_POWER = 1, SRV_EMB_GWP = 3000;
const LIFETIME = 5 * 365 * 24 * 3600;
const PUE = 1.2;

function loadConfig() {
  const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, "eco-config.json"), "utf8"));
  cfg._registry = JSON.parse(
    fs.readFileSync(path.join(__dirname, "eco-models.json"), "utf8")
  ).models;
  return cfg;
}

// Resolve a model id to {active, total, provider} using EcoLogits' registry:
// exact name -> else first alias substring -> else default_alias. Params are
// always the registry's, never hand-typed.
function resolveParams(model, cfg) {
  const reg = cfg._registry;
  const id = String(model || "");
  if (reg[id]) return reg[id];
  const lid = id.toLowerCase();
  for (const a of cfg.aliases) {
    if (a.match.some((s) => lid.includes(s)) && reg[a.registry]) return reg[a.registry];
  }
  return reg[cfg.default_alias];
}

// EcoLogits mean impacts for one generation. grid in kgCO2eq/kWh. request_latency=inf.
function impacts(activeB, totalB, outTokens, grid) {
  const gpuEnergy = outTokens * (E_ALPHA * activeB + E_BETA); // kWh, single GPU
  const latency = outTokens * (L_ALPHA * activeB + L_BETA); // s
  const gpuCount = Math.ceil((1.2 * totalB * Q_BITS / 8) / GPU_MEM);
  const serverEnergy = (latency / 3600) * SRV_POWER * (gpuCount / SRV_GPUS);
  const energyKwh = PUE * (serverEnergy + gpuCount * gpuEnergy);
  const embGwp = (latency / LIFETIME) *
    ((gpuCount / SRV_GPUS) * SRV_EMB_GWP + gpuCount * GPU_EMB_GWP);
  return { energyKwh, gco2: (energyKwh * grid + embGwp) * 1000 };
}

// Grid follows the model's provider (Anthropic/AWS, OpenAI/Azure, Google/GCP).
function gridFor(provider, cfg) {
  const g = cfg.grids_gco2_per_kwh;
  return (g[provider] != null ? g[provider] : g.default) / 1000; // -> kgCO2eq/kWh
}

// Served estimate: the faithful single-stream ceiling divided by serving_concurrency
// (continuous-batching amortization). Returns the served figure as `gco2` plus the
// untouched single-stream `gco2Ceiling` and the `concurrency` used.
function estimate(model, outTokens, cfg) {
  cfg = cfg || loadConfig();
  const p = resolveParams(model, cfg);
  const B = cfg.serving_concurrency > 0 ? cfg.serving_concurrency : 1;
  const ceiling = impacts(p.active, p.total, outTokens, gridFor(p.provider, cfg));
  return {
    energyKwh: ceiling.energyKwh / B,
    gco2: ceiling.gco2 / B,
    gco2Ceiling: ceiling.gco2,
    concurrency: B,
  };
}

// Saved CO2/$ multiplier: a token reduction R implies baseline = actual/(1-R),
// so savings scale by R/(1-R). Guard R>=1 (a misconfig) to avoid Infinity/NaN.
function savingsFactor(cfg, mode) {
  const R = (cfg.savings_vs_baseline && cfg.savings_vs_baseline[mode]) || 0;
  return R < 1 ? R / (1 - R) : 0;
}

module.exports = { loadConfig, resolveParams, impacts, estimate, gridFor, savingsFactor };
