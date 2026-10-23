"use strict";

const firebaseConfig = {
  apiKey: "AIzaSyBdJ4ge_ibXK6do2C9y0f0yaftz7qbYOOQ",
  authDomain: "cursed-timer.firebaseapp.com",
  projectId: "cursed-timer",
  storageBucket: "cursed-timer.firebasestorage.app",
  messagingSenderId: "715051463007",
  appId: "1:715051463007:web:5847f5bb26efa06d3946ea"
};
const FIREBASE_VERSION = "10.14.1";

const BASE_TITLE = "Cursed Time · 呪われた時間";
const GUEST_FLAG = "cursed-time:guest";

const $  = (s, r = document) => r.querySelector(s);
const pad = n => String(n).padStart(2, "0");
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2, 10));

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
const store = (() => {
  const mem = new Map();
  return {
    get(k, d) { if (mem.has(k)) return mem.get(k); try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { mem.set(k, v); try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
  };
})();

function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v; else el.setAttribute(k, v === true ? "" : v);
  }
  el.append(...kids.flat().filter(x => x != null && x !== false));
  return el;
}
function fmtDuration(ms) {
  const s = Math.floor(Math.abs(ms) / 1000), d = Math.floor(s / 86400), hh = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60), ss = s % 60;
  if (d) return `${d}d ${hh}h`;
  if (hh) return `${hh}h ${pad(m)}m`;
  if (m) return `${m}m ${pad(ss)}s`;
  return `${ss}s`;
}
function makeTicker(fn, ms) {
  let fallback = null;
  const useInterval = () => { if (!fallback) fallback = setInterval(fn, ms); };
  try {
    const blob = new Blob([`setInterval(()=>postMessage(0),${ms})`], { type: "text/javascript" });
    const w = new Worker(URL.createObjectURL(blob));
    w.onmessage = fn; w.onerror = useInterval;
  } catch { useInterval(); }
}

const Settings = (() => {
  const KEY = "cursed-time:settings";
  let s = Object.assign({ scare: true, volume: 0.7 }, store.get(KEY, {}));
  s.volume = Math.min(1, Math.max(0, Number(s.volume) || 0));
  const subs = new Set();
  return {
    get: () => s,
    set(p) { s = { ...s, ...p }; store.set(KEY, s); subs.forEach(f => f(s)); },
    subscribe(f) { subs.add(f); f(s); }
  };
})();

