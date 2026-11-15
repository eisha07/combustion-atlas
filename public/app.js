(() => {
"use strict";
const $ = (s, r = document) => r.querySelector(s);
const el = (tag, attrs = {}, html) => { const e = document.createElement(tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (html != null) e.innerHTML = html; return e; };
const byId = Object.fromEntries([...INV, ...GROUND].map(x => [x.id, x]));
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- palettes per mode ---------- */
const PAL = {
  dark: { fam: { acme: "#ff9a4a", mdca: "#ffd166", duct: "#62d6ff", saffire: "#ff5d6c", smoke: "#b9a7ff", other: "#6f7d95" }, ground: "#8fa3bf",
          dims: { F: "#ff9a4a", D: "#b9a7ff", S: "#62d6ff", O: "#ff5d9e", R: "#ffd166", M: "#7fe0c4" } },
  light:{ fam: { acme: "#1d2b4f", mdca: "#b97f00", duct: "#0f6470", saffire: "#a3260f", smoke: "#5b3f8c", other: "#7d6b5a" }, ground: "#8a7766",
          dims: { F: "#d24a1f", D: "#5b3f8c", S: "#0f5e6b", O: "#a3194f", R: "#b7791f", M: "#2f7d4f" } },
};
// colours for marks drawn directly on the orange sky (3D view): very dark or very light only
PAL.sky = { fam: { acme: "#0f1d45", mdca: "#ffe066", duct: "#c4f1f7", saffire: "#fff6e8", smoke: "#2d1650", other: "#3b2a20" }, ground: "#3b2a20" };
const state = {
  role: "engineer", habitat: "lunar", w: { ...HABITATS.lunar.w }, mode: "dark",
  selected: "PSI-20", pinned: ["PSI-20", "PSI-25", "PSI-99"], phase: "all", step: 0,
};
try { const s = JSON.parse(localStorage.getItem("atlas-pref") || "{}");
  if (ROLES[s.role]) state.role = s.role; if (HABITATS[s.habitat]) { state.habitat = s.habitat; state.w = { ...HABITATS[s.habitat].w }; } if (s.mode === "light" || s.mode === "dark") state.mode = s.mode; } catch (e) {}
const savePref = () => { try { localStorage.setItem("atlas-pref", JSON.stringify({ role: state.role, habitat: state.habitat, mode: state.mode })); } catch (e) {} };
const fc = k => PAL[state.mode].fam[k];
const dc = k => PAL[state.mode].dims[k];
const sky = k => (state.mode === "light" ? PAL.sky : PAL.dark).fam[k]; // matches the 3D marks

/* ---------- scoring ---------- */
function score(inv, w = state.w) {
  if (!inv.s) { const p = byId[inv.parent]; return p ? Math.round(score(p, w) * .55) : 4; }
  let t = 0, sw = 0; for (const d of DIMS) { t += (w[d.k] || 0) * inv.s[d.k]; sw += (w[d.k] || 0); }
  return sw ? Math.round(100 * t / sw) : 0;
}
const contrib = inv => { const sw = DIMS.reduce((a, d) => a + (state.w[d.k] || 0), 0) || 1; return DIMS.map(d => ({ ...d, v: 100 * (state.w[d.k] || 0) * inv.s[d.k] / sw })); };
const ranked = () => INV.map(i => ({ i, sc: score(i) })).sort((a, b) => b.sc - a.sc);
const phaseOK = inv => state.phase === "all" || inv.phase === state.phase;
function envOf(inv) {
  const e = inv.env || {}; let o2max = null, pmin = null, pmax = null;
  if (e.pts) for (const [p, o] of e.pts) { o2max = Math.max(o2max ?? -1, o); pmin = Math.min(pmin ?? 999, p); pmax = Math.max(pmax ?? -1, p); }
  if (e.o2) o2max = Math.max(o2max ?? -1, e.o2[1]);
  if (e.p) { pmin = Math.min(pmin ?? 999, e.p[0]); pmax = Math.max(pmax ?? -1, e.p[1]); }
  if (e.pApprox && pmin == null) pmin = pmax = e.pApprox;
  return { o2max, pmin, pmax, approx: !!e.approx };
}
function gloss(text) {
  if (!["undergrad", "grad", "professor"].includes(state.role)) return text;
  let out = text;
  for (const term of Object.keys(GLOSSARY)) {
    const re = new RegExp(`(^|[^\\w>])(${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})(?![\\w<])`, "i");
    out = out.replace(re, (m, a, b) => `${a}<abbr class="g" title="${GLOSSARY[term]}">${b}</abbr>`);
  }
  return out;
}

/* ---------- menus & mode ---------- */
function menu(btn, box, items, current, onPick) {
  box.innerHTML = "";
  for (const [k, label, sub] of items) {
    const b = el("button", { role: "menuitemradio", "aria-checked": k === current }, `<span>${label}</span>${sub ? `<small>${sub}</small>` : ""}`);
    b.onclick = () => { closeMenus(); onPick(k); }; box.append(b);
  }
  btn.onclick = e => { e.stopPropagation(); const open = !box.classList.contains("open"); closeMenus(); box.classList.toggle("open", open); btn.setAttribute("aria-expanded", open); };
}
function closeMenus() { document.querySelectorAll(".menu").forEach(m => m.classList.remove("open")); document.querySelectorAll(".menu-btn").forEach(b => b.setAttribute("aria-expanded", "false")); }
document.addEventListener("click", e => { if (!e.target.closest(".menu-wrap")) closeMenus(); });
function renderBar() {
  $("#role-lab").textContent = ROLES[state.role].label; $("#hab-lab").textContent = HABITATS[state.habitat].label;
  menu($("#role-btn"), $("#role-menu"), Object.entries(ROLES).map(([k, v]) => [k, v.label, v.agent]), state.role, setRole);
  menu($("#hab-btn"), $("#hab-menu"), Object.entries(HABITATS).map(([k, v]) => [k, v.label, k === "earth" ? "terrestrial spin-offs" : `${v.p} psia · ${v.o2}% O₂`]), state.habitat, setHabitat);
  const light = state.mode === "light";
  $("#mode").innerHTML = light ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>`
    : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="4.2"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/></svg>`;
  $("#mode").setAttribute("aria-label", light ? "Switch to dark view" : "Switch to light view");
}
$("#mode").onclick = () => { state.mode = state.mode === "dark" ? "light" : "dark"; savePref(); applyMode(); };
function applyMode() { document.documentElement.setAttribute("data-mode", state.mode); scene.setMode(state.mode); renderAll(); if (typeof deep !== "undefined") { deep.paint(); mars.paint(); } }
function setRole(k) { state.role = k; state.step = 0; savePref(); renderBar(); renderAgent(true); renderMini(); renderDossier(); }
function setHabitat(k) { state.habitat = k; state.w = { ...HABITATS[k].w }; savePref(); renderAll(); }

/* ---------- drawers ---------- */
function openDrawer(id, on = true) {
  const d = document.getElementById(id); d.classList.toggle("open", on);
  if (id === "dossier") $("#mini").classList.toggle("hide", on);
  scene.shift(($("#rank-drawer").classList.contains("open") ? .12 : 0) - ($("#dossier").classList.contains("open") ? .14 : 0));
}
document.addEventListener("click", e => { const c = e.target.closest("[data-close]"); if (c) openDrawer(c.dataset.close, false); });
document.addEventListener("keydown", e => { if (e.key !== "Escape") return; closeMenus(); openDrawer("rank-drawer", false); openDrawer("dossier", false); $("#agent").classList.add("closed"); $("#orb").classList.remove("hidden"); });

/* ---------- sky overlays ---------- */
function renderSky() {
  const H = HABITATS[state.habitat], pp = (H.p * H.o2 / 100).toFixed(2);
  $("#hab").innerHTML = `<div class="eyebrow">Crew environment <button class="link" id="why">why it matters</button></div><h2>${H.label}</h2>
    <div class="nums"><span><b>${H.p}</b> psia</span><span><b>${H.o2}</b>% O₂</span><span>ppO₂ <b>${pp}</b></span></div><div class="why">${H.note}</div>${matchMedia("(pointer: coarse)").matches ? `<div class="touch-hint">Swipe to rotate · pinch to zoom · tap a star</div>` : ""}`;
  $("#why").onclick = () => $("#hab").classList.toggle("show-why");
  const t = $("#top3"); t.innerHTML = `<div class="eyebrow">Closest to this need</div>`;
  ranked().filter(x => phaseOK(x.i)).slice(0, 3).forEach((x, n) => {
    const b = el("button", { class: "t3" }, `<span class="n">0${n + 1}</span><span class="nm"><span class="dot" style="background:${sky(x.i.fam)}"></span>${x.i.ac}</span><span class="sc">${x.sc}</span>`);
    b.onclick = () => select(x.i.id); t.append(b);
  });
  const all = el("button", { class: "link" }, `All ${INV.length} investigations, and tune the ranking`); all.onclick = () => openDrawer("rank-drawer"); t.append(all);
  $("#legend").innerHTML = Object.entries(FAMILIES).filter(([k]) => k !== "other").map(([k, f]) => `<span><i class="dot" style="background:${sky(k)}"></i>${f.short}</span>`).join("") + `<span><i class="dot" style="background:${(state.mode === "light" ? PAL.sky : PAL.dark).ground}"></i>ground reuse</span><span><i class="astro-ico">${ASTRO}</i>pinned to compare</span>`;
}

function renderRank(skipLens) {
  const H = HABITATS[state.habitat];
  $("#rank-title").textContent = state.habitat === "earth" ? "For fire safety on Earth" : `For a ${H.label.toLowerCase()}`;
  const f = $("#filters"); f.innerHTML = "";
  for (const [k, lab] of [["all", "All"], ["gas", "Gas"], ["liquid", "Liquid"], ["solid", "Solid"], ["aerosol", "Smoke & aerosol"]]) {
    const b = el("button", { class: "fchip", "aria-pressed": k === state.phase }, lab); b.onclick = () => { state.phase = k; renderRank(); renderSky(); scene.refresh(); }; f.append(b);
  }
  const ol = $("#rank"); ol.innerHTML = "";
  ranked().filter(x => phaseOK(x.i)).forEach((x, n) => {
    const li = el("li", { tabindex: 0, class: x.i.id === state.selected ? "sel" : "" });
    const bar = contrib(x.i).map(c => `<i style="width:${c.v}%;background:${dc(c.k)}" title="${c.name}"></i>`).join("");
    li.innerHTML = `<span class="n">${n + 1}</span><div style="min-width:0"><div class="nm"><span class="dot" style="background:${fc(x.i.fam)}"></span>${x.i.ac}</div><div class="sub">${x.i.name}</div><div class="bar">${bar}</div></div><span class="sc">${x.sc}</span>`;
    li.onclick = () => select(x.i.id); li.onkeydown = e => { if (e.key === "Enter") select(x.i.id); };
    ol.append(li);
  });
  if (skipLens) return;
  const lg = $("#lens-grid"); lg.innerHTML = "";
  for (const d of DIMS) {
    const lab = el("label", {}, `<span class="tag"><i style="background:${dc(d.k)}"></i>${d.name}</span>`);
    const inp = el("input", { type: "range", min: 0, max: 60, value: Math.round((state.w[d.k] || 0) * 100), "aria-label": d.name });
    inp.oninput = () => { state.w[d.k] = inp.value / 100; renderRankList(); };
    lab.append(inp); lg.append(lab);
  }
  const reset = el("button", { class: "ghost", style: "align-self:flex-start;margin-top:6px" }, "Reset to habitat weights");
  reset.onclick = () => { state.w = { ...HABITATS[state.habitat].w }; renderRank(); renderSky(); scene.refresh(); renderMini(); }; lg.append(reset);
}
function renderRankList() { // cheap refresh while sliding
  renderRank(true); renderSky(); scene.refresh(); renderMini();
}


/* an original little EVA astronaut (white suit, gold visor, backpack) planting a marker flag: the "pinned" badge.
   Light comes from the upper left; the contact shadow sits on the star's surface under his boots. */
const ASTRO = `<svg viewBox="0 0 40 56" aria-hidden="true">
  <defs>
    <linearGradient id="as-suit" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".5" stop-color="#eceef1"/><stop offset="1" stop-color="#a9b1be"/></linearGradient>
    <linearGradient id="as-limb" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ffffff"/><stop offset=".55" stop-color="#e3e6ea"/><stop offset="1" stop-color="#9aa3b1"/></linearGradient>
    <linearGradient id="as-pack" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e9ecef"/><stop offset="1" stop-color="#8d96a5"/></linearGradient>
    <radialGradient id="as-visor" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#ffe9b0"/><stop offset=".35" stop-color="#e2a83a"/><stop offset=".8" stop-color="#7a4a0e"/><stop offset="1" stop-color="#3f2406"/></radialGradient>
    <radialGradient id="as-shadow"><stop offset="0" stop-color="#1a0800" stop-opacity=".78"/><stop offset=".55" stop-color="#1a0800" stop-opacity=".4"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
  </defs>
  <ellipse class="as-ground" cx="20" cy="52.4" rx="13" ry="3" fill="url(#as-shadow)"/>
  <g class="fig" stroke="#1b1410" stroke-width=".85" stroke-linejoin="round" stroke-linecap="round">
    <line x1="33" y1="4" x2="33" y2="52" stroke-width="1.3"/>
    <path d="M33.6 4.4 L40 7.3 L33.6 10.2 Z" fill="#ff7a3c"/>
    <rect x="7" y="17.5" width="25" height="17" rx="3" fill="url(#as-pack)"/>
    <rect x="7" y="17.5" width="3" height="17" rx="1.5" fill="#1b1410" opacity=".18" stroke="none"/>
    <path d="M12.6 33 L11.6 46.5 L17.4 46.5 L17.8 33 Z" fill="url(#as-limb)"/>
    <path d="M20.6 33 L21.2 46.5 L27 46.5 L25.8 33 Z" fill="url(#as-limb)"/>
    <path d="M22.6 34 L23.3 46.3" stroke="#c8333b" stroke-width="1.1"/>
    <path d="M12.4 39.5 Q14.6 40.4 17.6 39.5 M21 40.2 Q23.6 41 26.3 40" fill="none" stroke-width=".55" opacity=".55"/>
    <path d="M10.6 46.2 H18 Q18.6 50.6 17.4 51 H10.4 Q9.6 48.6 10.6 46.2 Z" fill="#cfd4db"/>
    <path d="M20.6 46.2 H27.6 Q28.6 48.6 27.8 51 H20.8 Q19.8 50.6 20.6 46.2 Z" fill="#b9c0ca"/>
    <rect x="10.8" y="18.5" width="17.6" height="17" rx="5" fill="url(#as-suit)"/>
    <path d="M23.4 19 Q28.4 19.5 28.4 24 V31 Q28.4 35.4 24 35.4 Z" fill="#1d2b4f" opacity=".16" stroke="none"/>
    <rect x="14.6" y="24" width="10" height="5.6" rx="1.2" fill="#dde1e6" stroke-width=".6"/>
    <circle cx="16.8" cy="26.8" r=".9" fill="#c8333b" stroke="none"/><circle cx="19.4" cy="26.8" r=".9" fill="#2f6fd6" stroke="none"/><rect x="21.2" y="25.8" width="2.4" height="2" rx=".4" fill="#f2c14e" stroke="none"/>
    <path d="M11.2 20 Q7.4 22 7.8 30.5" fill="none" stroke="#1b1410" stroke-width="5.6"/>
    <path d="M11.2 20 Q7.4 22 7.8 30.5" fill="none" stroke="url(#as-limb)" stroke-width="3.9"/>
    <circle cx="7.9" cy="31.6" r="2" fill="#c9ced6"/>
    <path d="M28 20 Q31.6 20.4 32.4 24.6" fill="none" stroke="#1b1410" stroke-width="5.6"/>
    <path d="M28 20 Q31.6 20.4 32.4 24.6" fill="none" stroke="#c6ccd5" stroke-width="3.9"/>
    <circle cx="33" cy="25.6" r="2" fill="#aeb5c0"/>
    <ellipse cx="19.6" cy="18.6" rx="6.4" ry="2" fill="#c5cbd3"/>
    <circle cx="19.6" cy="11" r="8.4" fill="url(#as-suit)"/>
    <ellipse cx="20.6" cy="11.4" rx="6" ry="5.1" fill="url(#as-visor)" stroke-width=".7"/>
    <path d="M16.4 9.4 Q17.8 7 20.8 7.2" fill="none" stroke="#fff6dc" stroke-width="1.2" opacity=".9"/>
    <circle cx="24" cy="13.6" r=".8" fill="#fff3cf" stroke="none" opacity=".8"/>
    <path d="M24.8 4.6 Q28.2 7.4 27.8 12.4" fill="none" stroke="#1d2b4f" stroke-width="1.4" opacity=".18"/>
  </g>
</svg>`;

/* ---------- 3D constellation ---------- */
const scene = (() => {
  const host = $("#sky"), labels = $("#labels"), drag = $("#drag");
  const stub = { refresh() {}, focus() {}, setMode() {}, shift() {}, setPins() {} };
  const pinLayer = $("#pins"), pinEls = {};
  if (!window.THREE) return stub;
  const T = THREE;
  let renderer; try { renderer = new T.WebGLRenderer({ antialias: true, alpha: true }); } catch (e) { return stub; }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  host.prepend(renderer.domElement);
  const sc = new T.Scene(); sc.fog = new T.FogExp2(0x05070d, .011);
  const cam = new T.PerspectiveCamera(46, 1, .1, 500);
  const glowTex = (() => { const c = document.createElement("canvas"); c.width = c.height = 128; const g = c.getContext("2d");
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(.18, "rgba(255,255,255,.5)"); gr.addColorStop(.45, "rgba(255,255,255,.1)"); gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return new T.CanvasTexture(c); })();

  const starsPos = new Float32Array(2000 * 3);
  for (let i = 0; i < 2000; i++) { const r = 70 + Math.random() * 100, th = Math.random() * 6.283, ph = Math.acos(2 * Math.random() - 1); starsPos.set([r * Math.sin(ph) * Math.cos(th), r * Math.cos(ph), r * Math.sin(ph) * Math.sin(th)], i * 3); }
  const sg = new T.BufferGeometry(); sg.setAttribute("position", new T.BufferAttribute(starsPos, 3));
  const stars = new T.Points(sg, new T.PointsMaterial({ color: 0x9fb4d8, size: .35, transparent: true, opacity: .7, fog: false })); sc.add(stars);
  const nebulae = [[0x2a5fa8, -30, 10, -60, 70], [0x7a3214, 40, -14, -50, 60], [0x3b2a6e, 0, 25, -80, 80]].map(([c, x, y, z, s]) => {
    const sp = new T.Sprite(new T.SpriteMaterial({ map: glowTex, color: c, transparent: true, opacity: .35, blending: T.AdditiveBlending, depthWrite: false, fog: false })); sp.position.set(x, y, z); sp.scale.set(s, s, 1); sc.add(sp); return sp; });
  const grid = new T.PolarGridHelper(17, 12, 6, 64, 0x1d2a44, 0x141d31); grid.position.y = -3.4; grid.material.transparent = true; grid.material.opacity = .5; sc.add(grid);
  const core = new T.Mesh(new T.IcosahedronGeometry(1.4, 1), new T.MeshBasicMaterial({ color: 0x62d6ff, wireframe: true, transparent: true, opacity: .45 })); sc.add(core);
  const coreGlow = new T.Sprite(new T.SpriteMaterial({ map: glowTex, color: 0x62d6ff, transparent: true, opacity: .5, blending: T.AdditiveBlending, depthWrite: false })); coreGlow.scale.set(6, 6, 1); sc.add(coreGlow);

  const famKeys = Object.keys(FAMILIES), stations = {};
  famKeys.forEach((k, i) => {
    const a = i / famKeys.length * Math.PI * 2 + .3, R = k === "other" ? 13.5 : 11;
    const p = new T.Vector3(Math.cos(a) * R, i % 2 ? .8 : -.6, Math.sin(a) * R);
    const ring = new T.Mesh(new T.TorusGeometry(3.1, .02, 6, 90), new T.MeshBasicMaterial({ transparent: true, opacity: .35 })); ring.position.copy(p); ring.rotation.x = Math.PI / 2; sc.add(ring);
    const ring2 = new T.Mesh(new T.TorusGeometry(3.4, .008, 4, 90), new T.MeshBasicMaterial({ transparent: true, opacity: .18 })); ring2.position.copy(p); ring2.rotation.x = Math.PI / 2 + .25; sc.add(ring2);
    const lb = el("div", { class: "lbl st" }, FAMILIES[k].short); labels.append(lb);
    stations[k] = { p, ring, ring2, lb };
  });
  const nodes = {}, hits = [], groups = {};
  INV.forEach(i => (groups[i.fam] = groups[i.fam] || []).push(i));
  for (const [k, list] of Object.entries(groups)) list.forEach((inv, j) => {
    const a = j / list.length * Math.PI * 2 + k.length, st = stations[k].p;
    addNode(inv, new T.Vector3(st.x + Math.cos(a) * 2.5, st.y + Math.sin(j * 1.9) * 1.1, st.z + Math.sin(a) * 2.5), k, false);
  });
  GROUND.forEach((g, j) => { const par = nodes[g.parent]; let pos;
    if (par) { const out = par.pos.clone().setY(0).normalize(); pos = par.pos.clone().add(out.multiplyScalar(2.6)).add(new T.Vector3(0, 1.2 + (j % 2) * .6, 0)); } else pos = new T.Vector3(-15, 3, 6);
    addNode(g, pos, null, true); });
  function addNode(inv, pos, fam, ground) {
    const m = new T.Mesh(new T.SphereGeometry(1, 22, 16), new T.MeshBasicMaterial({ transparent: true })); m.position.copy(pos); sc.add(m);
    const g = new T.Sprite(new T.SpriteMaterial({ map: glowTex, transparent: true, blending: T.AdditiveBlending, depthWrite: false })); g.position.copy(pos); sc.add(g);
    const hit = new T.Mesh(new T.SphereGeometry(.8, 8, 6), new T.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })); hit.position.copy(pos); hit.userData.id = inv.id; sc.add(hit); hits.push(hit);
    const lb = el("div", { class: "lbl" }, inv.ac); labels.append(lb);
    nodes[inv.id] = { inv, pos, m, g, lb, ground, fam };
  }
  const relMat = new T.LineBasicMaterial({ transparent: true, opacity: .16 }), seen = new Set();
  INV.forEach(i => (i.rel || []).forEach(r => { const key = [i.id, r].sort().join(); if (seen.has(key) || !nodes[r]) return; seen.add(key);
    sc.add(new T.Line(new T.BufferGeometry().setFromPoints([nodes[i.id].pos, nodes[r].pos]), relMat)); }));
  const dashMat = new T.LineDashedMaterial({ dashSize: .2, gapSize: .15, transparent: true, opacity: .45 });
  GROUND.forEach(g => { if (!nodes[g.parent]) return; const l = new T.Line(new T.BufferGeometry().setFromPoints([nodes[g.id].pos, nodes[g.parent].pos]), dashMat); l.computeLineDistances(); sc.add(l); });
  const beamMat = new T.LineBasicMaterial({ transparent: true, opacity: .5, blending: T.AdditiveBlending });
  const beams = [0, 1, 2, 3, 4].map(() => { const ln = new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(), new T.Vector3()]), beamMat.clone()); sc.add(ln); return ln; });
  const halo = new T.Mesh(new T.TorusGeometry(1, .035, 8, 64), new T.MeshBasicMaterial({ transparent: true, opacity: .9 })); sc.add(halo);

  // ctl.fit = distance that frames the whole constellation for this screen shape; ctl.zoom scales it (wheel, pinch, focus)
  const ctl = { th: .9, ph: 1.12, fit: 41, zoom: 1, r: 41, tgt: new T.Vector3(), goal: new T.Vector3(), idle: 0, off: 0, offGoal: 0 };
  const setZoom = z => { ctl.zoom = Math.min(1.5, Math.max(.25, z)); ctl.idle = 0; };
  const ptrs = new Map(); let dragging = null, moved = false, hover = null, pinch = null;
  drag.addEventListener("pointerdown", e => {
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); try { drag.setPointerCapture(e.pointerId); } catch (x) {}
    if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, z: ctl.zoom }; dragging = null; moved = true; }
    else if (ptrs.size === 1) { dragging = { x: e.clientX, y: e.clientY, touch: e.pointerType !== "mouse" }; moved = false; }
  });
  drag.addEventListener("pointermove", e => {
    if (ptrs.has(e.pointerId)) ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && ptrs.size >= 2) { const [a, b] = [...ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y); if (d > 10) setZoom(pinch.z * pinch.d / d); return; }
    if (dragging) { const dx = e.clientX - dragging.x, dy = e.clientY - dragging.y; if (Math.abs(dx) + Math.abs(dy) > 4) moved = true;
      ctl.th += dx * (dragging.touch ? .009 : .005); ctl.ph = Math.min(2.6, Math.max(.35, ctl.ph - dy * (dragging.touch ? .006 : .005)));
      dragging.x = e.clientX; dragging.y = e.clientY; ctl.idle = 0; }
    else if (e.pointerType === "mouse") pick(e, false);
  });
  const endPtr = e => { const tap = e.type === "pointerup" && dragging && !moved && !pinch; ptrs.delete(e.pointerId);
    if (tap) pick(e, true); if (ptrs.size < 2) pinch = null; if (!ptrs.size) dragging = null; };
  drag.addEventListener("pointerup", endPtr); drag.addEventListener("pointercancel", endPtr);
  host.addEventListener("wheel", e => { if (!e.target.closest("#drag")) return; e.preventDefault(); setZoom(ctl.zoom * (1 + Math.sign(e.deltaY) * .08)); }, { passive: false });
  const ray = new T.Raycaster(), mv = new T.Vector2();
  function pick(e, click) {
    const r = renderer.domElement.getBoundingClientRect(); mv.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
    ray.setFromCamera(mv, cam); ray.params.Points = { threshold: 1 };
    const h = ray.intersectObjects(hits)[0]; hover = h ? h.object.userData.id : null;
    drag.style.cursor = hover ? "pointer" : ""; if (click && hover) select(hover);
  }
  function resize() {
    const w = host.clientWidth, h = host.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h); cam.aspect = w / h; cam.updateProjectionMatrix();
    // a portrait phone sees far less width, so step back until the rings fit across the screen
    ctl.fit = Math.max(41, 13 / (Math.tan(23 * Math.PI / 180) * cam.aspect));
  }
  addEventListener("orientationchange", () => setTimeout(resize, 250));
  new ResizeObserver(resize).observe(host); resize();

  const v = new T.Vector3(), v2 = new T.Vector3(), up = new T.Vector3(); let t0 = performance.now(), visible = true;
  new IntersectionObserver(es => visible = es[0].isIntersecting).observe(host);
  function frame(now) {
    requestAnimationFrame(frame); if (!visible) { t0 = now; return; }
    const dt = Math.min(50, now - t0); t0 = now; const t = now / 1000;
    ctl.idle += dt; if (!dragging && ctl.idle > 2500 && !reduced) ctl.th += dt * .00004;
    ctl.tgt.lerp(ctl.goal, .05); ctl.r += (ctl.fit * ctl.zoom - ctl.r) * .06; ctl.off += (ctl.offGoal - ctl.off) * .07;
    cam.position.set(ctl.tgt.x + ctl.r * Math.sin(ctl.ph) * Math.cos(ctl.th), ctl.tgt.y + ctl.r * Math.cos(ctl.ph), ctl.tgt.z + ctl.r * Math.sin(ctl.ph) * Math.sin(ctl.th));
    cam.lookAt(ctl.tgt);
    const W = host.clientWidth, Hh = host.clientHeight, wide = W > 900 ? .1 : 0;
    cam.setViewOffset(W, Hh, -(wide + ctl.off) * W, 0, W, Hh);
    core.rotation.y += .003; core.rotation.x += .0012;
    for (const k in stations) { stations[k].ring.rotation.z += .0015; stations[k].ring2.rotation.z -= .001; }
    beams.forEach((b, i) => b.material.opacity = (state.mode === "light" ? .45 : .25) + .25 * Math.sin(t * 2 + i));
    const sel = nodes[state.selected];
    if (sel) { halo.position.copy(sel.pos); halo.lookAt(cam.position); const s = sel.m.scale.x * 1.9 + Math.sin(t * 3) * .06; halo.scale.set(s, s, s); }
    renderer.render(sc, cam);
    for (const id in nodes) {
      const n = nodes[id]; v.copy(n.pos).project(cam);
      const show = v.z < 1 && (!n.ground || id === state.selected || id === hover);
      n.lb.style.display = show ? "" : "none";
      if (show) { n.lb.style.left = ((v.x + 1) / 2 * W) + "px"; n.lb.style.top = ((1 - v.y) / 2 * Hh) + "px"; n.lb.style.transform = "";
        const d = cam.position.distanceTo(n.pos); n.lb.style.opacity = (id === state.selected || id === hover) ? 1 : Math.max(.12, Math.min(1, 1.7 - d * (41 / ctl.fit) / 34)) * (n.dimmed ? .25 : 1);
        n.lb.classList.toggle("sel", id === state.selected); }
    }
    for (const id in pinEls) { const n = nodes[id], e = pinEls[id]; if (!n) continue; v.copy(n.pos).project(cam);
      if (v.z >= 1) { e.style.display = "none"; continue; } e.style.display = "";
      const sx = (v.x + 1) / 2 * W, sy = (1 - v.y) / 2 * Hh; v2.copy(n.pos).add(up.copy(cam.up).multiplyScalar(n.m.scale.x)).project(cam);
      const rp = Math.max(6, Math.abs(((1 - v2.y) / 2 * Hh) - sy)), h = Math.max(36, Math.min(58, rp * 2.6));
      e.style.width = (h * 40 / 56) + "px"; e.style.height = h + "px"; e.style.left = sx + "px"; e.style.top = (sy - rp * .7) + "px"; e.style.opacity = n.dimmed ? .35 : 1;
      if (n.lb.style.display !== "none") { n.lb.style.top = (sy - rp * .7 - h * .94 - 3) + "px"; n.lb.style.transform = "translate(-50%,-100%)"; } }
    for (const k in stations) { v.copy(stations[k].p).project(cam); const lb = stations[k].lb; lb.style.display = v.z < 1 ? "" : "none"; lb.style.left = ((v.x + 1) / 2 * W) + "px"; lb.style.top = ((1 - v.y) / 2 * Hh) + "px"; }
  }
  requestAnimationFrame(frame);

  const api = {
    setMode(mode) {
      const light = mode === "light";
      sc.fog.color.set(light ? 0xe4572e : 0x05070d); sc.fog.density = light ? .009 : .011;
      stars.material.color.set(light ? 0x3a1206 : 0x9fb4d8); stars.material.opacity = light ? .45 : .7; stars.material.size = light ? .3 : .35;
      nebulae.forEach(n => n.visible = !light);
      grid.material.color && grid.material.color.set(light ? 0x8e2c10 : 0x1d2a44); grid.material.opacity = light ? .16 : .5;
      relMat.color.set(light ? 0x1b1410 : 0x8fa3bf); relMat.opacity = light ? .35 : .16;
      dashMat.color.set(light ? 0x1b1410 : 0x8fa3bf);
      beams.forEach(b => { b.material.color.set(light ? 0xfff3dc : 0xff9a4a); b.material.blending = light ? T.NormalBlending : T.AdditiveBlending; b.material.needsUpdate = true; });
      halo.material.color.set(light ? 0x1b1410 : 0xffffff);
      for (const k in stations) { const c = new T.Color((light ? PAL.sky : PAL.dark).fam[k]); stations[k].ring.material.color = c; stations[k].ring2.material.color = c;
        stations[k].ring.material.opacity = light ? .85 : .35; stations[k].ring2.material.opacity = light ? .45 : .18; }
      coreGlow.material.blending = light ? T.NormalBlending : T.AdditiveBlending; coreGlow.material.needsUpdate = true;
      for (const id in nodes) { const n = nodes[id], P = light ? PAL.sky : PAL.dark, c = new T.Color(n.ground ? P.ground : P.fam[n.fam]);
        n.m.material.color = c; n.g.material.color = c.clone(); n.g.material.blending = light ? T.NormalBlending : T.AdditiveBlending; n.g.material.needsUpdate = true; }
      api.refresh();
    },
    refresh() {
      const light = state.mode === "light";
      const habCol = light ? { spacecraft: 0x0f5e6b, lunar: 0xfff3dc, rover: 0x1d2b4f, mars: 0x7a1508, suit: 0x1b1410, earth: 0x2f7d4f }[state.habitat]
                           : { spacecraft: 0x62d6ff, lunar: 0xdfe6f2, rover: 0xffd166, mars: 0xff7a4a, suit: 0xff5d9e, earth: 0x5ad19a }[state.habitat];
      core.material.color.setHex(habCol); coreGlow.material.color.setHex(habCol); coreGlow.material.opacity = light ? .25 : .5;
      for (const id in nodes) {
        const n = nodes[id], s0 = score(n.inv) / 100, ok = n.ground ? true : phaseOK(n.inv); n.dimmed = !ok;
        const r = n.ground ? .16 : .16 + s0 * .38; n.m.scale.set(r, r, r);
        const gs = n.ground ? 1.1 : .9 + s0 * 3.4; n.g.scale.set(gs, gs, 1);
        n.m.material.opacity = ok ? 1 : .15;
        n.g.material.opacity = ok ? (light ? (n.ground ? .08 : .1 + s0 * .18) : (n.ground ? .35 : .5 + s0 * .5)) : .04;
      }
      ranked().filter(x => phaseOK(x.i)).slice(0, 5).forEach((x, i) => beams[i].geometry.setFromPoints([new T.Vector3(), nodes[x.i.id].pos]));
    },
    focus(id) { const n = nodes[id]; if (!n) return; ctl.goal.copy(n.pos).multiplyScalar(cam.aspect < 1 ? .3 : .55); setZoom(cam.aspect < 1 ? .9 : .56); },
    shift(x) { ctl.offGoal = x; },
    setPins(ids) {
      for (const id in pinEls) if (!ids.includes(id)) { pinEls[id].remove(); delete pinEls[id]; }
      ids.forEach(id => { if (pinEls[id] || !nodes[id]) return;
        const b = el("button", { class: "astro", title: `${byId[id].ac} is pinned for comparison. Click to open the bench.`, "aria-label": `${byId[id].ac} pinned, open comparison bench` }, ASTRO);
        b.onclick = () => document.querySelector("#ch3").scrollIntoView({ behavior: reduced ? "auto" : "smooth" });
        pinLayer.append(b); pinEls[id] = b; });
    },
  };
  return api;
})();

