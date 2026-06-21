function parseQuery(qs) {
  const out = {};
  const s = qs.replace(/^\?/, "");
  if (!s) return out;
  for (const pair of s.split("&")) {
    const i = pair.indexOf("=");
    const rawK = i === -1 ? pair : pair.slice(0, i);
    const rawV = i === -1 ? "" : pair.slice(i + 1);
    const k = decodeURIComponent(rawK.replace(/\+/g, " "));
    const v = decodeURIComponent(rawV.replace(/\+/g, " "));
    if (k in out) out[k] = [].concat(out[k], v);
    else out[k] = v;
  }
  return out;
}
module.exports = parseQuery;