const Sound = (() => {
  let ctx = null, master = null, noiseBuf = null, bed = null, scareBus = null;
  const level = () => Math.min(1, Math.pow(Settings.get().volume, 1.6));

  function unlock() {
    try {
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return false;
        ctx = new AC();
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -20; comp.knee.value = 10; comp.ratio.value = 14;
        comp.attack.value = 0.002; comp.release.value = 0.25;
        master = ctx.createGain(); master.gain.value = level();
        master.connect(comp); comp.connect(ctx.destination);
        const len = ctx.sampleRate * 2;
        noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
        const d = noiseBuf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      }
      if (ctx.state !== "running") ctx.resume().catch(() => {});
      return true;
    } catch { return false; }
  }
  Settings.subscribe(() => { if (master) master.gain.setTargetAtTime(level(), ctx.currentTime, 0.03); });

  function thump(out, t, f, peak) {
    [[f, 1], [f * 2.2, 0.6], [f * 4.1, 0.3]].forEach(([fr, k]) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(fr, t);
      o.frequency.exponentialRampToValueAtTime(fr * 0.45, t + 0.17);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak * k), t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
      o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.25);
    });
  }
  const heartbeat = (out, t, peak) => {
    thump(out, t, 84, peak); noiseBurst(out, t, 0.06, peak * 0.35, 150, 900);
    thump(out, t + 0.2, 66, peak * 0.72); noiseBurst(out, t + 0.2, 0.05, peak * 0.25, 150, 900);
  };

  function noiseBurst(out, t, dur, peak, lo = 300, hi = 6000) {
    const src = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = noiseBuf; src.loop = true;
    bp.type = "bandpass"; bp.frequency.value = Math.sqrt(lo * hi); bp.Q.value = 0.4;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.01);
    g.gain.setValueAtTime(peak, t + Math.max(0.011, dur - 0.03));
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    src.connect(bp); bp.connect(g); g.connect(out);
    src.start(t, Math.random()); src.stop(t + dur + 0.02);
  }

  function startAlert(lead) {
    if (!unlock()) return;
    stopAlert(true);
    const t0 = ctx.currentTime + 0.05;
    const b = bed = ctx.createGain();
    b.connect(master);

    const lp = ctx.createBiquadFilter(), hg = ctx.createGain();
    const voices = [[55, "sawtooth", 1], [57.4, "sawtooth", 1], [110.8, "sawtooth", 0.5], [165.6, "triangle", 0.35], [880, "sine", 0.05], [893, "sine", 0.05]].map(([fr, ty, k]) => {
      const o = ctx.createOscillator(), vg = ctx.createGain();
      o.type = ty; o.frequency.value = fr; vg.gain.value = k; o.connect(vg); vg.connect(lp); return o;
    });
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(420, t0); lp.frequency.linearRampToValueAtTime(1900, t0 + 30);
    const strong = lead === "hum";
    hg.gain.setValueAtTime(0.0001, t0);
    hg.gain.linearRampToValueAtTime(strong ? 0.55 : 0.12, t0 + (strong ? 3 : 1.5));
    hg.gain.linearRampToValueAtTime(strong ? 0.7 : 0.42, t0 + 30);
    lp.connect(hg); hg.connect(b);
    voices.forEach(o => { o.start(t0); o.stop(t0 + 31); });

    for (let t = 0; t < 30;) { 
      const k = t / 30;
      heartbeat(b, t0 + t, (lead === "heartbeat" ? 0.9 : 0.4) * (0.6 + 0.5 * k));
      t += 1.05 - 0.55 * k;
    }
    if (lead === "static") for (let i = 0; i < 7; i++) noiseBurst(b, t0 + i * 0.32 + Math.random() * 0.1, 0.12 + Math.random() * 0.15, 0.55);
    for (let t = 4 + Math.random() * 3; t < 30; t += 4 + Math.random() * 3) noiseBurst(b, t0 + t, 0.1 + Math.random() * 0.2, 0.12 + 0.2 * (t / 30));
  }

  function stopAlert(immediate) {
    if (!bed) return;
    const b = bed; bed = null;
    const n = ctx.currentTime;
    b.gain.cancelScheduledValues(n);
    b.gain.setTargetAtTime(0, n, immediate ? 0.005 : 0.06);
    setTimeout(() => { try { b.disconnect(); } catch {} }, 600);
  }

  function curve(k) {
    const n = 2048, c = new Float32Array(n);
    for (let i = 0; i < n; i++) { const x = i * 2 / n - 1; c[i] = (1 + k) * x / (1 + k * Math.abs(x)); }
    return c;
  }

  function screech() {
    if (!unlock()) return;
    stopAlert(true); haltScare();
    const t = ctx.currentTime + 0.02, dur = 3.4;
    const bus = ctx.createGain();
    bus.gain.setValueAtTime(0.0001, t);
    bus.gain.exponentialRampToValueAtTime(1, t + 0.015);
    bus.gain.setValueAtTime(1, t + dur - 1);
    bus.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const sh = ctx.createWaveShaper(); sh.curve = curve(40); sh.oversample = "2x";
    sh.connect(bus); bus.connect(master); scareBus = bus;
    [[900, "sawtooth", 0.5], [1337, "square", 0.3], [2011, "sawtooth", 0.35]].forEach(([f0, type, amp], i) => {
      const o = ctx.createOscillator(), g = ctx.createGain(), m = ctx.createOscillator(), mg = ctx.createGain();
      o.type = type; o.frequency.setValueAtTime(f0, t);
      for (let k = 1; k <= 24; k++) o.frequency.linearRampToValueAtTime(f0 * (1 + Math.random() * 2.4), t + k * dur / 24);
      m.frequency.value = 31 + i * 17; mg.gain.value = 420 + i * 260;
      m.connect(mg); mg.connect(o.frequency);
      g.gain.value = amp; o.connect(g); g.connect(sh);
      o.start(t); m.start(t); o.stop(t + dur + 0.05); m.stop(t + dur + 0.05);
    });
    noiseBurst(sh, t, dur, 0.5, 1500, 9000);
    thump(sh, t, 48, 1.2);
  }

  function haltScare() {
    if (!scareBus) return;
    const b = scareBus; scareBus = null;
    const n = ctx.currentTime;
    b.gain.cancelScheduledValues(n); b.gain.setTargetAtTime(0, n, 0.03);
    setTimeout(() => { try { b.disconnect(); } catch {} }, 400);
  }
  function thud() { if (unlock()) thump(master, ctx.currentTime + 0.02, 60, 0.5); }
  function toll() {
    if (!unlock()) return;
    const t = ctx.currentTime + 0.05, g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.5, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 4.5);
    g.connect(master);
    [[110, 1], [221, 0.5], [331, 0.3], [447, 0.15]].forEach(([f, k]) => {
      const o = ctx.createOscillator(), og = ctx.createGain();
      o.type = "sine"; o.frequency.value = f; og.gain.value = k;
      o.connect(og); og.connect(g); o.start(t); o.stop(t + 4.6);
    });
  }
  function begin() {  
    if (!unlock()) return;
    const t = ctx.currentTime + 0.03, g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.35, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
    g.connect(master);
    [[196, 1], [392, 0.5], [588, 0.25]].forEach(([f, k]) => { const o = ctx.createOscillator(), og = ctx.createGain(); o.type = "sine"; o.frequency.value = f; og.gain.value = k; o.connect(og); og.connect(g); o.start(t); o.stop(t + 1.7); });
    thump(master, t, 90, 0.5);
  }
  const status = () => ctx ? ctx.state : "none";
  function test() {   
    if (Checkin.active) return;
    Scare.run();
  }
  return { unlock, startAlert, stopAlert, screech, haltScare, thud, toll, test, begin, status };
})();

const Spiral = {
  svg(arms = 2, turns = 5, seed = 11, stroke = 8) {
    const rnd = mulberry32(seed), R = 172, b = R / (turns * Math.PI * 2);
    let paths = "";
    for (let a = 0; a < arms; a++) {
      const off = a * Math.PI * 2 / arms;
      let d = "";
      for (let th = 0.5; th <= turns * Math.PI * 2; th += 0.12) {
        const r = b * th + (rnd() - 0.5) * 1.4;  
        d += (d ? "L" : "M") + (200 + r * Math.cos(th + off)).toFixed(1) + " " + (200 + r * Math.sin(th + off)).toFixed(1);
      }
      paths += `<path d="${d}"/>`;
    }
    return `<svg viewBox="0 0 400 400" aria-hidden="true" focusable="false"><g fill="none" stroke="#fff" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round">${paths}</g></svg>`;
  }
};

