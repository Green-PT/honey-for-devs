const assert = require("assert");
const mod = require("./solution.js");
const parseQuery = typeof mod === "function" ? mod : mod.parseQuery;

assert.deepStrictEqual(parseQuery("?a=1&b=hi%20there&a=2&flag"), {
  a: ["1", "2"],
  b: "hi there",
  flag: "",
});
assert.deepStrictEqual(parseQuery(""), {});
assert.deepStrictEqual(parseQuery("x=a+b"), { x: "a b" });
assert.deepStrictEqual(parseQuery("k=1"), { k: "1" });
console.log("ok");
