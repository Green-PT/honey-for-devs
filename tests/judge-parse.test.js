const { test } = require("node:test");
const assert = require("node:assert");
const { parseScore } = require("../bench/src/judge");

test("parseScore: last object wins over prose braces", () => {
  assert.equal(parseScore('uses {} as default. {"score": 91, "note": "ok"}').score, 91);
  assert.equal(parseScore('draft {"score": 80, "note": "a"}\nfinal {"score": 95, "note": "b"}').score, 95);
});

test("parseScore: a note that breaks JSON still yields the score", () => {
  assert.equal(parseScore('{"score": 88, "note": "returns {} on "empty" input"}').score, 88);
  assert.equal(parseScore('{"score": 77, "note": "uses dict {k: v}"}').score, 77);
});

test("parseScore: no score at all is null; out-of-range clamps", () => {
  assert.equal(parseScore("").score, null);
  assert.equal(parseScore("looks fine").score, null);
  assert.equal(parseScore('{"score": 140, "note": "x"}').score, 100);
});