const Art = (() => {
  // SVG Wajah Horor Berarsir Kasar & Mata Distorsi Spiral
  const faceSVG = `<svg viewBox="0 0 500 600" class="cursed-jumpscare-svg">
    <!-- Background Hitam Pekat dengan Arsir Tinta -->
    <rect width="500" height="600" fill="#000"/>
    
    <!-- Garis Speedlines Manga di Latar Belakang -->
    <g stroke="#fff" stroke-width="2" opacity="0.4">
      <line x1="0" y1="0" x2="250" y2="300"/><line x1="500" y1="0" x2="250" y2="300"/>
      <line x1="0" y1="600" x2="250" y2="300"/><line x1="500" y1="600" x2="250" y2="300"/>
      <line x1="250" y1="0" x2="250" y2="300"/><line x1="0" y1="300" x2="250" y2="300"/>
      <line x1="500" y1="300" x2="250" y2="300"/><line x1="250" y1="600" x2="250" y2="300"/>
    </g>

    <!-- Kontur Wajah Pucat & Terdistorsi -->
    <path d="M 100 150 C 70 300 90 500 250 560 C 410 500 430 300 400 150 C 370 50 130 50 100 150 Z" fill="#fff" stroke="#000" stroke-width="12"/>
    
    <!-- Tekstur Arsir Hitam di Pipi & Dahi (Style Junji Ito) -->
    <g stroke="#000" stroke-width="3" opacity="0.85">
      <line x1="110" y1="220" x2="160" y2="260"/><line x1="105" y1="240" x2="165" y2="280"/>
      <line x1="100" y1="260" x2="170" y2="300"/><line x1="390" y1="220" x2="340" y2="260"/>
      <line x1="395" y1="240" x2="335" y2="280"/><line x1="400" y1="260" x2="330" y2="300"/>
      <!-- Arsir Dahi -->
      <line x1="180" y1="100" x2="180" y2="150"/><line x1="200" y1="90" x2="200" y2="155"/>
      <line x1="220" y1="85" x2="220" y2="160"/><line x1="250" y1="80" x2="250" y2="160"/>
      <line x1="280" y1="85" x2="280" y2="160"/><line x1="300" y1="90" x2="300" y2="155"/>
      <line x1="320" y1="100" x2="320" y2="150"/>
    </g>

    <!-- Mata Kiri: Rongga Hitam dengan Pupil Spiral Melilit -->
    <ellipse cx="175" cy="230" rx="50" ry="40" fill="#000"/>
    <path d="M 175 230 m -30 0 a 30 30 0 1 0 60 0 a 30 30 0 1 0 -60 0 M 175 230 m -20 0 a 20 20 0 1 0 40 0 a 20 20 0 1 0 -40 0 M 175 230 m -10 0 a 10 10 0 1 0 20 0 a 10 10 0 1 0 -20 0" fill="none" stroke="#fff" stroke-width="4"/>

    <!-- Mata Kanan: Terbelalak Cemas dengan Pembuluh Darah -->
    <ellipse cx="325" cy="220" rx="55" ry="45" fill="#000"/>
    <ellipse cx="325" cy="220" rx="48" ry="38" fill="#fff"/>
    <!-- Spiral Pupil -->
    <path d="M 325 220 m -18 0 a 18 18 0 1 0 36 0 a 18 18 0 1 0 -36 0 M 325 220 m -8 0 a 8 8 0 1 0 16 0 a 8 8 0 1 0 -16 0" fill="none" stroke="#000" stroke-width="5"/>
    <!-- Urat Mata -->
    <g stroke="#000" stroke-width="2" fill="none">
      <path d="M 280 220 Q 300 215 310 220"/><path d="M 370 220 Q 350 225 340 220"/>
      <path d="M 325 180 Q 325 195 320 205"/><path d="M 325 260 Q 325 245 330 235"/>
    </g>

    <!-- Alis Bawah Menghitam -->
    <path d="M 110 180 Q 175 220 230 190" stroke="#000" stroke-width="12" fill="none"/>
    <path d="M 390 170 Q 325 210 270 180" stroke="#000" stroke-width="12" fill="none"/>

    <!-- Hidung Terdistorsi -->
    <path d="M 250 220 L 235 310 L 265 310 Z" fill="#000"/>

    <!-- Mulut Menganga Lebar (Screaming Void) -->
    <path d="M 140 370 Q 250 300 360 370 Q 250 570 140 370 Z" fill="#000" stroke="#000" stroke-width="8"/>
    
    <!-- Gigi Runcing Sharp Manga -->
    <g fill="#fff" stroke="#000" stroke-width="2">
      <!-- Gigi Atas -->
      <polygon points="160,355 175,395 190,355"/>
      <polygon points="195,350 210,400 225,350"/>
      <polygon points="230,345 250,410 270,345"/>
      <polygon points="275,350 290,400 305,350"/>
      <polygon points="310,355 325,395 340,355"/>
      <!-- Gigi Bawah -->
      <polygon points="170,425 185,385 200,425"/>
      <polygon points="205,435 220,380 235,435"/>
      <polygon points="240,440 250,380 260,440"/>
      <polygon points="265,435 280,380 295,435"/>
      <polygon points="300,425 315,385 330,425"/>
    </g>
  </svg>`;

  return { faceSVG };
})();