/* ---------- selection ---------- */
function select(id, fromAgent) {
  state.selected = id;
  renderRank(true); renderMini(); renderDossier(); renderEnv(); renderGrav(); scene.focus(id);
  if (!fromAgent) { const r = ROLES[state.role].route.findIndex(s => s[0] === id); if (r >= 0) { state.step = r; renderSteps(); } }
}

function matchInfo(inv) {
  const H = HABITATS[state.habitat], e = envOf(inv);
  if (state.habitat === "earth") return { c: "var(--ok)", pill: "on Earth", txt: inv.earth };
  if (e.o2max == null) return { c: "var(--faint)", pill: "O₂ n/a", txt: `Tested O₂ not stated in PSI. Target: ${H.o2}% at ${H.p} psia.` };
  const gap = H.o2 - e.o2max;
  const pTxt = e.pmin != null && !e.approx ? (H.p >= e.pmin - .01 && H.p <= e.pmax + .01 ? " Pressure is inside the tested range." : ` Pressure tested ${e.pmin}–${e.pmax} psia.`) : "";
  if (gap <= 0) return { c: "var(--ok)", pill: "covers O₂", txt: `Tested up to ${e.o2max}% O₂${e.approx ? " (approx.)" : ""}, at or above the ${H.o2}% target.${pTxt}` };
  if (gap <= 6) return { c: "var(--warn)", pill: `−${gap} pts`, txt: `Tested up to ${e.o2max}% O₂, just short of ${H.o2}%.${pTxt}` };
  return { c: "var(--crit)", pill: `−${gap} pts`, txt: `Tested only to ${e.o2max}% O₂; this habitat needs ${H.o2}%.${pTxt}` };
}

