'use strict';
// ---------- constants & math ----------
const W = 480, H = 270, TS = 16;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const sign = v => v < 0 ? -1 : v > 0 ? 1 : 0;
const approach = (v, t, d) => v < t ? Math.min(v + d, t) : Math.max(v - d, t);
const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const rnd = (a, b) => a + Math.random() * (b - a);
const rndi = (a, b) => Math.floor(rnd(a, b + 1));
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const easeOut = t => 1 - (1 - t) * (1 - t);

class RNG {
  constructor(s) { this.s = (s >>> 0) || 1; }
  next() {
    let t = this.s += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
  range(a, b) { return a + this.next() * (b - a); }
  int(a, b) { return Math.floor(this.range(a, b + 1)); }
  pick(a) { return a[Math.floor(this.next() * a.length)]; }
  chance(p) { return this.next() < p; }
  shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(this.next() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
}

function hexToRgb(h) { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
function rgbStr(r, g, b, a = 1) { return `rgba(${r | 0},${g | 0},${b | 0},${a})`; }
function shade(hex, f) { const [r, g, b] = hexToRgb(hex); return f >= 0 ? rgbStr(r + (255 - r) * f, g + (255 - g) * f, b + (255 - b) * f) : rgbStr(r * (1 + f), g * (1 + f), b * (1 + f)); }
function makeCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

// ---------- 3x5 pixel font ----------
const GLYPHS = {
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111',
  F: '111100110100100', G: '011100101101011', H: '101101111101101', I: '111010010010111', J: '001001001101010',
  K: '101101110101101', L: '100100100100111', M: '101111111101101', N: '110101101101101', O: '010101101101010',
  P: '110101110100100', Q: '010101101110011', R: '110101110101101', S: '011100010001110', T: '111010010010010',
  U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101', Y: '101101010010010',
  Z: '111001010100111', 0: '111101101101111', 1: '010110010010111', 2: '110001010100111', 3: '110001010001110',
  4: '101101111001001', 5: '111100110001110', 6: '011100111101111', 7: '111001010010010', 8: '111101111101111',
  9: '111101111001110', '!': '010010010000010', '+': '000010111010000', '-': '000000111000000', '.': '000000000000010',
  ':': '000010000010000', '/': '001001010100100', '%': '101001010100101', '?': '110001010000010', "'": '010010000000000',
  x: '000101010101000', '(': '010100100100010', ')': '010001001001010', ' ': '000000000000000'
};
function textWidth(s, sc = 1) { return s.length * 4 * sc - sc; }
function drawText(ctx, s, x, y, color = '#fff', sc = 1, align = 'left', outline = '#000') {
  s = String(s).toUpperCase();
  let w = textWidth(s, sc);
  if (align === 'center') x -= w / 2; else if (align === 'right') x -= w;
  x = Math.round(x); y = Math.round(y);
  const pass = (col, ox, oy) => {
    ctx.fillStyle = col;
    for (let i = 0; i < s.length; i++) {
      const g = GLYPHS[s[i]] || GLYPHS['?'];
      for (let p = 0; p < 15; p++) if (g[p] === '1') ctx.fillRect(x + i * 4 * sc + (p % 3) * sc + ox, y + ((p / 3) | 0) * sc + oy, sc, sc);
    }
  };
  if (outline) { pass(outline, -1, 0); pass(outline, 1, 0); pass(outline, 0, -1); pass(outline, 0, 1); }
  pass(color, 0, 0);
}

// ---------- input ----------
const ACTIONS = ['left', 'right', 'up', 'down', 'jump', 'atk1', 'atk2', 'roll', 'sk1', 'sk2', 'heal', 'interact', 'pause', 'map', 'ult'];
const ACTION_NAMES = {
  left: 'Move left', right: 'Move right', up: 'Up / climb', down: 'Down / drop', jump: 'Jump', atk1: 'Primary weapon', atk2: 'Secondary weapon',
  roll: 'Roll / air dash', sk1: 'Skill 1', sk2: 'Skill 2', heal: 'Drink flask', interact: 'Interact', ult: 'Ultimate', map: 'Map', pause: 'Pause'
};
const BIND_ORDER = ['left', 'right', 'up', 'down', 'jump', 'roll', 'atk1', 'atk2', 'sk1', 'sk2', 'ult', 'heal', 'interact', 'map', 'pause'];
// Two keyboard/mouse slots per action. Mouse buttons are stored as Mouse0 (left), Mouse1 (middle), Mouse2 (right).
const BIND_PRESETS = {
  classic: {
    name: 'Classic', desc: 'WASD, J and K to attack',
    keys: { left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'], up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'], jump: ['Space', null], atk1: ['KeyJ', 'Mouse0'], atk2: ['KeyK', 'Mouse2'],
      roll: ['ShiftLeft', 'KeyL'], sk1: ['KeyU', 'Digit1'], sk2: ['KeyI', 'Digit2'], heal: ['KeyR', 'KeyQ'], interact: ['KeyE', 'KeyF'], ult: ['KeyG', 'Digit4'], map: ['Tab', 'KeyM'], pause: ['Escape', 'KeyP'] }
  },
  arrows: {
    name: 'Arrow keys', desc: 'Arrows to move, Z X C to act',
    keys: { left: ['ArrowLeft', null], right: ['ArrowRight', null], up: ['ArrowUp', null], down: ['ArrowDown', null], jump: ['KeyZ', 'Space'], atk1: ['KeyX', null], atk2: ['KeyC', null],
      roll: ['KeyV', 'ShiftLeft'], sk1: ['KeyA', null], sk2: ['KeyS', null], heal: ['KeyD', null], interact: ['KeyE', null], ult: ['KeyF', null], map: ['Tab', null], pause: ['Escape', null] }
  },
  mouse: {
    name: 'Mouse + WASD', desc: 'Click to attack, Q and E for skills',
    keys: { left: ['KeyA', null], right: ['KeyD', null], up: ['KeyW', null], down: ['KeyS', null], jump: ['Space', null], atk1: ['Mouse0', null], atk2: ['Mouse2', null],
      roll: ['ShiftLeft', null], sk1: ['KeyQ', null], sk2: ['KeyE', null], heal: ['KeyR', null], interact: ['KeyF', null], ult: ['KeyG', 'Mouse1'], map: ['Tab', null], pause: ['Escape', null] }
  }
};
const PAD_DEFAULT = { jump: 0, roll: 1, atk1: 2, atk2: 3, sk1: 4, sk2: 5, heal: 6, interact: 7, map: 8, pause: 9, ult: 10 };
const PAD_NAMES = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'Back', 'Start', 'L3', 'R3', 'D-Up', 'D-Down', 'D-Left', 'D-Right'];
const KEY_NAMES = {
  Space: 'Space', Tab: 'Tab', Escape: 'Esc', Enter: 'Enter', Backspace: 'Bksp', CapsLock: 'Caps',
  ShiftLeft: 'L-Shift', ShiftRight: 'R-Shift', ControlLeft: 'L-Ctrl', ControlRight: 'R-Ctrl', AltLeft: 'L-Alt', AltRight: 'R-Alt',
  ArrowLeft: 'Left', ArrowRight: 'Right', ArrowUp: 'Up', ArrowDown: 'Down', Mouse0: 'Mouse L', Mouse1: 'Mouse M', Mouse2: 'Mouse R', Mouse3: 'Mouse 4', Mouse4: 'Mouse 5',
  Comma: ',', Period: '.', Slash: '/', Semicolon: ';', Quote: 'Quote', BracketLeft: '[', BracketRight: ']', Backslash: 'Backslash', Minus: '-', Equal: '=', Backquote: 'Tilde',
  Insert: 'Ins', Delete: 'Del', Home: 'Home', End: 'End', PageUp: 'PgUp', PageDown: 'PgDn'
};
function keyName(code) {
  if (!code) return '';
  if (KEY_NAMES[code]) return KEY_NAMES[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return 'Num ' + code.slice(6);
  return code;
}
function padName(i) { return i == null ? '' : (PAD_NAMES[i] || 'Btn ' + i); }

const Input = {
  raw: {}, hit: {}, pad: {}, touch: {}, down: {}, prev: {}, pressed: {}, released: {}, lastDevice: 'kb', axisX: 0,
  binds: {}, padBinds: {}, codeMap: {}, padRaw: [], padPrev: [],
  loadBinds() {
    const def = BIND_PRESETS.classic.keys, sb = Save.d.binds || {}, sp = Save.d.padBinds || {};
    for (const a of BIND_ORDER) {
      this.binds[a] = Array.isArray(sb[a]) ? [sb[a][0] || null, sb[a][1] || null] : def[a].slice();
      this.padBinds[a] = a in sp ? sp[a] : (a in PAD_DEFAULT ? PAD_DEFAULT[a] : null);
    }
    this.rebuild();
  },
  saveBinds() { Save.d.binds = JSON.parse(JSON.stringify(this.binds)); Save.d.padBinds = Object.assign({}, this.padBinds); Save.write(); this.rebuild(); },
  rebuild() {
    this.codeMap = {};
    for (const a of BIND_ORDER) for (const c of this.binds[a]) if (c) (this.codeMap[c] = this.codeMap[c] || []).push(a);
  },
  applyPreset(id) { const k = BIND_PRESETS[id].keys; for (const a of BIND_ORDER) this.binds[a] = k[a].slice(); this.saveBinds(); },
  resetPad() { for (const a of BIND_ORDER) this.padBinds[a] = a in PAD_DEFAULT ? PAD_DEFAULT[a] : null; this.saveBinds(); },
  // The label shown in prompts and on the HUD for an action, for whichever device is in use.
  label(a) {
    if (this.lastDevice === 'pad') return this.padBinds[a] != null ? padName(this.padBinds[a]) : '-';
    const b = this.binds[a] || []; return keyName(b[0] || b[1]) || '-';
  },
  actionsFor(code) { const acts = (this.codeMap[code] || []).slice(); if (code === 'Escape' && !acts.includes('pause')) acts.push('pause'); return acts; },
  press(code, repeat) { for (const a of this.actionsFor(code)) { if (!repeat) this.hit[a] = true; this.raw[a] = true; } },
  release(code) { for (const a of this.actionsFor(code)) this.raw[a] = false; },
  init() {
    this.loadBinds();
    addEventListener('keydown', e => {
      if (UI.capture) return; // the Controls screen is listening for a new key
      const bound = this.actionsFor(e.code).length > 0;
      if ((bound || ['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) && !(e.target && e.target.tagName === 'BUTTON' && (e.code === 'Space' || e.code === 'Enter'))) e.preventDefault();
      SND.init();
      this.lastDevice = 'kb';
      this.press(e.code, e.repeat);
    });
    addEventListener('keyup', e => this.release(e.code));
    addEventListener('blur', () => { this.raw = {}; });
    const cv = document.getElementById('game');
    addEventListener('mousemove', () => { if (this.lastDevice === 'pad') this.lastDevice = 'kb'; });
    cv.addEventListener('mousedown', e => { SND.init(); if (UI.capture) return; this.lastDevice = 'kb'; this.press('Mouse' + e.button, false); if (e.button === 1) e.preventDefault(); });
    addEventListener('mouseup', e => this.release('Mouse' + e.button));
    cv.addEventListener('contextmenu', e => e.preventDefault());
  },
  pollPad() {
    this.pad = {}; this.padPrev = this.padRaw; this.padRaw = [];
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const gp of pads) {
      if (!gp) continue;
      const b = i => !!(gp.buttons[i] && gp.buttons[i].pressed);
      gp.buttons.forEach((x, i) => { if (x.pressed) this.padRaw[i] = true; });
      const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
      const P = this.pad;
      // movement always uses the stick and the d-pad
      P.left = P.left || b(14) || ax < -0.4; P.right = P.right || b(15) || ax > 0.4;
      P.up = P.up || b(12) || ay < -0.5; P.down = P.down || b(13) || ay > 0.5;
      for (const a of BIND_ORDER) { const i = this.padBinds[a]; if (i != null && b(i)) P[a] = true; }
      if (gp.buttons.some(x => x.pressed) || Math.abs(ax) > .5 || Math.abs(ay) > .5) this.lastDevice = 'pad';
    }
  },
  padJustPressed() { for (let i = 0; i < this.padRaw.length; i++) if (this.padRaw[i] && !this.padPrev[i]) return i; return -1; },
  update() {
    this.pollPad();
    if (document.body && document.body.classList.contains('pad') !== (this.lastDevice === 'pad')) document.body.classList.toggle('pad', this.lastDevice === 'pad');
    for (const a of ACTIONS) {
      const d = !!(this.raw[a] || this.pad[a] || this.touch[a]);
      this.pressed[a] = !!this.hit[a] || (d && !this.prev[a]);
      this.released[a] = !d && this.prev[a];
      this.down[a] = d || !!this.hit[a];
      this.prev[a] = d;
    }
    this.hit = {};
  },
  clear() { this.raw = {}; this.hit = {}; this.touch = {}; for (const a of ACTIONS) { this.pressed[a] = false; this.down[a] = false; } }
};

// ---------- audio (synthesized) ----------
const SND = {
  ctx: null, master: null, sfxGain: null, musGain: null, noiseBuf: null, last: {}, muted: false,
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain(); this.master.gain.value = this.muted ? 0 : 0.8; this.master.connect(this.ctx.destination);
      const comp = this.ctx.createDynamicsCompressor(); comp.connect(this.master);
      this.sfxGain = this.ctx.createGain(); this.sfxGain.gain.value = 0.9; this.sfxGain.connect(comp);
      this.musGain = this.ctx.createGain(); this.musGain.gain.value = 0.5; this.musGain.connect(comp);
      const len = this.ctx.sampleRate; this.noiseBuf = this.ctx.createBuffer(1, len, len);
      const d = this.noiseBuf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      if (Music.pending != null) Music.start(Music.pending);
    } catch (e) { this.ctx = null; }
  },
  setMuted(m) { this.muted = m; if (this.master) this.master.gain.value = m ? 0 : 0.8; },
  tone(f, d, o = {}) {
    const c = this.ctx; if (!c) return;
    const t = c.currentTime + (o.delay || 0), dest = o.dest || this.sfxGain;
    const osc = c.createOscillator(), g = c.createGain();
    osc.type = o.type || 'square'; osc.frequency.setValueAtTime(f, t);
    if (o.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.slide), t + d);
    const v = o.vol == null ? 0.2 : o.vol;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + (o.attack || 0.004));
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    osc.connect(g); g.connect(dest); osc.start(t); osc.stop(t + d + 0.02);
  },
  noise(d, o = {}) {
    const c = this.ctx; if (!c) return;
    const t = c.currentTime + (o.delay || 0), dest = o.dest || this.sfxGain;
    const src = c.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true;
    const f = c.createBiquadFilter(); f.type = o.type || 'lowpass'; f.frequency.setValueAtTime(o.freq || 1000, t); f.Q.value = o.q || 1;
    if (o.slide) f.frequency.exponentialRampToValueAtTime(Math.max(20, o.slide), t + d);
    const g = c.createGain(); const v = o.vol == null ? 0.2 : o.vol;
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    src.connect(f); f.connect(g); g.connect(dest); src.start(t, Math.random() * 0.5); src.stop(t + d + 0.02);
  },
  play(name) {
    if (!this.ctx || !SFX[name]) return;
    const now = performance.now();
    if (this.last[name] && now - this.last[name] < 35) return;
    this.last[name] = now; SFX[name]();
  }
};
const tone = (...a) => SND.tone(...a), noise = (...a) => SND.noise(...a);
const SFX = {
  swing() { noise(.09, { vol: .16, freq: 2600, type: 'bandpass', q: .8, slide: 900 }); },
  heavy() { noise(.18, { vol: .22, freq: 1200, type: 'bandpass', slide: 250 }); tone(90, .14, { type: 'sine', vol: .15, slide: 50 }); },
  stab() { noise(.05, { vol: .14, freq: 4000, type: 'bandpass', q: 2, slide: 2000 }); },
  hit() { noise(.07, { vol: .3, freq: 1800 }); tone(150, .07, { type: 'square', vol: .09, slide: 60 }); },
  crit() { noise(.09, { vol: .34, freq: 2400 }); tone(1300, .12, { type: 'square', vol: .06, slide: 2300 }); tone(120, .1, { type: 'square', vol: .1, slide: 50 }); },
  block() { tone(900, .06, { type: 'square', vol: .08, slide: 500 }); noise(.05, { vol: .15, freq: 3000, type: 'highpass' }); },
  parry() { tone(1600, .2, { type: 'triangle', vol: .16 }); tone(2400, .25, { type: 'sine', vol: .1, delay: .03 }); noise(.06, { vol: .2, freq: 5000, type: 'highpass' }); },
  hurt() { tone(220, .22, { type: 'sawtooth', vol: .16, slide: 70 }); noise(.14, { vol: .25, freq: 900 }); },
  jump() { tone(260, .09, { type: 'square', vol: .045, slide: 520 }); },
  djump() { tone(380, .12, { type: 'triangle', vol: .08, slide: 780 }); noise(.08, { vol: .07, freq: 3000, type: 'highpass' }); },
  land() { noise(.05, { vol: .1, freq: 500 }); },
  roll() { noise(.16, { vol: .11, freq: 700, type: 'bandpass', slide: 2000 }); },
  cell() { tone(880 + Math.random() * 300, .08, { type: 'sine', vol: .07, slide: 1600 }); },
  gold() { tone(1300, .05, { type: 'square', vol: .035 }); tone(1750, .08, { type: 'square', vol: .035, delay: .04 }); },
  boom() { noise(.6, { vol: .45, freq: 800, slide: 80 }); tone(70, .45, { type: 'sine', vol: .3, slide: 30 }); },
  bow() { tone(520, .07, { type: 'triangle', vol: .1, slide: 180 }); noise(.06, { vol: .07, freq: 4000, type: 'highpass' }); },
  zap() { noise(.12, { vol: .16, freq: 5000, type: 'highpass' }); tone(1800, .1, { type: 'sawtooth', vol: .05, slide: 300 }); },
  freeze() { tone(1200, .35, { type: 'sine', vol: .08, slide: 2600 }); noise(.3, { vol: .1, freq: 6000, type: 'highpass' }); },
  door() { noise(.3, { vol: .3, freq: 400 }); tone(110, .2, { type: 'square', vol: .08, slide: 55 }); },
  heal() { [523, 659, 784, 1046].forEach((f, i) => tone(f, .16, { type: 'sine', vol: .09, delay: i * .06 })); },
  pickup() { [440, 660, 880].forEach((f, i) => tone(f, .1, { type: 'triangle', vol: .08, delay: i * .05 })); },
  scroll() { [392, 523, 659, 784, 1046].forEach((f, i) => tone(f, .2, { type: 'triangle', vol: .08, delay: i * .07 })); },
  windup() { tone(660, .07, { type: 'square', vol: .03 }); },
  enemyDie() { noise(.22, { vol: .2, freq: 1200, slide: 200 }); tone(160, .2, { type: 'sawtooth', vol: .05, slide: 40 }); },
  die() { tone(300, 1.3, { type: 'sawtooth', vol: .16, slide: 40 }); noise(.9, { vol: .2, freq: 600, slide: 100 }); },
  roar() { tone(90, 1.1, { type: 'sawtooth', vol: .2, slide: 50 }); tone(95, 1.1, { type: 'sawtooth', vol: .16, slide: 45 }); noise(1, { vol: .2, freq: 500 }); },
  ui() { tone(720, .04, { type: 'square', vol: .045 }); },
  deny() { tone(170, .14, { type: 'square', vol: .07 }); },
  curse() { tone(200, .6, { type: 'sawtooth', vol: .1, slide: 90 }); tone(207, .6, { type: 'sawtooth', vol: .08, slide: 85 }); },
  buy() { SFX.gold(); SFX.pickup(); },
  thud() { noise(.28, { vol: .35, freq: 260 }); tone(55, .28, { type: 'sine', vol: .3, slide: 32 }); },
  teleport() { tone(300, .2, { type: 'sine', vol: .08, slide: 1500 }); noise(.15, { vol: .08, freq: 3000, type: 'bandpass' }); },
  step() { noise(.03, { vol: .035, freq: 700 }); },
  ult() { tone(180, .6, { type: 'sawtooth', vol: .14, slide: 900 }); noise(.5, { vol: .25, freq: 2000, slide: 200 }); [523, 784, 1046].forEach((f, i) => tone(f, .3, { type: 'triangle', vol: .08, delay: .05 + i * .06 })); },
  surge() { tone(880, .12, { type: 'triangle', vol: .08 }); tone(1320, .2, { type: 'sine', vol: .07, delay: .08 }); },
  walljump() { tone(320, .08, { type: 'square', vol: .05, slide: 640 }); noise(.06, { vol: .08, freq: 1500, type: 'bandpass' }); },
  dash() { noise(.14, { vol: .14, freq: 3000, type: 'bandpass', slide: 600 }); tone(600, .1, { type: 'sine', vol: .05, slide: 300 }); },
  hook() { noise(.2, { vol: .12, freq: 3000, type: 'highpass' }); tone(900, .15, { type: 'square', vol: .04, slide: 400 }); },
  alert() { tone(980, .05, { type: 'square', vol: .03 }); tone(1300, .06, { type: 'square', vol: .03, delay: .05 }); },
  bell() { [196, 392, 588, 784].forEach((f, i) => tone(f, 1.6 - i * .2, { type: 'sine', vol: .18 - i * .03 })); noise(.1, { vol: .2, freq: 3000 }); }
};