const Scare = (() => {
  let root, flood, msg, again, t1 = 0, t2 = 0;

  function init() {
    root = $("#scare"); flood = $("#flood"); msg = $("#scareMsg"); again = $("#scareAgain");
    again.addEventListener("click", dismiss);
  }

  function run() {
    const strong = Settings.get().scare;
    clearTimeout(t1); clearTimeout(t2);
    flood.innerHTML = ""; msg.hidden = true; again.hidden = true;
    root.classList.toggle("soft", !strong);
    root.hidden = false;
    document.body.classList.add("noscroll");

    if (strong) {
      flood.innerHTML = Art.faceSVG;
      Sound.screech();
    } else {
      Sound.thud();
    }

    t1 = setTimeout(() => { msg.hidden = false; }, strong ? 800 : 300);
    t2 = setTimeout(() => { again.hidden = false; again.focus({ preventScroll: true }); }, strong ? 3000 : 1500);
  }

  function dismiss() {
    clearTimeout(t1); clearTimeout(t2);
    Sound.haltScare();
    root.hidden = true; flood.innerHTML = "";
    document.body.classList.remove("noscroll");
    Timer.note("You crawl back. It remembers your face.", 9000);
  }

  return { init, run };
})();

const Checkin = (() => {
  const FAST = new URLSearchParams(location.search).has("fast");
  const WINDOW = 30000;
  let active = false, deadline = 0, nextAt = 0, remain = 0, flashT = 0, prevFocus = null, shown = -1;
  const els = {};
  const draw = () => FAST ? 15000 + Math.random() * 10000 : (5 + Math.random() * 2) * 60000;

  function init() {
    els.root = $("#checkin"); els.btn = $("#ciBtn"); els.sec = $("#ciSec"); els.bar = $("#ciBar");
    els.btn.addEventListener("click", press);
  }
  const onStart = () => { if (!remain) remain = draw(); nextAt = Date.now() + remain; };
  const onPause = () => { remain = Math.max(0, nextAt - Date.now()); };
  const clearSchedule = () => { remain = 0; nextAt = 0; };

  function tick(n) {
    if (active) { const left = deadline - n; paint(left); if (left <= 0) fail(); return; }
    if (Timer.isRunning() && nextAt && n >= nextAt) trigger(n);
  }
  function trigger(n) {
    active = true; deadline = n + WINDOW; nextAt = 0; remain = 0; shown = -1;
    prevFocus = document.activeElement;
    Sound.unlock();
    Sound.startAlert(["hum", "static", "heartbeat"][Math.random() * 3 | 0]);
    els.root.hidden = false;
    document.body.classList.add("tremor"); document.body.classList.remove("panic");
    paint(WINDOW);
    els.btn.focus({ preventScroll: true });
    let flip = false;
    document.title = "ARE YOU STILL SANE?";
    clearInterval(flashT);
    flashT = setInterval(() => { flip = !flip; document.title = flip ? "… IT IS WATCHING …" : "ARE YOU STILL SANE?"; }, 800);
  }
  function paint(left) {
    const secs = Math.max(0, Math.ceil(left / 1000));
    if (secs === shown) return;
    shown = secs;
    els.sec.textContent = secs;
    els.bar.style.setProperty("--p", Math.max(0, left / WINDOW).toFixed(3));
    document.body.classList.toggle("panic", secs <= 10);
  }
  function close() {
    active = false; clearInterval(flashT);
    els.root.hidden = true;
    document.body.classList.remove("tremor", "panic");
    Sound.stopAlert();
    Timer.refreshTitle();
    try { prevFocus && prevFocus.focus({ preventScroll: true }); } catch {}
  }
  function press() {
    if (!active) return;
    if (Date.now() > deadline) { fail(); return; }
    close(); 
    remain = draw();
    nextAt = Timer.isRunning() ? Date.now() + remain : 0;
    Timer.note("Not yet… it still watches.", 6000);
  }
  function fail() {
    close();
    Timer.reset();
    Scare.run();
  }
  const cancel = () => { if (active) close(); };
  return { init, tick, onStart, onPause, clearSchedule, cancel, get active() { return active; } };
})();

