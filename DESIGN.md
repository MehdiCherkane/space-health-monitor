---
name: "Astro Vital"
description: "An operational orbital observatory for replay evidence, missing inputs and stale readings."
colors:
  canvas: "#070d16"
  surface: "#f4f6f2"
  surface-sunken: "#eaf0e9"
  surface-hover: "#e2eae0"
  border: "#d4ded2"
  border-strong: "#8d9f8b"
  ink: "#18241f"
  ink-muted: "#43564a"
  ink-subtle: "#536557"
  primary: "#416951"
  primary-hover: "#2f503c"
  on-primary: "#f4f6f2"
  focus: "#6e9b84"
  ok-ink: "#1d5e3a"
  ok-tint: "#edf6f0"
  ok-line: "#9cc9ad"
  watch-ink: "#7a4306"
  watch-tint: "#fdf6ed"
  watch-line: "#e5a960"
  muted-ink: "#43564a"
  muted-tint: "#f0f3f6"
  muted-line: "#c3ccd5"
  danger-ink: "#8f1d1d"
  danger-tint: "#fcefef"
  danger-line: "#e2a3a3"
  info-ink: "#416951"
  info-tint: "#edf3fa"
  info-line: "#a9c3dd"
  prov-historical-ink: "#416951"
  prov-historical-tint: "#e8f0f8"
  prov-synthetic-ink: "#5b3a8c"
  prov-synthetic-tint: "#f2edf9"
  prov-device-ink: "#0f5f5c"
  prov-device-tint: "#e6f4f3"
  assessment-watch: "#f4e9d5"
  assessment-insufficient: "#e5eeed"
  space-panel: "#101d29"
  space-text: "#e8eee8"
  space-muted: "#b7c5c6"
typography:
  metric:
    fontFamily: "'Fira Sans', system-ui, sans-serif"
    fontSize: "clamp(23px, 2.3vw, 34px)"
    fontWeight: 500
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "'Fira Sans', system-ui, sans-serif"
    fontSize: "25px"
    fontWeight: 500
    lineHeight: 1.3
  section-title:
    fontFamily: "'Fira Sans', system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 500
    lineHeight: 1.5
  source-title:
    fontFamily: "'Fira Sans', system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 500
    lineHeight: 1.5
  body:
    fontFamily: "'Fira Sans', system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  body-small:
    fontFamily: "'Fira Sans', system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "'Fira Sans', system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.5
  button:
    fontFamily: "'Fira Sans', system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.5
  badge:
    fontFamily: "'Fira Sans', system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 500
    lineHeight: 1.4
  code:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace"
    fontSize: "0.875em"
rounded:
  control: "12px"
  panel: "16px"
  badge: "7px"
  input: "0.4rem"
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
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "0.5rem 1rem"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "0.5rem 1rem"
  button-secondary-hover:
    backgroundColor: "{colors.surface-hover}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink-muted}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "0.5rem 1rem"
  button-disabled:
    backgroundColor: "{colors.muted-tint}"
    textColor: "{colors.ink-subtle}"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
    padding: "{spacing.4}"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.input}"
    padding: "0.4rem 0.5rem"
    width: "9rem"
  badge-watch:
    backgroundColor: "{colors.watch-tint}"
    textColor: "{colors.watch-ink}"
    typography: "{typography.badge}"
    rounded: "{rounded.badge}"
    padding: "0.125rem 0.5rem"
  provenance-synthetic:
    backgroundColor: "{colors.prov-synthetic-tint}"
    textColor: "{colors.prov-synthetic-ink}"
    typography: "{typography.badge}"
    rounded: "{rounded.badge}"
    padding: "0.125rem 0.5rem"
  scenario-navigation:
    backgroundColor: "{colors.space-panel}"
    textColor: "#ccd8d8"
    rounded: "{rounded.control}"
    padding: "9px 17px"
  assessment-watch:
    backgroundColor: "{colors.assessment-watch}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
---

# Design System: Astro Vital

## Overview

**Creative North Star: "Orbital observatory"**

Astro Vital is a calm operational observatory: crisp sage reading surfaces sit around a large illustrative scene on deep navy space. The interface makes assessment, evidence and available actions readable at a glance, with technical detail disclosed on demand.

The anatomy and cabin illustrations establish the scenario without claiming a physiological digital twin. Their depth belongs to the scene; the data panels remain quiet and opaque. Locally bundled artwork and typography preserve the same visual system offline.

**Key Characteristics:**

- Light reading panels against a deep space canvas.
- Restrained Fira Sans, tabular measurements and labeled provenance.
- A large illustrative scene with direct, keyboard-accessible navigation.
- One slow ambient galaxy; measurement and accessibility take priority.