function renderMini() {
  const id = state.selected, m = $("#mini"), g = GROUND.find(x => x.id === id);
  if (g) {
    m.innerHTML = `<div class="mini-h"><div><div class="eyebrow">${id} · ground study</div><h3>${g.ac}</h3></div><button class="x" id="mini-x" aria-label="Hide card">×</button></div>
      <p>${gloss(g.obj)}</p><div class="acts">${g.parent ? `<button class="ghost" data-sel="${g.parent}">Flight data: ${byId[g.parent].ac}</button>` : ""}<a class="link" href="${PSI(id)}" target="_blank" rel="noopener">PSI record ↗</a></div>`;
  } else {
    const inv = byId[id], mi = matchInfo(inv);
    m.innerHTML = `<div class="mini-h"><div><div class="eyebrow">${id} · ${FAMILIES[inv.fam].short}</div><h3>${inv.ac}</h3></div>
      <div style="display:flex;gap:6px;align-items:flex-start"><div class="score">${score(inv)}<small>relevance</small></div><button class="x" id="mini-x" aria-label="Hide card">×</button></div></div>
      <div class="specimen"><canvas class="spec"></canvas><div class="gauge"></div></div>
      <p>${gloss(inv.take)}</p>
      <div class="match"><span class="pill" style="background:${mi.c}">${mi.pill}</span><span style="color:var(--mute)">${mi.txt}</span></div>
      <div class="acts"><button class="solid" id="open-dossier">Open full dossier</button><button class="ghost" id="mini-pin" title="Adds this investigation to the comparison bench (section iii), side by side with up to two others">${state.pinned.includes(id) ? "Pinned ✓ · unpin" : "Pin to compare"}</button></div>`;
    $("#open-dossier").onclick = () => openDrawer("dossier");
    $("#mini-pin").onclick = () => togglePin(id);
  }
  m.querySelectorAll("[data-sel]").forEach(b => b.onclick = () => select(b.dataset.sel));
  $("#mini-x").onclick = () => m.classList.add("hide");
  if (!$("#dossier").classList.contains("open")) m.classList.remove("hide");
  specimen.set(g ? null : byId[id]);
}

function radarSVG(inv) {
  const R = 50, cx = 60, cy = 60, n = DIMS.length, pt = (k, r) => { const a = -Math.PI / 2 + k / n * Math.PI * 2; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]; };
  let s = `<svg width="120" height="120" viewBox="0 0 120 120" aria-hidden="true">`;
  [.33, .66, 1].forEach(f => s += `<polygon points="${DIMS.map((d, k) => pt(k, R * f).join(",")).join(" ")}" fill="none" style="stroke:var(--grid)"/>`);
  DIMS.forEach((d, k) => { const [x, y] = pt(k, R); s += `<circle cx="${x}" cy="${y}" r="2.6" fill="${dc(d.k)}"/>`; });
  const wmax = Math.max(...DIMS.map(d => state.w[d.k] || 0)) || 1;
  s += `<polygon points="${DIMS.map((d, k) => pt(k, R * (state.w[d.k] || 0) / wmax).join(",")).join(" ")}" fill="none" style="stroke:var(--accent2)" stroke-dasharray="2 2"/>`;
  s += `<polygon points="${DIMS.map((d, k) => pt(k, R * inv.s[d.k]).join(",")).join(" ")}" style="fill:var(--accent);fill-opacity:.2;stroke:var(--accent)" stroke-width="1.5"/>`;
  return s + "</svg>";
}