const Timer = (() => {
  const clampMin = v => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(180, Math.max(1, n)) : 25; };
  let TOTAL = clampMin(store.get("cursed-time:minutes", 25)) * 60000;
  const CAPTIONS = { idle: "The hour waits, patient and hungry.", running: "Do not look away. It is counting, too.", paused: "You stopped. It did not." };
  let state = "idle", remaining = TOTAL, endAt = 0, anim = null, lastTxt = "", noteT = 0, noteOn = false;
  let endured = Number(store.get("cursed-time:endured", 0)) || 0;
  const el = {};

  function init() {
    Object.assign(el, { dial: $("#dial"), digits: $("#digits"), ring: $("#ring"), cap: $("#timerCaption"), start: $("#btnStart"), pause: $("#btnPause"), reset: $("#btnReset"), count: $("#endured"), spin: $("#spiralSpin"), dur: $("#durMin"), durHint: $("#durHint"), presets: [...document.querySelectorAll(".preset")] });
    el.spin.innerHTML = Spiral.svg(2, 5, 11, 8);
    if (el.spin.animate) {
      anim = el.spin.animate([{ transform: "rotate(0deg)" }, { transform: "rotate(360deg)" }], { duration: 36000, iterations: Infinity });
      anim.pause();  
    }
    el.start.addEventListener("click", start);
    el.pause.addEventListener("click", pause);
    el.reset.addEventListener("click", () => { reset(); note("Back to the beginning. It remembers where you stopped."); });
    el.count.textContent = endured;
    el.dur.addEventListener("change", () => setMinutes(el.dur.value));
    el.presets.forEach(b => b.addEventListener("click", () => setMinutes(b.dataset.min)));
    renderState(); renderTime(true);
  }
  function setMinutes(v) {
    if (state === "running") return;
    if (String(v).trim() === "") { renderDuration(); return; }
    const m = clampMin(v);
    if (state === "paused") reset();
    TOTAL = m * 60000; remaining = TOTAL;
    store.set("cursed-time:minutes", m);
    renderDuration(); renderTime(true);
    note(`The hour is now ${m} minute${m === 1 ? "" : "s"} long.`, 4000);
  }
  function renderDuration() {
    const m = Math.round(TOTAL / 60000), locked = state === "running";
    el.dur.value = m; el.dur.disabled = locked;
    el.presets.forEach(b => { b.disabled = locked; b.setAttribute("aria-pressed", String(Number(b.dataset.min) === m)); });
    el.durHint.textContent = locked ? "The hour cannot be reshaped while the spiral turns. Halt it, or unwind the hour." : "";
  }
  const isRunning = () => state === "running";

  function start() {
    Sound.unlock();   
    if (state === "running") return;
    Sound.begin();
    setTimeout(() => {
      const st = Sound.status();
      if (st !== "running") note(st === "none" ? "This browser has no Web Audio. The omens will be silent." : "The browser keeps the sound locked. Click the page once more, then press again.", 9000);
    }, 400);
    endAt = Date.now() + remaining; state = "running";
    Checkin.onStart(); renderState(); renderTime(true);
  }
  function pause() {
    if (state !== "running") return;
    remaining = Math.max(0, endAt - Date.now()); state = "paused";
    Checkin.onPause(); renderState(); renderTime(true);
  }
  function reset() {
    state = "idle"; remaining = TOTAL;
    Checkin.clearSchedule(); renderState(); renderTime(true);
  }
  function tick(n) {
    if (state !== "running") return;
    remaining = endAt - n;
    if (remaining <= 0) return complete();
    renderTime();
  }
  function complete() {
    state = "idle"; remaining = TOTAL;
    endured++; store.set("cursed-time:endured", endured); el.count.textContent = endured;
    Checkin.cancel(); Checkin.clearSchedule();
    Sound.toll();
    renderState(); renderTime(true);
    note("The hour is spent. It is not finished with you.", 9000);
  }
  function renderTime(force) {
    const secs = Math.ceil(Math.max(0, remaining) / 1000);
    const txt = pad(Math.floor(secs / 60)) + ":" + pad(secs % 60);
    if (txt === lastTxt && !force) return;
    lastTxt = txt;
    el.digits.textContent = txt;
    el.ring.style.strokeDashoffset = String(100 * (1 - remaining / TOTAL));
    if (anim) anim.playbackRate = 1 + 1.6 * (1 - remaining / TOTAL); 
    refreshTitle();
  }
  function renderState() {
    el.start.hidden = state === "running";
    el.pause.hidden = state !== "running";
    el.dial.classList.toggle("running", state === "running");
    renderDuration();
    if (anim) { if (state === "running") anim.play(); else anim.pause(); }
    if (!noteOn) el.cap.textContent = CAPTIONS[state];
    refreshTitle();
  }
  function note(text, ms = 5000) {
    noteOn = true; el.cap.textContent = text;
    clearTimeout(noteT);
    noteT = setTimeout(() => { noteOn = false; el.cap.textContent = CAPTIONS[state]; }, ms);
  }
  function refreshTitle() {
    if (Checkin.active) return;
    document.title = state === "idle" ? BASE_TITLE : `${lastTxt} · ${state === "paused" ? "Halted" : "Cursed Time"}`;
  }
  return { init, tick, reset, note, isRunning, refreshTitle };
})();

