"use strict";
/* Routine Ready — Milestone 3 build (v2).
   One room, four devices, two editor modes (wizard + WHEN/IF/THEN rules),
   typed triggers, trace panel, six challenges with criterion-rubric checks,
   two quick-check questions, a before-and-after build pair, a take-home sheet
   and a results code. Client-side only. */

const $  = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const norm = p => String(p || "").trim().toLowerCase().replace(/\s+/g, " ");

/* ---------- persistence ---------- */
const LS = "routineReady.v1";
const freshP = () => ({done:{}, hints:{}, attempts:{}, times:{}, started:null, routines:null, onboarded:false,
                       judge:{}, probe:{}, probeT:{}, form:null, exp:null, reflect:""});
function loadP(){
  try { return Object.assign(freshP(), JSON.parse(localStorage.getItem(LS)) || {}); }
  catch(e){ return freshP(); }
}
let P = loadP();
/* Which build form comes first is random. ?form=A or ?form=B pins it on a fresh
   start (used for demos and for balancing the two orders across testers). */
if (P.form !== "A" && P.form !== "B"){
  let want = null; try { want = new URLSearchParams(location.search).get("form"); } catch(e){}
  P.form = want === "A" || want === "B" ? want : Math.random() < 0.5 ? "A" : "B";
}
const save = () => { try { P.routines = routines; localStorage.setItem(LS, JSON.stringify(P)); } catch(e){} };

/* ---------- room state ---------- */
const START = { light:true, blinds:true, locked:false, temp:72 };
let room = {...START};
let sun = 75;                       // 0–100; below 30 counts as dark
const isDark = () => sun < 30;
/* The slider is the sun's height; show it as a clock so routines attach to a
   time of day: 100 = noon, 30 = 6 PM (sunset), 0 = about 8:30 PM. */
function clockText(){
  const q = Math.round((100 - sun) * 6 / 70 * 4);          // quarter-hours after noon
  const h = Math.floor(q / 4), m = (q % 4) * 15;
  return `${h === 0 ? 12 : h}:${String(m).padStart(2, "0")} PM`;
}

function renderRoom(){
  $("#roomBox").classList.toggle("night", isDark());
  $("#sunLabel").textContent = `about ${clockText()} · ${isDark() ? "night 🌙" : "daytime"}`;
  const L = $("#d-light");
  L.classList.toggle("on", room.light);
  $("#lightIcon").textContent = "💡";
  $("#lightState").textContent = room.light ? "on" : "off";
  $("#lightBtn").textContent = room.light ? "Turn off" : "Turn on";
  const B = $("#d-blinds");
  B.classList.toggle("on", room.blinds);
  $("#blindsIcon").textContent = room.blinds ? "🪟" : "▦";
  $("#blindsState").textContent = room.blinds ? "open" : "closed";
  $("#blindsBtn").textContent = room.blinds ? "Close" : "Open";
  const K = $("#d-lock");
  K.classList.toggle("on", room.locked);
  $("#lockIcon").textContent = room.locked ? "🔒" : "🔓";
  $("#lockState").textContent = room.locked ? "locked" : "unlocked";
  $("#lockBtn").textContent = room.locked ? "Unlock" : "Lock";
  $("#tempState").textContent = room.temp + "°F";
}
function resetRoom(pre){ room = {...START, ...(pre || {})}; renderRoom(); }

/* manual device controls (sandbox is always live) */
$("#lightBtn").onclick  = () => { room.light = !room.light;  trace(`✋ You turned the lamp ${room.light?"on":"off"} by hand.`, "dim"); renderRoom(); };
$("#blindsBtn").onclick = () => { room.blinds = !room.blinds; trace(`✋ You ${room.blinds?"opened":"closed"} the blinds by hand.`, "dim"); renderRoom(); };
$("#lockBtn").onclick   = () => { room.locked = !room.locked; trace(`✋ You ${room.locked?"locked":"unlocked"} the door by hand.`, "dim"); renderRoom(); };
$("#tempUp").onclick    = () => { room.temp++; renderRoom(); };
$("#tempDown").onclick  = () => { room.temp--; renderRoom(); };
$("#sun").oninput = e => {
  const wasDark = isDark();
  sun = +e.target.value; renderRoom();
  if (isDark() !== wasDark)
    trace(isDark()
      ? "🌙 It's night now. Changing the time doesn't run anything by itself — routines still only fire when their phrase is said."
      : "🌞 It's daytime now. Routines with an “only after dark” condition will be skipped if you say their phrase.", "dim");
};

/* ---------- trace panel ---------- */
let traceLines = [];
let muted = false;                  // the before/after builds are scored without narration
function trace(msg, cls){
  if (muted) return;
  traceLines.push({msg, cls: cls || ""});
  if (traceLines.length > 80) traceLines = traceLines.slice(-80);
  const log = $("#traceLog");
  log.innerHTML = traceLines.map(l => `<div class="tl ${l.cls}">${esc(l.msg)}</div>`).join("");
  log.scrollTop = log.scrollHeight;
}
$("#clearTrace").onclick = () => { traceLines = []; $("#traceLog").innerHTML = '<div class="tl dim">Cleared.</div>'; };

/* ---------- routines + engine ---------- */
let routines = Array.isArray(P.routines) ? P.routines : [];
let lastRun = { said:"", fired:[] };

const CONDS = {
  afterDark:  { label:"only after dark",  test: () => isDark(),  why: () => isDark() ? "it is dark"  : "it is still daytime" },
  beforeDark: { label:"only in daylight", test: () => !isDark(), why: () => !isDark() ? "it is daytime" : "it is dark" },
  /* device-state conditions — offered by the rule editor (mode two) only */
  doorLocked: { device:true, label:"only if the front door is locked", test: () => room.locked, why: () => room.locked ? "the door is locked" : "the door is unlocked" },
  lampOn:     { device:true, label:"only if the lamp is on",           test: () => room.light,  why: () => room.light  ? "the lamp is on"     : "the lamp is off" }
};
const DEVS = {
  light:  { label:"💡 Lamp",       opts:[["off","turn off"],["on","turn on"]] },
  blinds: { label:"🪟 Blinds",     opts:[["closed","close"],["open","open"]] },
  lock:   { label:"🚪 Front door", opts:[["lock","lock"],["unlock","unlock"]] },
  temp:   { label:"🌡️ Thermostat", opts:null }
};
const ACT_LABEL = a =>
  a.device === "light"  ? `turn the lamp ${a.to}` :
  a.device === "blinds" ? `${a.to === "open" ? "open" : "close"} the blinds` :
  a.device === "lock"   ? `${a.to} the front door` :
  `set the thermostat to ${a.to}°F`;

