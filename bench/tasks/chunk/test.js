const assert = require("assert");
const mod = require("./solution.js");
const chunk = typeof mod === "function" ? mod : mod.chunk;

assert.deepStrictEqual(chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
assert.deepStrictEqual(chunk([1, 2, 3, 4], 2), [[1, 2], [3, 4]]);
assert.deepStrictEqual(chunk([], 3), []);
assert.deepStrictEqual(chunk([1], 5), [[1]]);

const src = [1, 2, 3];
chunk(src, 2);
assert.deepStrictEqual(src, [1, 2, 3], "chunk mutated its argument");
console.log("ok");
