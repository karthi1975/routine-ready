"use strict";
/* Routine Ready — Milestone 1 build (v0).
   One room, four devices, wizard editor, typed triggers, trace panel,
   challenges 1–4 playable with criterion-rubric checks. Client-side only. */

const $  = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const norm = p => String(p || "").trim().toLowerCase().replace(/\s+/g, " ");

/* ---------- persistence ---------- */
const LS = "routineReady.v1";
function loadP(){
  try { return Object.assign({done:{}, hints:{}, attempts:{}, routines:null, onboarded:false},
                             JSON.parse(localStorage.getItem(LS)) || {}); }
  catch(e){ return {done:{}, hints:{}, attempts:{}, routines:null, onboarded:false}; }
}
let P = loadP();
const save = () => { try { P.routines = routines; localStorage.setItem(LS, JSON.stringify(P)); } catch(e){} };

/* ---------- room state ---------- */
const START = { light:true, blinds:true, locked:false, temp:72 };
let room = {...START};
let sun = 75;                       // 0–100; below 30 counts as dark
const isDark = () => sun < 30;

function renderRoom(){
  $("#roomBox").classList.toggle("night", isDark());
  $("#sunLabel").textContent = isDark() ? "night 🌙" : "daytime";
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
function resetRoom(){ room = {...START}; renderRoom(); }

/* manual device controls (sandbox is always live) */
$("#lightBtn").onclick  = () => { room.light = !room.light;  trace(`✋ You turned the lamp ${room.light?"on":"off"} by hand.`, "dim"); renderRoom(); };
$("#blindsBtn").onclick = () => { room.blinds = !room.blinds; trace(`✋ You ${room.blinds?"opened":"closed"} the blinds by hand.`, "dim"); renderRoom(); };
$("#lockBtn").onclick   = () => { room.locked = !room.locked; trace(`✋ You ${room.locked?"locked":"unlocked"} the door by hand.`, "dim"); renderRoom(); };
$("#tempUp").onclick    = () => { room.temp++; renderRoom(); };
$("#tempDown").onclick  = () => { room.temp--; renderRoom(); };
$("#sun").oninput = e => { sun = +e.target.value; renderRoom(); };

/* ---------- trace panel ---------- */
let traceLines = [];
function trace(msg, cls){
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
  beforeDark: { label:"only in daylight", test: () => !isDark(), why: () => !isDark() ? "it is daytime" : "it is dark" }
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

function renderRoutines(){
  const el = $("#routineList");
  if (!routines.length){ el.innerHTML = '<div class="mut">No routines yet. Build one, or let Challenge 1 show you how.</div>'; return; }
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
let draft = null;   // {idx|null, step, name, phrase, cond, acts:{light,blinds,lock,temp}}
function openEditor(r, idx){
  draft = r
    ? { idx, step:1, name:r.name, phrase:r.phrase, cond:r.cond,
        acts: Object.fromEntries(["light","blinds","lock","temp"].map(d => [d, (r.actions.find(a => a.device === d) || {}).to ?? null])) }
    : { idx:null, step:1, name:"", phrase:"", cond:null, acts:{light:null, blinds:null, lock:null, temp:null} };
  $("#editorCard").classList.remove("hidden");
  renderEditor();
  $("#editorCard").scrollIntoView({behavior:"smooth", block:"nearest"});
}
$("#newRoutine").onclick = () => openEditor(null);

function renderEditor(){
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
    ${[["", "No condition — run whenever the phrase is said"], ["afterDark","Only after dark"], ["beforeDark","Only in daylight"]].map(([v, l]) =>
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
      <button class="mini" id="e-close">Cancel</button></div>
    ${stepTabs}${body}
    <div class="panelRow">
      ${d.step > 1 ? '<button class="btn sec" id="e-back">← Back</button>' : ""}
      ${d.step < 3 ? '<button class="btn" id="e-next">Next →</button>' : '<button class="btn" id="e-save">Save routine</button>'}
    </div>`;
  const grab = () => {
    if (d.step === 1){ d.name = $("#e-name").value; d.phrase = $("#e-phrase").value; }
  };
  $("#e-close").onclick = () => { $("#editorCard").classList.add("hidden"); draft = null; };
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
  $$("#editorCard [data-val]").forEach(i => i.onchange = () => { d.acts[i.dataset.val] = i.dataset.val === "temp" ? +i.value : i.value; });
  if ($("#e-save")) $("#e-save").onclick = () => {
    const actions = ["light","blinds","lock","temp"].filter(dev => d.acts[dev] != null)
                    .map(dev => ({device:dev, to:d.acts[dev]}));
    if (!actions.length){ alertStep("Pick at least one action — a routine that does nothing can't help Maya."); return; }
    const r = { id: d.idx != null ? routines[d.idx].id : "r" + Date.now(),
                name: d.name.trim() || d.phrase.trim(), phrase: d.phrase, cond: d.cond, actions };
    if (d.idx != null) routines[d.idx] = r; else routines.push(r);
    trace(`💾 Saved routine “${r.name}” — say “${r.phrase}” to run it.`, "dim");
    save(); renderRoutines();
    $("#editorCard").classList.add("hidden"); draft = null;
    if (cur && CH[cur].kind !== "worked") renderActive();   // refresh check button state
  };
  function alertStep(msg){
    const p = document.createElement("p"); p.className = "explain"; p.style.color = "var(--bad)"; p.textContent = msg;
    el.querySelector(".panelRow").before(p); setTimeout(() => p.remove(), 3500);
  }
}

/* ---------- challenges ---------- */
const CH = Object.fromEntries(CHALLENGES.map(c => [c.id, c]));
let cur = null;        // current challenge id
let wxStep = 0;        // worked-example step
let lastResults = null;
let hintShown = 0;

function doneCount(){ return CHALLENGES.filter(c => P.done[c.id]).length; }
function renderProgress(){ $("#progress").textContent = `${doneCount()}/6 challenges`; }

function renderLadder(){
  $("#ladder").innerHTML = CHALLENGES.map(c => {
    const d = P.done[c.id], lock = c.kind === "locked";
    return `<button class="chip ${cur === c.id ? "cur" : ""} ${d ? "done" : ""} ${lock ? "lock" : ""}" data-ch="${c.id}" ${lock ? "disabled" : ""}>
      <span>${d ? "✅" : lock ? "🔒" : "•"}</span> ${c.n}. ${esc(c.title)}
      <span class="st ${lock ? "lockTag" : ""}">${d ? "done" : lock ? esc(c.lockNote) : ""}</span></button>`;
  }).join("");
  $$("#ladder [data-ch]").forEach(b => b.onclick = () => openChallenge(b.dataset.ch));
  renderProgress();
}

function openChallenge(id){
  cur = id; wxStep = 0; lastResults = null; hintShown = P.hints[id] || 0;
  const c = CH[id];
  if (c.inject && !routines.some(r => r.id === c.inject.id) && !P.done[id]){
    routines.push(JSON.parse(JSON.stringify(c.inject)));
    save(); renderRoutines();
    trace(`📦 Maya's routine has been added to “My routines”.`, "dim");
  }
  renderLadder(); renderActive();
}

/* scenario runner handed to challenge checks — runs through the real engine, visibly */
function scenario(sunLevel, phrase){
  sun = sunLevel; $("#sun").value = sun;
  resetRoom();
  trace(`—— check: room reset, ${isDark() ? "night" : "daytime"} ——`, "dim");
  sayPhrase(phrase);
  return { room: {...room}, fired: [...lastRun.fired] };
}

function renderActive(){
  const el = $("#activePanel");
  if (!cur){ renderOnboarding(el); return; }
  const c = CH[cur], done = P.done[c.id];
  let h = `<h2>Challenge ${c.n} — ${esc(c.title)}</h2>
    <div class="goal">${esc(c.goal)}</div>
    <div class="support">Support: ${esc(c.support)}</div>`;
  if (done) h += `<div class="doneBanner">✅ Completed. Re-run the check any time, or move on.</div>`;

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
        <span>${esc(r.label)}${r.ok ? "" : `<span class="fb">${esc(r.fb)}</span>`}</span></div>`).join("");
      if (lastResults.every(r => r.ok)) h += `<div class="doneBanner">✅ All criteria met — challenge complete!</div>`;
    }
    h += `<div class="panelRow">
      <button class="btn" id="runCheck">Run the check</button>
      ${c.hints && hintShown < (c.hints || []).length ? `<button class="btn sec" id="hintBtn">Hint (${hintShown}/${c.hints.length} used)</button>` : ""}
      ${c.kind === "fix" ? '<span class="mut">No hints here — the trace panel is your tool.</span>' : ""}
    </div>`;
  }
  el.innerHTML = h;

  if ($("#wx-next")) $("#wx-next").onclick = () => { wxDo(c.steps[wxStep].do); wxStep++; wxDo(c.steps[wxStep].do, true); renderActive(); };
  if ($("#wx-done")) $("#wx-done").onclick = () => {
    wxDo(c.steps[wxStep].do);
    P.done.c1 = true; save(); openChallenge("c2");
  };
  if ($("#runCheck")) $("#runCheck").onclick = () => {
    lastResults = c.check({ routines, norm, scenario });
    const pass = lastResults.every(r => r.ok);
    P.attempts[c.id] = (P.attempts[c.id] || 0) + 1;
    if (pass) P.done[c.id] = true;
    save(); renderLadder(); renderActive();
  };
  if ($("#hintBtn")) $("#hintBtn").onclick = () => { hintShown++; P.hints[c.id] = hintShown; save(); renderActive(); };
}

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
    <div class="crit"><span class="mark">1</span><span><b>Trigger</b> — the phrase you say.</span></div>
    <div class="crit"><span class="mark">2</span><span><b>Condition</b> — when the routine is allowed to run (optional).</span></div>
    <div class="crit"><span class="mark">3</span><span><b>Action</b> — what the house does.</span></div>
    <p class="explain">You'll build routines, say phrases to the room on the left, and read the trace panel when something doesn't fire. Breaking things here is free — that's the point.</p>
    <div class="panelRow">
      <button class="btn" id="ob-new">I've never built a routine — show me (Challenge 1)</button>
      <button class="btn sec" id="ob-skip">I've built one before — skip to Challenge 2</button>
    </div>`;
  $("#ob-new").onclick  = () => { P.onboarded = true; save(); openChallenge("c1"); };
  $("#ob-skip").onclick = () => { P.onboarded = true; P.done.c1 = true; save(); openChallenge("c2"); };
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
if (P.onboarded){
  const next = CHALLENGES.find(c => c.kind !== "locked" && !P.done[c.id]);
  openChallenge(next ? next.id : "c4");
} else {
  renderActive();   // cur is null → onboarding
}