function runActions(r){
  for (const a of r.actions){
    if (a.device === "light")  room.light  = a.to === "on";
    if (a.device === "blinds") room.blinds = a.to === "open";
    if (a.device === "lock")   room.locked = a.to === "lock";
    if (a.device === "temp")   room.temp   = +a.to;
    trace(`      → ${ACT_LABEL(a)}`, "ok");
  }
  renderRoom();
}

function sayPhrase(raw){
  if (!norm(raw)) return;
  lastRun = { said: raw, fired: [] };
  trace(`🗣 You said: “${raw}”`);
  if (!routines.length){ trace("   There are no routines yet — the house has nothing to match against.", "warn"); return; }
  for (const r of routines){
    if (norm(r.phrase) !== norm(raw)){
      trace(`   • “${r.name}” — stored trigger is “${r.phrase}” — no match, skipped.`, "dim");
      continue;
    }
    trace(`   • “${r.name}” — trigger matched.`);
    if (r.cond){
      const c = CONDS[r.cond];
      if (!c.test()){
        trace(`      condition “${c.label}” not met (${c.why()}) — routine skipped. Nothing will happen.`, "warn");
        continue;
      }
      trace(`      condition “${c.label}” met (${c.why()}).`);
    }
    lastRun.fired.push(r.name);
    runActions(r);
  }
  if (!lastRun.fired.length) trace("   ✦ No routine fired. The room did nothing — a silent failure.", "warn");
}
$("#sayBtn").onclick = () => { sayPhrase($("#sayBox").value); $("#sayBox").select(); };
$("#sayBox").addEventListener("keydown", e => { if (e.key === "Enter") $("#sayBtn").click(); });

/* Optional speech input (Web Speech API, where the browser has it). Typing stays
   the default. The house acts on whatever the recognizer heard, so real
   mis-hearings ("goodnight" for "good night") show up in the trace. */
(function(){
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return;
  const btn = $("#micBtn"); btn.classList.remove("hidden");
  $("#sayNote").textContent = "Type the phrase, or press Speak and say it. Either way the house matches the exact words it receives.";
  let rec = null;
  const idle = () => { rec = null; btn.classList.remove("rec"); btn.textContent = "🎙 Speak"; };
  const clean = t => String(t).trim().replace(/[.!?,]+$/, "");
  btn.onclick = () => {
    if (rec){ rec.stop(); return; }
    try {
      /* Interim results are on so a short phrase is kept even if the recognizer
         never marks it final, and so the button can show that sound is arriving. */
      let interim = "", done = false, sawSound = false, failed = false;
      const finish = heard => {
        if (done || !heard) return;
        done = true;
        $("#sayBox").value = heard;
        trace(`🎙 The microphone heard: “${heard}”`, "dim");
        sayPhrase(heard);
      };
      rec = new SR(); rec.lang = "en-US"; rec.continuous = false; rec.interimResults = true; rec.maxAlternatives = 1;
      rec.onaudiostart = () => { btn.textContent = "● Listening… speak now"; };
      rec.onsoundstart = rec.onspeechstart = () => { sawSound = true; btn.textContent = "● Hearing you…"; };
      rec.onresult = e => {
        sawSound = true;
        const r = e.results[e.results.length - 1];
        const text = clean(r[0].transcript);
        if (r.isFinal) finish(text);
        else { interim = text; $("#sayBox").value = text; }
      };
      rec.onerror = e => {
        if (e.error === "aborted" || (e.error === "no-speech" && interim)) return;
        failed = true;
        if (e.error === "no-speech") trace(sawSound
          ? "🎙 I heard sound but no words. Press Speak, wait for “speak now”, and say the phrase again, or type it."
          : "🎙 No sound reached the browser. Check that this browser is allowed to use the microphone and that the right microphone is selected, then try again. Typing works the same way.", "warn");
        else if (e.error === "not-allowed" || e.error === "service-not-allowed")
          trace("🎙 The microphone is blocked for this page. Allow it from the icon in the address bar, or type the phrase.", "warn");
        else trace(`🎙 The microphone isn't available (${e.error}). Type the phrase instead — the matching rules are the same.`, "warn");
      };
      rec.onend = () => { if (!failed) finish(interim); idle(); };
      rec.start(); btn.classList.add("rec"); btn.textContent = "● Starting…";
    } catch(err){ idle(); trace("🎙 Speech input couldn't start. Type the phrase instead.", "warn"); }
  };
})();

function renderRoutines(){
  const el = $("#routineList");
  if (!routines.length){
    el.innerHTML = `<div class="mut">${cur && CH[cur].kind === "probe" && !P.done[cur]
      ? "No routines yet. Use + New routine to build the one in the goal."
      : "No routines yet. Build one, or let Challenge 1 show you how."}</div>`;
    return;
  }
  el.innerHTML = routines.map((r, i) => `
    <div class="rt">
      <div class="head">⚡ ${esc(r.name)}
        <button class="mini" data-edit="${i}">Edit</button>
        <button class="mini" data-del="${i}">Delete</button>
      </div>
      <div class="detail">say “${esc(r.phrase)}”${r.cond ? ` · ${CONDS[r.cond].label}` : ""} → ${r.actions.map(ACT_LABEL).join(", ")}</div>
    </div>`).join("");
  $$("#routineList [data-edit]").forEach(b => b.onclick = () => openEditor(routines[+b.dataset.edit], +b.dataset.edit));
  $$("#routineList [data-del]").forEach(b => b.onclick = () => {
    trace(`🗑 Deleted routine “${routines[+b.dataset.del].name}”.`, "dim");
    routines.splice(+b.dataset.del, 1); save(); renderRoutines();
  });
}

/* ---------- wizard editor (mode one) ---------- */
/* Two editor modes over one data model. Mode one ("wizard") mirrors consumer
   apps; mode two ("rule") mirrors power-user platforms: one screen, WHEN / IF /
   THEN vocabulary, actions added as rows. Challenge 6 forces mode two; after it
   is passed the learner can switch freely. */
