#!/usr/bin/env node
// Faithful port of EcoLogits v0.8.2 LLM impact model (genai-impact/ecologits, MIT).
// Mean-value path only — we want one number for the badge, not the +/-1.96 sigma band.
// Grid intensity comes from eco-config.json so the estimate reflects where Claude
// actually runs (AWS Trainium, PA/IN/MS ~500 gCO2/kWh), not EcoLogits' world mix.
// For the authoritative figure (embodied + ADPe + primary energy) run the real
// package via scripts/eco_report.py — this JS exists to keep the statusline fast
// and dependency-free.
"use strict";

const fs = require("fs");
const path = require("path");

// EcoLogits 0.8.2 constants — units: kWh, kgCO2eq, seconds, GB.
const Q_BITS = 4;
const E_ALPHA = 8.91e-8, E_BETA = 1.43e-6; // GPU energy/token: alpha*activeB + beta
const L_ALPHA = 8.02e-4, L_BETA = 2.23e-2; // GPU latency/token: alpha*activeB + beta
const GPU_MEM = 80, GPU_EMB_GWP = 143;
const SRV_GPUS = 8, SRV_POWER = 1, SRV_EMB_GWP = 3000;
const LIFETIME = 5 * 365 * 24 * 3600;
const PUE = 1.2;

function loadConfig() {
  return JSON.parse(fs.readFileSync(path.join(__dirname, "eco-config.json"), "utf8"));
}

// Resolve a model id ("claude-opus-4-8", "claude-3-5-haiku-...") to assumed params.
function resolveParams(model, cfg) {
  const id = String(model || "").toLowerCase();
  for (const m of cfg.models) if (m.match.some((s) => id.includes(s))) return m;
  return cfg.default_model;
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

function estimate(model, outTokens, cfg) {
  cfg = cfg || loadConfig();
  const p = resolveParams(model, cfg);
  return impacts(p.active, p.total, outTokens, gridFor(p.provider, cfg));
}

module.exports = { loadConfig, resolveParams, impacts, estimate, gridFor };
