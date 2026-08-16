---
name: RedactLocal
description: Black out a PDF in your browser, with nothing ever leaving the tab.
colors:
  containment-green: "#34d399"
  containment-green-solid: "#10b981"
  containment-green-deep: "#059669"
  sealed-slate: "#020617"
  chamber: "#0f172a"
  partition: "#1e293b"
  seam: "#334155"
  edge: "#475569"
  text-primary: "#f1f5f9"
  text-secondary: "#cbd5e1"
  text-muted: "#94a3b8"
  text-faint: "#64748b"
  redaction-black: "#000000"
  warning-amber: "#fcd34d"
  danger-red: "#fca5a5"
typography:
  display:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "2.25rem"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.015em"
  title:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 500
    lineHeight: 1.45
    letterSpacing: "normal"
  data:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.4
    fontFeature: "tabular-nums"
rounded:
  sm: "0.25rem"
  control: "0.5rem"
  action: "0.75rem"
  surface: "1rem"
  pill: "9999px"
spacing:
  hairline: "0.25rem"
  tight: "0.5rem"
  control: "0.75rem"
  panel: "1rem"
  section: "1.25rem"
components:
  button-primary:
    backgroundColor: "{colors.containment-green-solid}"
    textColor: "{colors.sealed-slate}"
    rounded: "{rounded.action}"
    padding: "0.5rem 1rem"
    height: "2.75rem"
  button-primary-hover:
    backgroundColor: "{colors.containment-green}"
  button-secondary:
    backgroundColor: "{colors.partition}"
    textColor: "{colors.text-muted}"
    rounded: "{rounded.action}"
    padding: "0.5rem 0.875rem"
    height: "2.75rem"
  button-secondary-active:
    backgroundColor: "{colors.containment-green-solid}"
    textColor: "{colors.containment-green}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.text-muted}"
    rounded: "{rounded.action}"
    padding: "0.5rem"
    size: "2.75rem"
  button-ghost-hover:
    backgroundColor: "{colors.partition}"
    textColor: "{colors.text-secondary}"
  surface-panel:
    backgroundColor: "{colors.chamber}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.surface}"
    padding: "1rem"
  input-field:
    backgroundColor: "{colors.sealed-slate}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.action}"
    padding: "0.5rem 0.75rem"
    height: "2.75rem"
  tab-active:
    backgroundColor: "{colors.containment-green-solid}"
    textColor: "{colors.containment-green}"
    rounded: "{rounded.control}"
    padding: "0.375rem 0.5rem"
  tab-inactive:
    backgroundColor: "transparent"
    textColor: "{colors.text-muted}"
    rounded: "{rounded.control}"
    padding: "0.375rem 0.5rem"
---

# Design System: RedactLocal

## Overview

**Creative North Star: "The Sealed Room"**

The interface is the container. RedactLocal's entire claim is that the document never leaves the tab, and the visual system exists to make that claim legible without ever saying it out loud. Surfaces are bounded — hairline-bordered panels sitting on a near-black ground, each one holding its contents rather than floating above them. Nothing bleeds off an edge, nothing implies a somewhere-else. When a panel needs to grow it scrolls inside itself; the room does not get bigger.

The palette is one accent against a deep neutral, and the accent is rationed. Containment Green appears where something has been sealed, confirmed, or is about to be: the redaction bar itself, a verified export, the one action per surface that finalises. Everywhere else the interface recedes into slate. The result is a workspace that reads as instrument rather than product — the person using it is handling a bank statement or a passport scan, and the design's job is to stay out of the way while making the state of the work unmistakable.

Density is high but not punishing. This is an Operate surface: the document occupies as much of the viewport as the chrome can spare, and every toolbar decision is a negotiation against the canvas. The one place expression is allowed is the moment of confirmation — the emerald glow under the export button, the verification panel that reports zero extractable characters. Those are the payoffs the rest of the restraint buys.