let draft = null;   // {idx|null, mode, step, name, phrase, cond, acts:{…}, rows:[{device,to}]}
const DEV_KEYS = ["light","blinds","lock","temp"];
const atSams = () => cur === "c6" && !P.done.c6;
const inProbe = () => !!cur && CH[cur].kind === "probe" && !P.done[cur];   // both builds use the same editor
const canSwitchMode = () => !!P.done.c6 && !atSams() && !inProbe();
function editorMode(r){
  if (atSams()) return "rule";
  if (inProbe()) return "wizard";
  if (r && (r.mode === "rule" || (r.cond && CONDS[r.cond].device))) return "rule";
  return P.done.c6 && P.mode === "rule" ? "rule" : "wizard";
}
const rowsToActs = rows => Object.fromEntries(DEV_KEYS.map(k => {
  const hit = rows.filter(a => a.device === k).pop(); return [k, hit ? hit.to : null]; }));
const actsToRows = acts => DEV_KEYS.filter(k => acts[k] != null).map(k => ({device:k, to:acts[k]}));

function openEditor(r, idx){
  const rows = r ? r.actions.map(a => ({...a})) : [];
  draft = { idx: r ? idx : null, mode: editorMode(r), step:1,
            name: r ? r.name : "", phrase: r ? r.phrase : "", cond: r ? r.cond : null,
            rows, acts: rowsToActs(rows) };
  $("#editorCard").classList.remove("hidden");
  renderEditor();
  $("#editorCard").scrollIntoView({behavior:"smooth", block:"nearest"});
}
$("#newRoutine").onclick = () => openEditor(null);

function closeEditor(){ $("#editorCard").classList.add("hidden"); draft = null; }
function editorAlert(msg){
  const p = document.createElement("p"); p.className = "explain"; p.style.color = "var(--bad)"; p.textContent = msg;
  $("#editorCard .panelRow").before(p); setTimeout(() => p.remove(), 3500);
}
function commitDraft(actions){
  const d = draft;
  const r = { id: d.idx != null ? routines[d.idx].id : "r" + Date.now(), mode: d.mode,
              name: d.name.trim() || d.phrase.trim(), phrase: d.phrase, cond: d.cond, actions };
  if (d.idx != null) routines[d.idx] = r; else routines.push(r);
  trace(`💾 Saved ${d.mode === "rule" ? "rule" : "routine"} “${r.name}” — say “${r.phrase}” to run it.`, "dim");
  save(); renderRoutines(); closeEditor();
  if (cur && CH[cur].kind !== "worked") renderActive();   // refresh check button state
}
const modeSwitchBtn = () => canSwitchMode()
  ? `<button class="mini" id="e-mode">${draft.mode === "rule" ? "Use the wizard" : "Use WHEN / IF / THEN"}</button>` : "";
function wireModeSwitch(grab){
  if (!$("#e-mode")) return;
  $("#e-mode").onclick = () => {
    grab();
    const d = draft;
    if (d.mode === "rule"){ d.acts = rowsToActs(d.rows.filter(a => a.device)); d.mode = "wizard"; d.step = 1; }
    else { d.rows = actsToRows(d.acts); d.mode = "rule"; }
    P.mode = d.mode; save(); renderEditor();
  };
}

function renderEditor(){
  if (draft.mode === "rule") return renderRuleEditor();
  const d = draft, el = $("#editorCard");
  const stepTabs = `<div class="steps">${[1,2,3].map(s =>
    `<span class="${d.step === s ? "cur" : ""}">${s}. ${["Trigger","Condition","Actions"][s-1]}</span>`).join("")}</div>`;
  let body = "";
  if (d.step === 1) body = `
    <div class="field"><label>Routine name</label><input type="text" id="e-name" value="${esc(d.name)}" placeholder="e.g. Good night"></div>
    <div class="field"><label>Trigger — the phrase you'll say</label><input type="text" id="e-phrase" value="${esc(d.phrase)}" placeholder="e.g. good night"></div>
    <p class="explain">The house matches this phrase exactly (ignoring capitals and extra spaces). “goodnight” and “good night” are different phrases.</p>`;
  if (d.step === 2) body = `
    <p class="explain" style="margin-bottom:6px">A condition doesn't change what the routine does — it decides <b>when it's allowed to run</b>.</p>
    ${[["", "No condition — run whenever the phrase is said"], ["afterDark","Only after dark"], ["beforeDark","Only in daylight"]]
      .concat(d.cond && CONDS[d.cond].device ? [[d.cond, CONDS[d.cond].label.replace(/^o/, "O")]] : []).map(([v, l]) =>
      `<label class="radio ${String(d.cond ?? "") === v ? "on" : ""}"><input type="radio" name="cond" value="${v}" ${String(d.cond ?? "") === v ? "checked" : ""}>${l}</label>`).join("")}`;
  if (d.step === 3){
    const row = (dev, label, opts) => `
      <label class="actRow ${d.acts[dev] != null ? "on" : ""}">
        <input type="checkbox" data-dev="${dev}" ${d.acts[dev] != null ? "checked" : ""}> ${label}
        ${dev === "temp"
          ? `<input type="number" data-val="temp" value="${d.acts.temp ?? 68}" min="55" max="85" ${d.acts.temp == null ? "disabled" : ""}>`
          : `<select data-val="${dev}" ${d.acts[dev] == null ? "disabled" : ""}>${opts.map(o =>
              `<option value="${o[0]}" ${d.acts[dev] === o[0] ? "selected" : ""}>${o[1]}</option>`).join("")}</select>`}
      </label>`;
    body = row("light","💡 Lamp",[["off","turn off"],["on","turn on"]])
         + row("blinds","🪟 Blinds",[["closed","close"],["open","open"]])
         + row("lock","🚪 Front door",[["lock","lock"],["unlock","unlock"]])
         + row("temp","🌡️ Thermostat",[]);
  }
  el.innerHTML = `<div class="traceHead"><b>${d.idx == null ? "New routine" : "Edit routine"} <span class="mut">· wizard mode</span></b>
      ${modeSwitchBtn()}<button class="mini" id="e-close">Cancel</button></div>
    ${stepTabs}${body}
    <p class="sentence" id="e-sentence"></p>
    <div class="panelRow">
      ${d.step > 1 ? '<button class="btn sec" id="e-back">← Back</button>' : ""}
      ${d.step < 3 ? '<button class="btn" id="e-next">Next →</button>' : '<button class="btn" id="e-save">Save routine</button>'}
    </div>`;
  const grab = () => {
    if (d.step === 1){ d.name = $("#e-name").value; d.phrase = $("#e-phrase").value; }
  };
  const alertStep = editorAlert;
  /* the routine so far, in plain language next to the three part names */
  const sentence = () => {
    const acts = DEV_KEYS.filter(k => d.acts[k] != null).map(k => ACT_LABEL({device:k, to:d.acts[k]}));
    const phrase = d.step === 1 && $("#e-phrase") ? $("#e-phrase").value : d.phrase;
    $("#e-sentence").innerHTML = `<b>When I say</b> “${esc(phrase.trim() || "…")}”`
      + (d.cond ? `, <b>but ${esc(CONDS[d.cond].label)}</b>` : "")
      + `, <b>the house will</b> ${acts.length ? esc(acts.join(" and ")) : "…"}.`;
  };
  sentence();
  if ($("#e-phrase")) $("#e-phrase").oninput = sentence;
  $("#e-close").onclick = closeEditor;
  wireModeSwitch(grab);
  if ($("#e-back")) $("#e-back").onclick = () => { grab(); d.step--; renderEditor(); };
  if ($("#e-next")) $("#e-next").onclick = () => {
    grab();
    if (d.step === 1 && !norm(d.phrase)){ alertStep("Give the routine a trigger phrase first — that's what you'll say."); return; }
    d.step++; renderEditor();
  };
  $$("#editorCard [name=cond]").forEach(i => i.onchange = () => { d.cond = i.value || null; renderEditor(); });
  $$("#editorCard [data-dev]").forEach(i => i.onchange = () => {
    const dev = i.dataset.dev;
    d.acts[dev] = i.checked ? (dev === "temp" ? 68 : {light:"off", blinds:"closed", lock:"lock"}[dev]) : null;
    renderEditor();
  });
  $$("#editorCard [data-val]").forEach(i => i.onchange = () => { d.acts[i.dataset.val] = i.dataset.val === "temp" ? +i.value : i.value; sentence(); });
  if ($("#e-save")) $("#e-save").onclick = () => {
    const actions = ["light","blinds","lock","temp"].filter(dev => d.acts[dev] != null)
                    .map(dev => ({device:dev, to:d.acts[dev]}));
    if (!actions.length){ alertStep("Pick at least one action — a routine that does nothing can't help Maya."); return; }
    commitDraft(actions);
  };
}

