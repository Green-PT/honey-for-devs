"use strict";
// hooks/eco.js against SAEF v3.2.0's own published columns: the per-billed-token factor
// at the default mix (85% input, no cache) checks the token basis, the class factors
// and the training term together.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const eco = require("./eco.js");

const cfg = eco.loadConfig();
const close = (a, b, tol = 1e-3) => assert.ok(Math.abs(a - b) <= tol * Math.abs(b), `${a} != ${b}`);

test("model ids map to SAEF size classes by tier word", () => {
  const cls = (m) => eco.estimate(m, 1, cfg).class;
  for (const m of ["claude-opus-5-5", "claude-fable-5-2", "claude-mythos-5-2", "gpt-6.2-astra", "gpt-6.2-sol", "o3", "some-new-model"])
    assert.equal(cls(m), "C", m);
  for (const m of ["claude-sonnet-5-5", "gpt-4o", "gpt-4.1", "gemini-2.5-pro"]) assert.equal(cls(m), "B", m);
  for (const m of ["claude-haiku-5-5", "gpt-4o-mini", "gpt-4.1-nano", "o4-mini", "gemini-2.5-flash", "gpt-6-luna", "gpt-6.1-terra"])
    assert.equal(cls(m), "A", m);
});

test("reproduces SAEF factor_kg_co2e_per_m_billed_tokens_default_mix", () => {
  const billedDefaultMix = { input: 850000, output: 150000 }; // 1M billed, 85% input share
  close(eco.estimate("claude-opus-5-5", billedDefaultMix, cfg).gco2, 146.69);
  close(eco.estimate("claude-sonnet-5-5", billedDefaultMix, cfg).gco2, 38.85);
  close(eco.estimate("claude-haiku-5-5", billedDefaultMix, cfg).gco2, 11.53);
  close(eco.estimate("claude-opus-5-5", billedDefaultMix, cfg).effTokens, 302465, 1e-5);
});

test("cache reads weigh 0.05, cache writes as fresh input, a number is output only", () => {
  const e = (t) => eco.estimate("claude-opus-5-5", t, cfg).effTokens;
  close(e({ cache_read: 1e6 }), 0.05e6 / 1.339);
  close(e({ cache_write: 1e6 }), e({ input: 1e6 }));
  assert.equal(e(1000), e({ output: 1000 }));
  close(eco.estimate("claude-opus-5-5", { output: 1339 }, cfg).waterMl, 3.1599); // 1k effective, class C
});
