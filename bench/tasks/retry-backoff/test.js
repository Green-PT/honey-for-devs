const assert = require("assert");
const mod = require("./solution.js");
const retry = typeof mod === "function" ? mod : mod.retry;
(async () => {
  let calls = 0;
  const v = await retry(async () => { calls++; if (calls < 3) throw new Error("fail"); return 42; },
    { retries: 5, baseDelay: 1 });
  assert.strictEqual(v, 42);
  assert.strictEqual(calls, 3);

  let c2 = 0;
  await assert.rejects(() => retry(async () => { c2++; throw new Error("always " + c2); },
    { retries: 2, baseDelay: 1 }));
  assert.strictEqual(c2, 3); // initial + 2 retries

  let c3 = 0;
  assert.strictEqual(await retry(async () => { c3++; return "ok"; }, { retries: 3, baseDelay: 1 }), "ok");
  assert.strictEqual(c3, 1); // no retry on first success
  console.log("ok");
})().catch((e) => { console.error(e); process.exit(1); });
