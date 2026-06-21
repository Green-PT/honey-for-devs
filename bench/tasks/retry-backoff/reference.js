async function retry(fn, { retries = 3, baseDelay = 100 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (attempt < retries) await new Promise((r) => setTimeout(r, baseDelay * 2 ** attempt));
    }
  }
  throw lastErr;
}
module.exports = retry;
