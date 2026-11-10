"use strict";
/* Challenge ladder — mirrors Appendix A of the proposal.
   Each check() receives a context from app.js:
     { routines, norm, scenario }   where scenario(sunLevel, phrase, pre) resets the
   room (plus any pre-set device state), sets the sun, says the phrase through the real engine (visible in the
   trace panel), and returns { room, fired } after the run.
   Criteria are criterion-referenced and feedback is formative (Shute):
   it names the failed criterion and points at the mismatched element,
   without giving the full answer. */

const CHALLENGES = [
{
  id:"c1", n:1, title:"Watch one get built", kind:"worked",
  support:"Full modeling — sit back and step through.",
  goal:"A worked example: watch the simulator build and test a “good night” routine that turns off the lamp.",
  steps:[
    {text:"Every routine has three parts. A TRIGGER — the phrase you say. Optional CONDITIONS — when the routine is allowed to run. ACTIONS — what the house actually does. That's the whole vocabulary; let's see each part once."},
    {text:"Step 1 — the trigger. I'm creating a routine named “Good night” and storing the trigger phrase good night. The house will compare what you say against this stored phrase, character for character.", do:"build"},
    {text:"Step 2 — conditions. I'm skipping them for now (Challenge 3 introduces them). Step 3 — actions: one action, turn the lamp off. The routine is saved — you can see it under “My routines.”"},
    {text:"Now the test. I'll type good night into the Say box… watch the lamp, and watch the trace panel narrate the match.", do:"test"},
    {text:"That's the entire loop you'll practice: build → say → read the trace. I'll clear my demo routine now so Challenge 2 is all yours.", do:"cleanup"}
  ]
},
{
  id:"c2", n:2, title:"Your first build", kind:"build",
  support:"Hints on demand.",
  goal:"Maya wants one phrase for bedtime. Build a routine so that saying “good night” turns the lamp off AND locks the front door.",
  testNote:"The check resets the room (lamp on, door unlocked), then says “good night.”",
  hints:[
    "Use + New routine. In step 1, the phrase must be stored exactly as it will be said: good night, two words.",
    "In step 3, select BOTH actions: Lamp → turn off and Front door → lock. Nothing else.",
    "After saving, test it yourself in the Say box before running the check — the trace will tell you what matched."
  ],
  check(ctx){
    const r = ctx.routines.find(x => ctx.norm(x.phrase) === "good night");
    const res = [];
    res.push({ ok: !!r,
      label:"Trigger phrase stored exactly as “good night”",
      fb:"No routine stores that exact phrase. Near-miss variants (like “goodnight”, one word) will not match — compare your stored phrase letter by letter." });
    let acts = false, extra = false;
    if (r){
      const m = {}; r.actions.forEach(a => m[a.device] = a.to);
      acts = m.light === "off" && m.lock === "lock";
      extra = r.actions.some(a => !(a.device === "light" && a.to === "off") && !(a.device === "lock" && a.to === "lock"));
    }
    res.push({ ok: acts && !extra,
      label:"Both required actions (lamp off, door locked), no unintended actions",
      fb: acts ? "The routine also does something Maya didn't ask for — remove the extra action." :
                 "The routine is missing one of the two actions. Check step 3 of the editor." });
    const run = ctx.scenario(75, "good night");
    res.push({ ok: run.fired.length >= 1,
      label:"Routine fires when the phrase is said",
      fb:"Nothing fired on the test run. Read the trace panel above — it names every routine it compared and why each was skipped." });
    res.push({ ok: !run.room.light && run.room.locked,
      label:"Room reaches the goal state (lamp off, door locked)",
      fb:"The routine fired but the room didn't end up where Maya needs it. Compare the actions it ran (in the trace) with the goal." });
    return res;
  }
},
{
  id:"c3", n:3, title:"Add a condition", kind:"build",
  support:"Hints on demand. The sun slider matters now.",
  goal:"Maya's husband naps in the afternoon. Build a routine so “lights out” turns the lamp off — but ONLY after dark. In daylight the phrase should do nothing.",
  testNote:"Build the routine first (+ New routine, under “My routines”) — saying “lights out” before it exists does nothing, because the house has nothing to match. Then the check runs twice: once in daylight (lamp must stay on) and once at night (lamp must turn off). Drag the sun slider to test it yourself first.",
  hints:[
    "New routine, trigger phrase lights out, action Lamp → turn off.",
    "Step 2 is the new part: pick the condition “only after dark.” A condition doesn't change what the routine does — it changes when it's allowed to run.",
    "Test both ways yourself: slider high (day) then say it, slider low (night) then say it. Watch the trace explain the skip."
  ],
  check(ctx){
    const r = ctx.routines.find(x => ctx.norm(x.phrase) === "lights out");
    const res = [];
    res.push({ ok: !!r,
      label:"Trigger phrase stored exactly as “lights out”",
      fb:"No routine stores that exact phrase. Check step 1 of the editor." });
    res.push({ ok: !!r && r.cond === "afterDark",
      label:"Routine carries the “only after dark” condition",
      fb:"The condition is what expresses “only after dark” — it lives in step 2 of the editor, not in the trigger or the actions." });
    const day = ctx.scenario(80, "lights out");
    res.push({ ok: day.room.light === true && day.fired.length === 0,
      label:"Daytime test: the lamp stays ON (routine is skipped)",
      fb:"In daylight the routine still ran (or the lamp went off). The trace shows which part let it through — look at the condition line." });
    const night = ctx.scenario(10, "lights out");
    res.push({ ok: night.fired.length >= 1 && night.room.light === false,
      label:"Night test: the routine fires and the lamp turns off",
      fb:"At night the routine should fire. If the trace shows no match, re-check the phrase; if it shows a condition skip, re-check which condition you picked." });
    return res;
  }
},
{
  id:"c4", n:4, title:"Fix the broken routine", kind:"fix",
  support:"Trace panel only — no hints. This is the diagnosis skill.",
  goal:"You're at Maya's place — her routine list is loaded (yours returns after this challenge). Maya built this routine herself. She says “good night” and… nothing happens. No error, no beep — a silent failure. Use the trace panel to find out why, fix her routine, and make bedtime work (lamp off, door locked).",
  testNote:"The check resets the room and says “good night.”",
  inject:{ id:"c4broken", name:"Maya's good night", phrase:"goodnight", cond:null,
           actions:[{device:"light",to:"off"},{device:"lock",to:"lock"}] },
  check(ctx){
    const r = ctx.routines.find(x => ctx.norm(x.phrase) === "good night");
    const res = [];
    res.push({ ok: !!r,
      label:"A routine now stores the trigger exactly as “good night”",
      fb:"Still no exact match for the spoken phrase. Say “good night” and read the trace: it prints the stored phrase next to what you said. Compare them character by character." });
    const run = ctx.scenario(75, "good night");
    res.push({ ok: run.fired.length >= 1,
      label:"Saying “good night” now fires the routine",
      fb:"The phrase still doesn't reach any routine. The trace names every routine it compared — one of them is almost right." });
    res.push({ ok: !run.room.light && run.room.locked,
      label:"Room reaches Maya's goal (lamp off, door locked)",
      fb:"It fires, but the room doesn't end up right — check the routine's actions against the goal." });
    return res;
  }
},
{
  id:"c5", n:5, title:"Build it alone", kind:"solo",
  support:"None — no hints, no worked steps. The check still tells you which criteria are met.",
  goal:"Maya leaves for work each morning. Build a routine so that saying “leaving home” turns the lamp off, closes the blinds AND locks the front door. Her husband sometimes says the phrase by accident in the evening — after dark it must do nothing at all.",
  testNote:"The check runs twice: once in daylight (all three things must happen) and once at night (nothing may change).",
  check(ctx){
    const r = ctx.routines.find(x => ctx.norm(x.phrase) === "leaving home");
    const want = { light:"off", blinds:"closed", lock:"lock" };
    const d = r ? actDiff(r, want) : null;
    const res = [];
    res.push({ ok: !!r,
      label:"Trigger phrase stored exactly as “leaving home”",
      fb:"No routine stores that exact phrase." });
    res.push({ ok: !!r && r.cond === "beforeDark",
      label:"Routine carries a condition that allows it only in daylight",
      fb: r && r.cond ? "The routine has a condition, but it allows the wrong time of day. Re-read when Maya actually leaves."
                      : "Something has to express “not after dark.” Which of the three parts decides WHEN a routine may run?" });
    res.push({ ok: !!d && !d.missing.length && !d.extra.length,
      label:"Exactly the three required actions (lamp off, blinds closed, door locked)",
      fb: !d ? "There is no routine to inspect yet." :
          d.missing.length ? `The routine is missing or mis-setting ${d.missing.length} of the three actions. Compare the goal sentence with the routine's summary line.` :
          "The routine also does something Maya didn't ask for." });
    const day = ctx.scenario(80, "leaving home");
    res.push({ ok: day.fired.length >= 1 && !day.room.light && !day.room.blinds && day.room.locked,
      label:"Daylight test: lamp off, blinds closed, door locked",
      fb:"In daylight the room did not reach the goal state. The trace above shows what matched and what ran." });
    const night = ctx.scenario(10, "leaving home");
    res.push({ ok: night.fired.length === 0 && night.room.light && night.room.blinds && !night.room.locked,
      label:"Night test: nothing changes",
      fb:"After dark the phrase still changed the room. The trace shows which routine let it through." });
    return res;
  }
},
{
  id:"c6", n:6, title:"Transfer: a different app", kind:"transfer",
  support:"Summative — unfamiliar editor, no hints, no wizard.",
  goal:"You're visiting Maya's brother Sam. His house runs a different app: there is no wizard, just one screen of rules written as WHEN / IF / THEN. Sam wants “movie time” to close the blinds, turn the lamp off and set the thermostat to 68°F — but only if the front door is already locked. If the door is unlocked, the phrase should do nothing, so he notices and locks up first.",
  testNote:"The check runs twice: once with the door unlocked (nothing may change) and once with the door locked (the room must reach Sam's goal). You can lock the door by hand in the room to try it yourself.",
  away:{ enter:"🏠 You're at Sam's place — a different app, and no routines yet. Yours come back after this challenge.",
         pass:"🏠 Movie time works at Sam's. Back home — your routines are restored." },
  check(ctx){
    const r = ctx.routines.find(x => ctx.norm(x.phrase) === "movie time");
    const want = { blinds:"closed", light:"off", temp:"68" };
    const d = r ? actDiff(r, want) : null;
    const quiet = "";   // summative: the check reports which criteria are met, without coaching
    const res = [];
    res.push({ ok: !!r, label:"A rule's WHEN stores exactly “movie time”", fb: quiet });
    res.push({ ok: !!r && r.cond === "doorLocked", label:"The rule's IF allows it only when the front door is locked", fb: quiet });
    res.push({ ok: !!d && !d.missing.length && !d.extra.length, label:"Exactly the three required THEN steps (blinds closed, lamp off, thermostat 68°F)", fb: quiet });
    const open = ctx.scenario(75, "movie time", { locked:false });
    res.push({ ok: open.fired.length === 0 && open.room.light && open.room.blinds && open.room.temp === 72,
      label:"Door-unlocked test: nothing changes", fb: quiet });
    const shut = ctx.scenario(75, "movie time", { locked:true });
    res.push({ ok: shut.fired.length >= 1 && !shut.room.light && !shut.room.blinds && shut.room.temp === 68,
      label:"Door-locked test: blinds closed, lamp off, thermostat at 68°F", fb: quiet });
    return res;
  }
}
];

/* Compare a routine's actions with a required {device: value} map.
   Later duplicates win, matching how the engine runs them in order. */
function actDiff(r, want){
  const got = {}; r.actions.forEach(a => got[a.device] = String(a.to));
  return { missing: Object.keys(want).filter(k => got[k] !== String(want[k])),
           extra:   Object.keys(got).filter(k => !(k in want)) };
}
