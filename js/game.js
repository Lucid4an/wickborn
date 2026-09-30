'use strict';
const G = {
  state: 'title', level: null, player: null, enemies: [], projs: [], objs: [], solids: [], bolts: [], corpses: [], decoy: null, ultFlash: 0, ultCol: '#fff',
  cam: { x: 0, y: 0 }, look: 0, shake: 0, hitstop: 0, slowmo: 0, hurtFlash: 0, time: 0, run: null, bg: null,
  nearObj: null, mapOpen: false, acc: 0, lastT: 0, revealT: 0, mmT: 0, endShown: false, victoryT: 0,

  init() {
    this.cv = $('game'); this.ctx = this.cv.getContext('2d'); this.ctx.imageSmoothingEnabled = false;
    this.lightC = makeCanvas(W, H); this.lightX = this.lightC.getContext('2d');
    this.vignette = this.makeVignette('0,0,0', .6); this.redVig = this.makeVignette('200,20,30', .75); this.purpleVig = this.makeVignette('120,30,170', .6);
    // warm every font face up front so no text renders late
    this.fontsReady = document.fonts ? Promise.all(['400 16px "Pixelify Sans"', '600 16px "Pixelify Sans"', '700 16px "Pixelify Sans"', '16px "Jacquarda Bastarda 9"'].map(f => document.fonts.load(f))).catch(() => { }) : Promise.resolve();
    Save.load(); Input.init(); UI.init();
    addEventListener('resize', () => this.resize()); this.resize();
    addEventListener('blur', () => { if (this.state === 'play' && !(Native.info && Native.info.smoke)) UI.pause(); });
    Ach.sync();
    UI.showTitle();
    requestAnimationFrame(t => { this.lastT = t; this.loop(t); });
  },
  makeVignette(rgb, a) {
    const c = makeCanvas(W, H), x = c.getContext('2d');
    const g = x.createRadialGradient(W / 2, H / 2, H * .35, W / 2, H / 2, W * .62);
    g.addColorStop(0, `rgba(${rgb},0)`); g.addColorStop(1, `rgba(${rgb},${a})`);
    x.fillStyle = g; x.fillRect(0, 0, W, H); return c;
  },
  resize() {
    const app = $('app'), w = app.clientWidth, h = app.clientHeight;
    const gut = w < 900 ? 32 : 24;
    let s = Math.min((w - gut) / W, (h - gut) / H);
    if (s >= 2) { const fs = Math.floor(s); if (fs / s > .87) s = fs; }
    const st = $('stage'); st.style.width = Math.floor(W * s) + 'px'; st.style.height = Math.floor(H * s) + 'px';
    document.documentElement.style.setProperty('--u', s + 'px');
  },
  addShake(v) { this.shake = Math.min(14, Math.max(this.shake, v)); },
  addBolt(x1, y1, x2, y2) { this.bolts.push({ x1, y1, x2, y2, life: .16 }); },
  targetFor(e) {
    const d = this.decoy;
    if (d && !d.dead && dist(e.cx, e.cy, d.x + 5, d.y + 11) < 260) return d;
    return this.player;
  },

  // ---------- flow ----------
  startTitleScene() {
    this.run = { biome: 0, ember: 0, kills: 0, cellsTotal: 0, cellsSpent: 0, time: 0, seed: 1, dmgTaken: 0, flasksUsed: 0, parries: 0, blueprints: 0 };
    const L = this.level = genLevel(0, 20260928);
    Art.renderLevel(L); L.fog = makeCanvas(L.tw, L.th);
    this.bg = Art.makeBG(0);
    this.enemies = []; this.projs = []; this.objs = []; this.solids = []; this.bolts = []; FX.clear();
    this.corpses = []; this.decoy = null;
    this.player = new Player(Save.d.skin); this.player.spawn(L.spawn.x + 250, L.spawn.y); this.player.invuln = 0;
    this.titleBase = this.player.x - W * .62; this.cam.x = this.titleBase; this.cam.y = this.player.y - H * .58;
    this.clampCam(); this.titleT = 0;
    Music.start(4);
  },
  titleUpdate(dt) {
    this.titleT += dt;
    this.cam.x = this.titleBase + Math.sin(this.titleT * .08) * 30;
    this.clampCam();
    if (Math.random() < .08) FX.add({ x: this.player.x + 5 + rnd(-2, 2), y: this.player.y - 6, vx: rnd(-6, 6), vy: -rnd(15, 30), life: 1.2, col: pick(['#ffab3d', '#ffcf6a']), glow: '#ff9a3c', grav: -5 });
    FX.update(dt);
  },
  newRun() {
    SND.init();
    Save.d.runs++; Save.write();
    this.run = { biome: 0, ember: Save.d.ember, kills: 0, cellsTotal: 0, cellsSpent: 0, time: 0, seed: (Math.random() * 1e9) | 0, dmgTaken: 0, flasksUsed: 0, parries: 0, blueprints: 0, ults: 0 };
    if (!skinUnlocked(skinById(Save.d.skin))) Save.d.skin = 'wick';
    const p = this.player = new Player(Save.d.skin);
    p.slots[0] = makeItem('rusty', 1); p.slots[0].affix = null;
    p.slots[1] = makeItem(pick(['bow', 'buckler']), 1); p.slots[1].affix = null;
    if (Save.d.startSkill) p.slots[2] = randomItem(1, 'skill');
    p.gold = [0, 50, 100, 200][Save.d.purseLv];
    this.endShown = false;
    this.loadLevel(0);
  },
  loadLevel(bi) {
    const r = this.run; r.biome = bi;
    Save.d.bestBiome = Math.max(Save.d.bestBiome, bi); Save.write();
    if (bi >= 1) Ach.unlock('ACH_AQUEDUCT'); if (bi >= 2) Ach.unlock('ACH_RAMPARTS'); if (bi >= 3) Ach.unlock('ACH_CRYPT');
    const L = this.level = genLevel(bi, r.seed + bi * 7919);
    Art.renderLevel(L); L.fog = makeCanvas(L.tw, L.th);
    this.bg = Art.makeBG(bi);
    this.enemies = []; this.projs = []; this.objs = []; this.bolts = []; this.corpses = []; this.decoy = null; FX.clear();
    for (const o of L.objs) { const ob = this.makeObj(o, bi); if (ob) this.objs.push(ob); }
    for (const s of L.spawns) this.enemies.push(new Enemy(s.type, s.x, s.y, s.elite));
    this.boss = null;
    if (L.boss) this.enemies.push(this.boss = new Warden(L.boss.x, L.boss.y));
    this.solids = this.objs.filter(o => o.solid);
    const p = this.player; p.spawn(L.spawn.x, L.spawn.y); p.wickUsed = false; p.flask = p.flaskMax; p.surge = Math.max(p.surge, 0);
    this.snapCam(); this.victoryT = 0; this.mapOpen = false; $('bigmap').hidden = true;
    Music.start(L.boss ? 4 : BIOMES[bi].song);
    $('hud').hidden = false; $('bossbar').hidden = true; UI.showScreen(null);
    UI.banner(BIOMES[bi].name, BIOMES[bi].sub);
    this.state = 'play'; Input.clear();
  },
  makeObj(o, bi) {
    switch (o.type) {
      case 'exit': return new ExitDoor(o.x, o.y, false);
      case 'entry': return new ExitDoor(o.x, o.y, true);
      case 'chest': return new Chest(o.x, o.y, false);
      case 'cursed': return new Chest(o.x, o.y, true);
      case 'merchant': return new Merchant(o.x, o.y);
      case 'shopitem': return new ShopItem(o.x, o.y, o.food);
      case 'scroll': return new Pickup(o.x, o.y, 'scroll', { vx: 0, vy: 0 });
      case 'item': return new Pickup(o.x, o.y, 'item', { item: randomItem(bi + 1 + (Math.random() < .3 ? 1 : 0), Math.random() < .35 ? 'skill' : null), vx: 0, vy: 0 });
      case 'food': return new Pickup(o.x, o.y, 'food', { food: FOODS[Math.min(2, bi)], vx: 0, vy: 0 });
      case 'door': return new Door(o.x, o.y, o.h);
      case 'vase': return new Vase(o.x, o.y);
    }
    return null;
  },
  exitLevel() {
    if (this.level.B.boss) return this.victory();
    SND.play('door');
    this.player.flask = this.player.flaskMax;
    UI.showKeeper();
  },
  nextBiome() { this.loadLevel(this.run.biome + 1); },
  bossIntro(b) {
    $('bossbar').hidden = false; Music.start(3);
    UI.banner('The Warden', 'Keeper of the last key');
  },
  onBossDeath() {
    $('bossbar').hidden = true; this.victoryT = 2.6;
    UI.toast('The Warden is slain');
  },
  victory() {
    const d = Save.d, r = this.run;
    d.wins++; d.kills += r.kills; d.emberMax = Math.max(d.emberMax, Math.min(3, r.ember + 1));
    if (!d.bestTime || r.time < d.bestTime) d.bestTime = Math.round(r.time);
    Save.write(); Music.start(4); SND.play('scroll');
    Ach.unlock('ACH_WARDEN');
    for (let e = 1; e <= 3; e++) if (r.ember >= e) Ach.unlock('ACH_EMBER_' + e);
    if (r.flasksUsed === 0) Ach.unlock('ACH_DRY_WICK');
    if (r.time < 720) Ach.unlock('ACH_QUICK_BURN');
    Ach.checkMeta();
    UI.showEnd(true);
  },
  onPlayerDeath() {
    Save.d.kills += this.run.kills; Save.write();
    Music.start(4);
    UI.showEnd(false);
  },
  toggleMap() { if (this.state !== 'play') return; this.mapOpen = !this.mapOpen; $('bigmap').hidden = !this.mapOpen; },

  // ---------- update ----------
  update(dt) {
    this.time += dt;
    Input.update();
    UI.tick(dt);
    if (this.state === 'title') { UI.padMenu(); this.titleUpdate(dt); return; }
    if (this.state !== 'play') { UI.padMenu(); return; }
    if (Input.pressed.pause) { UI.pause(); return; }
    if (Input.pressed.map) this.toggleMap();
    this.shake = Math.max(0, this.shake - dt * 28);
    this.hurtFlash = Math.max(0, this.hurtFlash - dt);
    if (this.hitstop > 0) { this.hitstop -= dt; return; }
    let sdt = dt;
    if (this.slowmo > 0) { this.slowmo -= dt; sdt = dt * .35; }
    this.run.time += sdt;
    const p = this.player;
    p.update(sdt);
    // interaction
    this.nearObj = null;
    if (p.alive && p.state !== 'roll') {
      let bd = 1e9; const pcx = p.x + p.w / 2, pcy = p.y + p.h / 2;
      for (const o of this.objs) {
        if (o.dead || !o.interactive) continue;
        const range = o instanceof ExitDoor ? 28 : o instanceof Door ? 18 : 20;
        const d = dist(pcx, pcy, o.x + o.w / 2, o.y + o.h / 2);
        if (d < range && d < bd) { bd = d; this.nearObj = o; }
      }
    }
    if (this.nearObj && Input.pressed.interact) this.nearObj.interact();
    for (const e of this.enemies) e.update(sdt);
    this.separate(sdt);
    this.enemies = this.enemies.filter(e => !e.dead);
    for (const pr of this.projs) pr.update(sdt);
    this.projs = this.projs.filter(pr => !pr.dead);
    for (const o of this.objs) o.update(sdt);
    this.objs = this.objs.filter(o => !o.dead);
    this.solids = this.objs.filter(o => o.solid);
    FX.update(sdt);
    for (const c of this.corpses) {
      c.t += sdt;
      if (c.t > .5 && Math.random() < .5) { const e = c.e; FX.add({ x: e.x + rnd(0, e.w), y: e.y + rnd(0, e.h), vx: rnd(-10, 10), vy: -rnd(20, 50), life: .6, col: pick(HIT_COLS[e.type] || ['#888']), size: 1, grav: -20 }); }
    }
    this.corpses = this.corpses.filter(c => c.t < 1.15);
    if (this.decoy && this.decoy.dead) this.decoy = null;
    this.ultFlash = Math.max(0, this.ultFlash - dt);
    for (const b of this.bolts) b.life -= sdt;
    this.bolts = this.bolts.filter(b => b.life > 0);
    this.updateCam(sdt);
    this.revealT -= dt; if (this.revealT <= 0) { this.revealT = .15; this.reveal(); }
    if (this.victoryT > 0) {
      this.victoryT -= dt;
      if (this.victoryT <= 0) {
        const L = this.level, door = new ExitDoor(L.pw / 2, L.bossFloor, false); this.objs.push(door);
        FX.burst(L.pw / 2, L.bossFloor - 20, 40, ['#ffcf6a', '#ff9a3c'], 120, .8, { glow: '#ff9a3c' }); SND.play('scroll');
        UI.toast('The crypt gate opens. Claim the last key.', 3);
      }
    }
    if (!p.alive && p.deadT > 1.8 && !this.endShown) { this.endShown = true; this.onPlayerDeath(); }
  },
  separate(dt) {
    const es = this.enemies;
    for (let i = 0; i < es.length; i++) for (let j = i + 1; j < es.length; j++) {
      const a = es[i], b = es[j];
      if (a.fly || b.fly || a.type === 'warden' || b.type === 'warden' || !overlap(a, b)) continue;
      const d = sign(a.cx - b.cx) || 1, push = 30 * dt;
      if (!rectSolid(a.x + d * push, a.y, a.w, a.h)) a.x += d * push;
      if (!rectSolid(b.x - d * push, b.y, b.w, b.h)) b.x -= d * push;
    }
  },
  clampCam() {
    const L = this.level;
    this.cam.x = clamp(this.cam.x, 0, Math.max(0, L.pw - W)); this.cam.y = clamp(this.cam.y, 0, Math.max(0, L.ph - H));
  },
  snapCam() { const p = this.player; this.look = p.face * 30; this.cam.x = p.x + p.w / 2 + this.look - W / 2; this.cam.y = p.y + p.h / 2 - H / 2 - 10; this.clampCam(); },
  updateCam(dt) {
    const p = this.player;
    this.look = approach(this.look, p.face * 32, 80 * dt);
    const tx = p.x + p.w / 2 + this.look - W / 2, ty = p.y + p.h / 2 - H / 2 - 12;
    this.cam.x += (tx - this.cam.x) * Math.min(1, dt * 7);
    this.cam.y += (ty - this.cam.y) * Math.min(1, dt * (p.onGround ? 6 : 3.5));
    if (p.y + p.h - this.cam.y > H - 30) this.cam.y = p.y + p.h - (H - 30);
    if (p.y - this.cam.y < 24) this.cam.y = p.y - 24;
    this.clampCam();
  },
  reveal() {
    const L = this.level, p = this.player; if (!L.fog) return;
    const tx = Math.floor((p.x + p.w / 2) / TS), ty = Math.floor((p.y + p.h / 2) / TS), rx = 17, ry = 10;
    const x0 = clamp(tx - rx, 0, L.tw - 1), x1 = clamp(tx + rx, 0, L.tw - 1), y0 = clamp(ty - ry, 0, L.th - 1), y1 = clamp(ty + ry, 0, L.th - 1);
    L.fog.getContext('2d').drawImage(L.mmBase, x0, y0, x1 - x0 + 1, y1 - y0 + 1, x0, y0, x1 - x0 + 1, y1 - y0 + 1);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) L.seen[y * L.tw + x] = 1;
  },

  // ---------- render ----------
  render() {
    const ctx = this.ctx, L = this.level; if (!L) return;
    const t = this.time;
    let sx = 0, sy = 0;
    if (this.shake > .3 && Save.d.shake) { sx = rnd(-1, 1) * this.shake; sy = rnd(-1, 1) * this.shake; }
    const cx = Math.round(this.cam.x + sx), cy = Math.round(this.cam.y + sy);
    ctx.drawImage(this.bg.sky, 0, 0);
    for (const ly of this.bg.layers) {
      const BW = ly.c.width, BH = ly.c.height;
      let ox = -((cx * ly.f) % BW); if (ox > 0) ox -= BW;
      const oy = clamp(H - BH + (L.ph - H - cy) * ly.f * .35, H - BH, 0);
      ctx.drawImage(ly.c, Math.round(ox), Math.round(oy)); ctx.drawImage(ly.c, Math.round(ox + BW), Math.round(oy));
    }
    const vx = clamp(cx, 0, L.pw - W), vy = clamp(cy, 0, L.ph - H);
    ctx.drawImage(L.canvas, vx, vy, Math.min(W, L.pw), Math.min(H, L.ph), vx - cx, vy - cy, Math.min(W, L.pw), Math.min(H, L.ph));
    ctx.save(); ctx.translate(-cx, -cy);
    const onScreen = (x, y, m = 40) => x > cx - m && x < cx + W + m && y > cy - m && y < cy + H + m;
    const flameKind = L.bi === 1 ? 'blue' : 'normal';
    for (const d of L.decor) {
      if (!onScreen(d.x, d.y)) continue;
      if (d.kind === 'torch') drawFlame(ctx, d.x, d.y - 1, t + d.x * .1, flameKind, 1);
      else if (d.flames) for (const f of d.flames) { const h = Math.sin(t * 15 + f.x) > 0 ? 3 : 2; ctx.fillStyle = '#ffab3d'; ctx.fillRect(f.x - 1, f.y - h, 2, h); ctx.fillStyle = '#fff3a8'; ctx.fillRect(f.x, f.y - h + 1, 1, h - 1); }
    }
    for (const o of this.objs) if (!(o instanceof Pickup) && onScreen(o.x, o.y, 60)) o.draw(ctx, t);
    for (const o of this.objs) if (o instanceof Pickup && onScreen(o.x, o.y)) o.draw(ctx, t);
    for (const c of this.corpses) {
      const e = c.e; if (!onScreen(e.x, e.y, 60)) continue;
      const ox = e.x + e.w / 2, oy = e.y + e.h, k = Math.min(1, c.t / .25), fade = 1 - clamp((c.t - .45) / .7, 0, 1);
      ctx.save(); ctx.globalAlpha = fade; ctx.translate(ox, oy); ctx.rotate(-e.face * k * (e.fly ? .6 : 1.35)); ctx.translate(-ox, -oy + k * (e.fly ? -4 : 0));
      drawEnemy(ctx, e, t); ctx.restore(); ctx.globalAlpha = 1;
    }
    for (const e of this.enemies) {
      if (!onScreen(e.x, e.y, 60)) continue;
      if (e.type === 'archer' && e.state === 'wind') {
        const k = 1 - e.t / e.wt, a = e.aim || 0;
        ctx.fillStyle = `rgba(255,70,50,${.25 + k * .6})`;
        for (let d = 10; d < 110; d += 4) ctx.fillRect(Math.round(e.cx + Math.cos(a) * d * e.face), Math.round(e.y + 7 + Math.sin(a) * d), 1, 1);
      }
      drawEnemy(ctx, e, t); drawEnemyExtras(ctx, e, t);
    }
    if (this.player && this.state !== 'title' || this.state === 'title') drawPlayer(ctx, this.player, t);
    for (const pr of this.projs) pr.draw(ctx);
    FX.draw(ctx);
    for (const b of this.bolts) this.drawBolt(ctx, b);
    ctx.restore();
    this.renderLights(cx, cy);
    FX.drawNums(ctx, cx, cy);
    if (this.nearObj && this.state === 'play') {
      const o = this.nearObj, key = Input.label('interact'), lbl = o.label();
      const tx = o.x + o.w / 2 - cx, ty = o.y - 12 - cy, full = key + '  ' + lbl, w = textWidth(full);
      ctx.fillStyle = 'rgba(10,8,14,.85)'; ctx.fillRect(Math.round(tx - w / 2) - 3, Math.round(ty) - 3, w + 6, 11);
      drawText(ctx, key, tx - w / 2, ty, '#ff9a3c', 1, 'left', null); drawText(ctx, lbl, tx - w / 2 + textWidth(key) + 8, ty, '#ecdcb4', 1, 'left', null);
    }
    ctx.drawImage(this.vignette, 0, 0);
    const p = this.player;
    if (this.state !== 'title' && p) {
      if (p.curse > 0) { ctx.globalAlpha = .6 + Math.sin(t * 4) * .2; ctx.drawImage(this.purpleVig, 0, 0); ctx.globalAlpha = 1; }
      if (p.alive && p.hp / p.maxHp < .25) { ctx.globalAlpha = .45 + Math.sin(t * 6) * .3; ctx.drawImage(this.redVig, 0, 0); ctx.globalAlpha = 1; }
      if (this.ultFlash > 0) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = this.ultFlash * .5; ctx.fillStyle = this.ultCol; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
      if (this.hurtFlash > 0) { ctx.fillStyle = `rgba(200,20,30,${this.hurtFlash * .45})`; ctx.fillRect(0, 0, W, H); }
    }
  },
  drawBolt(ctx, b) {
    const n = 7, pts = [];
    for (let i = 0; i <= n; i++) { const k = i / n; pts.push([lerp(b.x1, b.x2, k) + (i && i < n ? rnd(-5, 5) : 0), lerp(b.y1, b.y2, k) + (i && i < n ? rnd(-5, 5) : 0)]); }
    ctx.globalAlpha = clamp(b.life * 8, 0, 1);
    ctx.strokeStyle = '#5aa8ff'; ctx.lineWidth = 3; ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke();
    ctx.strokeStyle = '#f0faff'; ctx.lineWidth = 1; ctx.stroke(); ctx.globalAlpha = 1;
  },
  renderLights(cx, cy) {
    const lx = this.lightX, L = this.level;
    lx.globalCompositeOperation = 'source-over'; lx.globalAlpha = 1; lx.fillStyle = L.B.ambient; lx.fillRect(0, 0, W, H);
    lx.globalCompositeOperation = 'lighter';
    const add = (x, y, r, col, a = 1) => {
      const X = x - cx, Y = y - cy; if (X < -r || X > W + r || Y < -r || Y > H + r || !col) return;
      lx.globalAlpha = clamp(a, 0, 1); lx.drawImage(Art.light(col), X - r, Y - r, r * 2, r * 2);
    };
    const p = this.player, t = this.time;
    if (p) {
      const fl = Math.sin(t * 13) * 4 + Math.sin(t * 7.3) * 3;
      const dead = p.state === 'dead' ? Math.max(0, 1 - p.deadT) : 1;
      add(p.x + p.w / 2, p.y, (108 + fl + (p.surge >= 100 ? 14 : 0)) * (.4 + .6 * dead), p.curse > 0 ? '#b04ae0' : FLAME_LIGHT[p.skin.flame] || '#ffb060', .95 * dead + .2);
      if (p.ward) add(p.x + p.w / 2, p.y + 11, 50, '#ffd070', .5);
      if (p.blades) add(p.x + p.w / 2, p.y + 11, 60, '#b8e8ff', .45);
      if (p.phantomT > 0) add(p.x + p.w / 2, p.y + 11, 70, '#c8f0ff', .5);
      add(p.x + p.w / 2, p.y - 4, 28, '#fff3c0', .5 * dead);
    }
    for (const l of L.lights) add(l.x, l.y, l.r + (l.flick ? Math.sin(t * 9 + l.x) * 4 : 0), l.col, .85);
    for (const o of this.objs) if (!o.dead && o.light) { const ll = o.light(); if (ll) add(o.x + o.w / 2, o.y + o.h / 2, ll[1], ll[0], .8); }
    for (const pr of this.projs) { const c = pr.light(); if (c) add(pr.x, pr.y, 36, c, .8); }
    for (const e of this.enemies) {
      if (e.elite) add(e.cx, e.cy, 50, '#ffcf3a', .5);
      if (e.type === 'caster') add(e.cx, e.cy, 44, '#c77dff', .6);
      if (e.burn > 0) add(e.cx, e.cy, 30, '#ff8a3a', .6);
      if (e.frozen > 0) add(e.cx, e.cy, 30, '#8fdcff', .5);
      if (e.type === 'warden') { add(e.cx - e.face * 12, e.y + e.h - 14, 70, '#ffb45a', .7); add(e.cx, e.y + 8, 30, e.enraged ? '#ff2a2a' : '#ff8a3a', .6); }
      if (e.state === 'wind') add(e.cx, e.cy, 36, '#ff6a2a', .5);
      if (e.type === 'hound' || e.type === 'bloat') add(e.cx, e.y, 40, e.state === 'wind' ? '#ff3a2a' : '#ffb060', .7);
      if (e.type === 'gargoyle' && e.state !== 'perch') add(e.cx + e.face * 5, e.y + 3, 22, '#ff4a3a', .5);
    }
    for (const b of this.bolts) add((b.x1 + b.x2) / 2, (b.y1 + b.y2) / 2, 70, '#9fd8ff', b.life * 5);
    FX.lights(add);
    lx.globalAlpha = 1; lx.globalCompositeOperation = 'source-over';
    const ctx = this.ctx;
    ctx.globalCompositeOperation = 'multiply'; ctx.drawImage(this.lightC, 0, 0);
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .12; ctx.drawImage(this.lightC, 0, 0);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  },

  loop(now) {
    const dt = Math.min(.1, (now - this.lastT) / 1000 || 0); this.lastT = now;
    this.acc += dt; const STEP = 1 / 60;
    let n = 0;
    while (this.acc >= STEP && n < 6) { this.update(STEP); this.acc -= STEP; n++; }
    if (n >= 6) this.acc = 0;
    try { this.render(); } catch (e) { console.error(e); }
    if (UI.screen === 'screen-wardrobe' || UI.screen === 'screen-keeper' || UI.screen === 'screen-pause') UI.tickPreviews(this.time);
    if (this.state === 'play' || this.state === 'menu') {
      UI.updateHUD();
      if (this.boss && !this.boss.dead) $('boss-fill').style.width = (clamp(this.boss.hp / this.boss.maxHp, 0, 1) * 100) + '%';
      this.mmT -= dt; if (this.mmT <= 0) { this.mmT = .1; UI.drawMinimap(); if (this.mapOpen) UI.drawBigMap(); }
    }
    requestAnimationFrame(t => this.loop(t));
  }
};

G.init();
