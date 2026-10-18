const test = require("node:test");
const assert = require("node:assert");
const { extractInfo } = require("../bench/src/extract");
const { parseScore } = require("../bench/src/judge");

test("a definition block with a require('./x') usage comment is still the solution", () => {
  const reply = "```js\nfunction f() {}\nmodule.exports = f;\n// check: node -e \"require('./f')()\"\n```";
  assert.strictEqual(extractInfo(reply, "javascript").nblocks, 1);
  assert.strictEqual(extractInfo("```js\nconst f = require('./solution');\nf();\n```", "javascript").nblocks, 0);
});

test("judge score parser takes the last score object, past prose braces", () => {
  assert.strictEqual(parseScore('out = {} is fine.\n{"score": 93, "note": "ok"}').score, 93);
  assert.strictEqual(parseScore("").score, null);
});