const Tasks = (() => {
  const Z_UP = [..."\u030d\u030e\u0304\u0305\u033f\u0311\u0306\u0310\u0352\u0357\u0351\u0307\u0308\u030a\u0342\u0343\u0344\u034a\u034b\u034c\u0303\u0302\u030c\u0350\u0300\u0301\u030b\u030f\u0312\u0313\u0314\u033d\u0309"];
  const Z_MID = [..."\u0315\u031b\u0340\u0341\u0358\u0321\u0322\u0327\u0328\u0334\u0335\u0336\u035c\u035d\u035e\u035f\u0360\u0362\u0338\u0337\u0361"];
  const Z_DN = [..."\u0316\u0317\u0318\u0319\u031c\u031d\u031e\u031f\u0320\u0324\u0325\u0326\u0329\u032a\u032b\u032c\u032d\u032e\u032f\u0330\u0331\u0332\u0333\u0339\u033a\u033b\u033c\u0345\u0347\u0348\u0349\u034d\u034e\u0353\u0354\u0355\u0356\u0359\u035a\u0323"];
  const OFFSETS = [[8, 9, 1.2], [-10, 15, -1.6], [14, -9, 2], [-6, -13, -2.4]];
  let list = [], lastKey = null;
  const pending = new Set();
  let ul, countEl, emptyEl, form, textIn, dueIn;

  function zalgo(str, seed, power) {
    const r = mulberry32(seed), pick = a => a[r() * a.length | 0];
    let out = "";
    for (const ch of str) {
      out += ch;
      if (/\s/.test(ch)) continue;
      for (let i = 0, n = 1 + (r() * power | 0); i < n; i++) out += pick(Z_UP);
      for (let i = 0, n = r() * power * 0.5 | 0; i < n; i++) out += pick(Z_MID);
      for (let i = 0, n = 1 + (r() * power | 0); i < n; i++) out += pick(Z_DN);
    }
    return out;
  }
  const isCursed = (t, n) => t.deadline != null && n > t.deadline;
  const ghostCount = (t, n) => (n - t.deadline > 10 * 60 * 1000 ? 4 : 3);
  const when = t => t.deadline == null ? "No hour was set — the dread is patient." : new Date(t.deadline).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  const rel = (t, n) => t.deadline == null ? "" : (t.deadline > n ? `Due in ${fmtDuration(t.deadline - n)}` : `The hour passed ${fmtDuration(n - t.deadline)} ago`);
  const toLocalInput = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const defaultDue = () => { const d = new Date(Date.now() + 3600e3); d.setSeconds(0, 0); return toLocalInput(d); };

  function ghost(t, i) {
    const r = mulberry32(hash(t.id) + i * 131), [dx, dy, rot] = OFFSETS[i % OFFSETS.length];
    const g = h("div", { class: "ghost", "aria-hidden": "true" }, h("span", { class: "gbox" }), h("span", { class: "gtxt" }, zalgo(t.text, hash(t.id) + i * 7 + 1, 5)));
    g.style.cssText = `--i:${i};--dx:${dx + (r() * 4 - 2).toFixed(1)}px;--dy:${dy + (r() * 4 - 2).toFixed(1)}px;--rot:${rot}deg;--dur:${(1.4 + r() * 1.6).toFixed(2)}s`;
    return g;
  }
  function build(t, n) {
    const cursed = isCursed(t, n);
    const chk = h("input", { type: "checkbox", class: "chk", "aria-label": (cursed ? "Destroy the cursed stack: " : "Complete: ") + t.text, title: cursed ? "Only this one can destroy the entire stack" : "Release this burden" });
    const txt = cursed
      ? h("div", { class: "txt" }, h("span", { class: "sr-only" }, t.text), h("span", { "aria-hidden": "true" }, zalgo(t.text, hash(t.id), 3)))
      : h("div", { class: "txt" }, t.text);
    const meta = h("div", { class: "meta" }, h("span", {}, when(t)), t.deadline != null ? " · " : "", h("span", { class: "rel", "data-dl": t.deadline == null ? "" : t.deadline }, rel(t, n)));
    const stack = h("div", { class: "stack" + (cursed ? " cursed" : "") });
    if (cursed) for (let i = 0, c = ghostCount(t, n); i < c; i++) stack.append(ghost(t, i));
    stack.append(h("div", { class: "task" }, chk, h("div", {}, txt, meta)));
    const item = h("li", { class: "item", "data-id": t.id }, stack);
    if (cursed) item.append(h("p", { class: "multiply" }, "It keeps multiplying", h("span", { class: "dots" }, "...")));
    chk.addEventListener("change", () => destroy(item, t, chk, cursed));
    return item;
  }
  function render(force) {
    const n = Date.now();
    const key = list.map(t => t.id + ":" + (isCursed(t, n) ? ghostCount(t, n) : 0)).join("|");
    if (force || key !== lastKey) {
      lastKey = key;
      ul.replaceChildren(...list.map(t => build(t, n)));
      countEl.textContent = list.length ? `${list.length} ${list.length === 1 ? "burden weighs" : "burdens weigh"} upon you` : "";
      emptyEl.hidden = list.length > 0;
    } else {
      for (const s of ul.querySelectorAll(".rel")) {
        const dl = s.dataset.dl; if (dl === "") continue;
        const txt = rel({ deadline: Number(dl) }, n);
        if (s.textContent !== txt) s.textContent = txt;
      }
    }
  }
  function destroy(item, t, chk, cursed) {
    if (pending.has(t.id)) return;
    pending.add(t.id); chk.disabled = true;
    item.classList.add("dying");
    UI.say(cursed ? "The stack crumbles to ash. For now." : "One less weight. Another will come.");
    setTimeout(() => {
      Data.remove(t.id).catch(e => { UI.say("The burden refuses to leave: " + (e.code || e.message)); render(true); }).finally(() => pending.delete(t.id));
    }, 650);
  }
  function setAll(arr) {
    list = arr.filter(t => t && t.id && typeof t.text === "string")
      .sort((a, b) => ((a.deadline ?? Infinity) - (b.deadline ?? Infinity)) || ((a.createdAt || 0) - (b.createdAt || 0)));
    render(true);
  }
  function init() {
    ul = $("#taskList"); countEl = $("#taskCount"); emptyEl = $("#emptyNote");
    form = $("#taskForm"); textIn = $("#taskText"); dueIn = $("#taskDue");
    dueIn.value = defaultDue();
    const submit = () => {
      const text = textIn.value.trim();
      if (!text) { UI.say("A burden must have a name."); textIn.focus(); return; }
      const dl = dueIn.value ? new Date(dueIn.value).getTime() : null;
      const task = { id: uid(), text, deadline: Number.isNaN(dl) ? null : dl, createdAt: Date.now() };
      Data.add(task).then(r => { if (!r || r.saved !== false) UI.say("Another torment takes its seat."); }).catch(err => UI.say("The offering was refused: " + (err.code || err.message), 20000));
      textIn.value = ""; dueIn.value = defaultDue(); textIn.focus();
    };
    form.addEventListener("submit", e => e.preventDefault());
    $("#btnAdd").addEventListener("click", submit);
    [textIn, dueIn].forEach(i => i.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); submit(); } }));
  }
  return { init, setAll, tick: () => render(false) };
})();

