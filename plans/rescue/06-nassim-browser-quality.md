# Agent 6 — Nassim: verify the production browser experience and final evidence

## Mission and boundary

The shared UI kit, drawer, responsive CSS and 12-state gallery are merged. Your mission
is real-browser verification and focused UI defects, not a redesign. Budget 1.5–2.5
hours. Read common start/audit, UI/gallery source, existing kit/App tests and Fadoua's
manual checklist. Use `finish/browser-quality` from latest main.

Own `frontend/src/ui/`, `frontend/src/gallery/` and colocated tests. Whole-app browser
inspection is read-only outside those paths. Report dashboard defects to Amine, check-in
defects to Mohsine, shell/API/build changes to Hamza. Coordinate shared style fixes with
him before editing `frontend/src/styles.css` or manifests. You are not alone: preserve
all other work. Keep evidence temporarily in your worktree and hand references to
Fadoua for the authoritative `acceptance/`/`demo/` records.

## NS-R1 — prepare matrix while backend completes

1. Run current production build and test commands in a working locked environment.
   Record versions and commands. If missing dependencies block installation, report exact
   error; don't modify lockfile merely to hide the environment issue.
2. Inspect current gallery only as Fixture preview. Confirm it remains visibly labeled;
   no gallery state can be mistaken for a live integrated run. Keep generated cases
   traceable to fixture/engine inputs and distinguish manual edge examples.
3. Prepare a matrix with candidate SHA, scenario/mode, viewport, action, expected result,
   actual result and evidence link. Required widths: 320, 375, 768 and 1440 px.
4. Inspect font sizes/labels, provenance badges, source age/value readability, Why
   evidence density, buttons, loading/errors and long source/value text. Fix only an
   observed UI blocker or materially unreadable state; existing system stays intact.

## NS-R2 — native browser interaction on integrated build

Wait for Hamza's seeded candidate and exact launch command, then use FastAPI-served
production assets, not only the Vite dev server or gallery.

- Keyboard-only: scenario/checkpoint controls, Why, close, source history, check-in,
  reaction instructions/cancel, fallback and Fresh run are reachable in logical order.
- Native dialog: initial focus enters; Tab/Shift+Tab stay inside modal; Escape closes;
  focus returns to trigger; no background click/key interaction leaks. jsdom stubs do
  not prove these behaviors. Cover drawer reopened after state changes.
- At 320/375/768/1440: no horizontal page overflow; no hidden values/action text;
  card stacking/table overflow remains usable; fixed elements do not obscure controls.
- Reduced motion enabled: no required understanding depends on animation; focus remains
  visible. Verify real contrast/readability for watch, pending, stale and disabled.
- Repeated scenario/seek/reset while requests pending: no stale contradictory state;
  preserve console and Network evidence for any failure and send to owning agent.
- Observe optional field zeros, reaction cancel and unavailable reason/fallback; don't
  change behavior in shared UI to compensate for a feature logic bug.

## NS-R3 — network, offline and final capture

1. Clear console/network log and load fresh production origin. Record every asset/API
   request destination. Inspect JS/CSS loads, not only index.html. External source links
   used for citations are distinct from runtime fetch dependencies.
2. Fix remote runtime asset dependencies or route them to Hamza if build-owned. No
   console errors, missing CSS/JS, uncaught request failures or accessible-name gaps
   should remain during the actual demo path.
3. Coordinate actual network-disabled-before-launch rehearsal with Fadoua. Browser
   offline emulation that also blocks localhost may not represent Wi-Fi off; document
   the method, leave loopback available, and confirm the prepared app starts cleanly.
4. Execute both scenario walks and Fresh run twice on the frozen candidate. Historical
   scenario acceptance depends on actual archive; if absent, preserve explicit preview
   and Blocked result. A quick page load is not X01.
5. Capture final screenshots: RadLab stale Why, resolved incident, crew missing state,
   seeded watch Why, disabled-resource fallback and narrow viewport. Label build SHA,
   replay time and provenance/mode. Give these to Fadoua for recording/submission.

## Verification and done condition

Run focused UI tests after fixes and default frontend tests/build before handoff. Keep
native browser proofs separate from unit counts. Deliver branch/SHA, changed paths,
matrix, console/network observations, screenshots, tested network-disable method and
any Blocked checks. Done means the final integrated production build is legible,
keyboard usable, free of demonstrated runtime UI failures, with reproducible browser
evidence. Do not add scenes, body figures, new charts or presentation flourishes during
the release window.
