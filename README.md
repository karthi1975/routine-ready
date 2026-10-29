# Routine Ready (v0 — Milestone 1 build)

Browser-based simulator teaching family caregivers to build smart-home voice
routines. CS6460 final project. Client-side only — no server, no build step.

## Run locally
Open `index.html` in any browser (file:// works). Progress saves to localStorage
(`routineReady.v1`); to reset for a fresh demo:
`localStorage.removeItem('routineReady.v1')` in the console, then reload.

## Deploy to GitHub Pages (needed before the Milestone 1 recording)
1. Create a public repo (e.g. `routine-ready`), push these four files
   (`index.html`, `style.css`, `app.js`, `challenges.js`).
2. Repo Settings → Pages → Deploy from branch → `main` / root.
3. URL will be `https://<user>.github.io/routine-ready/` — verify in incognito.

## What's in v0 (build week 1, per proposal timeline)
- Room: lamp, blinds, front-door lock, thermostat; sun slider (dark = sun < 30)
- Wizard editor (mode one): trigger phrase → condition → actions
- Engine: exact-match triggers (case/whitespace normalized — "goodnight" ≠ "good night"),
  condition gating, trace panel narrating match/skip/fire
- Challenges 1–4 playable with criterion-rubric checks (C2's rubric = proposal Appendix B);
  C4 moves the learner to "Maya's place" (their own routines are stashed so they can't
  mask the bug) and injects her deliberately broken routine (silent failure → diagnose
  via trace); routines are restored on pass or on leaving the challenge
- Hints on demand (C2–C3), none for C4; attempts/hints logged in localStorage
- Challenges 5–6 locked (build week 2, Nov 9–15: independent build + second editor mode)

## Tests
Headless logic tests (engine, rubrics, worked-example lifecycle) run via
JavaScriptCore; 16/16 passing as of 2026-10-21. Bundle lives in the dev
scratchpad; re-create by stubbing DOM + concatenating `challenges.js` + `app.js`.