const Data = (() => {
  let backend = null;
  const GUEST_KEY = "cursed-time:guest-tasks";

  function guest() {
    let list = store.get(GUEST_KEY, []), cb = () => {};
    const save = () => store.set(GUEST_KEY, list);
    return {
      kind: "guest",
      start(f) { cb = f; cb(list.slice()); },
      add(t) { list.push(t); save(); cb(list.slice()); return Promise.resolve(); },
      remove(id) { list = list.filter(x => x.id !== id); save(); cb(list.slice()); return Promise.resolve(); },
      stop() { cb = () => {}; }
    };
  }
  function cloud(fb, user) {
    const { db, fs } = fb;
    const col = fs.collection(db, "users", user.uid, "tasks");
    const CK = "cursed-time:cache:" + user.uid;
    let unsub = null, cb = () => {}, synced = store.get(CK, []), unsaved = [];
    const emit = () => { const ids = new Set(synced.map(t => t.id)); cb(synced.concat(unsaved.filter(t => !ids.has(t.id)))); };
    const hint = e => {
      const c = e && e.code;
      if (c === "permission-denied") return "The cloud refused (permission-denied). In Firebase console → Firestore Database → Rules, paste the rules written at the top of the script. Until then your burdens stay on this device only.";
      if (c === "failed-precondition" || c === "not-found") return "Firestore has no database yet. In Firebase console → Build → Firestore Database → Create database. Your burdens stay on this device meanwhile.";
      if (c === "unavailable") return "The cloud is unreachable. Your burdens are kept on this device.";
      return "The cloud refused: " + ((e && (e.code || e.message)) || "unknown") + ". Your burdens are kept on this device.";
    };
    return {
      kind: "cloud",
      start(f) {
        cb = f; emit();              
        unsub = fs.onSnapshot(col, snap => {
          synced = snap.docs.map(d => ({ id: d.id, ...d.data() })); store.set(CK, synced);
          unsaved = unsaved.filter(t => !synced.some(s => s.id === t.id));
          emit();
        }, err => { UI.say(hint(err), 30000); emit(); });
      },
      add(t) {
        unsaved.push(t); emit();       
        const slow = setTimeout(() => UI.say("Still waiting for the cloud… your burden is kept on this device meanwhile.", 10000), 8000);
        return fs.setDoc(fs.doc(db, "users", user.uid, "tasks", t.id), { text: t.text, deadline: t.deadline, createdAt: t.createdAt })
          .then(() => { clearTimeout(slow); return { saved: true }; },
                e => { clearTimeout(slow); UI.say(hint(e), 30000); return { saved: false }; });
      },
      remove(id) {
        synced = synced.filter(t => t.id !== id); unsaved = unsaved.filter(t => t.id !== id); store.set(CK, synced); emit();
        return fs.deleteDoc(fs.doc(db, "users", user.uid, "tasks", id));
      },
      stop() { if (unsub) unsub(); unsub = null; cb = () => {}; }
    };
  }
  return {
    guest, cloud,
    connect(b) { if (backend) backend.stop(); backend = b; b.start(Tasks.setAll); },
    disconnect() { if (backend) backend.stop(); backend = null; Tasks.setAll([]); },
    add: t => backend ? backend.add(t) : Promise.reject(new Error("no vessel")),
    remove: id => backend ? backend.remove(id) : Promise.resolve()
  };
})();

