const assert = require("assert");
const mod = require("./solution.js");
const memoize = typeof mod === "function" ? mod : mod.memoize;
let calls = 0;
const add = (a, b) => { calls++; return a + b; };
const m = memoize(add);
assert.strictEqual(m(1, 2), 3);
assert.strictEqual(m(1, 2), 3);
assert.strictEqual(calls, 1);     // second call served from cache
assert.strictEqual(m(2, 2), 4);
assert.strictEqual(calls, 2);     // different args recompute
assert.strictEqual(m(1, 2), 3);
assert.strictEqual(calls, 2);     // still cached
console.log("ok");
