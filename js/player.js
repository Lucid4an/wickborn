'use strict';
const PC = { RUN: 128, ACC_G: 1600, ACC_A: 1150, GRAV: 1100, JUMP: 335, DJUMP: 305, MAXFALL: 440, ROLL: 235, CLIMB: 85, DASH: 330, WALLSLIDE: 70 };

class Player {
  constructor(skinId) {
    this.w = 10; this.h = 22;
    this.skin = skinById(skinId || Save.d.skin);
    this.slots = [null, null, null, null]; this.cds = [0, 0, 0, 0]; this.cdMax = [1, 1, 1, 1];
    this.stats = { b: 0, t: 0, s: 0 };
    this.gold = 0; this.cells = 0; this.mutations = []; this.curse = 0; this.kills = 0;
    this.flaskMax = 1 + Save.d.flaskLv; this.flask = this.flaskMax;
    this.maxHp = 100; this.hp = 100; this.rally = 0; this.rallyT = 0;
    this.balStacks = 0; this.balT = 0; this.tempo = 0; this.tempoT = 0;
    this.surge = 0; this.wickUsed = false; this.anim = 0; this.climbAnim = 0; this.ghosts = [];
    this.spawn(0, 0);
  }
  spawn(x, y) {
    this.x = x - this.w / 2; this.y = y - this.h; this.vx = 0; this.vy = 0; this.face = 1;
    this.state = 'normal'; this.atk = null; this.onGround = false; this.coyote = 0; this.jumpBuf = 0; this.jumps = 1;
    this.invuln = 1; this.rollT = 0; this.rollCd = 0; this.dropT = 0; this.dropping = false; this.climbing = false;
    this.comboT = 0; this.comboSlot = -1; this.comboStep = 0; this.parryT = 0; this.hurtT = 0; this.healT = 0; this.flameBoost = 0; this.deadT = 0;
    this.stepT = 0; this.airDash = true; this.wallDir = 0; this.wallCoyote = 0; this.lastWall = 0; this.wallLock = 0;
    this.sq = 0; this.ghosts = []; this.ghostT = 0; this.ward = null; this.blades = null; this.phantomT = 0;
  }
  get alive() { return this.state !== 'dead'; }
  hurtbox() { return this.state === 'roll' ? { x: this.x, y: this.y + 10, w: this.w, h: this.h - 10 } : this; }
  has(m) { return this.mutations.includes(m); }
  slotOf(id) { return this.slots.find(s => s && s.id === id); }
  statMult(s) { return 1 + 0.15 * this.stats[s]; }
  recalcHp(healDiff = true) {
    const old = this.maxHp;
    this.maxHp = Math.round(100 * (1 + 0.1 * (this.stats.b + this.stats.t) + 0.3 * this.stats.s));
    if (healDiff) this.hp = Math.min(this.maxHp, this.hp + Math.max(0, this.maxHp - old));
  }
  heal(v) { const before = this.hp; this.hp = Math.min(this.maxHp, this.hp + v); this.rally = 0; FX.num(this.x + 5, this.y - 4, this.hp - before, '#6aff8a'); FX.burst(this.x + 5, this.y + 10, 14, ['#6aff8a', '#caffda'], 50, .7, { grav: -60, glow: '#4fc466' }); }
  addSurge(v) {
    if (this.surge >= 100) return;
    this.surge = Math.min(100, this.surge + v);
    if (this.surge >= 100) { SND.play('surge'); UI.toast(ULTS[this.skin.ult].name + ' is ready. Press ' + Input.label('ult') + '.', 1.8); }
  }

