"use strict";
// Objective grader for user-facing web artifacts: a named structural + accessibility
// checklist. "passed" = every check the task requires holds. This is where over-
// compression shows up objectively — a stripped-down page fails alt-text, labels,
// responsiveness, or whole sections that a polished one keeps.

const CHECKS = {
  doctype: (h) => /<!doctype html>/i.test(h),
  title: (h) => /<title>\s*\S[^<]*<\/title>/i.test(h),
  viewport: (h) => /<meta[^>]+name=["']viewport["']/i.test(h),
  h1: (h) => /<h1[\s>]/i.test(h),
  nav: (h) => /<nav[\s>]/i.test(h) || /<header[\s>]/i.test(h),
  footer: (h) => /<footer[\s>]/i.test(h),
  css: (h) => /<style[\s>]/i.test(h) || /<link[^>]+stylesheet/i.test(h),
  // a real call-to-action: a button, or a link styled as one
  cta: (h) => /<button[\s>]/i.test(h) || /<a\b[^>]*class=["'][^"']*(btn|cta|button)/i.test(h),
  // genuinely responsive: a media query, OR a fluid layout (flex-wrap / grid auto-fit /
  // minmax / clamp). A flex/grid page with fluid sizing reflows without any @media.
  responsive: (h) =>
    /@media\b/i.test(h) ||
    /flex-wrap\s*:/i.test(h) ||
    /grid-template-columns[^;]*(auto-fit|auto-fill|minmax)/i.test(h) ||
    /clamp\(/i.test(h),
  // accessibility: no <img> without an alt attribute
  img_alt: (h) => {
    const imgs = h.match(/<img\b[^>]*>/gi) || [];
    return imgs.every((t) => /\balt\s*=/i.test(t));
  },
  // accessibility: every visible form control is labelled (wrapping <label> or for=/aria-label)
  labels: (h) => {
    const inputs = (h.match(/<(input|select|textarea)\b[^>]*>/gi) || []).filter(
      (t) => !/type=["'](hidden|submit|button)["']/i.test(t)
    );
    if (!inputs.length) return true;
    const ids = (h.match(/\bid=["']([^"']+)["']/gi) || []).map((s) => s.toLowerCase());
    const labelFors = (h.match(/<label\b[^>]*\bfor=["']([^"']+)["']/gi) || []).length;
    const ariaLabels = (h.match(/aria-label(ledby)?=/gi) || []).length;
    const wrapping = (h.match(/<label\b[^>]*>[\s\S]*?<(input|select|textarea)/gi) || []).length;
    return labelFors + ariaLabels + wrapping >= inputs.length;
  },
};

function gradeWeb(task, html) {
  if (!html || !/<(html|body|main|section|div)\b/i.test(html))
    return { passed: false, detail: "no HTML in reply" };

  const required = task.meta.checks || [];
  const minSections = task.meta.min_sections || 0;
  const results = [];
  for (const name of required) {
    const fn = CHECKS[name];
    if (!fn) continue;
    results.push([name, fn(html)]);
  }
  if (minSections) {
    // count semantic blocks: <section>/<article>, and fall back to <h2> headings as
    // evidence of distinct sections (a div-based page with N h2s has N sections).
    const blocks = (html.match(/<(section|article)[\s>]/gi) || []).length;
    const h2s = (html.match(/<h2[\s>]/gi) || []).length;
    results.push([`>=${minSections} sections`, Math.max(blocks, h2s) >= minSections]);
  }
  const failed = results.filter(([, ok]) => !ok).map(([n]) => n);
  return {
    passed: failed.length === 0,
    detail: failed.length ? `failed: ${failed.join(", ")}` : "ok",
    checks: results.length,
    failedCount: failed.length,
  };
}

module.exports = { gradeWeb, CHECKS };
