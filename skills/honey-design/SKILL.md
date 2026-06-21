---
name: honey-design
description: >-
  Same pixels, fewer tokens — for user-facing deliverables where visual polish is
  the spec. Use when building or editing a landing page, marketing site, hero,
  pricing/feature section, dashboard, or any HTML/CSS UI component. Keeps the full
  rendered design (layout depth, hierarchy, motion, responsive richness, a11y) and
  cuts tokens by expressing that design densely — CSS custom properties, shared
  classes, shorthand, fluid units — instead of by cutting the design. The honey
  core trims code and prose; this trims how the design is *written*, never how it
  looks. Reach for it whenever output is user-facing markup, even if the user never
  says "minimal".
argument-hint: "[the user-facing thing to build]"
license: MIT
---

# Honey Design (same pixels, fewer tokens)

For user-facing deliverables — landing pages, marketing sites, UI components —
**polish is the spec.** A bare, valid-but-ugly page is a fail, not a saving.

So the token lever here is **not** "emit less design." It's "express the same
design densely." Compress the *code*, never the rendered result. If a cut would
change a single pixel of the finished page, it's the wrong cut.

**Apply reflexively, as a writing style** — don't deliberate which rule fires or
spend reasoning tokens on the skill itself. Build the polished thing; write its
markup and CSS the dense way by habit.

## Hold the line on polish (the judged axis)

Never trade these for tokens — they *are* the deliverable:

- **Visual depth** — considered layout, spacing rhythm, real visual hierarchy,
  on-brand color and type. Not unstyled scaffolding.
- **Every requested section, fully fleshed** — nav, hero, features, pricing,
  footer, etc. A stubbed-out section is incomplete, not minimal.
- **Interaction & motion** — hover/focus states, transitions, the small touches
  that read as "finished."
- **Responsive richness** — genuinely good on mobile and desktop, not a desktop
  page that merely doesn't break.
- **Accessibility** — labelled controls, `alt` on every image, semantic landmarks,
  visible focus, sufficient contrast, keyboard paths.
- **Anything the user explicitly asked for.**

## The token lever — dense expression, identical render

Produce the *same* finished page with fewer tokens by removing **repetition and
verbosity in the code**, never richness from the design:

**CSS**

- **Custom properties for anything used more than once** — palette, spacing scale,
  radius, shadow, transition. Define in `:root` once, reference everywhere. The
  single biggest saver: a repeated `#1a1a2e`/`24px`/`box-shadow:…` becomes `var(--…)`.
- **Shared classes over repeated blocks.** Three feature cards = one `.card` rule,
  not three near-identical declaration blocks. Style by class, never inline.
- **Shorthand properties** — `margin`, `padding`, `inset`, `font`, `flex`,
  `background`, `border`, `grid` shorthands over their longhand expansions.
- **Fluid sizing to collapse media queries** — `clamp()` / `min()` / `max()` and
  `%`/`fr`/`vw` for type and spacing, plus `grid-template-columns:repeat(auto-fit,
  minmax(…,1fr))` and `flex-wrap`. One fluid rule often replaces a base rule plus
  two `@media` overrides. Keep an `@media` only where layout genuinely must change.
- **Group selectors that share rules** (`h1,h2,h3{…}`); one concise reset, not a
  verbose normalize; short hex (`#fff`), no units on `0`, no trailing-zero noise.
- **No dead, duplicated, or commented-out CSS.**

**HTML**

- **Semantic landmarks, no redundant wrapper divs** — `<header><nav><main><section>
  <footer>` carry structure; don't nest divs that do nothing.
- **No inline `style=` repetition** — push it to a class.
- **Concise, real-feeling copy** — enough to sell the design; no padded lorem.

**Prose around the artifact: near-zero.** The page is the answer. No "Here's your
landing page!", no walkthrough of what you built. One line max if something is
genuinely load-bearing (e.g. a font dependency).

## Self-check before you finish

> Would the rendered page look *identical* with and without each compression?

If yes — ship it; you moved cost out of the tokens, not out of the design. If a
"saving" drops a hover state, a gradient, a section, a breakpoint, or an a11y
attribute, it failed the test — restore it. Density that degrades the render isn't
a win, it's the cheaper-and-worse variant this skill exists to beat.