### Pinned direction contract

- **THESIS:** Make available evidence, missing information and stale readings legible through an anatomy-led orbital observatory.
- **OWN-WORLD:** The approved brief names “an anatomy-led orbital observatory”: deep navy space, light sage reading panels, natural anatomical shading, a complementary cabin schematic and a slowly rotating galaxy.
- **STORY:** Select a scenario and replay time, read the current assessment, inspect its supporting readings, then open Why? or an available action. Artwork anchors navigation; the backend supplies meaning.
- **FIRST VIEWPORT:** The brief requests an “operational app screen with immediate content, not a hero, a splash screen or a landing page.” The implemented desktop surface places assessment above readings / scene / history-and-evidence columns. Mobile moves checkpoints near scenario selection, then shows assessment before the scene.
- **FORM:** `seed: none (pinned)`. The existing user-approved brief pins the world and first surface; this implementation is code-led, with no separate approved composition card. The first-surface layout is descriptive of this dashboard, not a requirement that every future screen use three columns.

## Colors

Warm sage paper and forest interactions make reading surfaces distinct from the cool orbital frame. Frontmatter values are normative and preserve the actual CSS palette.

### Primary

- **Forest action** (`primary`, `primary-hover`, `on-primary`): primary actions, selected controls, disclosure links and chart dots.
- **Sage focus** (`focus`): the shared keyboard focus outline.

### Secondary

- **Advisory amber** (`watch-*`, `assessment-watch`): watch, stale and unavailable states; the assessment uses a warmer broad surface than its badge.
- **Source provenance** (`prov-historical-*`, `prov-synthetic-*`, `prov-device-*`): historical blue-tinted, synthetic lavender and device teal treatments, always labeled.
- **State families** (`ok-*`, `muted-*`, `danger-*`, `info-*`): current/resolved, neutral/observed, invalid/error and insufficient-information treatments. An insufficient assessment has its own pale blue-green surface.

### Neutral

- **Deep space** (`canvas`, `space-panel`): page canvas, scenario selection and replay rail.
- **Orbital text** (`space-text`, `space-muted`): light headings and supporting copy on the dark frame.
- **Sage paper** (`surface`, `surface-sunken`, `surface-hover`): data panels and interactive tonal steps.
- **Forest ink** (`ink`, `ink-muted`, `ink-subtle`): reading hierarchy on light surfaces.
- **Quiet dividers** (`border`, `border-strong`): internal separators and outlined controls.

**The Reading Surface Rule.** Place dense evidence and measurements on opaque light surfaces; reserve the dark canvas for framing, the scene and replay controls.

**The Meaning Before Hue Rule.** Pair status and provenance color with readable labels and distinct SVG icons. Observed is not a healthy state; watch is advisory.

## Typography

**Display and body font:** locally bundled Fira Sans, with system-ui and sans-serif fallbacks. Regular and Medium are served from `/fonts/`; the Medium font face currently handles requested weights from 500 through 800. This is a two-file setup, not a variable font.

**Technical font:** the system monospace stack for rule IDs, observation IDs and code. Primary measurements and replay time use Fira Sans with tabular numerals.

The hierarchy is compact and operational. Reading copy uses body and body-small; labels use the 13px label role. Main compact source values use the metric role, with a 25px override between 961px and 1200px. Desktop assessments use the headline role, reduced to 22px at compact desktop widths; narrower assessments use the shared 1.375rem title. Section and source titles stay subordinate to measurements.

## Layout

The shell is centered with a maximum width of 1520px. Main horizontal padding is 32px, reduced to 20px at 768px. Shared spacing steps are recorded in frontmatter; the dashboard adds compact 14px row gaps, 24px column gaps and 12px sidebar gaps.

At desktop widths above 960px, the assessment spans all columns. Below it, readings, the scene and the history/evidence sidebar occupy a 1 / 1.5 / 1.2 grid. Between 961px and 1200px the proportions become 1 / 1.3 / 1.15. Assessment actions sit to the right of its title. The scene is 500px tall.

At 960px and below, readings and scene share two columns while history and evidence move below. At 600px and below, the dashboard becomes one column: scenario controls and checkpoints lead, assessment precedes the scene, and readings follow. Sidebar panels and check-in controls stack. The check-in form becomes one column at 768px; its grouped optional fields stack at 600px. Tables scroll horizontally inside their container rather than widening the page.

## Elevation & Depth

Data panels are flat at rest, separated by tonal contrast and spacing. The anatomical illustration has a soft drop shadow; its scene uses a faint radial light. The drawer uses the existing diffuse lateral shadow, a dimmed backdrop and backdrop blur. Do not copy scene depth onto every reading card.

