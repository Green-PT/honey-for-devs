"use strict";

const assert = require("node:assert/strict");
const { execFileSync, spawnSync } = require("node:child_process");
const test = require("node:test");
const { decode, tryDecode, encode } = require(".");

// JSON.stringify throws on BigInt; compare via a replacer so big-int payloads
// participate in round-trip checks. Same transform both sides → still catches drift.
const j = (x) => JSON.stringify(x, (_, v) => (typeof v === "bigint" ? `#${v}` : v));

const handoff = {
  from: "reviewer",
  to: "implementer",
  kind: "code_review",
  findings: [
    { severity: "high", file: "src/auth.js", line: 42, message: "token never expires" },
    { severity: "medium", file: "src/api.js", line: 18, message: "missing rate limit" },
    { severity: "low", file: "src/ui.js", line: null, message: "true" },
  ],
  meta: { complete: true, retry: null, tags: ["security", "api"] },
};

test("round-trips an agent handoff losslessly", () => {
  assert.deepEqual(decode(encode(handoff)), handoff);
});

test("round-trips ambiguous and escaped strings", () => {
  const data = { minusZero: -0, values: ["", "null", "01", "  padded  ", "a\tb", "a\nb", "[text", "plain"] };
  assert.deepEqual(decode(encode(data)), data);
});

test("round-trips empty objects and empty record arrays", () => {
  const data = { meta: {}, rows: [{}, {}], context: { inner: {} }, items: [] };
  assert.deepEqual(decode(encode(data)), data);
});

test("preserves integers beyond Number.MAX_SAFE_INTEGER as BigInt", () => {
  const big = 9007199254740993n; // 2^53 + 1 — corrupts to ...992 if parsed via Number()
  assert.equal(decode(encode({ id: big })).id, big);
  assert.equal(decode("!eso/1\nid=9007199254740993\n").id, big); // literal from another runtime
  assert.equal(typeof decode(encode({ n: 42 })).n, "number"); // safe range stays Number
  const data = { rows: [{ id: big }], ids: [big] }; // record fields + scalar arrays
  assert.deepEqual(decode(encode(data)), data);
  // property-style: varied magnitude/sign, at every valid position, round-trips exact
  for (let p = 16; p <= 40; p++) {
    for (const v of [10n ** BigInt(p), -(10n ** BigInt(p)) - 7n]) {
      const doc = { x: v, rows: [{ id: v }], ids: [v, v + 1n] };
      assert.deepEqual(decode(encode(doc)), doc, `big-int round-trip failed for ${v}`);
    }
  }
});

test("tryDecode returns a result instead of throwing", () => {
  const good = tryDecode(encode(handoff));
  assert.equal(good.ok, true);
  assert.deepEqual(good.value, handoff);
  const bad = tryDecode("!eso/1\nrows[2]{id}\n1\n");
  assert.equal(bad.ok, false);
  assert.match(bad.error.message, /expected 2 rows/);
});

test("rejects keys that are not valid names instead of corrupting them", () => {
  assert.throws(() => encode({ "a b": 1 }), /Invalid ESO name/);
  assert.throws(() => encode({ "café": 1 }), /Invalid ESO name/);
});

test("rejects malformed input and schema drift", () => {
  assert.throws(() => decode("!eso/1\nrows[2]{id}\n1\n"), /expected 2 rows/);
  assert.throws(() => decode("!eso/1\nrow{x,x}\n1\t2\n"), /Duplicate field/);
  assert.throws(() => encode({ rows: [{ a: 1 }, { b: 2 }] }), /one schema/);
  assert.throws(() => encode({ "bad name": 1 }), /Invalid ESO name/);
  assert.throws(() => encode({ nested: { bad: NaN } }), /finite numbers/);
  assert.throws(() => encode({ nested: { bad: undefined } }), /Unsupported ESO value/);
  assert.throws(() => decode("!eso/1\nn=1e999\n"), /Invalid ESO number/);
});

test("treats prototype-shaped names as data", () => {
  const data = JSON.parse('{"__proto__":"safe","constructor":"also safe"}');
  assert.deepEqual(decode(encode(data)), data);
});

test("round-trips thousands of random documents losslessly", () => {
  // Seeded xorshift PRNG: deterministic, no external deps, reproducible failures.
  let seed = 0x2545f491;
  const rnd = () => {
    seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
    return (seed >>> 0) / 0xffffffff;
  };
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const name = () => pick(["a", "b", "c", "id", "x_1", "f.g", "h-i", "name", "Z"]);
  const scalar = () => pick([
    null, true, false, 0, -0, 1, -1, 42, 3.14, -2.5, 1e6, 9007199254740991,
    "", "x", "hello world", "  pad  ", "null", "true", "01", "1", "1.0",
    "a\tb", "a\nb", "[bracket", "{brace", '"quote', "café 🚀", "back\\slash", "!eso/1",
    "[2]", "a=b", "x[2]{y}", "id=5", "k{f}", "9007199254740993",
  ]);
  const keys = (n) => { const s = new Set(); while (s.size < n) s.add(name()); return [...s]; };
  const gen = (depth) => {
    const r = rnd();
    if (depth > 3 || r < 0.45) return scalar();
    if (r < 0.6) return Array.from({ length: Math.floor(rnd() * 4) }, scalar);
    if (r < 0.8) {
      const k = keys(1 + Math.floor(rnd() * 3));
      return Array.from({ length: Math.floor(rnd() * 4) }, () =>
        Object.fromEntries(k.map((key) => [key, gen(depth + 1)])));
    }
    return Object.fromEntries(keys(1 + Math.floor(rnd() * 4)).map((key) => [key, gen(depth + 1)]));
  };
  for (let i = 0; i < 5000; i++) {
    const root = Object.fromEntries(keys(1 + Math.floor(rnd() * 4)).map((key) => [key, gen(0)]));
    // Compare via JSON text: ESO guarantees JSON-semantics losslessness, where -0 and 0
    // are the same number (JSON.stringify(-0) === "0"). This comparison is order-sensitive,
    // so it still catches any field-order or value corruption.
    assert.equal(j(decode(encode(root))), j(root), `round-trip failed for ${j(root)}`);
  }
});

test("is smaller than compact JSON for repeated records", () => {
  assert.ok(Buffer.byteLength(encode(handoff)) < Buffer.byteLength(JSON.stringify(handoff)) * 0.75);
});

test("CLI encodes and decodes stdin", () => {
  const cli = require.resolve("../bin/eso.js");
  const encoded = execFileSync(process.execPath, [cli, "encode"], { input: JSON.stringify(handoff), encoding: "utf8" });
  const decoded = execFileSync(process.execPath, [cli, "decode"], { input: encoded, encoding: "utf8" });
  assert.deepEqual(JSON.parse(decoded), handoff);
  const big = execFileSync(process.execPath, [cli, "decode"], { input: "!eso/1\nid=9007199254740993\n", encoding: "utf8" });
  assert.match(big, /"id":9007199254740993(?!\d)/); // bare literal, not corrupted to ...992 or quoted
  const numStr = execFileSync(process.execPath, [cli, "decode"], { input: '!eso/1\ns="123"\n', encoding: "utf8" });
  assert.equal(JSON.parse(numStr).s, "123"); // numeric-looking string stays a string
  const bad = spawnSync(process.execPath, [cli], { encoding: "utf8" });
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /Usage/);
});