function renderDossier() {
  const d = $("#dossier"), id = state.selected, g = GROUND.find(x => x.id === id);
  if (g) {
    const par = byId[g.parent];
    d.innerHTML = `<div class="dr-h"><div><div class="eyebrow">${id} · ground investigation · ${g.years}</div><h2>${g.ac}</h2></div><button class="x" data-close="dossier" aria-label="Close dossier">×</button></div>
      <div class="dr-b"><div class="note"><div class="eyebrow">What it did</div>${gloss(g.obj)}</div><p style="margin:0">${g.team}</p>
      ${par ? `<p style="margin:0">Built on <button class="relbtn" data-sel="${par.id}">${par.ac}</button> flight data stored in PSI: new science without a new flight.</p>` : ""}
      <a class="ghost" style="align-self:flex-start" href="${PSI(id)}" target="_blank" rel="noopener">Open PSI record ↗</a></div>`;
  } else {
    const inv = byId[id], f = FAMILIES[inv.fam], mi = matchInfo(inv);
    const top = contrib(inv).sort((a, b) => b.v - a.v).slice(0, 2).map(c => c.name.toLowerCase());
    const conn = [...inv.rel, ...GROUND.filter(x => x.parent === id).map(x => x.id)].filter(r => byId[r]);
    d.innerHTML = `<div class="dr-h"><div><div class="eyebrow">${id} · ${inv.plat}${inv.years ? " · " + inv.years : ""}</div><h2>${inv.ac}</h2><div style="color:var(--mute);margin-top:4px">${inv.name}</div></div><button class="x" data-close="dossier" aria-label="Close dossier">×</button></div>
      <div class="dr-b">
        <div class="tags"><span class="tag2" style="border-color:${fc(inv.fam)}">${f.name}</span><span class="tag2">${f.phase}</span><span class="tag2">relevance ${score(inv)}</span></div>
        <div class="specimen" style="height:180px"><canvas class="spec"></canvas><div class="gauge"></div><div class="cap">${inv.sample}</div></div>
        <div class="match"><span class="pill" style="background:${mi.c}">${mi.pill}</span><span>${mi.txt}</span></div>
        <div class="note"><div class="eyebrow">Fire-safety takeaway</div>${gloss(inv.take)}</div>
        <div class="sec"><div class="eyebrow">Objective</div><div>${gloss(inv.obj)}</div></div>
        <dl class="kv"><dt>Fuels</dt><dd>${inv.fuels}</dd><dt>Sample</dt><dd>${inv.sample}</dd><dt>O₂</dt><dd>${gloss(inv.o2)}</dd><dt>Pressure</dt><dd>${inv.pres}</dd><dt>Flow</dt><dd>${gloss(inv.flow)}</dd><dt>Team</dt><dd>${inv.team}</dd></dl>
        <div class="vh"><div class="v"><div class="eyebrow">Varied between tests</div><ul>${inv.varied.map(x => `<li>${gloss(x)}</li>`).join("")}</ul></div><div class="h"><div class="eyebrow">Held the same</div><ul>${inv.held.map(x => `<li>${gloss(x)}</li>`).join("")}</ul></div></div>
        <div class="sec"><div class="eyebrow">Sensors & measurements</div><div class="tags">${inv.diag.map(x => `<span class="tag2">${x}</span>`).join("")}</div></div>
        <div class="radar">${radarSVG(inv)}<p><span class="eyebrow" style="display:block;margin-bottom:4px">Why it ranks here</span>Strongest on ${top.join(" and ")}. Filled shape: this investigation. Dashed: what the ${HABITATS[state.habitat].label.toLowerCase()} lens weighs.</p></div>
        ${conn.length ? `<div class="sec"><div class="eyebrow">Connected</div><div class="tags">${conn.map(r => `<button class="relbtn" data-sel="${r}">${byId[r].ac}</button>`).join("")}</div></div>` : ""}
        <div class="tags"><button class="solid" id="dos-pin">${state.pinned.includes(id) ? "Unpin from bench" : "Pin to comparison bench"}</button><a class="ghost" href="${PSI(id)}" target="_blank" rel="noopener">Open PSI record ↗</a></div>
      </div>`;
    $("#dos-pin").onclick = () => togglePin(id);
  }
  d.querySelectorAll("[data-sel]").forEach(b => b.onclick = () => select(b.dataset.sel));
  specimen.set(g ? null : byId[id]);
}
function togglePin(id) {
  if (state.pinned.includes(id)) state.pinned = state.pinned.filter(x => x !== id);
  else { state.pinned.push(id); if (state.pinned.length > 3) state.pinned.shift(); }
  renderCompare(); renderMini(); renderDossier();
}

/* ---------- specimen windows (always a dark viewing port) ---------- */
const specimen = (() => {
  let inv = null, raf = 0, t0 = performance.now();
  function set(i) { inv = i; cancelAnimationFrame(raf); t0 = performance.now(); raf = requestAnimationFrame(loop); }
  function loop(now) {
    const cvs = [...document.querySelectorAll("canvas.spec")].filter(c => c.offsetParent);
    for (const cv of cvs) { const r = cv.getBoundingClientRect(), d = Math.min(devicePixelRatio, 2);
      if (cv.width !== Math.round(r.width * d)) { cv.width = Math.round(r.width * d); cv.height = Math.round(r.height * d); }
      const ctx = cv.getContext("2d"); ctx.setTransform(d, 0, 0, d, 0, 0); draw(ctx, r.width, r.height, reduced ? 1.5 : (now - t0) / 1000, cv.parentElement.querySelector(".gauge")); }
    raf = requestAnimationFrame(loop);
  }
  function draw(ctx, W, H, t, gauge) {
    const glow = (x, y, r, st) => { const g = ctx.createRadialGradient(x, y, 0, x, y, r); st.forEach(([o, c]) => g.addColorStop(o, c)); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); };
    const shell = (x, y, r, w, a, b) => { ctx.save(); ctx.globalCompositeOperation = "lighter"; const g = ctx.createRadialGradient(x, y, Math.max(0, r - w), x, y, r + w);
      g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(.35, a); g.addColorStop(.6, b); g.addColorStop(1, "rgba(0,0,0,0)"); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r + w, 0, 7); ctx.fill(); ctx.restore(); };
    const arrow = (x, y, len) => { ctx.strokeStyle = "rgba(98,214,255,.3)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + len, y); ctx.lineTo(x + len - 4, y - 3); ctx.moveTo(x + len, y); ctx.lineTo(x + len - 4, y + 3); ctx.stroke(); };
    ctx.clearRect(0, 0, W, H); ctx.strokeStyle = "rgba(150,178,226,.06)"; ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 16) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y < H; y += 16) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    if (!inv) { if (gauge) gauge.textContent = ""; return; }
    const k = inv.kind, cx = W / 2, cy = H / 2 - 4, sz = Math.min(1, H / 170), fl = 1 + Math.sin(t * 7) * .015 + Math.sin(t * 13) * .01, H0 = HABITATS[state.habitat];
    let gt = "";
    if (k.startsWith("sphere")) {
      const cool = k.endsWith("cool"), R = 50 * sz * fl;
      if (cool) shell(cx, cy, R, 16 * sz, "rgba(120,140,255,.35)", "rgba(90,120,255,.15)");
      else { shell(cx, cy, R + 6 * sz, 14 * sz, "rgba(255,170,60,.55)", "rgba(255,90,20,.3)"); shell(cx, cy, R - 4 * sz, 8 * sz, "rgba(80,140,255,.5)", "rgba(80,140,255,.2)"); }
      glow(cx, cy, 18 * sz, [[0, "#9aa3b2"], [.8, "#5b6372"], [1, "#2a2f38"]]); ctx.fillStyle = "#3a404b"; ctx.fillRect(cx - 2, cy + 16 * sz, 4, H);
      gt = cool ? "cool flame · ≈500–1000 K" : "spherical diffusion flame";
    } else if (k.startsWith("droplet")) {
      const cool = k.endsWith("cool"), p = (t % 6) / 6, r = 14 * sz * Math.sqrt(Math.max(.02, 1 - p));
      ctx.strokeStyle = "#5b6372"; ctx.beginPath(); ctx.moveTo(16, cy); ctx.lineTo(W - 16, cy); ctx.stroke();
      if (p < .92) { if (cool) shell(cx, cy, r * 4.2 * fl, 10 * sz, "rgba(140,150,255,.35)", "rgba(100,120,255,.12)"); else { shell(cx, cy, r * 4 * fl, 9 * sz, "rgba(255,180,70,.6)", "rgba(255,90,30,.3)"); shell(cx, cy, r * 3.2 * fl, 5 * sz, "rgba(90,150,255,.45)", "rgba(80,140,255,.1)"); } }
      glow(cx, cy, r, [[0, "#e8f3ff"], [.7, "#8fb6d9"], [1, "#46637c"]]); gt = `d²-law burn · d/d₀ ${(r / (14 * sz)).toFixed(2)}`;
    } else if (k === "coflow" || k === "efield") {
      const by = H - 14; ctx.fillStyle = "#4a515c"; ctx.fillRect(cx - 5, by - 24 * sz, 10, 40);
      for (let i = 0; i < 8; i++) { const x = cx - 80 + i * 22 + (i > 3 ? 10 : 0), y = by - ((t * 30 + i * 13) % (H - 20)); ctx.strokeStyle = "rgba(98,214,255,.35)"; ctx.beginPath(); ctx.moveTo(x, y + 10); ctx.lineTo(x, y); ctx.stroke(); }
      ctx.save(); ctx.globalCompositeOperation = "lighter"; const base = by - 24 * sz, fh = 78 * sz * fl, fw = 26 * sz;
      const g = ctx.createLinearGradient(0, base, 0, base - fh); g.addColorStop(0, "rgba(80,140,255,.7)"); g.addColorStop(.35, "rgba(255,160,60,.65)"); g.addColorStop(.85, "rgba(255,110,40,.45)"); g.addColorStop(1, "rgba(255,80,20,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(cx - 5, base); ctx.bezierCurveTo(cx - fw, base - 10, cx - fw, base - fh, cx, base - fh); ctx.bezierCurveTo(cx + fw, base - fh, cx + fw, base - 10, cx + 5, base); ctx.fill(); ctx.restore();
      if (k === "efield") { ctx.strokeStyle = "#c08a50"; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(cx - 60, 14); ctx.lineTo(cx + 60, 14); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = "#ffd166"; for (let i = 0; i < 14; i++) ctx.fillRect(cx - 18 + (i * 7) % 36, base - fh * .6 - ((t * 40 + i * 9) % 50), 2, 2); gt = "mesh electrode · up to 10 kV"; }
      else gt = "non-buoyant jet flame · coflow ↑";
    } else if (k === "disk") {
      const by = H - 24; ctx.fillStyle = "#6b5a49"; ctx.fillRect(cx - 60 * sz, by, 120 * sz, 7); ctx.fillStyle = "#3a404b"; ctx.fillRect(cx - 64 * sz, by + 7, 128 * sz, 4);
      const elevated = H0.o2 > 25, life = elevated ? 1 : Math.max(0, 1 - (t % 8) / 5), R = 58 * sz * fl;
      ctx.save(); ctx.globalCompositeOperation = "lighter"; const g = ctx.createRadialGradient(cx, by, 30 * sz, cx, by, R + 14);
      g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(.55, `rgba(80,140,255,${.55 * life})`); g.addColorStop(.8, `rgba(255,150,60,${.45 * life})`); g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(cx, by, R + 14, (R + 14) * .9, 0, Math.PI, 0); ctx.fill(); ctx.restore();
      gt = elevated ? `${H0.o2}% O₂ · keeps burning, no airflow` : "21% O₂ · flame self-extinguishes";
    } else if (k.startsWith("spread")) {
      const big = k.endsWith("big"), y = cy + 10, x0 = 20, x1 = W - 20, front = x0 + ((t % 7) / 7) * (x1 - x0);
      ctx.fillStyle = "#cdbf9f"; ctx.fillRect(front, y, x1 - front, 5); ctx.fillStyle = "#2b2622"; ctx.fillRect(x0, y, front - x0, 5);
      for (let i = 0; i < 9; i++) { const yy = 14 + i * 12, xx = ((t * 60 + i * 37) % (W + 40)) - 40; if (yy < y - 12 || yy > y + 18) arrow(xx, yy, 18); }
      ctx.save(); ctx.globalCompositeOperation = "lighter"; const len = (big ? 90 : 60) * sz;
      const g = ctx.createLinearGradient(front - len, 0, front + 10, 0); g.addColorStop(0, "rgba(255,90,30,0)"); g.addColorStop(.6, "rgba(255,150,60,.55)"); g.addColorStop(1, "rgba(80,140,255,.6)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(front - len / 2 + 4, y + 2, len / 2 + 4, 13 * sz * fl, 0, 0, 7); ctx.fill(); ctx.restore();
      gt = "flame front · concurrent flow →";
    } else if (k === "smoke" || k === "dust") {
      const smoke = k === "smoke";
      if (smoke) { ctx.fillStyle = "#7b6a55"; ctx.fillRect(cx - 18, H - 30, 36, 9); glow(cx, H - 20, 24, [[0, "rgba(255,90,40,.6)"], [1, "rgba(255,90,40,0)"]]); }
      else { ctx.strokeStyle = "rgba(200,210,230,.35)"; ctx.strokeRect(cx - 90, 14, 180, H - 34); }
      for (let i = 0; i < 70; i++) { const a = i * 2.39996, life = (t * .25 + i / 70) % 1, r = smoke ? (8 + life * 70) * sz : (25 + (i * 13 % 55)) * sz;
        const x = cx + Math.cos(a) * r * 1.1, y = (smoke ? H - 26 - life * 36 * sz : cy) + Math.sin(a) * r * .55;
        ctx.fillStyle = smoke ? `rgba(200,195,210,${.6 * (1 - life)})` : "rgba(205,120,90,.6)"; ctx.beginPath(); ctx.arc(x + (smoke ? 0 : Math.sin(t + i) * 3), y, smoke ? .8 + life * 2.4 : 1.2, 0, 7); ctx.fill(); }
      gt = smoke ? "pyrolysis smoke · particles grow as they age" : "dust aerosol · P-Trak vs DustTrak";
    } else if (k === "fluid") {
      ctx.strokeStyle = "rgba(200,210,230,.35)"; ctx.strokeRect(cx - 90, 20, 180, H - 40); ctx.strokeStyle = "rgba(98,214,255,.5)";
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(cx - 30, cy + 4, 30 + i * 12, 16 + i * 7, 0, t + i, t + i + 4.5); ctx.stroke(); }
      gt = "thermocapillary flow";
    }
    if (gauge) gauge.textContent = gt;
  }
  return { set };
})();