  // ---- damage calculations ----
  weaponDmg(it, base, e, crit) {
    let d = base * tierMult(it) * this.statMult(it.def.stat);
    if (it.affix === 'dmg') d *= 1.2;
    if (it.def.stacking) d *= 1 + 0.12 * this.balStacks;
    if (this.has('farsight') && ['bow', 'frost', 'spark'].includes(it.def.kind)) d *= 1.35;
    if (this.has('bully') && e && e.disabled()) d *= 1.4;
    if (this.phantomT > 0) d *= 1.3;
    if (crit) d *= 2;
    return d;
  }
  skillDmg(it) {
    if (!it) return 10;
    let d = it.def.dmg * tierMult(it) * this.statMult(it.def.stat);
    if (it.affix === 'dmg') d *= 1.2;
    return d;
  }
  critFor(it, step, e, reach) {
    const c = it.def.crit, cx = this.x + this.w / 2, ex = e.x + e.w / 2;
    let crit = false;
    if (c === 'combo') crit = step >= 2;
    else if (c === 'behind') crit = sign(ex - cx) === e.face;
    else if (c === 'tip') crit = Math.abs(ex - cx) > reach * 0.55;
    else if (c === 'disabled') crit = e.disabled();
    else if (c === 'last') crit = step === it.def.combo.length - 1;
    else if (c === 'bleeding') crit = e.bleed > 0;
    if (!crit && it.affix === 'critc') crit = Math.random() < .15;
    return crit;
  }
  onHitEnemy(e, dmg, o) {
    if (this.rally > 0) { const amt = Math.min(this.rally, dmg * (this.has('bloodlust') ? 0.6 : 0.3)); this.hp = Math.min(this.maxHp, this.hp + amt); this.rally -= amt; }
    if (o.item && o.item.def.stacking) { this.balStacks = Math.min(10, this.balStacks + 1); this.balT = 1.5; }
    if (o.crit && o.item && o.item.affix === 'leech') this.hp = Math.min(this.maxHp, this.hp + this.maxHp * .02);
    if (o.src !== 'ult') this.addSurge(dmg * .4 / (1 + .65 * Math.min(G.run.biome, 2)));
    this.flameBoost = 2;
  }
  onKill(e) {
    this.kills++; G.run.kills++; Ach.unlock('ACH_FIRST_SNUFF');
    if (e.elite) Save.d.elites = (Save.d.elites || 0) + 1;
    if (G.run.kills % 25 === 0) Ach.checkMeta();
    this.addSurge(e.elite ? 25 : 5);
    if (this.curse > 0) { this.curse--; if (this.curse === 0) { Ach.unlock('ACH_UNCURSED'); UI.toast('The curse is lifted'); SND.play('scroll'); FX.burst(this.x + 5, this.y + 10, 30, ['#e0c0ff', '#a960ea'], 120, .7, { glow: '#a960ea' }); } }
    if (this.has('feast')) this.hp = Math.min(this.maxHp, this.hp + this.maxHp * .04);
    if (this.has('tempo')) { this.tempo = Math.min(3, this.tempo + 1); this.tempoT = 5; }
  }

  hurt(dmg, o = {}) {
    if (!this.alive || G.state !== 'play') return 'ignored';
    if (this.invuln > 0 || this.phantomT > 0 || ['roll', 'mantle', 'dash', 'ultdash'].includes(this.state) || (this.state === 'plunge' && !o.dot)) return 'ignored';
    let blocked = false;
    if (this.state === 'block' && !o.dot) {
      const sx = o.src && o.src.x != null ? o.src.x + (o.src.w || 0) / 2 : this.x - o.dir;
      const from = sign(sx - (this.x + this.w / 2)) || -o.dir || this.face;
      if (from === this.face && !o.boom) {
        if (this.parryT > 0) {
          SND.play('parry'); G.hitstop = .12; G.addShake(3); FX.flash(this.x + 5 + this.face * 8, this.y + 8, 60, '#fff6c0', .25);
          FX.burst(this.x + 5 + this.face * 8, this.y + 8, 16, ['#fff6c0', '#ffe070'], 140, .35, { glow: '#fff6c0' });
          if (o.src && o.src.stunMe) o.src.stunMe(1.6);
          this.parryT = 0; this.invuln = .15; this.addSurge(12);
          G.run.parries++; if (G.run.parries >= 10) Ach.unlock('ACH_STEADY_HAND');
          return 'parried';
        }
        blocked = true; dmg *= 0.25; SND.play('block');
        FX.burst(this.x + 5 + this.face * 7, this.y + 9, 8, '#ffe070', 100, .2);
        this.vx = -this.face * 90;
      }
    }
    if (this.has('ironwax')) dmg *= 0.85;
    if (this.ward && this.curse <= 0) {
      const absorb = Math.min(this.ward.hp, dmg); this.ward.hp -= absorb; dmg -= absorb;
      SND.play('block'); FX.burst(this.x + 5, this.y + 11, 10, ['#ffe6a0', '#e8d6ad'], 110, .3);
      if (this.ward.hp <= 0) { this.ward = null; UI.toast('Ward shattered', 1.2); FX.burst(this.x + 5, this.y + 11, 24, ['#ffe6a0', '#b89f76'], 150, .5); }
      if (dmg <= 0) { this.invuln = .25; return 'blocked'; }
    }
    dmg = Math.max(1, Math.round(dmg));
    if (this.curse > 0) { dmg = this.hp; this.curse = 0; UI.toast('The curse claims you'); }
    this.hp -= dmg; G.run.dmgTaken += dmg;
    this.rally = Math.min(this.rally + dmg, this.maxHp - Math.max(0, this.hp)); this.rallyT = 2.2;
    FX.num(this.x + 5, this.y - 4, dmg, '#ff5a5a', !blocked);
    if (this.hp <= 0) {
      if (this.has('secondwick') && !this.wickUsed) { this.wickUsed = true; this.hp = Math.round(this.maxHp * .3); this.rally = 0; UI.toast('Second Wick! You cling to life.', 2); SND.play('heal'); this.invuln = 1.5; return 'hit'; }
      this.die(); return 'hit';
    }
    if (blocked) { this.invuln = .2; return 'blocked'; }
    SND.play('hurt'); G.addShake(5); G.hitstop = Math.max(G.hitstop, .06); G.hurtFlash = .35;
    this.invuln = .9;
    if (!o.dot) { this.atk = null; this.state = 'hurt'; this.hurtT = .22; this.vx = (o.dir || -this.face) * 150; this.vy = -160; this.wallDir = 0; }
    FX.burst(this.x + 5, this.y + 10, 10, ['#ff5a5a', '#8a1a1a'], 110, .4);
    return 'hit';
  }
  die() {
    this.hp = 0; this.state = 'dead'; this.atk = null; this.deadT = 0; this.vx = (this.vx || 0) * .4; this.vy = -180;
    this.ward = null; this.blades = null; this.phantomT = 0;
    SND.play('die'); G.addShake(8); G.hitstop = .2; G.slowmo = 1.2;
    const fc = FLAMES[this.skin.flame] || FLAMES.normal;
    FX.burst(this.x + 5, this.y + 4, 40, [fc[0], fc[1], fc[2], '#555'], 140, 1, { grav: -40, glow: FLAME_LIGHT[this.skin.flame] });
  }