/* ---------- rule editor (mode two): WHEN / IF / THEN on one screen ---------- */
function renderRuleEditor(){
  const d = draft, el = $("#editorCard");
  const valCtl = (a, i) => !a.device ? "" :
    a.device === "temp"
      ? `<span class="mut">set to</span> <input type="number" data-rval="${i}" value="${esc(a.to)}" min="55" max="85"> <span class="mut">°F</span>`
      : `<select data-rval="${i}">${DEVS[a.device].opts.map(o =>
          `<option value="${o[0]}" ${a.to === o[0] ? "selected" : ""}>${o[1]}</option>`).join("")}</select>`;
  const rows = d.rows.map((a, i) => `
    <div class="ruleRow">
      <select data-rdev="${i}"><option value="">choose a device…</option>${DEV_KEYS.map(k =>
        `<option value="${k}" ${a.device === k ? "selected" : ""}>${DEVS[k].label}</option>`).join("")}</select>
      ${valCtl(a, i)}
      <button class="mini" data-rdel="${i}" title="Remove this step">✕</button>
    </div>`).join("");
  el.innerHTML = `<div class="traceHead"><b>${d.idx == null ? "New rule" : "Edit rule"} <span class="mut">· WHEN / IF / THEN</span></b>
      ${modeSwitchBtn()}<button class="mini" id="e-close">Cancel</button></div>
    <div class="ruleBlock"><span class="kw">WHEN</span><span>I say</span>
      <input type="text" id="r-phrase" value="${esc(d.phrase)}" placeholder="the exact phrase" autocomplete="off"></div>
    <div class="ruleBlock"><span class="kw">IF</span>
      <select id="r-cond"><option value="">always (no IF)</option>${Object.entries(CONDS).map(([k, c]) =>
        `<option value="${k}" ${d.cond === k ? "selected" : ""}>${c.label}</option>`).join("")}</select></div>
    <div class="ruleBlock col"><div><span class="kw">THEN</span><span class="mut">steps run top to bottom</span></div>
      ${rows || '<div class="mut">No THEN steps yet.</div>'}
      <div><button class="mini" id="r-add">+ Add a THEN step</button></div></div>
    <div class="field"><label>Rule name (optional)</label><input type="text" id="r-name" value="${esc(d.name)}" placeholder="defaults to the phrase"></div>
    <div class="panelRow"><button class="btn" id="r-save">Save rule</button></div>`;
  const grab = () => {
    d.phrase = $("#r-phrase").value; d.name = $("#r-name").value; d.cond = $("#r-cond").value || null;
    $$("#editorCard [data-rval]").forEach(i => {
      const a = d.rows[+i.dataset.rval]; a.to = a.device === "temp" ? +i.value : i.value; });
  };
  $("#e-close").onclick = closeEditor;
  wireModeSwitch(grab);
  $("#r-add").onclick = () => { grab(); d.rows.push({device:"", to:null}); renderEditor(); };
  $$("#editorCard [data-rdel]").forEach(b => b.onclick = () => { grab(); d.rows.splice(+b.dataset.rdel, 1); renderEditor(); });
  $$("#editorCard [data-rdev]").forEach(sel => sel.onchange = () => {
    grab();
    const a = d.rows[+sel.dataset.rdev];
    a.device = sel.value;
    a.to = !a.device ? null : a.device === "temp" ? 70 : DEVS[a.device].opts[0][0];
    renderEditor();
  });
  $("#r-save").onclick = () => {
    grab();
    if (!norm(d.phrase)){ editorAlert("WHEN is empty — the rule needs the phrase that sets it off."); return; }
    if (d.rows.some(a => !a.device)){ editorAlert("One THEN step has no device chosen — pick one or remove the step."); return; }
    if (!d.rows.length){ editorAlert("Add at least one THEN step — a rule that does nothing can't help anyone."); return; }
    commitDraft(d.rows.map(a => ({device:a.device, to:a.to})));
  };
}

