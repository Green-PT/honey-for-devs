const assert = require("assert");
const mod = require("./solution.js");
const deepMerge = typeof mod === "function" ? mod : mod.deepMerge;

const a = { a: 1, b: { c: 2, d: 3 }, list: [1, 2] };
const b = { b: { d: 4, e: 5 }, f: 6, list: [9] };
assert.deepStrictEqual(deepMerge(a, b), { a: 1, b: { c: 2, d: 4, e: 5 }, f: 6, list: [9] });
// inputs not mutated
assert.deepStrictEqual(a, { a: 1, b: { c: 2, d: 3 }, list: [1, 2] });
assert.deepStrictEqual(b, { b: { d: 4, e: 5 }, f: 6, list: [9] });
console.log("ok");