**Key Characteristics:**
- Bounded surfaces: every panel is enclosed by a hairline border and scrolls internally rather than pushing the page
- One rationed accent against a near-black ground
- Canvas-first: chrome is compressed so the document can breathe
- State is always legible — counts, progress, and verification are shown, never implied
- Evidence over assertion: the interface shows proof rather than claiming trust

## Colors

A single green against six steps of blue-biased near-black, where the green means containment and nothing else.

### Primary
- **Containment Green** (`#34d399`): The live accent. Redaction bars on the canvas, active tab and toggle states, confirmation text, the brand mark's bar. Used at full strength for text and iconography on dark grounds.
- **Containment Green Solid** (`#10b981`): The fill for the single primary action on a surface — Export, Redact Selected, Scan All. Always paired with Sealed Slate text, never with a grey.
- **Containment Green Deep** (`#059669`): Reserved for pressed and disabled-active states of the primary fill.

### Neutral
- **Sealed Slate** (`#020617`): The room. Page ground, the fill inside translucent input wells, and the text colour on any Containment Green fill.
- **Chamber** (`#0f172a`): Panel and card bodies, used at 40% opacity over the ground so the layering stays tonal rather than opaque.
- **Partition** (`#1e293b`): Hover fills, inactive segmented-control backgrounds, badge grounds.
- **Seam** (`#334155`): Hairline borders at 50–60% opacity — the primary device for separating one enclosure from the next. Also the canvas dot-grid and scrollbar thumb.
- **Edge** (`#475569`): Unchecked control strokes; the muted text lines in the brand mark.
- **Text Primary** (`#f1f5f9`): Headings, file names, match text.
- **Text Secondary** (`#cbd5e1`): Body copy and default control labels.
- **Text Muted** (`#94a3b8`): Supporting copy, inactive controls, explanatory footnotes.
- **Text Faint** (`#64748b`): Metadata, counts, "not scanned" states.

### Semantic
- **Redaction Black** (`#000000`): The colour of the redaction rectangle itself, on canvas and in the exported raster. It is not a UI colour and is never used for chrome.
- **Warning Amber** (`#fcd34d`): Findings that need human review — unread pages, matches awaiting confirmation, partial verification.
- **Danger Red** (`#fca5a5`): Export failures, unopenable files, recoverable-content warnings.

### Named Rules

**The One Seal Rule.** Exactly one Containment Green *fill* per surface. Multiple green-*text* elements are fine — they report state — but two solid green buttons competing in one panel means the primary action has not been decided. When the sidebar shows Scan All beside Export All, they are deliberately weighted: bordered versus filled.

**The Black Is Not A Colour Rule.** Pure `#000000` belongs to redaction rectangles only. UI never reaches for it; Sealed Slate is the darkest chrome value. This keeps the one thing that means "destroyed" visually unique.

**The Amber Means Unfinished Rule.** Amber is never decorative and never a brand colour. It marks exactly one condition: something a human still has to look at. A screen with no amber is a screen with nothing outstanding.

## Typography

**Display / Body Font:** Inter (with `ui-sans-serif`, `system-ui`, `-apple-system`, `Segoe UI` fallbacks)
**Data Font:** `ui-monospace` / SFMono-Regular / Menlo — matched text and numeric readouts only

**Character:** One neutral grotesque doing all the work, tightened at display sizes and left alone below. The personality is deliberately absent: this surface sits next to the user's own document, and a typeface with opinions would compete with the thing being redacted. Distinction comes from weight and colour, not from family.

### Hierarchy
- **Display** (600, 2.25rem, 1.1, `-0.025em`): The single page headline above the drop zone. One per route.
- **Headline** (600, 1.5rem, 1.25, `-0.015em`): Landing-page section headings.
- **Title** (600, 1.125rem, 1.4): Panel titles and the wordmark.
- **Body** (400, 0.875rem, 1.5): The working size — control labels, copy, match text. Reading passages cap at ~65ch.
- **Label** (500, 0.6875rem, 1.45): Metadata, row status, counts, footnotes. The densest legible step.
- **Data** (mono, 0.75rem, tabular): Matched strings in the review list, where character-level differences matter.

### Named Rules