// ---------- procedural music ----------
const SONGS = [
  { bpm: 96, root: 45, scale: [0, 2, 3, 5, 7, 8, 10], prog: [0, 5, 3, 4], lead: 'triangle' },   // Tallow Cells, A minor
  { bpm: 88, root: 50, scale: [0, 2, 3, 5, 7, 9, 10], prog: [0, 3, 6, 4], lead: 'sine' },       // Aqueduct, D dorian
  { bpm: 112, root: 40, scale: [0, 1, 3, 5, 7, 8, 10], prog: [0, 1, 5, 4], lead: 'square' },    // Ramparts, E phrygian
  { bpm: 138, root: 48, scale: [0, 2, 3, 5, 7, 8, 11], prog: [0, 5, 1, 4], lead: 'sawtooth', boss: true }, // Warden
  { bpm: 70, root: 45, scale: [0, 2, 3, 5, 7, 8, 10], prog: [0, 5, 2, 4], lead: 'sine', calm: true }       // title / keeper
];
const midi = n => 440 * Math.pow(2, (n - 69) / 12);
const Music = {
  timer: null, step: 0, next: 0, song: null, pending: null, cur: -1,
  start(i) {
    if (this.cur === i && this.timer) return;
    this.stop(); this.pending = i; this.cur = i;
    if (!SND.ctx) return;
    this.song = SONGS[i]; this.step = 0; this.next = SND.ctx.currentTime + 0.15;
    this.melody = []; const r = new RNG(i * 977 + 13);
    for (let k = 0; k < 64; k++) this.melody.push(r.chance(0.55) ? r.int(0, 9) : -1);
    this.timer = setInterval(() => this.tick(), 40);
  },
  stop() { if (this.timer) clearInterval(this.timer); this.timer = null; this.cur = -1; },
  deg(d) { const s = this.song.scale; const o = Math.floor(d / s.length); return this.song.root + s[((d % s.length) + s.length) % s.length] + 12 * o; },
  tick() {
    const c = SND.ctx; if (!c || !this.song) return;
    const spb = 60 / this.song.bpm / 4;
    while (this.next < c.currentTime + 0.3) { this.play(this.step, this.next); this.next += spb; this.step++; }
  },
  play(st, t) {
    const S = this.song, dest = SND.musGain, d = t - SND.ctx.currentTime;
    const s16 = st % 16, bar = Math.floor(st / 16) % 4, chord = S.prog[bar];
    const o = (f, len, type, vol, extra = {}) => SND.tone(f, len, Object.assign({ type, vol, delay: Math.max(0, d), dest }, extra));
    if (s16 % 4 === 0 || (!S.calm && s16 === 10)) o(midi(this.deg(chord) - 12), S.calm ? .9 : .28, 'triangle', .22);
    if (!S.calm && s16 % 2 === 0) { const arp = [0, 2, 4, 7][(s16 / 2) % 4]; o(midi(this.deg(chord + arp) + 12), .12, S.lead, S.lead === 'sawtooth' || S.lead === 'square' ? .025 : .05); }
    if (S.calm && s16 % 4 === 2) { const arp = [0, 2, 4, 2][(s16 / 4) | 0]; o(midi(this.deg(chord + arp) + 12), .8, 'sine', .05); }
    const m = this.melody[(st >> 1) % 64];
    if (st % 2 === 0 && m >= 0 && bar % 2 === 1) o(midi(this.deg(chord + m) + 24), .22, 'sine', .035);
    if (!S.calm) {
      const kick = S.boss ? s16 % 4 === 0 : (s16 === 0 || s16 === 8 || s16 === 11);
      if (kick) { o(120, .16, 'sine', .35, { slide: 40 }); }
      if (s16 === 4 || s16 === 12) SND.noise(.12, { vol: .09, freq: 1800, type: 'bandpass', delay: Math.max(0, d), dest });
      if (s16 % 2 === 1) SND.noise(.03, { vol: .035, freq: 8000, type: 'highpass', delay: Math.max(0, d), dest });
    }
  }
};

// ---------- persistence ----------
const Save = {
  key: 'wickborn-save-v1', d: null,
  defaults() { return { flaskLv: 0, purseLv: 0, startSkill: false, unlocked: [], blueprints: [], runs: 0, wins: 0, bestBiome: 0, kills: 0, emberMax: 0, ember: 0, muted: false, shake: true, bestTime: 0, skin: 'wick', skins: [], achievements: [], elites: 0, ultsTotal: 0, binds: null, padBinds: null }; },
  load() {
    let d = null;
    const N = window.wickbornNative;
    try { d = JSON.parse(N ? N.readSave() : localStorage.getItem(this.key)); } catch (e) { d = null; }
    this.d = Object.assign(this.defaults(), d || {});
    SND.muted = this.d.muted;
  },
  write() {
    const s = JSON.stringify(this.d);
    if (window.wickbornNative) { window.wickbornNative.writeSave(s); return; }
    try { localStorage.setItem(this.key, s); } catch (e) { }
  }
};