/* ---------- chapter i: envelope ---------- */
function renderEnv() {
  const svg = $("#env"), W = 640, H = 340, L = 50, R = 20, Tp = 14, B = 44;
  const xs = p => L + (Math.log10(p) - Math.log10(3)) / (Math.log10(80) - Math.log10(3)) * (W - L - R), ys = o => Tp + (1 - o / 100) * (H - Tp - B);
  let s = "";
  for (const p of [3, 4.3, 7.3, 10, 14.7, 20, 30, 44, 73.5]) s += `<line x1="${xs(p)}" x2="${xs(p)}" y1="${Tp}" y2="${H - B}" style="stroke:var(--grid)"/><text x="${xs(p)}" y="${H - B + 16}" text-anchor="middle">${p}</text>`;
  for (const o of [0, 20, 40, 60, 80, 100]) s += `<line x1="${L}" x2="${W - R}" y1="${ys(o)}" y2="${ys(o)}" style="stroke:var(--grid)"/><text x="${L - 8}" y="${ys(o) + 3}" text-anchor="end">${o}%</text>`;
  s += `<text x="${(L + W - R) / 2}" y="${H - 6}" text-anchor="middle">total pressure, psia (log) · 1 atm = 14.7</text><text transform="translate(12 ${(Tp + H - B) / 2}) rotate(-90)" text-anchor="middle">O₂ mole fraction</text>`;
  for (const [pp, lab, p0] of [[3.07, "ppO₂ 3.1 psi · Earth air", 5.6], [4.3, "ppO₂ 4.3 psi · suit", 5.2], [1.7, "ppO₂ 1.7", 3.9]]) {
    let d = ""; for (let p = 3; p <= 80; p *= 1.04) { const o = 100 * pp / p; if (o > 100) continue; d += (d ? "L" : "M") + xs(p).toFixed(1) + "," + ys(o).toFixed(1); }
    s += `<path d="${d}" fill="none" style="stroke:var(--iso)" stroke-dasharray="4 4"/><text x="${xs(p0) + 6}" y="${ys(100 * pp / p0) + 3}" style="fill:var(--iso)">${lab}</text>`;
  }
  const order = [...INV].sort((a, b) => (a.id === state.selected) - (b.id === state.selected));
  for (const inv of order) {
    const e = inv.env || {}, col = fc(inv.fam), on = inv.id === state.selected, lt = state.mode === "light", op = on ? .95 : (lt ? .55 : .3), fop = on ? .3 : (lt ? .12 : .07);
    let g = `<g data-sel="${inv.id}" style="cursor:pointer"><title>${inv.ac}: ${inv.o2} · ${inv.pres}</title>`;
    if (e.p && e.o2) g += `<rect x="${xs(e.p[0])}" y="${ys(e.o2[1])}" width="${xs(e.p[1]) - xs(e.p[0])}" height="${ys(e.o2[0]) - ys(e.o2[1])}" fill="${col}" fill-opacity="${fop}" stroke="${col}" stroke-opacity="${op}" ${e.approx ? 'stroke-dasharray="3 3"' : ""}/>`;
    else if (e.p) g += `<rect x="${xs(e.p[0])}" y="${ys(5)}" width="${xs(e.p[1]) - xs(e.p[0])}" height="${ys(0) - ys(5)}" fill="${col}" fill-opacity="${fop + .05}" stroke="${col}" stroke-opacity="${op}" stroke-dasharray="2 3"/>`;
    else if (e.o2 && e.pApprox && !e.pts) { const x = xs(e.pApprox) + (inv.id.length % 3 - 1) * 7; g += `<line x1="${x}" x2="${x}" y1="${ys(e.o2[0])}" y2="${ys(e.o2[1])}" stroke="${col}" stroke-opacity="${op}" stroke-width="${on ? 5 : 3}" stroke-linecap="round" ${e.approx ? 'stroke-dasharray="5 4"' : ""}/>`; }
    if (e.pts) e.pts.forEach(([p, o]) => { const x = xs(p), y = ys(o); g += `<path d="M${x},${y - 5}L${x + 5},${y}L${x},${y + 5}L${x - 5},${y}Z" fill="${col}" fill-opacity="${on ? 1 : .5}" style="stroke:var(--ink)" stroke-opacity="${on ? .6 : .15}"/>`; });
    if (on) { const lp = e.p ? [e.p[1], e.o2 ? e.o2[1] : 5] : e.pts ? e.pts[e.pts.length - 1] : e.o2 ? [e.pApprox, e.o2[1]] : null;
      if (lp) g += `<text x="${xs(lp[0]) - 8}" y="${ys(lp[1]) - 8}" text-anchor="end" style="fill:var(--ink);font-size:11.5px;font-weight:500">${inv.ac}</text>`; }
    s += g + "</g>";
  }
  s += `<text x="${xs(3.2)}" y="${ys(5) - 4}" style="fill:var(--faint)">strip: pressure tested, O₂ not stated</text>`;
  for (const [k, lab, p, o] of [["spacecraft", "Earth air / ISS", 14.7, 21], ["lunar", "Lunar base · rover · Mars (assumed)", 10.2, 30], ["suit", "Spacesuit", 4.3, 100], [null, "Exploration atm.", 8.2, 34]]) {
    const cur = k && (k === state.habitat || (k === "lunar" && ["rover", "mars"].includes(state.habitat)) || (k === "spacecraft" && state.habitat === "earth")), x = xs(p), y = ys(o);
    s += `<circle cx="${x}" cy="${y}" r="${cur ? 7 : 5}" style="fill:${cur ? "var(--ink)" : "none"};stroke:var(--ink)" stroke-width="1.5"/>`;
    if (cur && !reduced) s += `<circle cx="${x}" cy="${y}" r="8" fill="none" style="stroke:var(--ink)"><animate attributeName="r" values="8;22;8" dur="2.8s" repeatCount="indefinite"/><animate attributeName="opacity" values=".8;0;.8" dur="2.8s" repeatCount="indefinite"/></circle>`;
    const pos = { "Spacesuit": [x + 10, y + 4, "start"], "Earth air / ISS": [x + 9, y + 17, "start"], "Exploration atm.": [x - 9, y + 17, "end"] }[lab] || [x + 10, y + 21, "start"];
    s += `<text x="${pos[0]}" y="${pos[1]}" text-anchor="${pos[2]}" style="fill:${cur ? "var(--ink)" : "var(--mute)"};font-size:${cur ? 11.5 : 10}px">${lab}</text>`;
  }
  svg.innerHTML = s;
  svg.querySelectorAll("[data-sel]").forEach(g => g.onclick = () => { select(g.dataset.sel); openDrawer("dossier"); $("#sky").scrollIntoView({ behavior: reduced ? "auto" : "smooth" }); });
  const Hb = HABITATS[state.habitat], cover = INV.filter(i => { const e = envOf(i); return e.o2max != null && e.o2max >= Hb.o2; }).map(i => i.ac), pp = Hb.p * Hb.o2 / 100;
  let txt;
  if (state.habitat === "suit") txt = `At 100% O₂ only ${cover.join(", ") || "no investigation"} comes close: CFI-G's burner stream reached 85%, the highest in microgravity. No solid-material data exists near suit conditions.`;
  else if (["lunar", "rover", "mars"].includes(state.habitat)) txt = `A ${Hb.o2}% O₂, ${Hb.p} psia cabin has ppO₂ ≈ ${pp.toFixed(2)} psi, nearly Earth air's 3.07. Yet flammability tracks O₂ fraction: BRE flames that self-extinguished at 21% kept burning at 26.5–34%. Every solid-material flight test (BASS, BASS-II, Saffire) stayed at or below 21%.`;
  else if (state.habitat === "earth") txt = `Earth air sits with the ISS cabin at 21% O₂ and 14.7 psia, where most flight tests ran, so their flammability and smoke data carry over once buoyancy is accounted for.`;
  else txt = `The ISS cabin matches Earth air. Spacecraft fire data is densest here and thins quickly toward the exploration atmospheres up and to the left.`;
  $("#env-insight").textContent = txt;
}

/* ---------- chapter ii: gravity ---------- */
function renderGrav() {
  const svg = $("#grav"), xs = g => g < .01 ? 40 + (Math.log10(Math.max(g, 1e-6)) + 6) / 4 * 90 : 130 + g * 360;
  const rows = { flight: 70, ground: 120, mimic: 166, future: 206 };
  let s = `<rect x="${xs(.012)}" y="38" width="${xs(.99) - xs(.012)}" height="186" style="fill:var(--same);stroke:var(--accent2)" stroke-opacity=".35" stroke-dasharray="3 4"/><text x="${xs(.62)}" y="52" text-anchor="middle" style="fill:var(--accent2)">bounded · no data yet</text>`;
  for (const [g, lab] of [[1e-6, "μg"], [1e-4, "10⁻⁴"], [.166, "Moon .17"], [.378, "Mars .38"], [1, "Earth 1 g"]]) s += `<line x1="${xs(g)}" x2="${xs(g)}" y1="34" y2="228" style="stroke:${g > .1 && g < 1 ? "var(--line-strong)" : "var(--grid)"}"/><text x="${xs(g)}" y="242" text-anchor="middle">${lab}</text>`;
  s += `<text x="${xs(.01)}" y="256" text-anchor="middle" style="fill:var(--faint)">log ← | → linear</text>`;
  for (const [k, lab] of [["flight", "ISS / Cygnus flight data"], ["ground", "1-g ground counterparts"], ["mimic", "partial-g analog"], ["future", "planned lunar-g tests"]]) s += `<text x="40" y="${rows[k] - 15}" style="fill:var(--mute)">${lab}</text>`;
  const fl = INV.filter(i => i.fam !== "other");
  fl.forEach((i, n) => { const x = xs(2e-6 * Math.pow(1.6, n % 10)), y = rows.flight + (n > 9 ? 6 : -3), on = i.id === state.selected; s += `<circle cx="${x}" cy="${y}" r="${on ? 5 : 3.2}" fill="${fc(i.fam)}" ${on ? 'style="stroke:var(--ink)" stroke-width="1.5"' : ""}><title>${i.ac}</title></circle>`; });
  s += `<text x="${xs(2e-4)}" y="${rows.flight + 5}" style="fill:var(--ink)">${fl.length} investigations</text>`;
  [0, 1, 2, 3, 4, 5].forEach(n => s += `<circle cx="${xs(1) - 6 - n * 7}" cy="${rows.ground}" r="3" fill="${PAL[state.mode].ground}"/>`);
  s += `<text x="${xs(1) - 52}" y="${rows.ground + 4}" text-anchor="end" style="fill:var(--ink)">BRE, BASS, CLD, SPICE… ground tests</text>`;
  s += `<g data-sel="PSI-22" style="cursor:pointer"><line x1="${xs(1e-6)}" x2="${xs(.3)}" y1="${rows.mimic}" y2="${rows.mimic}" style="stroke:var(--accent)" stroke-width="2" stroke-dasharray="6 4"/><path d="M${xs(.3)},${rows.mimic - 5}L${xs(.3) + 8},${rows.mimic}L${xs(.3)},${rows.mimic + 5}Z" style="fill:var(--accent)"/><text x="${xs(.3) + 12}" y="${rows.mimic + 4}" style="fill:var(--accent)">E-FIELD ion wind</text></g>`;
  for (const [lab, dx] of [["LUCI", -16], ["FM2", 16]]) s += `<circle cx="${xs(.166) + dx}" cy="${rows.future}" r="6" fill="none" style="stroke:var(--ink)" stroke-dasharray="2 2"/><text x="${xs(.166) + dx}" y="${rows.future + 20}" text-anchor="middle" style="fill:var(--ink)">${lab}</text>`;
  svg.innerHTML = s;
  svg.querySelectorAll("[data-sel]").forEach(g => g.onclick = () => { select(g.dataset.sel); openDrawer("dossier"); $("#sky").scrollIntoView({ behavior: reduced ? "auto" : "smooth" }); });
}