**The Tabular Digits Rule.** Every number that updates in place — page counters, match counts, box tallies, percentages — uses `tabular-nums`. Digits changing width causes the control beside them to twitch, which reads as instability in a tool whose job is to look exact.

**The 11px Floor Rule.** `0.6875rem` is the smallest type in the system, and it carries metadata only. Nothing a decision depends on may live below Body size.

## Layout

A single centred column capped at `max-w-6xl` (72rem), with `1rem` gutters rising to `1.5rem` at `sm`. The container width is identical before and after a file is opened — the page must not change shape the moment the tool becomes active.

The shell is a sticky-footer flex column: `min-h-screen` with the footer on `mt-auto`. The editor row takes a definite height from `lg` up (`calc(100dvh - 16.5rem)`), which is what lets the canvas and the sidebar match heights and scroll internally instead of growing the page. Below `lg` the sidebar stacks under the editor and the row grows naturally, because a fixed height at that width squeezes the toolbar out of the card.

**Density and rhythm.** Spacing runs on a `0.25rem` base: `0.5rem` between related controls, `0.75rem` inside control clusters, `1rem` panel padding, `1.25rem` between sections. Toolbars compress at `lg` rather than `sm` — tablets keep full-size touch targets.

**Responsive behaviour.** Two breakpoints carry everything: `sm` (640px) for text and wrapping, `lg` (1024px) for the sidebar-beside-canvas layout and the compaction of touch targets from 44px to 36px. There is no `md` or `xl` behaviour; adding one means the system has grown a state nobody designed.

### Named Rules

**The 44px Until Large Rule.** Every interactive target is at least 44×44px below `lg`, relaxing to 36px only at `lg` and above. The breakpoint is `lg`, not `sm`, because tablets are touch devices at 768px.

**The Nothing Scrolls The Page Rule.** In the editor, scrolling belongs to the canvas stage and the sidebar panels, never to the document body. A page that scrolls while a redaction is being drawn moves the target out from under the pointer.

## Elevation & Depth

Flat by default; shadow has to earn its place. Depth is carried by tonal layering — translucent Chamber panels (40% over the ground) separated by Seam hairlines at 50–60% — and by nothing else across the great majority of the interface. Borders, not shadows, are what tell you where one enclosure ends and the next begins.

Exactly two things cast a shadow, and both are load-bearing. The document canvas takes a deep drop (`shadow-2xl`, black at 50%) because it is a physical page sitting in the room and must read as the one real object on screen. The primary action takes a coloured glow (`shadow-lg` in Containment Green at 20–25%) because it is the moment of commitment. Everything else — panels, cards, toolbars, popovers — is flat.

### Shadow Vocabulary
- **Document** (`box-shadow: 0 25px 50px -12px rgb(0 0 0 / 0.5)`): The page canvas only. Never applied to UI surfaces.
- **Commitment glow** (`box-shadow: 0 10px 15px -3px rgb(16 185 129 / 0.25)`): The single primary action per surface; brightens to 30% on hover.

### Named Rules

**The Two Shadows Rule.** The system owns two shadows: one for the document, one for the primary action. A third means something is being emphasised that should have been solved with tone or border.

## Shapes

Radius climbs with the size of the thing it encloses, which keeps the hierarchy readable at a glance: `0.5rem` for controls inside a cluster (icon buttons, list rows, tabs), `0.75rem` for standalone actions and inputs, `1rem` for panels and cards, full round for badges and status pills. Nothing is square except the document canvas, which takes `0.125rem` so it reads as paper rather than as another UI surface.

Borders are the primary structural device and are always hairline — 1px at 50–60% opacity, never solid. A border at full strength reads as a cage; at half strength it reads as a seam, which is the intent.

The recurring silhouette is the horizontal bar: the redaction rectangle, the brand mark, the progress track, the segmented control. Where a new element can plausibly be a bar, it should be.

## Components