/* ---------- challenges ---------- */
const CH = Object.fromEntries(CHALLENGES.map(c => [c.id, c]));
/* The before and after builds reuse the "someone else's place" mechanism:
   an empty routine list while the build is open, yours back afterwards. */
CH.pre  = { id:"pre",  n:0, kind:"probe", title:"Try one build first",
            away:{ enter:"📝 First build — an empty routine list. Build what the goal asks, then submit.", pass:"" } };
CH.post = { id:"post", n:7, kind:"probe", title:"One last build",
            away:{ enter:"📝 Last build — an empty routine list again. Your routines come back after you submit.", pass:"" } };
const FORM = Object.fromEntries(FORMS.map(f => [f.id, f]));
const probeForm = id => FORM[id === "pre" ? P.form : (P.form === "A" ? "B" : "A")];
const pendingJ = c => !!c.after && !(P.judge[c.id] || {}).ok;
let probeConf = [null, null, null];
let cur = null;        // current challenge id
let wxStep = 0;        // worked-example step
let lastResults = null;
let hintShown = 0;

function doneCount(){ return CHALLENGES.filter(c => P.done[c.id]).length; }
function renderProgress(){ $("#progress").textContent = `${doneCount()}/6 challenges`; }

/* Results code: per challenge attempts, hints and minutes; per quick check
   whether the first answer was right and how many tries; per build the form,
   the five criteria, seconds and the three confidence ratings.
   Nothing identifying; it leaves the browser only if the learner pastes it. */
function resultsCode(){
  const row = c => [P.attempts[c.id] || 0, P.hints[c.id] || 0, P.times[c.id] ?? -1];
  const jr  = c => { const J = P.judge[c.id]; return J ? [J.first ? 1 : 0, J.tries] : null; };
  const pr  = id => { const b = P.probe[id]; return !b ? null : b.skip ? 0 : [b.f, b.k.join(""), b.t, b.conf.join("")]; };
  const data = { v:2, x:P.exp, c:CHALLENGES.map(row), j:CHALLENGES.filter(c => c.after).map(jr), a:pr("pre"), b:pr("post") };
  try { return "RR2-" + btoa(JSON.stringify(data)); } catch(e){ return ""; }
}

/* what comes after challenge c: the next unfinished step, then the last build */
function nextStep(c){
  const x = CHALLENGES.find(x => x.n > c.n && (!P.done[x.id] || pendingJ(x)));
  if (x) return { id:x.id, label:`Continue to Challenge ${x.n}: ${x.title} →` };
  if (doneCount() === CHALLENGES.length && !P.done.post) return { id:"post", label:"One last build → see your before and after" };
  return null;
}

function renderLadder(){
  const probeChip = (id, label) => {
    const b = P.probe[id], lock = id === "post" && doneCount() < CHALLENGES.length;
    return `<button class="chip probe ${cur === id ? "cur" : ""} ${P.done[id] ? "done" : ""} ${lock ? "lock" : ""}" data-ch="${id}" ${lock ? "disabled" : ""}>
      <span>${P.done[id] ? "✅" : lock ? "🔒" : "📝"}</span> ${label}
      <span class="st ${lock ? "lockTag" : ""}">${b ? (b.skip ? "skipped" : "recorded") : lock ? "after Challenge 6" : ""}</span></button>`;
  };
  $("#ladder").innerHTML = probeChip("pre", "Before: try one build first") + CHALLENGES.map(c => {
    const d = P.done[c.id], lock = c.kind === "locked";
    return `<button class="chip ${cur === c.id ? "cur" : ""} ${d ? "done" : ""} ${lock ? "lock" : ""}" data-ch="${c.id}" ${lock ? "disabled" : ""}>
      <span>${d ? "✅" : lock ? "🔒" : "•"}</span> ${c.n}. ${esc(c.title)}
      <span class="st ${lock ? "lockTag" : ""}">${d ? "done" : lock ? esc(c.lockNote) : ""}</span></button>`;
  }).join("") + probeChip("post", "After: one last build");
  $$("#ladder [data-ch]").forEach(b => b.onclick = () => openChallenge(b.dataset.ch));
  renderProgress();
}

function openChallenge(id){
  cur = id; wxStep = 0; lastResults = null; hintShown = P.hints[id] || 0;
  const c = CH[id];
  probeConf = [null, null, null];
  if (c.kind === "probe" && !P.done[id] && !P.probeT[id]) P.probeT[id] = Date.now();
  if (c.kind !== "probe" && !P.started){ P.started = Date.now(); P.onboarded = true; }
  if (c.kind !== "probe" && !P.done.pre){ P.done.pre = true; P.probe.pre = { skip: 1 }; }   // lessons began without a first build
  /* The fix-it challenge happens at Maya's place: her routine list replaces
     yours while it's active, so your own routines can't mask her bug. */
  /* Challenge 6 uses the same mechanism for Sam's place (empty list, rule editor). */
  if (draft) closeEditor();
  if (P.stash && P.awayAt !== id){
    routines = P.stash; P.stash = null; P.awayAt = null;
    save(); renderRoutines();
    trace("🏠 Back home — your routines are restored.", "dim");
  }
  const away = c.inject ? [JSON.parse(JSON.stringify(c.inject))] : c.away ? [] : null;
  if (away && !P.done[id] && !P.stash){
    P.stash = routines; P.awayAt = id;
    routines = away;
    save(); renderRoutines();
    trace(c.away ? c.away.enter : "🏠 You're at Maya's place — only her routine is loaded. Yours come back after this challenge.", "dim");
  }
  renderLadder(); renderActive();
}

/* scenario runner handed to challenge checks — runs through the real engine, visibly */
function scenario(sunLevel, phrase, pre){
  sun = sunLevel; $("#sun").value = sun;
  resetRoom(pre);
  trace(`—— check: room reset, ${isDark() ? "night" : "daytime"}${pre && "locked" in pre ? `, front door ${pre.locked ? "locked" : "unlocked"}` : ""} ——`, "dim");
  sayPhrase(phrase);
  return { room: {...room}, fired: [...lastRun.fired] };
}

