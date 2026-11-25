#!/usr/bin/env node
// Token-based CO2e and water estimate for LLM inference, per the method in
// Llopis-Garcia (2026), "Accounting for purchased artificial intelligence inference in
// corporate greenhouse gas inventories: A token-based method", Sustainable Production
// and Consumption 70, 320-347, doi:10.1016/j.spc.2026.11.003 (preprint arXiv 2606.10660).
// Factors: SAEF dataset v3.2.0, CC BY 4.0 (see eco-config.json and NOTICE). Equations are
// implemented here from the paper; no SAEF code is used.
//
//   T_eff = (out + W_in*(uncached in + cache writes) + W_cache*cache reads) / D
//   kgCO2e = T_eff/1e6 * inference footprint + T_billed/1e6 * training term
//   water  = T_eff/1e3 * mL per 1k effective tokens (on-site WUE + off-site EWIF)
//
// The model id maps to a size class (A small, B standard, C frontier) by tier word;
// unmapped ids get the conservative class C, as the paper prescribes. Region is the
// global average: Claude/GPT routing is not disclosed, the paper's rule for that case.
"use strict";

const fs = require("fs");
const path = require("path");

function loadConfig() {
  return JSON.parse(fs.readFileSync(path.join(__dirname, "eco-config.json"), "utf8"));
}

function modelClass(model, cfg) {
  const id = String(model || "").toLowerCase();
  const rule = cfg.class_rules.find((r) => r.match.some((s) => id.includes(s)));
  return rule ? rule.class : cfg.default_class;
}

// tokens: output count, or {input, output, cache_read, cache_write} (bench/pricing shape;
// input = uncached). Cache writes are freshly prefilled input, so they weigh as uncached.
function estimate(model, tokens, cfg) {
  cfg = cfg || loadConfig();
  const t = typeof tokens === "number" ? { output: tokens } : tokens || {};
  const { input = 0, output = 0, cache_read = 0, cache_write = 0 } = t;
  const tb = cfg.token_basis;
  const cls = modelClass(model, cfg);
  const f = cfg.classes[cls];
  const eff = (output + tb.w_in * (input + cache_write) + tb.w_cache * cache_read) / tb.d;
  const billed = input + output + cache_read + cache_write;
  const training = (billed / 1e6) * f.training_kg_per_m_billed;
  return {
    class: cls,
    effTokens: eff,
    energyKwh: (eff / 1e6) * f.facility_kwh_per_m_eff,
    gco2: ((eff / 1e6) * f.footprint_kg_per_m_eff + training) * 1000,
    gco2High: ((eff / 1e6) * f.footprint_high_kg_per_m_eff + training) * 1000,
    waterMl: (eff / 1e3) * f.water_ml_per_1k_eff,
    waterMlExclHydro: (eff / 1e3) * f.water_excl_hydro_ml_per_1k_eff,
  };
}

// Saved CO2/$ multiplier: a token reduction R implies baseline = actual/(1-R),
// so savings scale by R/(1-R). Guard R>=1 (a misconfig) to avoid Infinity/NaN.
function savingsFactor(cfg, mode) {
  const R = (cfg.savings_vs_baseline && cfg.savings_vs_baseline[mode]) || 0;
  return R < 1 ? R / (1 - R) : 0;
}

// The savings ratio WITH its provenance. The number is a modelled counterfactual from a
// committed bench stamp — it was never measured for the session being reported — so this
// returns the label callers must print alongside it.
//
// Returns null when no committed stamp covers the session's model. A tool that reports
// its own savings against a counterfactual it never ran is grading its own homework;
// no number is the honest output there, not an extrapolated one.
function savingsInfo(cfg, mode, model) {
  const prov = cfg.savings_provenance || {};
  const byModel = prov.by_model || {};
  const key = model ? Object.keys(byModel).find((k) => String(model).toLowerCase().includes(k)) : null;
  if (!key) return null;

  const src = byModel[key];
  const scale = (cfg.savings_vs_baseline || {})[mode];
  const full = (cfg.savings_vs_baseline || {}).full;
  if (!scale || !full) return null;

  const R = src.ratio * (scale / full); // lite/ultra keep their historical ratio to full
  const measured = mode === prov.measured_mode;
  return {
    R,
    k: R < 1 ? R / (1 - R) : 0,
    measured,
    stamp: src.stamp || prov.stamp,
    model: src.model,
    p: src.p,
    label: measured
      ? `modeled from ${src.stamp || prov.stamp} (${src.model}, n=${src.n ?? prov.n}, p=${src.p}) — not measured for this session`
      : `extrapolated from the '${prov.measured_mode}' figure in ${src.stamp || prov.stamp} — not measured for this session, and this mode was never benchmarked`,
  };
}

module.exports = { loadConfig, estimate, savingsFactor, savingsInfo };