/* ---------- chapter iii: compare ---------- */
function renderCompare() {
  scene.setPins(state.pinned.filter(id => INV.some(i => i.id === id)));
  const invs = state.pinned.filter(id => INV.some(i => i.id === id)).map(id => byId[id]), tb = $("#cmp");
  $("#cmp-title").textContent = invs.length > 1 ? invs.map(i => i.ac).join(" · ") : "Side by side";
  if (!invs.length) { tb.innerHTML = `<tr><td colspan="2">Nothing pinned yet. Pin investigations from a dossier.</td></tr>`; return; }
  const rows = [["Hardware", i => FAMILIES[i.fam].name], ["Platform", i => i.plat], ["Fuel phase", i => FAMILIES[i.fam].phase],
    ["Fuels", i => i.fuels], ["Sample / burner", i => i.sample], ["O₂", i => i.o2], ["Pressure", i => i.pres], ["Flow", i => i.flow],
    ["Varied", i => i.varied, 1], ["Held same", i => i.held, 1], ["Sensors", i => i.diag, 1], ["Relevance", i => String(score(i))]];
  const norm = s => s.toLowerCase().replace(/[^a-z0-9₂ ]/g, "").trim();
  let h = `<tr><th></th>${invs.map(i => `<th><div class="hd"><span><span class="dot" style="background:${fc(i.fam)};margin-right:7px"></span>${i.ac}</span><button class="x" data-unpin="${i.id}" aria-label="Unpin ${i.ac}">×</button></div></th>`).join("")}</tr>`;
  for (const [lab, fn, list] of rows) {
    const vals = invs.map(fn);
    if (list) { const counts = {}; vals.forEach(v => new Set(v.map(norm)).forEach(x => counts[x] = (counts[x] || 0) + 1));
      h += `<tr><td>${lab}</td>${vals.map(v => `<td>${v.map(x => counts[norm(x)] > 1 && invs.length > 1 ? `<mark>${x}</mark>` : x).join(", ")}</td>`).join("")}</tr>`; }
    else { const same = invs.length > 1 && vals.every(v => norm(v) === norm(vals[0]));
      h += `<tr><td>${lab}</td>${vals.map(v => `<td class="${same ? "same" : ""}">${v}${same ? '<span class="same-tag">shared</span>' : ""}</td>`).join("")}</tr>`; }
  }
  tb.innerHTML = h;
  tb.querySelectorAll("[data-unpin]").forEach(b => b.onclick = () => togglePin(b.dataset.unpin));
}

/* ---------- chapter iv: Earth ---------- */
function renderSpin() {
  $("#spin").innerHTML = SPINOFFS.map(s => `<div class="card"><b>${s.t}</b><p>${s.d}</p><div class="tags">${s.ids.length ? s.ids.map(id => `<button class="relbtn" data-sel="${id}">${byId[id].ac}</button>`).join("") : `<span class="mono" style="font-size:10.5px;color:var(--faint)">broader NASA technology, not a PSI record</span>`}</div></div>`).join("");
  $("#spin").querySelectorAll("[data-sel]").forEach(b => b.onclick = () => { select(b.dataset.sel); $("#sky").scrollIntoView({ behavior: reduced ? "auto" : "smooth" }); });
  document.body.classList.toggle("earth-on", state.habitat === "earth");
}

addEventListener("scroll", () => document.querySelector(".bar").classList.toggle("scrolled", scrollY > 40), { passive: true });
/* nav dots */
{ const dots = [...document.querySelectorAll("#navdots a")], secs = dots.map(a => document.querySelector(a.getAttribute("href")));
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) dots.forEach((d, i) => d.classList.toggle("on", secs[i] === e.target)); }), { threshold: .5 });
  secs.forEach(s => s && io.observe(s)); }

/* ---------- agent ---------- */
let sampleFn = null, sampleState = "pending", busy = false, history = [];
const log = $("#log");
const addMsg = (cls, text) => { const m = el("div", { class: "msg " + cls }); m.textContent = text; log.append(m); log.scrollTop = log.scrollHeight; return m; };
$("#orb").onclick = () => { $("#agent").classList.remove("closed"); $("#orb").classList.add("hidden"); setTimeout(() => $("#ain").focus(), 200); };
$("#a-close").onclick = () => { $("#agent").classList.add("closed"); $("#orb").classList.remove("hidden"); };
function renderSteps() {
  const R = ROLES[state.role], st = $("#steps"); st.innerHTML = "";
  R.route.forEach(([id], n) => { const b = el("button", { class: "step", "aria-current": n === state.step }, `${n + 1} · ${byId[id].ac}`); b.onclick = () => { state.step = n; select(id, true); renderSteps(); }; st.append(b); });
  $("#route-note").innerHTML = gloss(R.route[state.step][1]);
}
function renderAgent(roleChanged) {
  const R = ROLES[state.role];
  $("#a-glyph").textContent = $("#orb-glyph").textContent = R.glyph; $("#a-name").textContent = $("#orb-name").textContent = R.agent; $("#a-role").textContent = `Guide for the ${R.label.toLowerCase()} view`;
  renderSteps();
  const a = $("#asks"); a.innerHTML = ""; R.asks.forEach(q => { const b = el("button", { class: "ask" }, q); b.onclick = () => ask(q); a.append(b); });
  if (roleChanged) { history = []; log.innerHTML = ""; addMsg("ai", R.blurb + " Start the route above, or ask me anything about these investigations.");
    if (sampleState === "off") addMsg("sys", "Live answers are unavailable here; replies come from the desk's own data.");
    select(R.route[0][0], true); }
}
$("#aform").onsubmit = e => { e.preventDefault(); const q = $("#ain").value.trim(); if (q) { $("#ain").value = ""; ask(q); } };
function catalog() {
  const H = HABITATS[state.habitat];
  return INV.map(i => `${i.id} | ${i.ac} — ${i.name} | ${FAMILIES[i.fam].name} | ${i.plat} | phase ${i.phase} | fuels: ${i.fuels} | sample: ${i.sample} | O2: ${i.o2} | P: ${i.pres} | flow: ${i.flow} | varied: ${i.varied.join("; ")} | held: ${i.held.join("; ")} | sensors: ${i.diag.join("; ")} | objective: ${i.obj} | takeaway: ${i.take} | Earth: ${i.earth} | related: ${i.rel.join(",")} | relevance for ${H.label}: ${score(i)}`).join("\n")
    + "\nGROUND STUDIES REUSING PSI DATA:\n" + GROUND.map(g => `${g.id} | ${g.ac} | builds on ${g.parent || "none"} | ${g.obj}`).join("\n");
}
function instructions() {
  const R = ROLES[state.role], H = HABITATS[state.habitat];
  return `You are the "${R.agent}", a guide inside Combustion Atlas, a dashboard of NASA PSI combustion investigations for fire safety in crew habitats. The user is a ${R.label}. ${R.blurb}
Context: selected crew environment is ${H.label} (${H.p} psia, ${H.o2}% O2). Facts from the brief: spacesuits run 100% O2 at 4.3 psi; Moon base and pressurized rovers are expected at >=30% O2 and <=10.2 psi (over 40% more O2 fraction than Earth air), reducing EVA pre-breathe; there is no partial-gravity combustion data in PSI yet (LUCI and FM2 expected); E-FIELD mimics partial gravity via ion wind; microgravity and 1-g results bound intermediate gravity; the highest microgravity O2 (up to 85%) was in ACME CFI-G. The SAME/SAME-R smoke instrument also measured dust in DAFT. ACME's six experiments shared CIR hardware; FLEX, FLEX-2, CFI used MDCA in CIR; BASS, BASS-II, SPICE, SLICE used the SPICE flow duct in the MSG.
Currently selected in the dashboard: ${state.selected}.
Rules: Answer in under 170 words unless asked for more, in plain prose or short lists, pitched for a ${R.label.toLowerCase()}. Cite investigations by acronym with PSI ID. Use only the catalog and facts above; if something is not in them, say the PSI summary does not state it. Do not invent numbers. When your answer centers on one investigation, call focus_investigation; when comparing, call compare_investigations; when the user names a crew environment, call set_habitat.
CATALOG:
${catalog()}`;
}
const tools = [
  { name: "focus_investigation", description: "Select and fly to one investigation in the dashboard.", inputSchema: { type: "object", properties: { id: { type: "string", description: "PSI ID like PSI-20" } }, required: ["id"] },
    execute: ({ id }) => { if (!byId[id]) throw new Error("unknown id"); select(id, true); return { ok: true, selected: id }; } },
  { name: "compare_investigations", description: "Pin 2-3 investigations to the comparison bench.", inputSchema: { type: "object", properties: { ids: { type: "array", items: { type: "string" } } }, required: ["ids"] },
    execute: ({ ids }) => { const ok = ids.filter(id => INV.some(i => i.id === id)).slice(0, 3); state.pinned = ok; renderCompare(); renderMini(); return { pinned: ok }; } },
  { name: "set_habitat", description: "Switch the crew environment lens: spacecraft, lunar, rover, mars, suit, earth.", inputSchema: { type: "object", properties: { habitat: { type: "string", enum: Object.keys(HABITATS) } }, required: ["habitat"] },
    execute: ({ habitat }) => { if (!HABITATS[habitat]) throw new Error("unknown habitat"); setHabitat(habitat); return { habitat }; } },
];
function localAnswer(q) {
  const words = q.toLowerCase().split(/\W+/).filter(w => w.length > 3);
  const top = INV.map(i => { const blob = `${i.ac} ${i.name} ${i.fuels} ${i.obj} ${i.take} ${i.diag.join(" ")} ${i.varied.join(" ")}`.toLowerCase(); return { i, n: words.reduce((a, w) => a + (blob.includes(w) ? 1 : 0), 0) + score(i) / 200 }; }).sort((a, b) => b.n - a.n).slice(0, 3);
  select(top[0].i.id, true);
  return "From the desk data, the closest matches are:\n" + top.map(x => `• ${x.i.ac} (${x.i.id}): ${x.i.take}`).join("\n");
}
/* AI guide transport. Three ways, tried in order:
   1. inside a Claude artifact page: window.claude.use("sample")
   2. self-hosted: POST to ATLAS_CONFIG.aiEndpoint (a small server that holds the Anthropic API key; see /api and server.js)
   3. neither: answers come from local keyword matching over data.js */
const CFG = window.ATLAS_CONFIG || {};
let aiMode = "pending", apiHistory = [];
const toolDefs = tools.map(t => ({ name: t.name, description: t.description, input_schema: t.inputSchema }));
function runTool(name, input, acts) {
  const t = tools.find(x => x.name === name); if (!t) throw new Error("unknown tool");
  const r = t.execute(input || {}); acts.push(`${name.replace(/_/g, " ")} → ${JSON.stringify(input).replace(/[{}"]/g, "")}`); return r;
}
async function askApi(q, out, acts) {
  const context = { role: state.role, habitat: state.habitat, selected: state.selected, scores: Object.fromEntries(INV.map(i => [i.id, score(i)])) };
  const messages = [...apiHistory.slice(-8), { role: "user", content: q }];
  let text = "";
  for (let round = 0; round < 4; round++) {
    const r = await fetch(CFG.aiEndpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ context, messages }) });
    if (r.status === 429) { const e = new Error("rate"); e.code = "rate_limited"; throw e; }
    if (!r.ok) { let d = {}; try { d = await r.json(); } catch (x) {} const e = new Error("http " + r.status); e.code = "http"; e.reason = [d.error, d.detail].filter(Boolean).join(": ") || ("HTTP " + r.status); throw e; }
    const res = await r.json();
    const blocks = Array.isArray(res.content) ? res.content : [];
    messages.push({ role: "assistant", content: blocks });
    const said = blocks.filter(b => b.type === "text").map(b => b.text).join("\n").trim();
    if (said) { text += (text ? "\n\n" : "") + said; out.textContent = text; log.scrollTop = log.scrollHeight; }
    const calls = blocks.filter(b => b.type === "tool_use");
    if (res.stop_reason !== "tool_use" || !calls.length) break;
    messages.push({ role: "user", content: calls.map(c => { let content, is_error = false;
      try { content = JSON.stringify(runTool(c.name, c.input, acts)); } catch (e) { content = String(e.message || e); is_error = true; }
      return { type: "tool_result", tool_use_id: c.id, content, is_error }; }) });
  }
  apiHistory.push({ role: "user", content: q }, { role: "assistant", content: text || "(no answer)" });
  return text || "I couldn't form an answer to that. Try rephrasing.";
}
async function ask(q) {
  if (busy) return; busy = true; $("#asend").disabled = true; addMsg("me", q);
  if (aiMode === "off" || aiMode === "pending") { addMsg("ai", localAnswer(q)); busy = false; $("#asend").disabled = false; return; }
  const out = addMsg("ai", "Thinking…"), acts = [];
  try {
    if (aiMode === "api") out.textContent = await askApi(q, out, acts);
    else {
      const msgs = [{ role: "user", content: instructions() + "\n\nReply 'Ready.' to confirm." }, { role: "assistant", content: "Ready." }, ...history.slice(-8), { role: "user", content: q }];
      const wrapped = tools.map(t => ({ ...t, execute: inp => runTool(t.name, inp, acts) }));
      const res = await sampleFn(msgs, { tools: wrapped, cache: false, onText: ({ text }) => { out.textContent = text; log.scrollTop = log.scrollHeight; } });
      out.textContent = res.text; history.push({ role: "user", content: q }, { role: "assistant", content: res.text });
    }
  } catch (err) {
    if (err && err.code === "not_granted") { sampleFn = null; aiMode = "off"; out.textContent = localAnswer(q); }
    else if (err && err.code === "rate_limited") out.textContent = "Too many questions at once. Wait a moment and ask again.";
    else {
      out.textContent = localAnswer(q);
      const why = location.protocol === "file:" ? "the page was opened as a file; run npm start and open http://localhost:3000"
        : (err && err.reason) || (err instanceof TypeError ? "the server is not running or /api/ask is unreachable" : (err && err.message) || "unknown error");
      addMsg("sys", `The live guide could not be reached (${why}), so this answer comes from the desk's own data.`);
    }
  }
  if (acts.length) { const a = el("span", { class: "act" }); a.textContent = acts.join(" · "); out.append(a); }
  busy = false; $("#asend").disabled = false;
}
(async () => {
  try { const s = window.claude && window.claude.use ? await window.claude.use("sample") : null; if (s) { sampleFn = s; aiMode = "sample"; } } catch (e) {}
  if (aiMode === "pending") aiMode = CFG.aiEndpoint ? "api" : "off";
  sampleState = aiMode === "off" ? "off" : "on";
  if (aiMode === "off") addMsg("sys", "Live answers are unavailable here; replies come from the desk's own data.");
})();