function renderActive(){
  const el = $("#activePanel");
  if (!cur){ renderOnboarding(el); return; }
  const c = CH[cur], done = P.done[c.id];
  if (c.kind === "probe"){ renderProbe(el, c); return; }
  const J = P.judge[c.id] || null;
  const nx = done && !pendingJ(c) ? nextStep(c) : null;
  let h = `<h2>Challenge ${c.n} — ${esc(c.title)}</h2>
    <div class="goal">${esc(c.goal)}</div>
    <div class="support">Support: ${esc(c.support)}</div>`;
  const isAway = !!(c.inject || c.away);          // the fixed/built routine stays at that house
  if (done) h += `<div class="doneBanner">✅ Completed.${isAway ? "" : " Re-run the check any time, or move on."}</div>`;

  if (c.kind === "worked"){
    const s = c.steps[wxStep];
    h += `<div class="hintBox"><b>Step ${wxStep + 1} of ${c.steps.length}.</b> ${esc(s.text)}</div>
      <div class="panelRow">
        ${wxStep < c.steps.length - 1
          ? '<button class="btn" id="wx-next">Next →</button>'
          : '<button class="btn" id="wx-done">Finish — my turn (Challenge 2) →</button>'}
      </div>`;
  } else {
    if (c.testNote) h += `<p class="explain">${esc(c.testNote)}</p>`;
    if (c.hints && hintShown > 0)
      h += c.hints.slice(0, hintShown).map(x => `<div class="hintBox">💡 ${esc(x)}</div>`).join("");
    if (lastResults){
      h += lastResults.map(r => `<div class="crit ${r.ok ? "pass" : "fail"}"><span class="mark">${r.ok ? "✓" : "✗"}</span>
        <span>${esc(r.label)}${r.ok || !r.fb ? "" : `<span class="fb">${esc(r.fb)}</span>`}</span></div>`).join("");
      if (c.kind === "transfer" && !lastResults.every(r => r.ok))
        h += `<p class="explain">This is the transfer task, so the check tells you which criteria are not met yet but doesn't coach. The trace from both test runs is in the panel on the left.</p>`;
      if (lastResults.every(r => r.ok)) h += `<div class="doneBanner">✅ All criteria met — challenge complete!</div>`;
    }
    if (done && c.after){
      const last = J ? c.after.opts[J.last] : null;
      h += `<div class="quick"><b>Quick check</b> <span class="mut">one question, no building</span>
        <p>${esc(c.after.q)}</p>
        ${c.after.opts.map((o, i) => `<button class="opt ${J && J.last === i ? (o.ok ? "right" : "wrong") : ""}" data-j="${i}" ${J && J.ok ? "disabled" : ""}>${esc(o.t)}</button>`).join("")}
        ${last ? `<div class="fb ${last.ok ? "right" : "wrong"}">${esc(last.fb)}</div>` : ""}
      </div>`;
    }
    h += `<div class="panelRow">
      ${nx ? `<button class="btn" id="nextCh">${esc(nx.label)}</button>` : ""}
      ${done && isAway ? "" : `<button class="btn${done ? " sec" : ""}" id="runCheck">Run the check</button>`}
      ${c.hints && hintShown < (c.hints || []).length ? `<button class="btn sec" id="hintBtn">Hint (${hintShown}/${c.hints.length} used)</button>` : ""}
      ${c.kind === "fix" ? '<span class="mut">No hints here — the trace panel is your tool.</span>' : ""}
      ${c.kind === "solo" && !done ? '<span class="mut">No hints — you have every piece you need.</span>' : ""}
      ${c.kind === "transfer" && !done ? '<span class="mut">No hints, no wizard — use + New routine to open Sam\'s rule editor.</span>' : ""}
    </div>`;
    if (doneCount() === CHALLENGES.length && !CHALLENGES.some(pendingJ)) h += finishHTML();
  }
  el.innerHTML = h;

  if ($("#nextCh")) $("#nextCh").onclick = () => openChallenge(nx.id);
  wireFinish();
  $$("#activePanel [data-j]").forEach(b => b.onclick = () => {
    const i = +b.dataset.j, ok = !!c.after.opts[i].ok;
    const j = P.judge[c.id] || { first: ok, tries: 0 };
    j.tries++; j.last = i; j.ok = ok;
    P.judge[c.id] = j; save(); renderActive();
  });
  if ($("#wx-next")) $("#wx-next").onclick = () => { wxDo(c.steps[wxStep].do); wxStep++; wxDo(c.steps[wxStep].do, true); renderActive(); };
  if ($("#wx-done")) $("#wx-done").onclick = () => {
    wxDo(c.steps[wxStep].do);
    P.done.c1 = true; save(); openChallenge("c2");
  };
  if ($("#runCheck")) $("#runCheck").onclick = () => {
    lastResults = c.check({ routines, norm, scenario });
    const pass = lastResults.every(r => r.ok);
    P.attempts[c.id] = (P.attempts[c.id] || 0) + 1;
    if (pass && !P.done[c.id]){
      P.done[c.id] = true;
      if (P.started) P.times[c.id] = Math.round((Date.now() - P.started) / 6000) / 10;   // minutes since onboarding
    }
    if (pass && P.stash){
      routines = P.stash; P.stash = null; P.awayAt = null;
      renderRoutines();
      trace(c.away ? c.away.pass : "🏠 Maya's bedtime works again. Back home — your routines are restored.", "dim");
    }
    save(); renderLadder(); renderActive();
  };
  if ($("#hintBtn")) $("#hintBtn").onclick = () => { hintShown++; P.hints[c.id] = hintShown; save(); renderActive(); };
}