  // ---- actions ----
  tryHeal() {
    if (this.flask <= 0) { SND.play('deny'); UI.toast('Flask is empty'); return; }
    if (this.hp >= this.maxHp) { SND.play('deny'); return; }
    this.flask--; this.healT = .4; this.atk = null; SND.play('heal');
    this.heal(this.maxHp * .6); G.run.flasksUsed++;
  }
  useUlt() {
    if (this.surge < 100) { SND.play('deny'); return; }
    if (!['normal', 'block'].includes(this.state)) return;
    this.surge = 0; this.atk = null; if (this.state === 'block') this.state = 'normal';
    SND.play('ult'); G.hitstop = Math.max(G.hitstop, .08); G.ultFlash = .5; G.ultCol = FLAME_LIGHT[this.skin.flame];
    UI.banner(ULTS[this.skin.ult].name, '', 1.1);
    ULT_FX[this.skin.ult](this);
    G.run.ults++; Save.d.ultsTotal = (Save.d.ultsTotal || 0) + 1; if (Save.d.ultsTotal >= 50) Ach.unlock('ACH_SURGE_50');
  }
  startRoll(dir) {
    this.state = 'roll'; this.rollT = 0; this.rollDur = this.has('quickstep') ? .37 : .3; this.rollDir = dir; this.atk = null; this.face = dir;
    SND.play('roll'); FX.burst(this.x + 5, this.y + this.h, 6, '#8a8090', 40, .3, { grav: -20 });
  }
  startDash(dir) {
    this.state = 'dash'; this.dashT = .16; this.dashDir = dir; this.face = dir; this.atk = null; this.airDash = false; this.vy = 0;
    SND.play('dash'); FX.burst(this.x + 5, this.y + 11, 10, this.skin.pal.trail, 80, .3, { dir: dir > 0 ? Math.PI : 0, spread: .6, grav: 0, glow: this.skin.pal.trail });
  }
  useWeapon(i) {
    const it = this.slots[i]; if (!it) return;
    const def = it.def;
    if (def.kind === 'shield') return;
    if (this.state !== 'normal' || this.healT > 0) return;
    if (def.cd && this.cds[i] > 0) { SND.play('deny'); return; }
    if (this.atk) {
      if (this.atk.slot === i) this.atk.queued = true;
      else if (this.atk.phase === 'rec') { this.atk = null; this.startAttack(i, 0); }
      else this.atk.queuedOther = i;
      return;
    }
    let step = 0;
    if (this.comboSlot === i && this.comboT > 0) step = (this.comboStep + 1) % def.combo.length;
    this.startAttack(i, step);
  }
  startAttack(i, step) {
    const it = this.slots[i];
    this.atk = { slot: i, item: it, step, stepDef: it.def.combo[step], phase: 'wind', t: 0, hitSet: new Set(), queued: false };
    const dir = (Input.down.right ? 1 : 0) - (Input.down.left ? 1 : 0);
    if (dir) this.face = dir;
    this.wallDir = 0;
  }
  useSkill(i) {
    const it = this.slots[i]; if (!it) return;
    if (this.state !== 'normal' || this.healT > 0) return;
    if (this.cds[i] > 0) { SND.play('deny'); return; }
    if (this.atk && this.atk.phase !== 'rec') return;
    this.atk = null;
    const ok = it.def.use.call(it.def, this);
    if (ok === false) return;
    this.cds[i] = it.def.cd * (this.has('tinker') ? .7 : 1) * (it.affix === 'cdr' ? .75 : 1);
    this.cdMax[i] = this.cds[i];
  }
  onActStart(a) {
    const it = a.item, def = it.def, st = a.stepDef, cx = this.x + this.w / 2;
    if (def.kind === 'melee') {
      SND.play(st.sfx || 'swing');
      if (this.onGround) this.vx = this.face * st.lunge;
      if (st.shock && this.onGround) for (const d of [-1, 1]) G.projs.push(new Proj({ x: cx + d * 16, y: this.y + this.h - 1, vx: d * 210, owner: 'player', kind: 'shock', life: .45, r: 5, item: it, dmgFn: (e, c) => this.weaponDmg(it, st.dmg * .5, e, c), critFn: e => e.disabled(), pierce: 9, kb: 80 }));
    } else if (def.kind === 'bow') {
      SND.play(def.proj === 'knife' ? 'stab' : 'bow');
      const n = st.count || 1, spr = st.spread || 0;
      for (let k = 0; k < n; k++) {
        const ang = n > 1 ? (k - (n - 1) / 2) * spr : rnd(-spr, spr), sp = st.speed;
        G.projs.push(new Proj({
          x: cx + this.face * 8, y: this.y + 9, vx: this.face * sp * Math.cos(ang), vy: sp * Math.sin(ang), owner: 'player', kind: def.proj || 'arrow', item: it, kb: 40,
          dmgFn: (e, c) => this.weaponDmg(it, st.dmg, e, c), critFn: e => (def.crit === 'bleeding' && e.bleed > 0) || (it.affix === 'critc' && Math.random() < .15),
          burn: it.affix === 'burn', bleed: it.affix === 'bleed' || def.bleedAlways
        }));
      }
      if (!this.onGround) this.vy = Math.min(this.vy, 20);
    } else if (def.kind === 'frost') {
      SND.play('freeze'); this.cds[a.slot] = def.cd * (it.affix === 'cdr' ? .75 : 1); this.cdMax[a.slot] = this.cds[a.slot];
      for (let k = 0; k < 40; k++) { const d = rnd(4, st.reach), sp = rnd(-.45, .45); FX.add({ x: cx + this.face * 6, y: this.y + 9, vx: this.face * d * 4 * Math.cos(sp), vy: d * 4 * Math.sin(sp), life: .25, col: pick(['#bfefff', '#8fdcff', '#fff']), drag: 4, glow: k % 8 ? null : '#8fdcff' }); }
      for (const e of G.enemies) {
        if (e.dead) continue;
        const dx = (e.x + e.w / 2 - cx) * this.face, dy = Math.abs(e.y + e.h / 2 - (this.y + 9));
        if (dx > -6 && dx < st.reach && dy < 12 + dx * .5) e.hurt(this.weaponDmg(it, st.dmg, e, false), { dir: this.face, kb: 20, freeze: 2, item: it });
      }
    } else if (def.kind === 'spark') {
      let first = null, bd = st.reach;
      for (const e of G.enemies) {
        if (e.dead) continue; const dx = (e.x + e.w / 2 - cx) * this.face, d = dist(cx, this.y + 9, e.x + e.w / 2, e.y + e.h / 2);
        if (dx > -8 && d < bd && losClear(cx, this.y + 9, e.x + e.w / 2, e.y + e.h / 2)) { bd = d; first = e; }
      }
      SND.play('zap');
      if (!first) { G.addBolt(cx + this.face * 6, this.y + 9, cx + this.face * 40, this.y + 9 + rnd(-6, 6)); return; }
      const hitE = (e, fx, fy) => { G.addBolt(fx, fy, e.x + e.w / 2, e.y + e.h / 2); const c = it.affix === 'critc' && Math.random() < .15; e.hurt(this.weaponDmg(it, st.dmg, e, c), { crit: c, dir: this.face, kb: 10, item: it, stun: .08 }); };
      hitE(first, cx + this.face * 6, this.y + 9);
      let second = null, sd = 80;
      for (const e of G.enemies) { if (e.dead || e === first) continue; const d = dist(first.x, first.y, e.x, e.y); if (d < sd) { sd = d; second = e; } }
      if (second) hitE(second, first.x + first.w / 2, first.y + first.h / 2);
    }
  }
  meleeHits(a) {
    const st = a.stepDef, it = a.item, cx = this.x + this.w / 2;
    const up = st.style === 'overhead' || st.style === 'upslash' || st.style === 'upheavy' ? 6 : 0;
    const hb = st.style === 'spin'
      ? { x: cx - st.reach, y: this.y + this.h / 2 - st.hh / 2 - 2, w: st.reach * 2, h: st.hh }
      : { x: this.face > 0 ? cx - 4 : cx - st.reach + 4, y: this.y + this.h / 2 - st.hh / 2 - 2 - up, w: st.reach, h: st.hh + up };
    for (const e of G.enemies) {
      if (e.dead || a.hitSet.has(e) || !overlap(hb, e)) continue;
      a.hitSet.add(e);
      const crit = this.critFor(it, a.step, e, st.reach);
      const dir = st.style === 'spin' ? (sign(e.cx - cx) || this.face) : this.face;
      e.hurt(this.weaponDmg(it, st.dmg, e, crit), { crit, dir, kb: st.kb, stun: st.stun, item: it, src: 'melee' });
      G.hitstop = Math.max(G.hitstop, crit || st.kb > 150 ? .07 : .035);
      if (st.shake) G.addShake(st.shake); else G.addShake(crit ? 3 : 1.5);
    }
    for (const o of G.objs) if (o.breakable && !o.dead && !a.hitSet.has(o) && overlap(hb, o)) { a.hitSet.add(o); o.smash(this.face); }
    if (st.boom && !a.boomed && a.t > st.a * .4) {
      a.boomed = true;
      explode(cx + this.face * 18, this.y + 9, 22, this.weaponDmg(it, st.dmg * .8, null, false), 'player', { item: it });
    }
  }
  updateAttack(dt) {
    const a = this.atk; if (!a) return;
    const spd = (1 + 0.15 * this.tempo) * (this.phantomT > 0 ? 1.15 : 1);
    a.t += dt * spd;
    const st = a.stepDef;
    if (a.phase === 'wind' && a.t >= st.w) { a.phase = 'act'; a.t = 0; this.onActStart(a); if (!this.atk) return; }
    if (a.phase === 'act') {
      if (a.item.def.kind === 'melee') this.meleeHits(a);
      if (a.t >= st.a) { a.phase = 'rec'; a.t = 0; }
    }
    if (a.phase === 'rec') {
      const chain = (a.queued || a.queuedOther != null) && a.t >= st.r * .35;
      if (a.t >= st.r || chain) {
        this.comboSlot = a.slot; this.comboStep = a.step; this.comboT = .4;
        const q = a.queued, qo = a.queuedOther; this.atk = null;
        if (q) this.useWeapon(a.slot); else if (qo != null) { this.comboT = 0; this.useWeapon(qo); }
      }
    }
  }
  tryMantle(dir) {
    if (!dir || this.onGround || this.vy < -60 || this.state !== 'normal' || this.atk) return false;
    const tx = dir > 0 ? Math.floor((this.x + this.w + 2) / TS) : Math.floor((this.x - 2) / TS);
    const L = G.level;
    for (let ty = Math.floor((this.y - 2) / TS); ty <= Math.floor((this.y + 12) / TS); ty++) {
      if (getT(L, tx, ty) === 1 && getT(L, tx, ty - 1) !== 1 && getT(L, tx, ty - 2) !== 1) {
        const topY = ty * TS;
        if (topY < this.y - 6 || topY > this.y + 12) continue;
        const nx = dir > 0 ? tx * TS + 1 : (tx + 1) * TS - this.w - 1, ny = topY - this.h;
        if (rectSolid(nx, ny, this.w, this.h) || rectSolid(this.x, ny, this.w, this.h)) continue;
        this.state = 'mantle'; this.mantle = { fx: this.x, fy: this.y, tx: nx, ty: ny, t: 0 }; this.vx = 0; this.vy = 0; this.wallDir = 0;
        SND.play('step');
        return true;
      }
    }
    return false;
  }
  addGhost() { this.ghosts.push({ x: Math.round(this.x + this.w / 2), y: Math.round(this.y + this.h), f: this.face, P: playerPose(this, G.time), a: 1 }); if (this.ghosts.length > 8) this.ghosts.shift(); }