/* ---------- print grain shared by the light view's textures ---------- */
let GRAIN = null;
function grain(c, W, H, a) {
  if (!GRAIN) { GRAIN = document.createElement("canvas"); GRAIN.width = GRAIN.height = 220; const g = GRAIN.getContext("2d"), im = g.createImageData(220, 220);
    for (let i = 0; i < im.data.length; i += 4) { const v = Math.random() * 255; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255; } g.putImageData(im, 0, 0); }
  c.save(); c.globalAlpha = a; c.globalCompositeOperation = "overlay"; c.fillStyle = c.createPattern(GRAIN, "repeat"); c.fillRect(0, 0, W, H); c.restore();
}

/* ---------- light view hero: a red planet and drifting rocks behind the constellation ---------- */
const mars = (() => {
  const P = $("#mars"), F = $("#rocks-far"), N = $("#rocks-near"); if (!P) return { paint() {} };
  function setup(cv) { const r = $("#sky").getBoundingClientRect(), d = Math.min(devicePixelRatio || 1, 1.5); cv.width = Math.round(r.width * d); cv.height = Math.round(r.height * d); const c = cv.getContext("2d"); c.setTransform(d, 0, 0, d, 0, 0); return [c, r.width, r.height]; }
  function rock(c, x, y, r, rnd, shade) {
    const n = 9 + Math.floor(rnd() * 5), pts = []; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, rr = r * (.68 + rnd() * .45); pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr * (.75 + rnd() * .3)]); }
    const g = c.createLinearGradient(x - r, y - r, x + r, y + r); g.addColorStop(0, shade ? "#d8573a" : "#e2674a"); g.addColorStop(.55, "#9a2a12"); g.addColorStop(1, "#4a0d04");
    c.fillStyle = g; c.beginPath(); pts.forEach(([a, b], i) => i ? c.lineTo(a, b) : c.moveTo(a, b)); c.closePath(); c.fill();
    c.save(); c.clip(); for (let i = 0; i < r / 3; i++) { const cx = x + (rnd() - .5) * r * 1.4, cy = y + (rnd() - .5) * r * 1.2, cr = 1 + rnd() * r * .16;
      c.fillStyle = "rgba(60,8,2,.45)"; c.beginPath(); c.arc(cx, cy, cr, 0, 7); c.fill(); c.fillStyle = "rgba(255,170,130,.35)"; c.beginPath(); c.arc(cx - cr * .3, cy - cr * .3, cr * .5, 0, 7); c.fill(); }
    c.restore(); c.strokeStyle = "rgba(255,190,160,.35)"; c.lineWidth = 1; c.beginPath(); pts.slice(0, Math.ceil(n * .4)).forEach(([a, b], i) => i ? c.lineTo(a, b) : c.moveTo(a, b)); c.stroke();
  }
  function paint() {
    if (state.mode !== "light") return;
    let seed = 1965; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    // planet
    const [c, W, H] = setup(P); c.clearRect(0, 0, W, H);
    const R = Math.min(W, H) * .4, cx = W * .88, cy = H * .2;
    const halo = c.createRadialGradient(cx, cy, R * .9, cx, cy, R * 1.35); halo.addColorStop(0, "rgba(255,200,150,.45)"); halo.addColorStop(1, "rgba(255,200,150,0)");
    c.fillStyle = halo; c.beginPath(); c.arc(cx, cy, R * 1.35, 0, 7); c.fill();
    c.save(); c.beginPath(); c.arc(cx, cy, R, 0, 7); c.clip();
    const base = c.createRadialGradient(cx - R * .4, cy + R * .1, R * .1, cx, cy, R); base.addColorStop(0, "#f2683e"); base.addColorStop(.55, "#c0301a"); base.addColorStop(1, "#5e0e05");
    c.fillStyle = base; c.fillRect(cx - R, cy - R, R * 2, R * 2);
    for (let i = 0; i < 260; i++) { const a = rnd() * 6.283, rr = Math.sqrt(rnd()) * R, x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr, br = R * (.03 + rnd() * .18), dark = rnd() > .45;
      const g = c.createRadialGradient(x, y, 0, x, y, br); g.addColorStop(0, dark ? `rgba(95,12,4,${.15 + rnd() * .2})` : `rgba(255,135,95,${.08 + rnd() * .14})`); g.addColorStop(1, "rgba(0,0,0,0)");
      c.fillStyle = g; c.beginPath(); c.arc(x, y, br, 0, 7); c.fill(); }
    for (let k = 0; k < 4; k++) { let x = cx - R * .6 + rnd() * R * .6, y = cy - R * .1 + rnd() * R * .6, ang = -.3 + rnd() * .6;
      c.strokeStyle = "rgba(70,8,2,.55)"; c.lineWidth = 1.2 + rnd() * 2; c.beginPath(); c.moveTo(x, y);
      for (let i = 0; i < 26; i++) { ang += (rnd() - .5) * .7; x += Math.cos(ang) * R * .035; y += Math.sin(ang) * R * .02; c.lineTo(x, y); } c.stroke(); }
    for (let i = 0; i < 34; i++) { const a = rnd() * 6.283, rr = Math.sqrt(rnd()) * R * .95, x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr, cr = R * (.01 + Math.pow(rnd(), 2.5) * .08);
      c.fillStyle = "rgba(70,8,2,.5)"; c.beginPath(); c.ellipse(x, y, cr, cr * .85, 0, 0, 7); c.fill();
      c.fillStyle = "rgba(255,160,120,.4)"; c.beginPath(); c.ellipse(x + cr * .25, y + cr * .25, cr * .6, cr * .5, 0, 0, 7); c.fill();
      c.strokeStyle = "rgba(255,180,140,.35)"; c.lineWidth = 1; c.beginPath(); c.arc(x, y, cr * 1.15, Math.PI * .9, Math.PI * 1.7); c.stroke(); }
    const term = c.createLinearGradient(cx - R, cy + R, cx + R * .6, cy - R * .6); term.addColorStop(0, "rgba(255,160,110,.12)"); term.addColorStop(.55, "rgba(40,4,0,0)"); term.addColorStop(1, "rgba(40,4,0,.5)");
    c.fillStyle = term; c.fillRect(cx - R, cy - R, R * 2, R * 2);
    grain(c, W, H, .7);
    c.restore();
    c.strokeStyle = "rgba(255,215,185,.5)"; c.lineWidth = 2; c.beginPath(); c.arc(cx, cy, R - 1, Math.PI * .55, Math.PI * 1.25); c.stroke();
    // print grain over the whole sky
    grain(c, W, H, .16);
    // rocks: far layer small and faint, near layer larger
    const [f] = setup(F); f.clearRect(0, 0, W, H);
    for (let i = 0; i < 26; i++) rock(f, rnd() * W, rnd() * H, 2 + rnd() * 7, rnd, true);
    const [n] = setup(N); n.clearRect(0, 0, W, H);
    const spots = [[.6, .12, 16], [.68, .5, 9], [.7, .44, 22], [.36, .88, 14], [.08, .58, 11], [.5, .72, 7], [.97, .62, 26], [.82, .58, 12], [.26, .2, 8], [.44, .06, 6], [.93, .86, 9], [.16, .74, 18]];
    for (const [x, y, r] of spots) rock(n, x * W, y * H, r * (.8 + rnd() * .4), rnd, false);
  }
  return { paint };
})();

/* ---------- deep-field backdrop: an original cyanotype-and-galaxy texture painted once per size ---------- */
const deep = (() => {
  const cv = $("#deep"); if (!cv) return { paint() {} };
  function paint() {
    if (state.mode === "light") return paintThermal();
    const d = Math.min(devicePixelRatio || 1, 1.5), W = innerWidth, H = innerHeight;
    cv.width = Math.round(W * d); cv.height = Math.round(H * d);
    const c = cv.getContext("2d"); c.setTransform(d, 0, 0, d, 0, 0);
    let seed = 20261115; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const gauss = () => (rnd() + rnd() + rnd() - 1.5) / 1.5;
    const blob = (x, y, rx, ry, col, a) => { c.save(); c.translate(x, y); c.scale(rx / ry, 1); const g = c.createRadialGradient(0, 0, 0, 0, 0, ry);
      g.addColorStop(0, `rgba(${col},${a})`); g.addColorStop(1, `rgba(${col},0)`); c.fillStyle = g; c.beginPath(); c.arc(0, 0, ry, 0, 7); c.fill(); c.restore(); };
    // indigo cyanotype ground
    const bg = c.createLinearGradient(0, 0, W * .3, H); bg.addColorStop(0, "#0e2250"); bg.addColorStop(.55, "#0a1a40"); bg.addColorStop(1, "#06102a");
    c.fillStyle = bg; c.fillRect(0, 0, W, H);
    for (let i = 0; i < 70; i++) { const light = rnd() > .5; blob(rnd() * W, rnd() * H, 80 + rnd() * 260, 40 + rnd() * 120, light ? "40,80,150" : "2,8,26", light ? .22 : .35); }
    // canvas weave and folds
    for (let y = 0; y < H; y += 2) { c.fillStyle = `rgba(${rnd() > .5 ? "170,200,255" : "0,0,0"},${.015 + rnd() * .035})`; c.fillRect(0, y, W, 1); }
    for (let x = 0; x < W; x += 3) { c.fillStyle = `rgba(${rnd() > .5 ? "170,200,255" : "0,0,0"},${.01 + rnd() * .02})`; c.fillRect(x, 0, 1, H); }
    for (let i = 0; i < 7; i++) { const y = rnd() * H; c.strokeStyle = `rgba(160,190,240,${.04 + rnd() * .05})`; c.lineWidth = 1 + rnd() * 2; c.beginPath(); c.moveTo(0, y); for (let x = 0; x <= W; x += 40) c.lineTo(x, y + gauss() * 3); c.stroke(); }
    c.strokeStyle = "rgba(190,215,255,.08)"; c.lineWidth = 2; c.beginPath(); c.moveTo(W * .5, 0); for (let y = 0; y <= H; y += 30) c.lineTo(W * .5 + gauss() * 2, y); c.stroke();
    // white cloud streaks, like sun-printed wisps
    const bands = [[.78, .05, .55], [.9, .45, 1.05], [.62, .6, 1], [.22, -.05, .3]];
    for (const [yf, x0, x1] of bands) {
      const y0 = yf * H, amp = 10 + rnd() * 18, ph = rnd() * 6;
      for (let i = 0; i < 160; i++) { const t = rnd(), x = (x0 + (x1 - x0) * t) * W, y = y0 + Math.sin(t * 9 + ph) * amp + gauss() * 12;
        blob(x, y, 20 + rnd() * 90, 2 + rnd() * 7, "235,242,255", .05 + rnd() * .14); }
      for (let i = 0; i < 70; i++) { const t = rnd(), x = (x0 + (x1 - x0) * t) * W, y = y0 + Math.sin(t * 9 + ph) * amp + gauss() * 6;
        blob(x, y, 4 + rnd() * 18, .8 + rnd() * 1.6, "255,255,255", .25 + rnd() * .35); }
    }
    // spiral galaxy
    const gx = W * .17, gy = H * .84, R = Math.min(W, H) * .24;
    c.save(); c.translate(gx, gy); c.rotate(-.55); c.scale(1, .64);
    blob(0, 0, R * 1.15, R * 1.15, "120,150,220", .12);
    for (let arm = 0; arm < 2; arm++) for (let i = 0; i < 2600; i++) {
      const t = Math.pow(rnd(), .8), th = arm * Math.PI + t * 3.4 * Math.PI, r = R * t, sp = R * (.05 + .07 * (1 - t));
      const x = Math.cos(th) * r + gauss() * sp, y = Math.sin(th) * r + gauss() * sp, warm = 1 - t;
      c.fillStyle = `rgba(${Math.round(210 + 45 * warm)},${Math.round(215 + 20 * warm)},${Math.round(255 - 70 * warm)},${.25 + rnd() * .55})`;
      c.beginPath(); c.arc(x, y, .3 + rnd() * (rnd() > .97 ? 1.8 : .9), 0, 7); c.fill();
    }
    for (let arm = 0; arm < 2; arm++) for (let i = 0; i < 500; i++) { const t = .15 + rnd() * .8, th = arm * Math.PI + t * 3.4 * Math.PI - .18, r = R * t;
      c.fillStyle = "rgba(4,10,30,.18)"; c.beginPath(); c.arc(Math.cos(th) * r + gauss() * 4, Math.sin(th) * r + gauss() * 4, 2 + rnd() * 3, 0, 7); c.fill(); }
    blob(0, 0, R * .32, R * .32, "255,236,200", .75); blob(0, 0, R * .1, R * .1, "255,250,235", .95);
    c.restore();
    // a small companion galaxy and scattered stars
    blob(W * .88, H * .12, 26, 12, "230,225,210", .45);
    for (let i = 0; i < 420; i++) { const x = rnd() * W, y = rnd() * H, big = rnd() > .96;
      c.fillStyle = `rgba(240,240,255,${.3 + rnd() * .6})`; c.beginPath(); c.arc(x, y, big ? 1.4 : .3 + rnd() * .7, 0, 7); c.fill();
      if (big) { blob(x, y, 7, 7, "220,230,255", .35); c.fillStyle = "rgba(235,240,255,.35)"; c.fillRect(x - 6, y - .3, 12, .6); c.fillRect(x - .3, y - 6, .6, 12); } }
    // vignette keeps the edges quiet and the content legible
    const v = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .3, W / 2, H / 2, Math.max(W, H) * .75);
    v.addColorStop(0, "rgba(3,6,16,0)"); v.addColorStop(1, "rgba(3,6,16,.65)"); c.fillStyle = v; c.fillRect(0, 0, W, H);
  }

  // light view: soft thermal-camera blooms (red, orange, cream, blue) under heavy print grain
  function paintThermal() {
    const d = Math.min(devicePixelRatio || 1, 1.5), W = innerWidth, H = innerHeight;
    cv.width = Math.round(W * d); cv.height = Math.round(H * d);
    const c = cv.getContext("2d"); c.setTransform(d, 0, 0, d, 0, 0);
    let seed = 4417; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    c.fillStyle = "#e4572e"; c.fillRect(0, 0, W, H);
    const blooms = [["246,214,160", .1, .25, .45], ["59,95,168", .85, .78, .38], ["214,40,25", .22, .62, .3], ["242,140,58", .55, .35, .42], ["40,62,130", .9, .12, .28],
      ["246,214,160", .7, .95, .3], ["214,40,25", .62, .58, .2], ["59,95,168", .05, .95, .3], ["250,190,110", .4, .1, .3], ["120,60,120", .3, .78, .16]];
    for (const [col, x, y, r] of blooms) { const R = r * Math.max(W, H), X = x * W + (rnd() - .5) * 60, Y = y * H + (rnd() - .5) * 60;
      c.save(); c.translate(X, Y); c.scale(1, .7 + rnd() * .6); const g = c.createRadialGradient(0, 0, 0, 0, 0, R);
      g.addColorStop(0, `rgba(${col},.95)`); g.addColorStop(.45, `rgba(${col},.55)`); g.addColorStop(1, `rgba(${col},0)`); c.fillStyle = g; c.beginPath(); c.arc(0, 0, R, 0, 7); c.fill(); c.restore(); }
    grain(c, W, H, .55);
  }
  let to = 0, lastW = 0;
  addEventListener("resize", () => { if (Math.abs(innerWidth - lastW) < 2) return; clearTimeout(to); to = setTimeout(() => { lastW = innerWidth; paint(); mars.paint(); }, 250); });
  lastW = innerWidth;
  return { paint };
})();

