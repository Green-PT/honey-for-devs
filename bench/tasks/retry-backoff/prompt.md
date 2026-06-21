Write a JavaScript async function `retry(fn, options)` that calls the async function `fn` and
retries it on rejection with exponential backoff.

- `options.retries` (default 3) is the number of *additional* attempts after the first, so the
  total number of calls is at most `retries + 1`.
- `options.baseDelay` (default 100, ms) — wait `baseDelay * 2 ** attempt` before each retry
  (attempt index starting at 0).
- Resolve with `fn`'s value on the first success. If every attempt rejects, throw the last error.

Put it in a single JavaScript code block and `module.exports = retry` (or `{ retry }`).