const Auth = (() => {
  const configured = !!firebaseConfig.apiKey && !/PASTE|YOUR_/i.test(firebaseConfig.apiKey) && !/PASTE|YOUR_/i.test(firebaseConfig.projectId || "");
  let fb = null;

  async function init() {
    if (!configured) {
      UI.loginMsg("The cloud ritual is not yet prepared (paste your firebaseConfig into the script). Guests may still enter.");
      UI.loginReady(); App.route(null);
      return;
    }
    try {
      const base = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/`;
      const [appM, authM, fs] = await Promise.all([import(base + "firebase-app.js"), import(base + "firebase-auth.js"), import(base + "firebase-firestore.js")]);
      const app = appM.initializeApp(firebaseConfig);
      fb = { auth: authM.getAuth(app), db: fs.getFirestore(app), authM, fs };  
      let first = true;
      authM.onAuthStateChanged(fb.auth, user => {
        if (first) { first = false; UI.loginReady(); UI.loginMsg(""); }
        App.route(user);
      }, err => { UI.loginMsg("The gate is troubled: " + (err.code || err.message)); UI.loginReady(); });
    } catch (e) {
      UI.loginMsg("The cloud could not be reached. Guests may still enter.");
      UI.loginReady(); App.route(null);
    }
  }
  function explain(e) {
    switch (e && e.code) {
      case "auth/popup-closed-by-user":
      case "auth/cancelled-popup-request": return "You hesitated. The gate remembers.";
      case "auth/popup-blocked": return "Your browser barred the doorway. Allow pop-ups and try again.";
      case "auth/unauthorized-domain": return "This domain is not yet bound. Add it under Authentication → Settings → Authorized domains.";
      case "auth/operation-not-supported-in-this-environment": return "The gate will not open from a file. Serve this page over http://localhost or a hosting URL.";
      case "auth/network-request-failed": return "The cloud is silent. Check your connection.";
      default: return "The ritual failed: " + ((e && (e.code || e.message)) || "unknown");
    }
  }
  async function signIn() {
    if (!fb) { UI.loginMsg(configured ? "The gate has not finished stirring…" : "The cloud ritual is not prepared. Paste your firebaseConfig, or enter as a guest."); return; }
    try {
      const p = new fb.authM.GoogleAuthProvider();
      p.setCustomParameters({ prompt: "select_account" });
      await fb.authM.signInWithPopup(fb.auth, p);
    } catch (e) { UI.loginMsg(explain(e)); }
  }
  async function signOut() { if (fb && fb.auth.currentUser) await fb.authM.signOut(fb.auth); }
  const backend = user => Data.cloud(fb, user);
  function touch(user) {
    if (!fb) return;
    fb.fs.setDoc(fb.fs.doc(fb.db, "users", user.uid), { displayName: user.displayName || null, lastSeen: Date.now() }, { merge: true }).catch(() => {});
  }
  return { init, signIn, signOut, backend, touch };
})();

const UI = (() => {
  let sayT = 0;
  function mountWards(el) {
    const id = "w" + Math.random().toString(36).slice(2, 7);
    const chk = h("input", { type: "checkbox", id: id + "s", class: "chk small" });
    const rng = h("input", { type: "range", id: id + "v", min: "0", max: "100", step: "1" });
    const test = h("button", { type: "button", class: "btn small" }, "Test the Omen");
    el.append(
      h("div", { class: "ward-row" }, chk, h("label", { for: id + "s" }, "Jumpscare imagery & screech")),
      h("div", {}, h("label", { for: id + "v" }, "Volume (loud sounds are capped)"), rng),
      test
    );
    chk.addEventListener("change", () => Settings.set({ scare: chk.checked }));
    rng.addEventListener("input", () => Settings.set({ volume: rng.value / 100 }));
    test.addEventListener("click", () => Sound.test());
    Settings.subscribe(s => { chk.checked = s.scare; if (document.activeElement !== rng) rng.value = Math.round(s.volume * 100); });
  }
  return {
    say(text, ms = 7000) { const m = $("#msg"); m.textContent = text; clearTimeout(sayT); sayT = setTimeout(() => { m.textContent = ""; }, ms); },
    loginMsg(text) { $("#loginMsg").textContent = text; },
    loginReady() { $("#btnGoogle").disabled = false; $("#btnGuest").disabled = false; },
    showLogin() { $("#login").hidden = false; $("#app").hidden = true; document.title = BASE_TITLE; window.scrollTo(0, 0); },
    showApp() { $("#login").hidden = true; $("#app").hidden = false; },
    mountWards
  };
})();

const App = (() => {
  let session = null;

  function route(user) {
    if (user) return enter({ kind: "cloud", user });
    if (store.get(GUEST_FLAG, false)) return enter({ kind: "guest" });
    leave();
  }
  function enter(s) {
    if (session && session.kind === s.kind && (!s.user || (session.user && session.user.uid === s.user.uid))) return;
    session = s;
    if (s.kind === "cloud") {
      store.set(GUEST_FLAG, false);
      Auth.touch(s.user);
      Data.connect(Auth.backend(s.user));
      $("#vesselInfo").textContent = "Bound to the cloud as " + (s.user.displayName || s.user.email || "a stranger");
      $("#btnLeave").textContent = "Abandon the Vessel";
    } else {
      Data.connect(Data.guest());
      $("#vesselInfo").textContent = "Guest — your burdens live only in this browser";
      $("#btnLeave").textContent = "Leave the Threshold";
    }
    UI.showApp();
  }
  function leave() {
    Timer.reset(); Checkin.cancel();
    Data.disconnect();
    session = null;
    UI.showLogin();
  }
  function init() {
    $("#btnGoogle").addEventListener("click", Auth.signIn);
    $("#btnGuest").addEventListener("click", () => { store.set(GUEST_FLAG, true); route(null); });
    $("#btnLeave").addEventListener("click", async () => {
      if (session && session.kind === "cloud") await Auth.signOut();
      else { store.set(GUEST_FLAG, false); route(null); }
    });
  }
  return { init, route };
})();

function frame() {
  const n = Date.now();
  Timer.tick(n);
  Checkin.tick(n);
  Tasks.tick(n);
}
(function boot() {
  $("#loginSpiral").innerHTML = Spiral.svg(3, 6, 23, 7);
  Timer.init(); Tasks.init(); Checkin.init(); Scare.init(); App.init();
  UI.mountWards($("#loginWards"));
  UI.mountWards($("#appWards"));
  makeTicker(frame, 500);
  document.addEventListener("visibilitychange", frame);
  Auth.init();
})();