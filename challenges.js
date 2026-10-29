"use strict";
/* Challenge ladder — mirrors Appendix A of the proposal.
   Each check() receives a context from app.js:
     { routines, norm, scenario }   where scenario(sunLevel, phrase) resets the
   room, sets the sun, says the phrase through the real engine (visible in the
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
  id:"c5", n:5, title:"Build it alone", kind:"locked",
  support:"No support — independent build.",
  goal:"A “leaving home” routine: three actions, one condition, no hints.",
  lockNote:"Coming in build week 2 (Nov 9–15)"
},
{
  id:"c6", n:6, title:"Transfer: new editor mode", kind:"locked",
  support:"Summative — unfamiliar trigger–condition–action editor, no hints.",
  goal:"A novel goal (“movie time”) in the second editor mode.",
  lockNote:"Coming in build week 2 (Nov 9–15)"
}
];
