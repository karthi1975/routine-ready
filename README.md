# Routine Ready (v1 — Milestone 2 build)

Browser-based simulator teaching family caregivers to build smart-home voice
routines. CS6460 final project. Client-side only — no server, no build step.

## Run locally
Open `index.html` in any browser (file:// works). Progress saves to localStorage
(`routineReady.v1`); to reset for a fresh demo:
`localStorage.removeItem('routineReady.v1')` in the console, then reload.

## Deploy to GitHub Pages
1. Create a public repo (e.g. `routine-ready`), push these four files
   (`index.html`, `style.css`, `app.js`, `challenges.js`).
2. Repo Settings → Pages → Deploy from branch → `main` / root.
3. URL will be `https://<user>.github.io/routine-ready/` — verify in incognito.

## What's in v1 (build week 2, per proposal timeline)
- Room: lamp, blinds, front-door lock, thermostat; sun slider (dark = sun < 30)
- Two editor modes over one data model:
  - mode one, wizard (consumer-app style): trigger phrase → condition → actions
  - mode two, rules (power-user style): one screen, WHEN / IF / THEN, actions added as
    rows, plus device-state conditions (door locked, lamp on)
- Engine: exact-match triggers (case/whitespace normalized — "goodnight" ≠ "good night"),
  condition gating, trace panel narrating match/skip/fire
- All six challenges playable with criterion-rubric checks (C2's rubric = proposal Appendix B):
  - C1 worked example; C2–C3 guided builds with hints on demand
  - C4 at "Maya's place": the learner's routines are stashed and her broken routine is
    loaded (silent failure → diagnose via trace); restored on pass or on leaving
  - C5 unaided build ("leaving home": three actions, daylight-only), no hints
  - C6 transfer at "Sam's place": empty routine list, rule editor only, device-state
    condition, no hints and no per-criterion coaching (summative)
- After C6 the learner can switch any routine between the two editors
- Completion panel with a results code (attempts, hints, minutes per challenge; no
  identifying data; leaves the browser only if the learner pastes it)

- From Milestone 1 peer review: plain-language sentence preview in the wizard ("When I
  say … but only … the house will …"), a clock label on the time-of-day slider (noon →
  late evening), and optional speech input via the Web Speech API where the browser has
  it (typing stays the default; the trace shows what the microphone heard)

## Tests
End-to-end flow test (39 assertions, real click handlers, all six challenges including
wrong builds, the away-house stash, mode switching and the results code) runs in
headless Chrome via `--dump-dom`; 39/39 passing as of 2026-11-10.