The page enters once over 500ms with a small vertical translation. The galaxy turns once every 120 seconds using a single linear transform; static stars stay fixed. Shared control feedback takes 160ms, anatomy changes fade over 260ms and the drawer slides over 240ms. These are the implemented values within the brief's interaction windows. Shadow and motion values live in the sidecar.

**The Measurement Stillness Rule.** Display supplied values immediately without counting or interpolation. Pause decorative motion during the reaction task, when the document is hidden, and when reduced motion is requested.

## Shapes

Panels use the panel radius and shared controls use the control radius. Compact status and provenance chips use the smaller badge radius. The scene has a 20px outer silhouette; its anatomy-toggle items use 9px corners within rounded grouped controls. Existing check-in inputs retain their smaller input radius and check-in buttons use 0.45rem corners.

Borders clarify interactive edges and internal divisions. Reading cards have no outer border in the resolved dashboard style. Icons are local SVG strokes on a 24px grid, usually displayed at 16px; labels carry their meaning.

## Components

### Buttons

Primary, secondary and ghost variants share a minimum 44px target, the button typography and control radius. Primary darkens on hover; secondary and ghost gain the surface-hover tone. A press scales an enabled shared button to 0.98. Disabled controls carry their reason nearby and do not depend on dimming alone. Pressed state is exposed with `aria-pressed`. The global keyboard outline is 3px with a 2px offset.

### Inputs / Fields

Check-in inputs use a light surface, a quiet one-pixel border and a 9rem width constrained by their parent. They retain a 44px minimum height and an explicit label. Their focus outline uses primary at 3px with a 1px offset. Validation and request errors are text, with danger color supporting the message.

### Chips

Status chips combine an icon, state text and tint; provenance chips combine an icon and explicit source category. They are information labels rather than decorative tags. Preserve the distinct historical, synthetic and device semantics when changing copy or layout.

### Cards / Containers

The canonical card uses a light surface, no outer border, panel corners and 16px padding. Source cards use 16px vertical / 18px horizontal padding; sidebar cards use 16px. A selected source card has a 2px inset sage outline. Source details and exact history values expand through native disclosures with 44px summary targets.

### Navigation

Scenario controls use dark bordered segments with a forest selected fill. The replay rail uses outlined checkpoint buttons and a pale sage selected checkpoint. Both expose pressed states; selection stays understandable without hover. At phone width the replay rail moves directly after scenario selection.

### Observatory scenes

The crew scene crops locally bundled original anatomy artwork into male/female and front/back illustration views; these controls never alter subject or measurements. Three callouts open sleep history, the reaction check and evidence. A visible illustrative-anatomy caption bounds the meaning. The detector scene uses an inline geometric cabin drawing and two labeled instrument selectors; its caption identifies historical cabin measurements.

### Assessment, history and evidence

Assessment surfaces and badges show the exact returned state. Why? opens the explanatory drawer. The drawer presents readable light panels, retains keyboard focus behavior and puts detailed source and rule information behind the primary narrative. History uses individual supplied points with no smoothed line or invented threshold; a visible caption and raw table preserve time, unit and provenance context. Device observations use copper dots identified in the caption. Evidence details and incidents use disclosures to keep the first view readable.

### Motion control

The header exposes Pause motion / Resume motion. Reduced motion and an active reaction check lock animation off; hidden documents also pause it. Reduced motion removes entrance, galaxy, anatomy and spinner animation and transitions. The static artwork remains present.

## Do's and Don'ts

### Do:

- Do keep the assessment and Why? action prominent, with detailed evidence available on demand.
- Do use the shared reading surfaces, sage controls and focus treatment across new operational panels.
- Do keep historical, synthetic and device measurements visibly distinct, including profile and time context.
- Do bundle typography and artwork locally, and preserve a usable static scene.
- Do use the anatomical view controls only to change the illustration.
- Do plot only supplied observations and keep exact values available in the table.

### Don't:

- Don't turn cabin detector readings into personal exposure or body annotations.
- Don't infer health scores, organ diagnoses, vital signs or clinical thresholds from the artwork.
- Don't rely on color alone to communicate status, selection or provenance.
- Don't add number count-ups, fake live signals, constant floating cards or extra ambient motion.
- Don't replace missing inputs with zero or make incompatible measurement profiles look comparable.

Not canonized: metric sizes resolve below the brief's suggested 30–42px range at compact widths; the static Medium file represents several requested weights; disclosure markers still use generated plus/minus glyphs. These are implementation facts or reviewable limitations, not new visual rules. This documentation pass changes no UI code.