/* ---------- completion: results code + take-home sheet ---------- */
function finishHTML(){
  return `<div class="finish">
      <b>🎉 Ladder complete — all six challenges.</b>
      <p class="explain">Both editors are now yours: open any routine and switch between the wizard and WHEN / IF / THEN.</p>
      ${P.done.post ? "" : `<p class="explain"><b>One step is left:</b> the last build, with the button above. It takes about 3 minutes and shows your before and after.</p>`}
      <label for="resCode">Your results code</label>
      <div class="sayRow"><input id="resCode" type="text" readonly value="${esc(resultsCode())}"><button class="btn sec" id="copyCode">Copy</button></div>
      <p class="explain">It holds attempts, hints, minutes, your two quick-check answers and your two build scores — nothing about you. It stays in this browser unless you choose to paste it somewhere.</p>
      <div class="panelRow"><button class="btn sec" id="openSheet">Open my take-home sheet</button></div>
    </div>`;
}
function wireFinish(){
  if ($("#openSheet")) $("#openSheet").onclick = openSheet;
  if ($("#copyCode")) $("#copyCode").onclick = () => {
    const i = $("#resCode"); i.select();
    try { navigator.clipboard.writeText(i.value); } catch(e){}
    $("#copyCode").textContent = "Copied";
  };
}
function openSheet(){
  const el = $("#sheetCard");
  el.classList.remove("hidden");
  el.innerHTML = `<div class="traceHead"><b>Take-home sheet</b>
      <button class="mini noPrint" id="sheetPrint">Print</button><button class="mini noPrint" id="sheetClose" style="margin-left:0">Close</button></div>
    <p class="sentence"><b>When I say</b> a phrase, <b>but only if</b> a condition is true, <b>the house will</b> do the actions.</p>
    <table class="sheet">
      <tr><th>In Routine Ready</th><th>Alexa app</th><th>Google Home app</th><th>Apple Home app</th></tr>
      <tr><td><b>Trigger</b><br>the phrase you say</td><td>“When” → Voice</td><td>“Starters” → a voice command</td><td>A Scene's name, said to Siri</td></tr>
      <tr><td><b>Condition</b><br>when it may run</td><td>Few options. Often a second routine or a schedule instead.</td><td>“Conditions” (in the script editor)</td><td>“Time” and “People” options on an Automation</td></tr>
      <tr><td><b>Action</b><br>what the house does</td><td>“Alexa Will”</td><td>“Actions”</td><td>The accessories set in the Scene</td></tr>
    </table>
    <p class="explain">App wording changes between versions. Look for the idea, not the exact word.</p>
    <p style="font-size:14px;margin:12px 0 4px"><b>When a routine does nothing, check in this order:</b></p>
    <div class="crit"><span class="mark">1</span><span><b>The words.</b> Compare what the assistant heard with the stored phrase, letter by letter. Most apps keep a voice history.</span></div>
    <div class="crit"><span class="mark">2</span><span><b>The condition.</b> Is the routine allowed to run right now? A skipped routine is not a broken one.</span></div>
    <div class="crit"><span class="mark">3</span><span><b>The actions.</b> Run the routine by hand from the app and watch what the devices do.</span></div>
    <div class="field"><label for="reflect">The first routine I will build at home</label>
      <textarea id="reflect" rows="3" placeholder="When I say … the house will …">${esc(P.reflect || "")}</textarea></div>
    <p class="explain noPrint">What you write here stays in this browser. It is not part of the results code.</p>`;
  $("#reflect").oninput = e => { P.reflect = e.target.value; save(); };
  $("#sheetClose").onclick = () => el.classList.add("hidden");
  $("#sheetPrint").onclick = () => window.print();
  el.scrollIntoView({behavior:"smooth", block:"nearest"});
}

