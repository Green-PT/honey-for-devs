"use strict";
// Minimal Anthropic Messages + OpenAI Responses client over fetch (Node 18+).

const ANTHROPIC_BASE = (process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com").replace(/\/$/, "");
const OPENAI_BASE = (process.env.OPENAI_BASE_URL || "https://api.openai.com").replace(/\/$/, "");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const TRANSIENT = new Set([408, 409, 429, 500, 502, 503, 504, 529]);

// POST JSON with retry — a long benchmark run will hit the odd transient network drop or
// 429/overloaded; one of those shouldn't kill 300+ generations. Up to 8 attempts with capped
// exponential backoff (~1,2,4,8,16,30,30s ≈ 90s total) to ride out a sustained provider overload.
const MAX_ATTEMPTS = 7;
const backoff = (a) => Math.min(30000, 1000 * 2 ** a) + Math.floor(Math.random() * 500);
async function postJSON(url, headers, body, label) {
  let lastErr;
  for (let attempt = 0; attempt <= MAX_ATTEMPTS; attempt++) {
    let res;
    try {
      res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
    } catch (e) {
      lastErr = e; // network error (fetch failed / ECONNRESET)
      if (attempt < MAX_ATTEMPTS) { await sleep(backoff(attempt)); continue; }
      throw e;
    }
    if (res.ok) return res.json();
    const text = await res.text();
    lastErr = new Error(`${label} ${res.status}: ${text.slice(0, 400)}`);
    if (TRANSIENT.has(res.status) && attempt < MAX_ATTEMPTS) {
      await sleep(backoff(attempt));
      continue;
    }
    throw lastErr;
  }
  throw lastErr;
}

async function complete({ model, system, user, maxTokens = 4096, thinking = 0 }) {
  return /^(gpt-|o\d|chatgpt-)/i.test(model)
    ? completeOpenAI({ model, system, user, maxTokens, thinking })
    : completeAnthropic({ model, system, user, maxTokens, thinking });
}

async function completeAnthropic({ model, system, user, maxTokens, thinking }) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY is not set");

  const body = {
    model,
    max_tokens: maxTokens,
    messages: [{ role: "user", content: user }],
  };
  // Cache the skill system prompt: in real agentic use it's loaded once per session, not
  // re-billed per task. cache_control makes repeat calls read it at ~10% input cost.
  if (system) body.system = [{ type: "text", text: system, cache_control: { type: "ephemeral" } }];
  if (thinking > 0) {
    body.thinking = { type: "enabled", budget_tokens: thinking };
    body.max_tokens = maxTokens + thinking; // max_tokens must exceed the thinking budget
  }

  const data = await postJSON(
    `${ANTHROPIC_BASE}/v1/messages`,
    { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body,
    "anthropic"
  );
  const text = (data.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");
  const u = data.usage || {};
  return {
    text,
    usage: {
      input: u.input_tokens || 0,
      output: u.output_tokens || 0,
      // cache fields are reported but not added into billed totals here
      cache_read: u.cache_read_input_tokens || 0,
      cache_write: u.cache_creation_input_tokens || 0,
    },
  };
}

async function completeOpenAI({ model, system, user, maxTokens, thinking }) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is not set");

  const body = {
    model,
    input: user,
    // Reasoning models spend output budget on hidden reasoning before the answer; without
    // headroom the answer gets truncated (empty reply at the cap). Add room beyond the
    // answer budget so the visible output isn't starved.
    max_output_tokens: maxTokens + 8192,
    store: false,
  };
  if (system) body.instructions = system;
  if (thinking > 0) body.reasoning = { effort: "medium" };

  const data = await postJSON(
    `${OPENAI_BASE}/v1/responses`,
    { "content-type": "application/json", authorization: `Bearer ${key}` },
    body,
    "openai"
  );
  const text = data.output_text || (data.output || [])
    .flatMap((item) => item.content || [])
    .filter((item) => item.type === "output_text")
    .map((item) => item.text)
    .join("");
  const u = data.usage || {};
  const cached = u.input_tokens_details?.cached_tokens || 0;
  return {
    text,
    usage: {
      input: Math.max(0, (u.input_tokens || 0) - cached),
      output: u.output_tokens || 0,
      cache_read: cached,
      cache_write: 0,
    },
  };
}

module.exports = { complete };
