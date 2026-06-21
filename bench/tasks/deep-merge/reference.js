function isPlainObject(x) {
  return x !== null && typeof x === "object" && !Array.isArray(x);
}
function deepMerge(target, source) {
  const out = { ...target };
  for (const k of Object.keys(source)) {
    out[k] = isPlainObject(out[k]) && isPlainObject(source[k]) ? deepMerge(out[k], source[k]) : source[k];
  }
  return out;
}
module.exports = deepMerge;
