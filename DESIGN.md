---
name: "Astro Vital"
description: "A deep-space observatory for replay evidence, missing inputs and stale readings."
colors:
  canvas: "#040813"
  canvas-high: "#0a1226"
  surface: "#f3f6fd"
  surface-sunken: "#e9eef9"
  surface-hover: "#e1e8f6"
  border: "#d5def0"
  border-strong: "#8fa3c7"
  ink: "#0e1a33"
  ink-muted: "#4a5878"
  ink-subtle: "#5a6885"
  primary: "#2f6fe0"
  primary-hover: "#6ba1ff"
  primary-strong: "#2258c8"
  on-primary: "#ffffff"
  accent: "#4f8bff"
  focus: "#9dbeff"
  ok: "#2fbf8f"
  ok-ink: "#0b6b4f"
  ok-tint: "#e6f8f1"
  watch: "#f2b44e"
  watch-ink: "#6e4700"
  watch-tint: "#fdf3e2"
  slate: "#8fa3c7"
  slate-ink: "#3e5475"
  slate-tint: "#edf1f9"
  danger-ink: "#8e2f45"
  danger-tint: "#fbeef1"
  prov-historical-ink: "#0e6b85"
  prov-historical-tint: "#e6f7fc"
  prov-synthetic-ink: "#5b3e9e"
  prov-synthetic-tint: "#f1ecff"
  prov-device-ink: "#244c9a"
  prov-device-tint: "#eaf0ff"
typography:
  sans: "'Fira Sans', self-hosted"
  body: "1rem / 1.5"
  small: "0.875rem"
  label: "0.8125rem"
  metric: "clamp(30px, 2.5vw, 38px)"
  headline: "25px"
rounded:
  control: "10px"
  panel: "16px"
  badge: "7px"
spacing:
  "1": "0.25rem"
  "2": "0.5rem"
  "3": "0.75rem"
  "4": "1rem"
  "5": "1.5rem"
  "6": "2rem"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.control}"
  glass-panel:
    backgroundColor: "rgba(9, 17, 36, 0.58)"
    border: "1px solid rgba(130, 170, 255, 0.25)"
    rounded: "{rounded.panel}"
  light-card:
    backgroundColor: "rgba(243, 246, 253, 0.92)"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
  badge-current:
    backgroundColor: "{colors.ok-tint}"
    textColor: "{colors.ok-ink}"
  badge-watch:
    backgroundColor: "{colors.watch-tint}"
    textColor: "{colors.watch-ink}"
  badge-insufficient:
    backgroundColor: "{colors.slate-tint}"
    textColor: "{colors.slate-ink}"
---

# Design System: Astro Vital

## Overview

**Creative North Star: "Blue-glass orbital observatory"**

Deep-space navy surrounds a supplied animated galaxy. Light cool reading surfaces float over the scene as ~92% opaque glass; dark framing panels are translucent navy glass with a 1px blue border and backdrop blur. The crew scenario uses an original inline hologram line-art figure; the detector scenario uses an original cabin cross-section.

The visual hierarchy is: replay controls → status banner and resolving action → readings / scene / history-and-evidence → checkpoints and check-in. The first viewport carries the assessment, its primary action and the readings that support it.

## Colors

- **Deep space:** `canvas`/`canvas-high`; base colour lives on `<html>` only. A fixed galaxy canvas sits at `z-index: -1`; `<body>` stays transparent.
- **Brand blue:** `primary` fills buttons and selected tabs with white text. `accent` is the link and chart-line blue on dark. Filled-button hover uses `primary-strong` so white text keeps AA contrast; `primary-hover` is the lighter outline/link hover.
- **Light surfaces:** `surface`/`surface-glass` for data cards, with `ink`, `ink-muted` and `ink-subtle` text. `primary-ink` is used for primary-coloured text on light surfaces.
- **Status:** green `ok` only for current/ok; `watch` amber for caution/stale; `slate` for missing and insufficient data, never alarm red; muted rose only for invalid/error.
- **Provenance:** historical cyan, synthetic violet, device blue, always paired with a label and icon.
- Every text/background pair is checked to meet WCAG AA at its actual size. Status and provenance never rely on colour alone.

## Typography

Locally bundled Fira Sans regular/medium (SIL OFL). Reading text is 14–16px, secondary labels are at least 13px, and primary readings use `clamp(30px, 2.5vw, 38px)` with tabular numerals. Code and rule IDs use the system monospace stack with a 13px floor. Two families maximum; no remote fonts.

## Layout

- 3 columns above 1200px, 2 columns at 800–1200px, 1 column below 800px.
- The status banner keeps a fixed 188px min-height on desktop (176px below 800px) so switching scenarios does not move the page.
- The crew scene is a large central stage; readings are compact cards; history and evidence form the right column. Detailed evidence, history tables and incident history are progressive disclosures.
- Targets are at least 44px for controls; focus is a 2px `focus` ring with 2px offset, separate from selected-state fills.

## Motion

One ambient moving element: the supplied galaxy canvas. It rotates slowly, freezes on pause/reduced-motion/hidden/measurement, and keeps its last frame. A 500ms shell entrance and 150–200ms hover/press/selection feedback explain interactions. Status transitions never interpolate or count measurements. `prefers-reduced-motion` removes animation and transitions across the app.

## Components

- **Status banner:** light glass assessment surface; the resolving engine action is the primary filled button, Why? is an outline secondary. Badges use icons + words + tints.
- **Source cards:** light glass; metric title first, source ID and state badge, large tabular reading; dose readings show two decimals with the full returned six-decimal value in a title tooltip; “Reading age: …” labels the age field clearly.
- **Observatory scenes:** inline SVG line art only. Crew hologram has male/female and front/back presentation controls and leader-line callouts. Cabin cross-section has two labeled nodes and a visible historical-data note.
- **History:** real unsmoothed samples only; line + area, visible points, unit-labelled y-axis, x ticks, returned-baseline band where known, hover/focus tooltips, single-point state and a raw table with correct plurals.
- **Evidence status:** compact presentation of the returned uncertainty facts; no model, probability or confidence calculation.
- **Replay rail:** exact checkpoint labels, Fresh run and shell-owned play/pause, 1×/2×/4× speed and clock scrubber.

## Don'ts

- Do not put an opaque background on `<body>` or a wrapper; it hides the galaxy.
- Do not use green for anything except current/ok; do not turn watch into an emergency or missing data into red.
- Do not map detector readings onto the body, invent vitals, smooth history or hardcode clinical comparisons.
- Do not remove the illustration, evidence or replay behaviour when restyling; the data semantics are the product.