/* ---------- before-and-after builds ---------- */
function renderProbe(el, c){
  const pre = c.id === "pre", f = probeForm(c.id), b = P.probe[c.id];
  let h = "";
  if (!P.done[c.id]){
    h = `<h2>${pre ? "Before the lessons — try one build" : "After the lessons — one last build"}</h2>
      <div class="goal">${esc(f.goal)}</div>
      <p class="explain">${pre
        ? "Nothing has been taught yet, so getting stuck is normal. Give it about 3 minutes, then submit whatever you have. You get one submission and no feedback for now. At the end you will see this build next to your last one."
        : "Same rules as your first build: one submission, no hints, no feedback until you submit. Then you see both builds side by side."}</p>
      <p class="explain">Use + New routine below. You can say the phrase to the room and move the time-of-day slider to try it.</p>
      <div class="quick"><b>Before you submit</b> <span class="mut">1 = not at all · 5 = very sure</span>
        ${CONFIDENCE.map((q, i) => `<div class="confRow"><span>${esc(q)}</span><span class="confBtns">${[1,2,3,4,5].map(v =>
          `<button class="opt num ${probeConf[i] === v ? "sel" : ""}" aria-pressed="${probeConf[i] === v}" data-ci="${i}" data-v="${v}" aria-label="${v} of 5">${v}</button>`).join("")}</span></div>`).join("")}
      </div>
      <p class="explain hidden" id="probeMsg" style="color:var(--bad)">Please answer the three ratings first.</p>
      <div class="panelRow"><button class="btn" id="probeSubmit">Submit my build</button>
        ${pre ? '<button class="mini" id="probeSkip">Skip this build</button>' : ""}</div>`;
  } else if (pre){
    h = `<h2>Before the lessons</h2>
      <div class="doneBanner">${b && b.skip ? "Skipped. You can still do the last build at the end." : "✅ Recorded. You will see how it went at the end, next to your last build."}</div>`;
    if (!P.onboarded) h += `<p style="font-size:14px">Now the lessons. How do you want to start?</p>
      <div class="panelRow">
        <button class="btn" id="ob-new">I've never built a routine — show me (Challenge 1)</button>
        <button class="btn sec" id="ob-skip">I've built one before — skip to Challenge 2</button>
      </div>`;
    else { const nx = nextStep(c); if (nx) h += `<div class="panelRow"><button class="btn" id="nextCh">${esc(nx.label)}</button></div>`; }
  } else {
    const a = P.probe.pre && !P.probe.pre.skip ? P.probe.pre : null;
    const mark = v => v ? '<span class="yes">✓</span>' : '<span class="no">✗</span>';
    const avg = x => (x.conf.reduce((s, v) => s + v, 0) / x.conf.length).toFixed(1);
    h = `<h2>Your before and after</h2>
      <table class="sheet ba">
        <tr><th>Criterion</th><th>Before<br><span class="mut">${a ? `“${esc(FORM[a.f].phrase)}”` : "skipped"}</span></th><th>After<br><span class="mut">“${esc(FORM[b.f].phrase)}”</span></th></tr>
        ${PROBE_CRITERIA.map((t, i) => `<tr><td>${esc(t)}</td><td>${a ? mark(a.k[i]) : "–"}</td><td>${mark(b.k[i])}</td></tr>`).join("")}
        <tr class="tot"><td>Score</td><td>${a ? a.s + " of 5" : "–"}</td><td>${b.s} of 5</td></tr>
        <tr><td>Time</td><td>${a ? fmtSecs(a.t) : "–"}</td><td>${fmtSecs(b.t)}</td></tr>
        <tr><td>Confidence (1 to 5)</td><td>${a ? avg(a) : "–"}</td><td>${avg(b)}</td></tr>
      </table>
      <p class="explain">The two builds are different goals of the same size, scored on the same five criteria. One caution: a second try is always a little easier, so this alone can't prove the lessons caused the change.</p>`
      + finishHTML();
  }
  el.innerHTML = h;
  wireFinish();
  if ($("#nextCh")) $("#nextCh").onclick = () => openChallenge(nextStep(c).id);
  $$("#activePanel [data-ci]").forEach(x => x.onclick = () => { probeConf[+x.dataset.ci] = +x.dataset.v; renderActive(); });
  const leave = () => {                      // close the build and give the learner's routines back
    if (draft) closeEditor();
    P.done[c.id] = true;
    if (P.stash){ routines = P.stash; P.stash = null; P.awayAt = null; }
    sun = 75; $("#sun").value = sun; resetRoom();
    save(); renderRoutines(); renderLadder(); renderActive();
  };
  if ($("#probeSubmit")) $("#probeSubmit").onclick = () => {
    if (probeConf.some(v => v == null)){ $("#probeMsg").classList.remove("hidden"); return; }
    muted = true;
    let k; try { k = f.check({ routines, norm, scenario }).map(v => v ? 1 : 0); } finally { muted = false; }
    P.probe[c.id] = { f: f.id, k, s: k.reduce((s, v) => s + v, 0), conf: [...probeConf],
                      t: Math.round((Date.now() - (P.probeT[c.id] || Date.now())) / 1000) };
    trace(pre ? "📝 First build recorded." : "📝 Last build recorded. Back home — your routines are restored.", "dim");
    leave();
  };
  if ($("#probeSkip")) $("#probeSkip").onclick = () => { P.probe.pre = { skip: 1 }; leave(); };
  const start = exp => { P.exp = exp; P.onboarded = true; P.started = Date.now(); if (exp) P.done.c1 = true; save(); openChallenge(exp ? "c2" : "c1"); };
  if ($("#ob-new"))  $("#ob-new").onclick  = () => start(0);
  if ($("#ob-skip")) $("#ob-skip").onclick = () => start(1);
}
const fmtSecs = t => `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;

/* worked-example side effects, run when ENTERING a step (enterOnly) or leaving it */
function wxDo(what, enterOnly){
  if (!what) return;
  if (what === "build" && enterOnly){
    if (!routines.some(r => r.id === "wx1")){
      routines.push({ id:"wx1", name:"Good night (demo)", phrase:"good night", cond:null, actions:[{device:"light", to:"off"}] });
      save(); renderRoutines();
    }
  }
  if (what === "test" && enterOnly){
    resetRoom();
    $("#sayBox").value = "good night";
    setTimeout(() => sayPhrase("good night"), 450);
  }
  if (what === "cleanup" && !enterOnly){
    routines = routines.filter(r => r.id !== "wx1");
    $("#sayBox").value = "";
    save(); renderRoutines();
  }
}

/* ---------- onboarding ---------- */
function renderOnboarding(el){
  el.innerHTML = `<h2>Meet Maya</h2>
    <div class="goal">Maya's husband uses a wheelchair and controls his room by voice. At home, Maya wants one phrase — <b>“good night”</b> — to turn off the lamp and lock the door. She tried the real app once; the routine never fired, nothing said why, and she gave up.</div>
    <p style="font-size:14px">Routine Ready is a safe copy of her living room. Here, routines are built from three parts:</p>
    <div class="crit"><span class="mark">1</span><span><b>Trigger</b> — “<i>When I say…</i>” The phrase you say.</span></div>
    <div class="crit"><span class="mark">2</span><span><b>Condition</b> — “<i>…but only if…</i>” When the routine is allowed to run (optional).</span></div>
    <div class="crit"><span class="mark">3</span><span><b>Action</b> — “<i>…the house will…</i>” What the house does.</span></div>
    <p class="sentence">Put together: <b>When I say</b> “good night”, <b>the house will</b> turn the lamp off and lock the front door.</p>
    <p class="explain">You'll build routines, say phrases to the room on the left, and read the trace panel when something doesn't fire. Breaking things here is free — that's the point.</p>
    <p class="explain">First you try one build on your own, before any teaching. At the end you do one more, and you see the two side by side. That is how you can tell what the lessons changed.</p>
    <div class="panelRow">
      <button class="btn" id="ob-pre">Start — try one build first (about 3 minutes)</button>
    </div>`;
  $("#ob-pre").onclick = () => openChallenge("pre");
}

/* ---------- theme toggle (shared csTheme key) ---------- */
(function(){
  const KEY = "csTheme", modes = ["auto","dark","light"],
        labels = {auto:"🌗 Auto", dark:"🌙 Dark", light:"☀️ Light"};
  let mode = "auto"; try { const m = localStorage.getItem(KEY); if (modes.includes(m)) mode = m; } catch(e){}
  const btn = $("#themeBtn");
  const apply = () => {
    if (mode === "auto") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", mode);
    btn.textContent = labels[mode];
  };
  btn.onclick = () => { mode = modes[(modes.indexOf(mode) + 1) % 3]; try { localStorage.setItem(KEY, mode); } catch(e){} apply(); };
  apply();
})();

/* ---------- boot ---------- */
renderRoom(); renderRoutines(); renderLadder();
if (P.onboarded && !P.done.pre){ P.done.pre = true; P.probe.pre = { skip: 1 }; }   // progress saved by an earlier version
if (P.awayAt && CH[P.awayAt]){
  openChallenge(P.awayAt);            // reload in the middle of a build or an away challenge
} else if (P.onboarded){
  const next = CHALLENGES.find(c => !P.done[c.id] || pendingJ(c));
  openChallenge(next ? next.id : P.done.post ? "post" : "c6");
} else if (P.done.pre){
  openChallenge("pre");               // first build is in, lessons not started yet
} else {
  renderActive();   // cur is null → onboarding
}