### Buttons
- **Shape:** Gently rounded (`0.75rem`), 44px tall dropping to 36px at `lg`.
- **Primary:** Containment Green Solid fill with Sealed Slate text — dark-on-bright, roughly 7.8:1. Carries the commitment glow and scales to 98% on press.
- **Secondary:** Partition fill at 40% with a Seam border and Text Muted label; brightens on hover. Active/pressed state swaps to a Containment Green tint with a green border.
- **Ghost:** Transparent, icon-only, Text Muted. Used exclusively for corrective actions (undo, clear page, clear all) — they undo work rather than create it, so they stay quiet until looked for. Disabled at 35% opacity.
- **Hover / Focus:** 200ms `transition-all`; focus-visible is a 2px ring in Containment Green at 50–60%, or Seam for neutral controls.

### Cards / Containers
- **Corner:** `1rem`.
- **Background:** Chamber at 40% over the ground.
- **Border:** Seam hairline at 50%.
- **Shadow:** None (see Elevation).
- **Padding:** `1rem`; `0.75rem` for dense panel footers.
- **Structure:** Header and footer are `shrink-0`; only the middle scrolls. A footer allowed to compress is one whose primary action gets clipped.

### Inputs / Fields
- **Style:** Sealed Slate well at 60%, Seam border, `0.75rem` radius, 44px tall (36px at `lg`).
- **Focus:** Border shifts to Containment Green at 60%; no glow, no ring — the field is already enclosed.
- **Checkboxes:** Native input is `sr-only` with a painted 16px box beside it. **The label must be `relative`** — an absolutely-positioned `sr-only` input with no positioned ancestor escapes its scroll container and stacks down the page.

### Navigation
- Sticky header, 64px, Sealed Slate at 85% with backdrop blur, Seam bottom border.
- Brand mark (36×28) plus wordmark: "Redact" in Text Primary, "Local" in Containment Green.
- Sidebar navigation is a tab strip: active tab takes a Containment Green tint with a matching ring; inactive is Text Muted on transparent. Each tab carries a count badge.

### The Redaction Bar
The signature element and the only place pure black appears. Drawn on a transparent overlay canvas in unscaled PDF units, so the same coordinates serve the on-screen preview at any zoom and the flattened export at print density. An optional compliance stamp is drawn inside it in near-white (`#e8edf5`), shrunk to fit, in a second pass after every rectangle is filled — so an overlapping box can never bury a neighbour's stamp.

### Verification Panel
Three states, never two: green (every check ran and found nothing), amber (the flattening ran but some checks could not), red (recoverable content found). Collapsing "clean" and "unverified" into one green banner would tell someone a file was checked when it was not.

## Do's and Don'ts

### Do:
- **Do** keep exactly one Containment Green fill per surface (The One Seal Rule); use green *text* freely for state.
- **Do** separate surfaces with hairline Seam borders at 50–60% opacity rather than reaching for a shadow.
- **Do** give every number that updates in place `tabular-nums`.
- **Do** hold interactive targets at 44×44px below `lg`, relaxing to 36px only at `lg` and above.
- **Do** make panels scroll internally — `min-h-0` on the flex child, `shrink-0` on its header and footer.
- **Do** show the proof. Counts, progress and verification results are stated as numbers, not as reassurance.
- **Do** reach for a horizontal bar when a new element could plausibly be one.

### Don't:
- **Don't** drift toward cloud-SaaS visual language — gradient heroes, floating 3D mockups, blue-violet palettes, "trusted by" logo walls. The product's whole claim is that it is not a cloud service.
- **Don't** use security-theatre iconography: padlocks, shields, fingerprints, hex-grid backgrounds, matrix green. The shield was deliberately retired in favour of the redaction bar.
- **Don't** add consumer-app playfulness — mascots, blobs, bouncy spring motion, emoji as section markers. People arrive here with passport scans and bank statements.
- **Don't** use pure `#000000` for any UI surface; it belongs to redaction rectangles alone.
- **Don't** introduce a third shadow, an `md`/`xl` breakpoint, or a second accent hue without retiring something first.
- **Don't** let the page body scroll in the editor; scrolling belongs to the canvas stage and the panels.
- **Don't** put type below `0.6875rem`, and never put a decision-carrying value there.