/* ---------- guided tour ---------- */
const tour = (() => {
  const box = $("#tour"), spot = $("#spot"), tip = $("#tip");
  const toTop = () => scrollTo({ top: 0, behavior: "auto" });
  const toEl = sel => document.querySelector(sel).scrollIntoView({ block: "center", behavior: "auto" });
  const union = (...sels) => { const rs = sels.map(q => document.querySelector(q).getBoundingClientRect()); const l = Math.min(...rs.map(r => r.left)), t = Math.min(...rs.map(r => r.top)), r = Math.max(...rs.map(r => r.right)), b = Math.max(...rs.map(r => r.bottom)); return { left: l, top: t, width: r - l, height: b - t }; };
  const GOALS = [
    ["Screen materials for a habitat", "Pick the habitat, open the top-ranked dossiers, check the O₂ pill.", () => { setHabitat("lunar"); go(4); }],
    ["Find data to validate a model", "Switch to researcher; the guide's route lists benchmark datasets.", () => { setRole("researcher"); go(7); }],
    ["Compare two investigations", "Pin from a card, then read chapter iii.", () => go(10)],
    ["Teach or learn the basics", "Undergrad or professor role adds glossary hover-terms.", () => { setRole("undergrad"); go(5); }],
  ];
  const STEPS = [
    { center: true, h: "Welcome to the atlas", p: "Twenty NASA combustion investigations, ranked by how much they matter for fire safety where crews live. Everything stays tucked away until you call it. What brings you here?", goals: true },
    { at: () => union("#role-btn", "#hab-btn"), pre: toTop, h: "1 · Tell it who and where", p: "<b>I am</b> sets your role: the guide, the route and the vocabulary adapt. <b>Protecting</b> sets the crew environment (ISS, lunar base, rover, Mars, spacesuit, Earth). Changing it re-ranks every investigation.", use: "Use it to answer: <b>which studies matter for a 30% O₂ lunar cabin vs the ISS?</b>" },
    { at: () => { const r = $("#sky").getBoundingClientRect(); return { left: r.left + r.width * .3, top: r.top + r.height * .2, width: r.width * .45, height: r.height * .62 }; }, pre: toTop, h: "2 · The constellation", p: "Each star is an investigation, orbiting the hardware it used (ACME, MDCA, MSG duct, Saffire, smoke &amp; aerosol). <b>Bigger, brighter = more relevant</b> for your habitat. Beams from the centre point at the top five. Small grey moons are ground studies that reused flight data.", use: "<b>Drag</b> to orbit · <b>scroll</b> to zoom · <b>click</b> a star to select it." },
    { at: () => $("#hab").getBoundingClientRect(), pre: toTop, h: "3 · Crew environment", p: "Pressure, O₂ fraction and oxygen partial pressure (ppO₂) of the habitat you chose. Tap <b>why it matters</b> for the fire-safety context.", use: "Notice: a lunar cabin has nearly Earth's ppO₂ but a much higher O₂ fraction, which is what drives flammability." },
    { at: () => $("#top3").getBoundingClientRect(), pre: () => { toTop(); openDrawer("rank-drawer", false); }, h: "4 · Ranking", p: "The three closest matches. The link opens all twenty with fuel-phase filters and <b>Tune what the ranking weighs</b>: six sliders (flammability, detection, suppression, elevated O₂, scale, model data).", use: "Use the sliders when your question is narrower, e.g. turn detection up to find smoke-detector evidence." },
    { at: () => $("#mini").getBoundingClientRect(), pre: () => { toTop(); openDrawer("dossier", false); $("#mini").classList.remove("hide"); }, h: "5 · The investigation card", p: "A live schematic of the experiment, its fire-safety takeaway, and a pill telling you whether it was tested at your habitat's oxygen level (green covers it, amber close, red short). <b>Open full dossier</b> shows fuels, sample sizes, O₂, pressure, flow, what was varied vs held constant, sensors, and why it ranks where it does.", use: "<b>Pin to compare</b> sends it to the comparison bench (chapter iii)." },
    { at: () => union("#help", "#mode"), pre: toTop, h: "6 · Views and help", p: "The sun/moon switches between the deep-space view and the orange light view. This <b>?</b> brings the tour back any time.", use: "Your role, habitat and view are remembered on this device." },
    { at: () => $("#orb").getBoundingClientRect(), pre: toTop, h: "7 · Your guide", p: "A role-specific assistant. Its <b>guided route</b> walks five stops chosen for your role; you can also ask questions in plain words. It answers from the PSI data shown here and can fly the map, pin comparisons or switch habitats for you.", use: "Try: <b>“What should change in material screening for a 30% O₂ base?”</b>" },
    { at: () => $("#ch1 .ch-fig").getBoundingClientRect(), pre: () => toEl("#ch1"), h: "8 · i. Oxygen &amp; pressure", p: "Every investigation's tested pressure and O₂ range against crew atmospheres. Dashed curves hold ppO₂ constant. Click a band to open that study.", use: "Use it to spot <b>coverage gaps</b>: no solid-material flight test went above 21% O₂." },
    { at: () => $("#ch2 .ch-fig").getBoundingClientRect(), pre: () => toEl("#ch2"), h: "9 · ii. Gravity", p: "PSI has microgravity and 1-g data, nothing in between yet. The two bracket lunar and Martian gravity; E-FIELD's ion wind is the closest analog.", use: "Use it when arguing what we can and can't predict for the Moon." },
    { at: () => $("#ch3").getBoundingClientRect(), pre: () => toEl("#ch3"), h: "10 · iii. Comparison bench", p: "Up to three pinned investigations side by side. Shaded cells are identical across all; highlighted words are shared by some.", use: "Use it to see <b>how tests differ and where they agree</b>: hardware, fuels, O₂, flow, sensors." },
    { at: () => $("#ch4").getBoundingClientRect(), pre: () => toEl("#ch4"), h: "11 · iv. Back to Earth", p: "Terrestrial spin-offs, each linked to the investigations behind it: water-mist extinguishers, smoke detection, firefighter gear, material standards, cleaner engines.", use: "Pick <b>Earth applications</b> as the habitat to rank studies for terrestrial fire safety.", last: true },
  ];
  let i = 0;
  function go(n) { i = n; show(); }
  function place() {
    const st = STEPS[i];
    if (st.center) { spot.style.cssText = `left:50%;top:50%;width:0;height:0;`; tip.className = "tip center"; return; }
    tip.className = "tip";
    const r = st.at(), pad = 8, W = innerWidth, H = innerHeight;
    const L = Math.max(6, r.left - pad), T = Math.max(6, r.top - pad), Wd = Math.min(W - 12, r.width + pad * 2), Hd = Math.min(H - 12, r.height + pad * 2);
    spot.style.cssText = `left:${L}px;top:${T}px;width:${Wd}px;height:${Hd}px`;
    const tw = tip.offsetWidth, th = tip.offsetHeight; let x, y;
    if (T + Hd + th + 16 < H) { y = T + Hd + 14; x = L; }
    else if (T - th - 16 > 0) { y = T - th - 14; x = L; }
    else if (L - tw - 16 > 0) { x = L - tw - 14; y = Math.min(H - th - 12, Math.max(12, T)); }
    else if (L + Wd + tw + 16 < W) { x = L + Wd + 14; y = Math.min(H - th - 12, Math.max(12, T)); }
    else { x = (W - tw) / 2; y = H - th - 16; }
    tip.style.left = Math.min(W - tw - 12, Math.max(12, x)) + "px"; tip.style.top = Math.max(12, y) + "px";
  }
  function show() {
    const st = STEPS[i]; st.pre && st.pre();
    tip.innerHTML = `<div class="eyebrow">How to use the atlas</div><h3 id="tip-h">${st.h}</h3><p>${st.p}</p>
      ${st.goals ? `<div class="goals">${GOALS.map((g, n) => `<button class="goal" data-g="${n}"><b>${g[0]}</b><span>${g[1]}</span></button>`).join("")}</div>` : ""}
      ${st.use ? `<div class="use">${st.use}</div>` : ""}
      <div class="nav"><span class="count">${i ? `${i} / ${STEPS.length - 1}` : ""}</span>
        ${i ? `<button class="ghost" id="t-back">Back</button>` : `<button class="ghost" id="t-skip">Not now</button>`}
        <button class="solid" id="t-next">${st.last ? "Start exploring" : i ? "Next" : "Take the full tour"}</button></div>`;
    tip.querySelectorAll("[data-g]").forEach(b => b.onclick = () => GOALS[b.dataset.g][2]());
    const back = $("#t-back"), skip = $("#t-skip");
    if (back) back.onclick = () => go(i - 1); if (skip) skip.onclick = end;
    $("#t-next").onclick = () => st.last ? end() : go(i + 1);
    requestAnimationFrame(() => requestAnimationFrame(place));
    $("#t-next").focus({ preventScroll: true });
  }
  function start(n = 0) { box.hidden = false; box.classList.add("on"); closeMenus(); $("#agent").classList.add("closed"); $("#orb").classList.remove("hidden"); go(n); }
  function end() { box.classList.remove("on"); box.hidden = true; try { localStorage.setItem("atlas-toured", "1"); } catch (e) {} toTop(); }
  addEventListener("resize", () => { if (!box.hidden) place(); });
  document.addEventListener("keydown", e => { if (box.hidden) return; if (e.key === "Escape") end(); if (e.key === "ArrowRight") $("#t-next").click(); if (e.key === "ArrowLeft" && i) go(i - 1); });
  $("#help").onclick = () => start(0);
  return { start, seen: () => { try { return localStorage.getItem("atlas-toured") === "1"; } catch (e) { return true; } } };
})();

/* ---------- init ---------- */
function renderAll() { renderBar(); renderSky(); renderRank(); scene.refresh(); renderMini(); renderDossier(); renderEnv(); renderGrav(); renderCompare(); renderSpin(); }
document.documentElement.setAttribute("data-mode", state.mode); scene.setMode(state.mode);
renderAll(); renderAgent(true); deep.paint(); mars.paint();
if (!tour.seen()) setTimeout(() => tour.start(0), 900);
})();