  update(dt) {
    const I = Input;
    this.invuln = Math.max(0, this.invuln - dt); this.rollCd -= dt; this.comboT -= dt; this.coyote -= dt; this.jumpBuf -= dt;
    this.parryT -= dt; this.healT -= dt; this.dropT -= dt; this.flameBoost = Math.max(0, this.flameBoost - dt * 6);
    this.wallCoyote -= dt; this.wallLock -= dt; this.phantomT = Math.max(0, this.phantomT - dt);
    for (let i = 0; i < 4; i++) this.cds[i] = Math.max(0, this.cds[i] - dt);
    this.rallyT -= dt; if (this.rallyT <= 0 && this.rally > 0) this.rally = Math.max(0, this.rally - this.maxHp * .25 * dt);
    this.balT -= dt; if (this.balT <= 0) this.balStacks = 0;
    this.tempoT -= dt; if (this.tempoT <= 0) this.tempo = 0;
    this.anim += Math.abs(this.vx) * dt * .11;
    this.dropping = this.dropT > 0;
    this.sq = approach(this.sq, 0, dt * 1.6);
    for (const g of this.ghosts) g.a -= dt * 4;
    this.ghosts = this.ghosts.filter(g => g.a > 0);
    const trail = ['roll', 'dash', 'ultdash'].includes(this.state) || this.phantomT > 0;
    if (trail) { this.ghostT -= dt; if (this.ghostT <= 0) { this.ghostT = .035; this.addGhost(); } }
    if (this.ward) { this.ward.t -= dt; if (this.ward.t <= 0) this.ward = null; }
    if (this.blades) this.updateBlades(dt);

    if (this.state === 'dead') {
      this.deadT += dt; this.vy = Math.min(this.vy + PC.GRAV * dt, PC.MAXFALL); this.vx *= 1 - 4 * dt; moveBody(this, dt);
      return;
    }
    if (this.state === 'mantle') {
      const m = this.mantle; m.t += dt / .11;
      this.x = lerp(m.fx, m.tx, clamp(m.t, 0, 1)); this.y = lerp(m.fy, m.ty, clamp(m.t * 1.4, 0, 1));
      if (m.t >= 1) { this.x = m.tx; this.y = m.ty; this.state = 'normal'; this.onGround = true; this.jumps = 1; this.airDash = true; this.sq = .15; }
      return;
    }
    const dir = (I.down.right ? 1 : 0) - (I.down.left ? 1 : 0);
    if (I.pressed.jump) this.jumpBuf = .13;
    if (I.pressed.ult) this.useUlt();

    if (this.state === 'hurt') {
      this.hurtT -= dt; if (this.hurtT <= 0) this.state = 'normal';
      this.vx = approach(this.vx, 0, 600 * dt); this.vy = Math.min(this.vy + PC.GRAV * dt, PC.MAXFALL); moveBody(this, dt);
      return;
    }
    if (this.state === 'ultdash') {
      this.dashT -= dt; this.vx = this.dashDir * 520; this.vy = 0; moveBody(this, dt);
      const hb = { x: this.x - 8, y: this.y - 4, w: this.w + 16, h: this.h + 8 };
      for (const e of G.enemies) if (!e.dead && !this.dashHit.has(e) && overlap(hb, e)) { this.dashHit.add(e); e.hurt(this.dashDmg, { dir: this.dashDir, kb: 320, stun: .6, crit: true, src: 'ult' }); G.hitstop = Math.max(G.hitstop, .05); G.addShake(4); }
      for (const o of G.objs) if (o.breakable && !o.dead && overlap(hb, o)) o.smash(this.dashDir);
      FX.add({ x: this.x + 5 - this.dashDir * 6, y: this.y + rnd(4, 20), vx: -this.dashDir * 80, vy: 0, life: .3, col: pick(['#ff4a3a', '#ffab3d']), glow: '#ff4a3a' });
      if (this.dashT <= 0 || this.hitWall) { this.state = 'normal'; this.vx = this.dashDir * 80; if (this.hitWall) { G.addShake(6); SND.play('thud'); } }
      return;
    }
    if (this.state === 'dash') {
      this.dashT -= dt; this.vx = this.dashDir * PC.DASH; this.vy = 0; moveBody(this, dt);
      if (this.dashT <= 0 || this.hitWall) { this.state = 'normal'; this.vx = this.dashDir * PC.RUN; this.vy = -20; }
      return;
    }
    if (this.state === 'plunge') {
      this.vy = 560; this.vx = 0; moveBody(this, dt);
      if (Math.random() < .8) FX.add({ x: this.x + rnd(0, 10), y: this.y, vx: 0, vy: -40, life: .2, col: '#ffab3d' });
      if (this.onGround) {
        this.state = 'normal'; this.hurtT = 0; this.healT = .18; this.sq = .3;
        const it = this.plungeItem, hb = { x: this.x - 26, y: this.y + this.h - 18, w: this.w + 52, h: 20 };
        SND.play('thud'); G.addShake(6); G.hitstop = .05;
        FX.burst(this.x + 5, this.y + this.h, 24, ['#cfc4ae', '#8a8090', '#ffab3d'], 160, .45, { dir: -Math.PI / 2, spread: 1.4, glow: '#ff8a3a' });
        FX.ring(this.x + 5, this.y + this.h, 34, '#ffab3d', .25);
        for (const e of G.enemies) if (!e.dead && overlap(hb, e)) { const c = e.disabled(); e.hurt(this.weaponDmg(it, it.def.combo[0].dmg * 1.6, e, c), { crit: c, dir: sign(e.x - this.x) || 1, kb: 160, stun: .8, item: it, src: 'melee' }); }
        for (const o of G.objs) if (o.breakable && !o.dead && overlap(hb, o)) o.smash(sign(o.x - this.x));
        this.invuln = Math.max(this.invuln, .15);
      }
      return;
    }
    if (this.state === 'roll') {
      this.rollT += dt;
      this.vx = this.rollDir * PC.ROLL * (this.has('quickstep') ? 1.05 : 1);
      this.vy = Math.min(this.vy + PC.GRAV * dt, PC.MAXFALL);
      moveBody(this, dt);
      if (Math.random() < .5) FX.add({ x: this.x + 5 - this.rollDir * 4, y: this.y + this.h - 2, vx: -this.rollDir * 20, vy: -10, life: .25, col: '#6a6070' });
      if (this.rollT >= this.rollDur) { this.state = 'normal'; this.rollCd = this.has('quickstep') ? 0 : .22; }
      if (this.jumpBuf > 0 && this.onGround) { this.state = 'normal'; this.doJump(); }
      return;
    }
    if (this.state === 'climb') {
      const cx = this.x + this.w / 2;
      this.climbing = true;
      const vdir = (I.down.down ? 1 : 0) - (I.down.up ? 1 : 0);
      this.vy = vdir * PC.CLIMB; this.vx = 0; this.climbAnim += vdir * dt * 12;
      moveBody(this, dt);
      const onLad = ladderAt(cx, this.y + this.h - 2) || ladderAt(cx, this.y + 4);
      if (this.jumpBuf > 0) { this.state = 'normal'; this.climbing = false; this.jumpBuf = 0; this.vy = -PC.JUMP * .8; this.vx = dir * PC.RUN; this.jumps = 1; this.airDash = true; SND.play('jump'); }
      else if (!onLad || (this.onGround && vdir > 0) || (dir && !vdir)) { this.state = 'normal'; this.climbing = false; if (!onLad && vdir < 0) { this.vy = -60; } }
      return;
    }
    this.climbing = false;

    // ---- normal / block ----
    if (I.pressed.heal) this.tryHeal();
    if (I.pressed.roll && this.healT <= 0) {
      if ((this.onGround || this.coyote > 0) && this.rollCd <= 0) { this.startRoll(dir || this.face); return; }
      if (!this.onGround && this.airDash && this.state === 'normal') { this.startDash(dir || (this.wallDir ? -this.wallDir : this.face)); this.wallDir = 0; return; }
    }
    const cx = this.x + this.w / 2;
    if (!this.atk && ((I.down.up && ladderAt(cx, this.y + this.h - 4)) || (I.down.down && this.onGround && ladderAt(cx, this.y + this.h + 4) && !I.down.jump))) {
      const tx = Math.floor(cx / TS); this.x = tx * TS + 8 - this.w / 2; this.state = 'climb'; this.atk = null; this.vx = 0; this.jumps = 1; this.wallDir = 0; return;
    }
    let shieldSlot = -1;
    for (let i = 0; i < 2; i++) if (this.slots[i] && this.slots[i].def.kind === 'shield' && I.down[i ? 'atk2' : 'atk1']) shieldSlot = i;
    if (shieldSlot >= 0 && !this.atk && this.healT <= 0) {
      if (this.state !== 'block') { this.state = 'block'; this.parryT = .22; SND.play('ui'); }
    } else if (this.state === 'block') this.state = 'normal';

    const plungeOK = !this.onGround && I.down.down && this.coyote <= 0;
    for (const [i, act] of [[0, 'atk1'], [1, 'atk2']]) {
      if (!I.pressed[act] || this.state === 'block') continue;
      const it = this.slots[i];
      if (plungeOK && it && it.def.kind === 'melee' && !this.atk) { this.state = 'plunge'; this.plungeItem = it; this.wallDir = 0; this.invuln = Math.max(this.invuln, .1); SND.play('heavy'); return; }
      this.useWeapon(i);
    }
    if (I.pressed.sk1) this.useSkill(2);
    if (I.pressed.sk2) this.useSkill(3);
    this.updateAttack(dt);

    // horizontal
    let target = dir * PC.RUN * (this.phantomT > 0 ? 1.3 : 1);
    const a = this.atk;
    if (a && a.item.def.kind === 'melee') target *= a.phase === 'rec' ? .3 : 0;
    if (a && a.item.def.kind !== 'melee') target *= .45;
    if (this.state === 'block') target *= .35;
    if (this.healT > 0) target *= .3;
    const acc = this.onGround ? PC.ACC_G : PC.ACC_A;
    if (this.wallLock > 0) { /* keep wall-jump momentum */ }
    else if (!(a && a.phase === 'act' && a.item.def.kind === 'melee')) this.vx = approach(this.vx, target, acc * dt);
    else this.vx = approach(this.vx, 0, 900 * dt);
    if (dir && !a && this.state !== 'block' && this.wallLock <= 0) this.face = dir;

    // jumping
    if (this.onGround) { this.coyote = .1; this.jumps = 1; this.airDash = true; }
    if (this.jumpBuf > 0 && this.state !== 'block') {
      if (I.down.down && this.onGround && this.standingOnPlatform()) { this.dropT = .2; this.jumpBuf = 0; this.dropping = true; this.y += 1; }
      else if (this.coyote > 0) this.doJump();
      else if ((this.wallDir || this.wallCoyote > 0) && !a) this.wallJump(this.wallDir || this.lastWall);
      else if (this.jumps > 0 && !(a && a.phase === 'act')) {
        this.jumps--; this.jumpBuf = 0; this.vy = -PC.DJUMP; SND.play('djump'); this.sq = -.2;
        const fc = FLAMES[this.skin.flame] || FLAMES.normal;
        FX.burst(this.x + 5, this.y + this.h, 10, fc, 70, .3, { dir: Math.PI / 2, spread: 1.2, grav: 0, glow: FLAME_LIGHT[this.skin.flame] });
      }
    }
    if (!I.down.jump && this.vy < -120 && this.wallLock <= 0) this.vy = -120 + (this.vy + 120) * .5;
    // gravity
    const g = this.vy > 0 ? PC.GRAV * 1.15 : PC.GRAV;
    this.vy = Math.min(this.vy + g * dt, PC.MAXFALL);
    if (this.wallDir && this.vy > PC.WALLSLIDE) this.vy = PC.WALLSLIDE;
    if (a && a.item.def.kind === 'melee' && a.phase !== 'rec' && this.vy > 0) this.vy = Math.min(this.vy, 90);
    const wasG = this.onGround, fallV = this.vy;
    moveBody(this, dt);
    if (this.hitWall && dir === this.hitWall) this.tryMantle(dir);
    if (this.state !== 'normal') return;
    // wall slide
    this.wallDir = 0;
    if (!this.onGround && dir && !a && this.vy > -40 && !ladderAt(this.x + this.w / 2, this.y + this.h - 4) && rectSolid(this.x + dir, this.y + 4, this.w, this.h - 12)) {
      this.wallDir = dir; this.lastWall = dir; this.wallCoyote = .12; this.jumps = 1; this.airDash = true; this.face = -dir;
      if (Math.random() < .35) FX.add({ x: dir > 0 ? this.x + this.w : this.x, y: this.y + rnd(4, 18), vx: -dir * 10, vy: 10, life: .3, col: '#8a8090' });
    }
    if (this.onGround && !wasG) {
      SND.play('land'); FX.burst(this.x + 5, this.y + this.h, 5, '#8a8090', 40, .25, { dir: -Math.PI / 2, spread: 1.5, grav: 100 });
      this.sq = clamp(fallV / 1400, .08, .3);
    }
    if (this.onGround && Math.abs(this.vx) > 60) { this.stepT -= dt; if (this.stepT <= 0) { this.stepT = .26; SND.play('step'); } }
    if (spikeAt(this.x + 1, this.y, this.w - 2, this.h) && this.invuln <= 0 && this.phantomT <= 0) {
      const r = this.hurt(this.maxHp * .12 + 4, { dir: -this.face, src: null, dot: false });
      if (r === 'hit') { this.vy = -300; this.state = 'normal'; }
    }
  }
  wallJump(wd) {
    this.vy = -320; this.vx = -wd * 190; this.face = -wd; this.wallLock = .16; this.wallDir = 0; this.wallCoyote = 0; this.jumpBuf = 0;
    this.jumps = 1; this.airDash = true; this.sq = -.2; SND.play('walljump');
    FX.burst(wd > 0 ? this.x + this.w : this.x, this.y + 12, 8, '#8a8090', 70, .3, { dir: wd > 0 ? Math.PI : 0, spread: .8, grav: 60 });
  }
  updateBlades(dt) {
    const B = this.blades; B.t -= dt; if (B.t <= 0) { this.blades = null; return; }
    const ox = this.x + this.w / 2, oy = this.y + this.h - 11, t = G.time;
    for (let i = 0; i < 3; i++) {
      const a = t * 5 + i * 2.094, bx = ox + Math.cos(a) * 22, by = oy + Math.sin(a) * 15;
      for (const e of G.enemies) {
        if (e.dead || !overlap({ x: bx - 5, y: by - 5, w: 10, h: 10 }, e)) continue;
        const k = B.hit.get(e) || 0; if (G.time - k < .4) continue;
        B.hit.set(e, G.time);
        e.hurt(this.skillDmg(B.it), { dir: sign(e.cx - ox) || 1, kb: 60, item: B.it, src: 'blade' });
      }
    }
  }
  doJump() {
    this.vy = -PC.JUMP; this.coyote = 0; this.jumpBuf = 0; this.onGround = false; SND.play('jump'); this.sq = -.18;
    FX.burst(this.x + 5, this.y + this.h, 4, '#8a8090', 30, .2, { grav: 50 });
  }
  standingOnPlatform() {
    const y = this.y + this.h + 1, L = G.level;
    const t1 = getT(L, Math.floor((this.x + 1) / TS), Math.floor(y / TS)), t2 = getT(L, Math.floor((this.x + this.w - 1) / TS), Math.floor(y / TS));
    return (t1 === T_PLAT || t1 === 0) && (t2 === T_PLAT || t2 === 0) && (t1 === T_PLAT || t2 === T_PLAT);
  }
}
