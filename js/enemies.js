'use strict';
const HIT_COLS = {
  rotling: ['#7a9a6a', '#4a6a3a', '#5b4a3a'], archer: ['#d8cdb8', '#3b2f4a'], moth: ['#d9c9a0', '#8a7a5a', '#ffcf5a'],
  leaper: ['#6a9a5a', '#a8c27a'], spitter: ['#b6d85a', '#6a8a3a'], shield: ['#9a9aa6', '#6a4a2a'], knight: ['#aab0bb', '#7a808c', '#b3353d'],
  bomber: ['#8a5a3a', '#ff6a2a'], caster: ['#c77dff', '#40305a'], warden: ['#6a6a78', '#ff8a3a', '#3a3a44'],
  hound: ['#3a2a2e', '#e8d6ad', '#ff9a3c'], bloat: ['#d8c9a0', '#b8a47c', '#ffab3d'], hookman: ['#5a4a3a', '#9a9aa6'], gargoyle: ['#6a6a72', '#8a8a94', '#4a4a52']
};

class Enemy {
  constructor(type, x, y, elite) {
    const D = ENEMIES[type], bi = G.run.biome, em = G.run.ember;
    this.type = type; this.D = D; this.elite = !!elite;
    this.maxHp = this.hp = Math.round(D.hp * (type === 'warden' ? 1 : 1 + 0.65 * Math.min(bi, 2)) * (1 + .35 * em) * (elite ? 3.2 : 1));
    this.dmg = D.dmg * (1 + 0.4 * Math.min(bi, 2)) * (1 + .25 * em) * (elite ? 1.25 : 1);
    this.w = D.w; this.h = D.h; this.x = x - this.w / 2; this.y = y - this.h;
    this.fly = !!D.fly; this.vx = 0; this.vy = 0; this.face = Math.random() < .5 ? -1 : 1;
    this.state = type === 'gargoyle' ? 'perch' : 'idle'; if (type === 'gargoyle') this.fly = false;
    this.t = 0; this.t2 = 0; this.aggro = false; this.cool = rnd(.4, 1.2);
    this.burn = 0; this.bleed = 0; this.bleedT = 0; this.dotT = .5; this.frozen = 0; this.stun = 0; this.root = 0; this.flash = 0; this.anim = rnd(0, 6);
    this.homeX = this.x; this.homeY = this.y; this.speed = D.speed * (elite ? 1.1 : 1); this.turnT = 0; this.patrolT = rnd(1, 3);
    this.kbRes = type === 'knight' || type === 'shield' || type === 'hookman' ? .5 : 1;
    this.dead = false; this.didHit = false; this.poise = 0; this.jumpCd = 0; this.dropT = 0; this.alertT = 0; this.windMul = 1;
    this.mod = null;
    if (elite) {
      this.mod = pick(ELITE_MODS).id;
      if (this.mod === 'hasted') { this.speed *= 1.4; this.windMul = .7; }
      if (this.mod === 'warded') { this.wardUp = true; this.wardT = 0; }
    }
    this.tg = null;
  }
  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.h / 2; }
  disabled() { return this.stun > 0 || this.frozen > 0 || this.root > 0; }
  sees(range) {
    const p = this.tg || G.player; if (!p.alive) return false;
    const px = p.x + p.w / 2, py = p.y + 8;
    if (dist(this.cx, this.cy, px, py) > range) return false;
    return losClear(this.cx, this.y + 4, px, py);
  }
  canAttack() {
    const lim = 2 + (G.run.biome >= 2 ? 1 : 0);
    let n = 0;
    for (const o of G.enemies) if (o !== this && !o.dead && o.type !== 'warden' && o.aggro && (o.state === 'wind' || o.state === 'atk')) n++;
    return n < lim;
  }
  tryWind(t, move) {
    if (!this.canAttack()) { this.cool = rnd(.2, .45); return false; }
    this.move = move; this.setState('wind', t); return true;
  }
  stunMe(t) { this.stun = Math.max(this.stun, t); this.state = 'idle'; this.t = 0; this.vx = 0; FX.num(this.cx, this.y - 8, 'STUN', '#ffe56a'); }
  applyBurn(s) { this.burn = Math.max(this.burn, s); }
  hurt(dmg, o = {}) {
    if (this.dead) return;
    let d = dmg;
    if (this.wardUp && o.src !== 'dot') {
      this.wardUp = false; this.wardT = 5; SND.play('block'); FX.burst(this.cx, this.cy, 14, ['#c07af0', '#f0d8ff'], 120, .35, { glow: '#c07af0' });
      FX.num(this.cx, this.y - 2, 'WARD', '#c07af0'); return;
    }
    if (this.type === 'shield' && !this.disabled() && this.state !== 'rec' && this.state !== 'hit' && o.dir && o.dir === -this.face && o.src !== 'boom' && o.src !== 'door' && o.src !== 'trap' && o.src !== 'ult') {
      d *= 0.2; SND.play('block');
      FX.burst(this.cx + this.face * 6, this.cy, 8, ['#ffe070', '#fff'], 110, .2);
      o = Object.assign({}, o, { kb: (o.kb || 0) * .3, stun: 0, crit: false });
    }
    if (this.type === 'gargoyle') {
      if (this.state === 'perch') { d *= .25; this.state = 'wake'; this.t = .3; this.aggro = true; }
      else if (this.state === 'rec') d *= 1.5;
    }
    if (this.mod === 'armored') d *= .6;
    d = Math.max(1, Math.round(d));
    this.hp -= d; this.flash = .09;
    FX.num(this.cx, this.y - 2, d, o.crit ? '#ffb040' : '#ffffff', o.crit);
    FX.burst(this.cx, this.cy, o.crit ? 12 : 6, HIT_COLS[this.type] || '#fff', o.crit ? 150 : 100, .4, { dir: o.dir > 0 ? 0 : o.dir < 0 ? Math.PI : undefined, spread: 1, floor: true });
    SND.play(o.crit ? 'crit' : 'hit');
    const boss = this.type === 'warden';
    if (o.kb) {
      this.vx = (o.dir || 0) * o.kb * this.kbRes * (this.elite ? .5 : 1) * (boss ? .1 : 1);
      if (!this.fly && this.onGround && o.kb > 120 && !boss) this.vy = -90;
      if (this.fly) this.vy = -20;
      this.kbT = .15;
    }
    if (o.freeze && !(boss && this.freezeImm > 0)) { this.frozen = Math.max(this.frozen, boss ? .7 : o.freeze); if (boss) this.freezeImm = 5; this.interrupt(); SND.play('freeze'); }
    if (o.stun && !boss) { this.stun = Math.max(this.stun, o.stun); this.interrupt(); }
    if (o.root && !this.fly) this.root = Math.max(this.root, boss ? 1 : o.root);
    const aff = o.item && o.item.affix, bleedy = o.item && o.item.def.bleedAlways;
    if (o.burn || aff === 'burn') this.applyBurn(3);
    if (o.bleed || aff === 'bleed' || bleedy) { this.bleed = Math.min(6, this.bleed + (o.bleedStacks || 1)); this.bleedT = 4; }
    // flinch (light enemies) or poise break (heavy enemies); wind-ups are never interrupted by plain hits
    if (!boss && this.state !== 'wind' && this.state !== 'atk' && this.state !== 'perch' && this.state !== 'wake') {
      if (this.D.light) { this.state = 'hit'; this.t = o.crit ? .26 : .16; }
      else { this.poise += d; if (this.poise > this.maxHp * .3) { this.poise = 0; this.state = 'hit'; this.t = .6; FX.num(this.cx, this.y - 10, 'STAGGER', '#ffe56a'); } }
    }
    if (!this.aggro) { this.aggro = true; this.alertT = .6; }
    G.player.onHitEnemy(this, d, o);
    if (this.hp <= 0) this.die();
  }
  interrupt() { if (this.type !== 'warden' && (this.state === 'wind' || this.state === 'atk')) { this.state = 'rec'; this.t = .4; } }
  dotDamage(d, col) {
    d = Math.max(1, Math.round(d)); this.hp -= d; FX.num(this.cx, this.y - 2, d, col);
    if (this.hp <= 0) this.die();
  }
  die() {
    if (this.dead) return;
    this.dead = true; this.state = 'dead'; SND.play('enemyDie'); G.addShake(this.elite ? 6 : 2);
    G.corpses.push({ e: this, t: 0 });
    FX.burst(this.cx, this.cy, this.elite ? 40 : 16, HIT_COLS[this.type] || '#fff', 140, .7, { floor: true, size: 2 });
    FX.burst(this.cx, this.cy, 8, ['#5fd4ff'], 60, .5, { glow: '#5fd4ff', grav: -30 });
    const bi = G.run.biome;
    dropCells(this.cx, this.cy, Math.floor(this.D.cells * (1 + bi * .35) * (this.elite ? 12 : 1) + Math.random()));
    if (Math.random() < .45 || this.elite) dropGold(this.cx, this.cy, rndi(2, 6) * (1 + bi) * (this.elite ? 6 : 1));
    const bp = lockedBlueprints();
    if (bp.length && (this.elite || Math.random() < .04)) G.objs.push(new Pickup(this.cx, this.cy, 'blueprint', { bp: pick(bp), vx: 0, vy: -200 }));
    if (this.elite) {
      G.objs.push(new Pickup(this.cx, this.cy, 'item', { item: randomItem(bi + 2, Math.random() < .3 ? 'skill' : null), vx: rnd(-50, 50), vy: -220 }));
      UI.toast('Elite slain!');
    }
    if (this.mod === 'volatile') G.objs.push(new Delay(.9, () => explode(this.cx, this.cy, 46, this.dmg * 1.2, 'enemy'), this.cx, this.cy, 46));
    if (this.type === 'bloat') {
      if (this.selfDestruct) explode(this.cx, this.cy, 40, this.dmg, 'enemy');
      else explode(this.cx, this.cy, 36, this.dmg * .9, 'both');
    }
    G.player.onKill(this);
  }
  front(dir = this.face) { return dir > 0 ? this.x + this.w + 2 : this.x - 2; }
  edgeAhead(dir = this.face) { return !groundPt(this.front(dir), this.y + this.h + 4) || solidPt(this.front(dir), this.y + this.h - 4); }
  onPlatform() { return getT(G.level, Math.floor(this.cx / TS), Math.floor((this.y + this.h + 2) / TS)) === T_PLAT; }
  meleeCheck(reach, hh, dmg, yoff = 0) {
    if (this.didHit) return;
    const hb = { x: this.face > 0 ? this.cx : this.cx - reach, y: this.y + this.h - hh + yoff, w: reach, h: hh };
    const tg = this.tg || G.player;
    if (tg.alive && overlap(hb, tg.hurtbox())) { const r = tg.hurt(dmg, { dir: this.face, src: this }); if (r !== 'ignored') this.didHit = true; }
  }
  bodyCheck(dmg) {
    if (this.didHit) return;
    const tg = this.tg || G.player;
    if (tg.alive && overlap(this, tg.hurtbox())) { const r = tg.hurt(dmg, { dir: sign(tg.x - this.x) || this.face, src: this }); if (r !== 'ignored') this.didHit = true; }
  }
  setState(s, t) { this.state = s; this.t = s === 'wind' ? t * this.windMul : t; this.t2 = 0; if (s === 'wind') { this.wt = this.t; SND.play('windup'); } if (s === 'atk') this.didHit = false; }
  update(dt) {
    this.flash -= dt; this.freezeImm = (this.freezeImm || 0) - dt; this.kbT = (this.kbT || 0) - dt; this.alertT -= dt;
    this.jumpCd -= dt; this.dropT -= dt; this.dropping = this.dropT > 0; this.poise = Math.max(0, this.poise - this.maxHp * .05 * dt);
    this.anim += Math.abs(this.vx) * dt * .15 + (this.fly ? dt * 6 : 0);
    if (this.mod === 'warded' && !this.wardUp) { this.wardT -= dt; if (this.wardT <= 0) this.wardUp = true; }
    if (this.mod === 'vampiric' && this.aggro) this.hp = Math.min(this.maxHp, this.hp + this.maxHp * .012 * dt);
    this.dotT -= dt;
    if (this.dotT <= 0) {
      this.dotT = .5; const bi = G.run.biome;
      if (this.burn > 0) { this.dotDamage(3 * (1 + .6 * bi), '#ff9a3c'); FX.burst(this.cx, this.cy, 3, ['#ffab3d', '#e0572a'], 30, .4, { grav: -80 }); }
      if (this.bleed > 0 && !this.dead) this.dotDamage(this.bleed * 1.6 * (1 + .6 * bi), '#e04060');
      if (this.dead) return;
    }
    this.burn -= dt; this.bleedT -= dt; if (this.bleedT <= 0) this.bleed = 0;
    this.stun -= dt; this.frozen -= dt; this.root -= dt;
    this.tg = this.type === 'warden' ? G.player : G.targetFor(this);
    const p = this.tg, pcx = p.x + p.w / 2, dx = pcx - this.cx, dy = (p.y + p.h) - (this.y + this.h);
    const pd = dist(this.cx, this.cy, pcx, p.y + p.h / 2);
    if (pd > 700 && this.type !== 'warden') return;
    if (this.frozen > 0 || this.stun > 0) {
      this.vx = approach(this.vx, 0, 500 * dt);
      if (this.fly) this.vy = approach(this.vy, this.stun > 0 ? 40 : 0, 300 * dt);
      this.physics(dt); return;
    }
    if (this.type !== 'warden' && !this.aggro && p.alive && this.sees(this.D.sight) && (this.fly || Math.abs(dy) < 90) && this.state !== 'perch') {
      this.aggro = true; this.cool = Math.max(this.cool, .35); this.alertT = .6; SND.play('alert');
    }
    if (this.type !== 'warden' && this.aggro && (pd > 430 || !p.alive)) { this.aggro = false; if (this.state !== 'perch') this.state = 'idle'; }
    this.cool -= dt; this.t -= dt; this.t2 += dt;
    if (this.state === 'hit') {
      this.vx = approach(this.vx, 0, 500 * dt); if (this.fly) this.vy = approach(this.vy, 0, 300 * dt);
      if (this.t <= 0) this.state = this.aggro ? 'chase' : 'idle';
    } else if (this.kbT <= 0) AI[this.type].call(this, dt, p, dx, dy, pd);
    else this.vx = approach(this.vx, 0, 700 * dt);
    if (this.root > 0 && !this.fly) this.vx = 0;
    this.physics(dt);
  }
  physics(dt) {
    if (!this.fly) this.vy = Math.min(this.vy + 1000 * dt, 450);
    moveBody(this, dt);
  }
  patrol(dt, sp = .4) {
    this.patrolT -= dt;
    if (this.patrolT <= 0) { this.patrolT = rnd(1.5, 3.5); this.pausing = !this.pausing && Math.random() < .5; if (Math.random() < .4) this.face *= -1; }
    if (this.pausing) { this.vx = approach(this.vx, 0, 400 * dt); return; }
    if (this.edgeAhead() || this.hitWall) this.face *= -1;
    this.vx = this.face * this.speed * sp;
  }
  // Ground navigation: walk toward a point, hop small walls, jump up to ledges, drop through planks.
  nav(dt, tx, ty, stop = 0, sp = 1) {
    const dx = tx - this.cx, dy = ty - (this.y + this.h);
    if (Math.abs(dx) > 2) this.face = sign(dx);
    let want = Math.abs(dx) > stop ? this.face * this.speed * sp : 0;
    if (this.onGround) {
      const fx = this.front();
      const wall = solidPt(fx, this.y + this.h - 4);
      if (want && wall && this.D.jumper && this.jumpCd <= 0 && !solidPt(fx, this.y + this.h - 4 - TS * 2) && !solidPt(this.cx, this.y - TS)) {
        this.vy = -340; this.jumpCd = .5; this.onGround = false;
      } else if (this.D.jumper && dy < -34 && dy > -115 && Math.abs(dx) < 120 && this.jumpCd <= 0 && !solidPt(this.cx, this.y - TS)) {
        this.vy = -Math.min(440, Math.sqrt(2 * 1000 * (-dy + 20))); this.vx = clamp(dx * 1.8, -this.speed * 1.5, this.speed * 1.5); this.jumpCd = 1.3; this.onGround = false;
        return;
      }
      if (dy > 30 && this.onPlatform()) this.dropT = .25;
      const edge = !groundPt(fx, this.y + this.h + 4);
      if (want && edge && dy <= 24) want = 0;
    } else if (Math.abs(this.vx) > Math.abs(want)) return;
    this.vx = approach(this.vx, want, (this.onGround ? 900 : 400) * dt);
  }
  teleport(p) {
    for (let i = 0; i < 12; i++) {
      const nx = p.x + p.w / 2 + pick([-1, 1]) * rnd(70, 130) - this.w / 2, ny = p.y - rnd(10, 40);
      if (!rectSolid(nx, ny, this.w, this.h) && losClear(nx + 6, ny + 6, p.x + 5, p.y + 8)) {
        FX.burst(this.cx, this.cy, 16, ['#c77dff', '#40305a'], 80, .5, { grav: 0 });
        this.x = nx; this.y = ny; SND.play('teleport');
        FX.burst(this.cx, this.cy, 16, ['#c77dff', '#e0a0ff'], 80, .5, { grav: 0, glow: '#c77dff' });
        return;
      }
    }
  }
}

function lockedBlueprints() {
  return Object.keys(ITEMS).filter(id => ITEMS[id].cost && !Save.d.unlocked.includes(id) && !Save.d.blueprints.includes(id) && !G.objs.some(o => o.bp === id));
}
const NEAR = (dx, dy, rx, ry) => Math.abs(dx) < rx && Math.abs(dy) < ry;

const AI = {
  rotling(dt, p, dx, dy) {
    const s = this.state;
    if (s === 'idle') { if (this.aggro) this.state = 'chase'; else this.patrol(dt); }
    else if (s === 'chase') {
      if (!this.aggro) { this.state = 'idle'; return; }
      if (NEAR(dx, dy, 26, 24) && this.cool <= 0 && this.onGround) { this.vx = 0; this.face = sign(dx) || this.face; this.combo = Math.random() < .5 ? 1 : 0; this.tryWind(.42, 'bite'); }
      else this.nav(dt, p.x + p.w / 2, p.y + p.h, 16);
    } else if (s === 'wind') { this.vx = 0; if (this.t <= 0) { this.setState('atk', .18); this.vx = this.face * 170; } }
    else if (s === 'atk') {
      this.meleeCheck(24, 18, this.dmg); this.vx = approach(this.vx, 0, 600 * dt);
      if (this.t <= 0) { if (this.combo > 0 && NEAR(dx, dy, 40, 24)) { this.combo--; this.face = sign(dx) || this.face; this.setState('wind', .24); } else this.setState('rec', .55); }
    } else if (s === 'rec') { this.vx = approach(this.vx, 0, 600 * dt); if (this.t <= 0) { this.state = 'chase'; this.cool = rnd(.3, .9); } }
  },
  hound(dt, p, dx, dy) {
    const s = this.state;
    if (s === 'idle') { if (this.aggro) this.state = 'chase'; else this.patrol(dt, .35); }
    else if (s === 'chase') {
      if (!this.aggro) { this.state = 'idle'; return; }
      if (Math.abs(dx) < 75 && Math.abs(dx) > 16 && Math.abs(dy) < 30 && this.cool <= 0 && this.onGround) { this.vx = 0; this.face = sign(dx) || this.face; this.tryWind(.3, 'lunge'); }
      else this.nav(dt, p.x + p.w / 2, p.y + p.h, 30);
    } else if (s === 'wind') { this.vx = 0; if (this.t <= 0) { this.vy = -170; this.vx = this.face * 310; this.onGround = false; this.setState('atk', .6); } }
    else if (s === 'atk') {
      this.bodyCheck(this.dmg);
      if ((this.onGround && this.t2 > .12) || this.t <= 0) { this.setState('retreat', .45); }
    } else if (s === 'retreat') {
      this.vx = this.edgeAhead(-this.face) ? 0 : -this.face * 150;
      if (this.t <= 0) { this.state = 'chase'; this.cool = rnd(.5, 1); }
    } else if (s === 'rec') { if (this.t <= 0) this.state = 'chase'; }
  },
  bloat(dt, p, dx, dy, pd) {
    const s = this.state, py = p.y + p.h / 2;
    const bob = Math.sin(this.anim * .6) * 10;
    if (s === 'wind') {
      this.vx = approach(this.vx, 0, 200 * dt); this.vy = approach(this.vy, 0, 200 * dt);
      if (this.t <= 0) { this.selfDestruct = true; this.hp = 0; this.die(); }
      return;
    }
    let tx = this.homeX + Math.sin(this.anim * .2) * 20, ty = this.homeY + bob;
    if (this.aggro) { tx = p.x + p.w / 2; ty = py - 4 + bob * .3; this.state = 'chase'; }
    const a = Math.atan2(ty - this.cy, tx - this.cx), sp = this.aggro ? this.speed : 20;
    this.vx = approach(this.vx, Math.cos(a) * sp, 120 * dt); this.vy = approach(this.vy, Math.sin(a) * sp, 120 * dt);
    this.face = sign(dx) || this.face;
    if (this.aggro && pd < 30) { this.setState('wind', .75); SND.play('curse'); }
  },
  archer(dt, p, dx, dy) {
    const s = this.state;
    if (s === 'idle') { if (this.aggro) this.state = 'chase'; else this.patrol(dt, .3); }
    else if (s === 'chase') {
      if (!this.aggro) { this.state = 'idle'; return; }
      this.face = sign(dx) || this.face;
      const close = Math.abs(dx) < 70 && Math.abs(dy) < 40;
      if (close && this.onGround && this.jumpCd <= 0 && !this.edgeAhead(-this.face)) { this.vy = -270; this.vx = -this.face * 150; this.jumpCd = 2.2; this.onGround = false; }
      else if (close && !this.edgeAhead(-this.face)) this.vx = -this.face * this.speed;
      else if (Math.abs(dx) > 200 || !this.sees(this.D.sight)) this.nav(dt, p.x + p.w / 2, p.y + p.h, 150);
      else if (this.onGround) this.vx = approach(this.vx, 0, 400 * dt);
      if (this.cool <= 0 && this.onGround && this.sees(this.D.sight)) { this.vx = 0; this.tryWind(.7, 'shoot'); }
    } else if (s === 'wind') {
      this.vx = 0; this.face = sign(dx) || this.face;
      const tx = p.x + p.w / 2 + (p.vx || 0) * .3;
      this.aim = Math.atan2(clamp(p.y + 10 - (this.y + 7), -90, 90), Math.abs(tx - this.cx) || 1);
      if (this.t <= 0) {
        const a = clamp(this.aim, -.65, .65), sp = 260 + G.run.biome * 25;
        G.projs.push(new Proj({ x: this.cx + this.face * 6, y: this.y + 7, vx: Math.cos(a) * sp * this.face, vy: Math.sin(a) * sp, owner: 'enemy', dmg: this.dmg, kind: 'arrow' }));
        SND.play('bow'); this.setState('rec', .45);
      }
    } else if (s === 'rec') { if (this.t <= 0) { this.state = 'chase'; this.cool = rnd(1.2, 1.9); } }
  },
  moth(dt, p, dx, dy, pd) {
    const s = this.state, px = p.x + p.w / 2, py = p.y + 6;
    if (s === 'idle' || s === 'chase') {
      let tx, ty;
      if (!this.aggro) { tx = this.homeX + Math.sin(this.anim * .3) * 30; ty = this.homeY + Math.sin(this.anim * .5) * 10; }
      else { const a = G.time * 1.6 + this.homeX; tx = px + Math.cos(a) * 55; ty = py - 34 + Math.sin(a * 1.3) * 12; }
      const a = Math.atan2(ty - this.cy, tx - this.cx), d = dist(this.cx, this.cy, tx, ty), sp = Math.min(this.speed, d * 3);
      this.vx = approach(this.vx, Math.cos(a) * sp, 300 * dt); this.vy = approach(this.vy, Math.sin(a) * sp, 300 * dt);
      this.face = sign(dx) || this.face;
      if (this.aggro && pd < 125 && this.cool <= 0 && this.sees(150)) { if (this.tryWind(.5, 'dive')) this.tgt = { x: px, y: py + 4 }; }
    } else if (s === 'wind') {
      this.vx = approach(this.vx, 0, 400 * dt); this.vy = approach(this.vy, -20, 400 * dt);
      this.tgt = { x: px + (p.vx || 0) * .2, y: py + 4 };
      if (this.t <= 0) { const a = Math.atan2(this.tgt.y - this.cy, this.tgt.x - this.cx); this.vx = Math.cos(a) * 280; this.vy = Math.sin(a) * 280; this.setState('atk', .45); }
    } else if (s === 'atk') {
      this.bodyCheck(this.dmg);
      if (Math.random() < .5) FX.add({ x: this.cx, y: this.cy, vx: 0, vy: 0, life: .3, col: '#d9c9a0' });
      if (this.t <= 0 || this.hitWall || this.onGround || this.hitCeil) this.setState('rec', .6);
    } else if (s === 'rec') {
      this.vx = approach(this.vx, 0, 300 * dt); this.vy = approach(this.vy, -40, 300 * dt);
      if (this.t <= 0) { this.state = 'chase'; this.cool = rnd(1, 1.8); }
    }
  },
  leaper(dt, p, dx, dy) {
    const s = this.state;
    if (s === 'idle') { if (this.aggro) this.state = 'chase'; else this.patrol(dt, .5); }
    else if (s === 'chase') {
      if (!this.aggro) { this.state = 'idle'; return; }
      if (this.onGround && this.cool <= 0 && Math.abs(dx) < 160 && Math.abs(dx) > 18 && Math.abs(dy) < 80) { this.vx = 0; this.face = sign(dx); this.chain = Math.random() < .6 ? 1 : 0; this.tryWind(.5, 'leap'); }
      else this.nav(dt, p.x + p.w / 2, p.y + p.h, 40);
    } else if (s === 'wind') {
      this.vx = 0;
      if (this.t <= 0) { this.vy = -330 + Math.min(0, dy) * 1.5; this.vx = clamp(dx * 1.7, -240, 240); this.onGround = false; this.setState('atk', 2); }
    } else if (s === 'atk') {
      this.bodyCheck(this.dmg);
      if ((this.onGround && this.t2 > .1) || this.t <= 0) {
        SND.play('land'); FX.burst(this.cx, this.y + this.h, 10, ['#6a8a5a', '#a8c27a'], 80, .3, { dir: -Math.PI / 2, spread: 1.4 });
        if (this.chain > 0 && Math.abs(dx) < 170) { this.chain--; this.face = sign(dx) || this.face; this.setState('wind', .25); }
        else this.setState('rec', .7);
      }
    } else if (s === 'rec') { this.vx = approach(this.vx, 0, 900 * dt); if (this.t <= 0) { this.state = 'chase'; this.cool = rnd(.8, 1.5); } }
  },
  spitter(dt, p, dx, dy) {
    const s = this.state;
    if (s === 'idle') { if (this.aggro) this.state = 'chase'; else this.patrol(dt, .5); }
    else if (s === 'chase') {
      if (!this.aggro) { this.state = 'idle'; return; }
      this.face = sign(dx) || this.face;
      if (Math.abs(dx) > 140) this.nav(dt, p.x + p.w / 2, p.y + p.h, 120); else this.vx = approach(this.vx, 0, 200 * dt);
      if (this.cool <= 0 && this.sees(210)) this.tryWind(.6, 'spit');
    } else if (s === 'wind') {
      this.vx = 0;
      if (this.t <= 0) {
        const T = .9, g = 500, spread = G.run.biome >= 1 || this.elite ? [-24, 0, 24] : [0];
        for (const off of spread) {
          const ddx = dx + off, ddy = p.y + p.h - 4 - (this.y + 4);
          G.projs.push(new Proj({ x: this.cx + this.face * 6, y: this.y + 4, vx: ddx / T, vy: (ddy - .5 * g * T * T) / T, grav: g, owner: 'enemy', dmg: this.dmg, kind: 'glob', r: 3 }));
        }
        SND.play('land'); this.setState('rec', .6);
      }
    } else if (s === 'rec') { if (this.t <= 0) { this.state = 'chase'; this.cool = rnd(1.8, 2.6); } }
  },
  shield(dt, p, dx, dy) {
    const s = this.state;
    const turnTo = () => { if (sign(dx) && sign(dx) !== this.face) { this.turnT += dt; if (this.turnT > .5) { this.face *= -1; this.turnT = 0; } } else this.turnT = 0; };
    if (s === 'idle') { if (this.aggro) this.state = 'chase'; else this.patrol(dt, .35); }
    else if (s === 'chase') {
      if (!this.aggro) { this.state = 'idle'; return; }
      turnTo();
      const facing = sign(dx) === this.face;
      if (facing && NEAR(dx, dy, 36, 26) && this.cool <= 0) { this.vx = 0; this.tryWind(.55, 'bash'); }
      else if (facing && Math.abs(dx) > 90 && Math.abs(dx) < 200 && Math.abs(dy) < 20 && this.cool <= 0 && this.sees(200)) { this.vx = 0; this.tryWind(.65, 'rush'); }
      else if (facing && Math.abs(dx) > 24 && !this.edgeAhead()) this.vx = this.face * this.speed; else this.vx = approach(this.vx, 0, 400 * dt);
    } else if (s === 'wind') {
      this.vx = 0;
      if (this.t <= 0) { if (this.move === 'rush') { this.setState('atk', .55); this.vx = this.face * 270; } else { this.setState('atk', .2); this.vx = this.face * 230; } }
    } else if (s === 'atk') {
      this.meleeCheck(22, 22, this.dmg * (this.move === 'rush' ? 1.2 : 1));
      if (this.move === 'rush' && Math.random() < .6) FX.add({ x: this.cx - this.face * 8, y: this.y + this.h - 2, vx: -this.face * 40, vy: -20, life: .3, col: '#8a8090' });
      if (this.edgeAhead() || this.hitWall) this.vx = 0;
      if (this.t <= 0) this.setState('rec', this.move === 'rush' ? 1 : .75);
    } else if (s === 'rec') { this.vx = approach(this.vx, 0, 800 * dt); if (this.t <= 0) { this.state = 'chase'; this.cool = rnd(.6, 1.2); } }
  },
  hookman(dt, p, dx, dy) {
    const s = this.state;
    if (s === 'idle') { if (this.aggro) this.state = 'chase'; else this.patrol(dt, .35); }
    else if (s === 'chase') {
      if (!this.aggro) { this.state = 'idle'; return; }
      this.face = sign(dx) || this.face;
      if (this.cool <= 0 && Math.abs(dx) > 50 && Math.abs(dx) < 180 && Math.abs(dy) < 30 && this.sees(190)) { this.vx = 0; this.tryWind(.55, 'hook'); }
      else if (this.cool <= 0 && NEAR(dx, dy, 30, 26)) { this.vx = 0; this.tryWind(.45, 'swing'); }
      else this.nav(dt, p.x + p.w / 2, p.y + p.h, 22);
    } else if (s === 'wind') {
      this.vx = 0;
      if (this.t <= 0) {
        if (this.move === 'hook') {
          this.hookHit = false;
          this.hookOut = new Proj({ x: this.cx + this.face * 8, y: this.y + 8, vx: this.face * 420, owner: 'enemy', kind: 'ehook', dmg: this.dmg * .5, life: .45, r: 3, srcE: this });
          G.projs.push(this.hookOut); SND.play('hook'); this.setState('atk', .7);
        } else { this.setState('atk', .2); this.vx = this.face * 120; SND.play('heavy'); }
      }
    } else if (s === 'atk') {
      if (this.move === 'swing') {
        this.meleeCheck(28, 24, this.dmg); this.vx = approach(this.vx, 0, 600 * dt);
        if (this.t <= 0) this.setState('rec', .55);
      } else {
        if (this.hookOut && this.hookOut.dead) this.hookOut = null;
        if (this.hookHit) { this.hookHit = false; this.hookOut = null; this.move = 'swing'; this.face = sign(dx) || this.face; this.setState('wind', .22); }
        else if (!this.hookOut && this.t < .4) this.setState('rec', .6);
      }
    } else if (s === 'rec') { this.vx = approach(this.vx, 0, 600 * dt); if (this.t <= 0) { this.state = 'chase'; this.cool = rnd(.8, 1.5); } }
  },
  gargoyle(dt, p, dx, dy, pd) {
    const s = this.state;
    if (s === 'perch') { this.fly = false; this.vx = 0; if (pd < 140 && this.sees(150)) { this.state = 'wake'; this.t = .5; this.aggro = true; SND.play('thud'); } return; }
    if (s === 'wake') { this.vx = 0; if (this.t <= 0) { this.state = 'chase'; this.fly = true; this.vy = -140; this.cool = .6; } return; }
    const px = p.x + p.w / 2, py = p.y + p.h / 2;
    if (s === 'chase' || s === 'idle') {
      this.fly = true;
      const tx = px - sign(dx || 1) * 40, ty = py - 62;
      const a = Math.atan2(ty - this.cy, tx - this.cx), d = dist(this.cx, this.cy, tx, ty), sp = Math.min(this.speed, d * 3);
      this.vx = approach(this.vx, Math.cos(a) * sp, 280 * dt); this.vy = approach(this.vy, Math.sin(a) * sp, 280 * dt);
      this.face = sign(dx) || this.face;
      if (this.cool <= 0 && pd < 170 && this.sees(180)) this.tryWind(.5, 'dive');
    } else if (s === 'wind') {
      this.vx = approach(this.vx, 0, 400 * dt); this.vy = approach(this.vy, -30, 400 * dt);
      if (this.t <= 0) { const a = Math.atan2(py + 6 - this.cy, px - this.cx); this.vx = Math.cos(a) * 340; this.vy = Math.sin(a) * 340; this.setState('atk', .75); }
    } else if (s === 'atk') {
      this.bodyCheck(this.dmg);
      if (Math.random() < .6) FX.add({ x: this.cx, y: this.cy, vx: 0, vy: 0, life: .25, col: '#8a8a94' });
      if (this.onGround || this.hitWall || this.hitCeil || this.t <= 0) {
        if (this.onGround) {
          SND.play('thud'); G.addShake(3); FX.burst(this.cx, this.y + this.h, 14, ['#8a8a94', '#cfc4ae'], 120, .4, { dir: -Math.PI / 2, spread: 1.4 });
          const hb = { x: this.x - 14, y: this.y + this.h - 12, w: this.w + 28, h: 14 };
          if (!this.didHit && overlap(hb, p.hurtbox())) p.hurt(this.dmg * .7, { dir: sign(dx) || 1, src: this });
        }
        this.fly = false; this.setState('rec', .9);
      }
    } else if (s === 'rec') {
      this.vx = approach(this.vx, 0, 600 * dt);
      if (this.t <= 0) { this.fly = true; this.vy = -160; this.state = 'chase'; this.cool = rnd(1.2, 2); }
    }
  },
  knight(dt, p, dx, dy) {
    const s = this.state;
    if (s === 'idle') { if (this.aggro) this.state = 'chase'; else this.patrol(dt, .3); }
    else if (s === 'chase') {
      if (!this.aggro) { this.state = 'idle'; return; }
      const near = NEAR(dx, dy, 44, 34);
      if (this.cool <= 0 && near) { this.vx = 0; this.face = sign(dx) || this.face; if (Math.random() < .55) { this.combo = 1; this.tryWind(.7, 'combo'); } else this.tryWind(.85, 'slam'); }
      else if (this.cool <= 0 && Math.abs(dx) > 60 && Math.abs(dx) < 150 && Math.abs(dy) < 24 && this.sees(160)) { this.vx = 0; this.face = sign(dx) || this.face; this.tryWind(.65, 'thrust'); }
      else this.nav(dt, p.x + p.w / 2, p.y + p.h, 30);
    } else if (s === 'wind') {
      this.vx = 0;
      if (this.t <= 0) {
        if (this.move === 'thrust') { this.setState('atk', .42); this.vx = this.face * 340; SND.play('stab'); }
        else if (this.move === 'slam') { this.setState('atk', .35); this.slammed = false; SND.play('heavy'); }
        else { this.setState('atk', .3); this.vx = this.face * 120; SND.play('heavy'); }
      }
    } else if (s === 'atk') {
      if (this.move === 'thrust') {
        this.meleeCheck(34, 16, this.dmg * 1.1, -8);
        if (this.edgeAhead() || this.hitWall) this.vx = 0;
        if (this.t2 > .28) this.vx = approach(this.vx, 0, 1400 * dt);
        if (this.t <= 0) this.setState('rec', .8);
      } else if (this.move === 'slam') {
        if (this.t2 > .12 && !this.slammed) {
          this.slammed = true; this.meleeCheck(46, 40, this.dmg * 1.2); G.addShake(5); SND.play('thud');
          FX.burst(this.cx + this.face * 30, this.y + this.h, 14, ['#cfc4ae', '#8a8090'], 120, .4, { dir: -Math.PI / 2, spread: 1.2 });
          for (const d of [-1, 1]) G.projs.push(new Proj({ x: this.cx + d * 24, y: this.y + this.h - 1, vx: d * 180, owner: 'enemy', kind: 'shock', dmg: this.dmg * .6, life: .9, r: 5 }));
        }
        if (this.t <= 0) this.setState('rec', 1.0);
      } else {
        if (this.t2 > .05 && this.t2 < .2) this.meleeCheck(40, 34, this.dmg);
        this.vx = approach(this.vx, 0, 500 * dt);
        if (this.t <= 0) {
          if (this.combo > 0 && Math.abs(dx) < 60) { this.combo--; this.face = sign(dx) || this.face; this.setState('wind', .4); }
          else this.setState('rec', .9);
        }
      }
    } else if (s === 'rec') { this.vx = approach(this.vx, 0, 700 * dt); if (this.t <= 0) { this.state = 'chase'; this.cool = rnd(.5, 1); } }
  },
  bomber(dt, p, dx, dy) {
    const s = this.state;
    if (s === 'idle') { if (this.aggro) this.state = 'chase'; else this.patrol(dt, .4); }
    else if (s === 'chase') {
      if (!this.aggro) { this.state = 'idle'; return; }
      this.face = sign(dx) || this.face;
      if (Math.abs(dx) < 50 && Math.abs(dy) < 30 && this.onGround && this.jumpCd <= 0 && !this.edgeAhead(-this.face)) {
        this.vy = -280; this.vx = -this.face * 170; this.jumpCd = 2.5; this.onGround = false;
        G.projs.push(new Proj({ x: this.cx, y: this.y + 4, vx: 0, vy: -40, grav: 520, owner: 'enemy', dmg: this.dmg, kind: 'bomb', life: 1, r: 3 }));
      } else if (Math.abs(dx) < 90 && !this.edgeAhead(-this.face)) this.vx = -this.face * this.speed;
      else if (Math.abs(dx) > 170) this.nav(dt, p.x + p.w / 2, p.y + p.h, 140);
      else if (this.onGround) this.vx = approach(this.vx, 0, 400 * dt);
      if (this.cool <= 0 && this.onGround && this.sees(220)) { this.vx = 0; this.tryWind(.55, 'throw'); }
    } else if (s === 'wind') {
      this.vx = 0;
      if (this.t <= 0) {
        const T = .75, g = 520, ddx = dx + (p.vx || 0) * .3, ddy = p.y + p.h - 4 - (this.y - 6);
        G.projs.push(new Proj({ x: this.cx, y: this.y - 6, vx: ddx / T, vy: (ddy - .5 * g * T * T) / T, grav: g, owner: 'enemy', dmg: this.dmg, kind: 'bomb', life: 1.15, r: 3 }));
        SND.play('swing'); this.setState('rec', .5);
      }
    } else if (s === 'rec') { if (this.t <= 0) { this.state = 'chase'; this.cool = rnd(2, 2.8); } }
  },
  caster(dt, p, dx, dy, pd) {
    const s = this.state;
    this.vx = 0; this.vy = Math.sin(this.anim * .5) * 6; this.face = sign(dx) || this.face;
    if (s === 'idle') { if (this.aggro) this.state = 'chase'; }
    else if (s === 'chase') {
      if (!this.aggro) { this.state = 'idle'; return; }
      if (pd < 40 && this.jumpCd <= 0) { this.teleport(p); this.jumpCd = 3; }
      if (this.cool <= 0) {
        if (Math.random() < .5) this.teleport(p);
        this.tryWind(.8, Math.random() < .4 ? 'ring' : 'orbs');
      }
    } else if (s === 'wind') {
      if (Math.random() < .5) FX.add({ x: this.cx + rnd(-8, 8), y: this.cy + rnd(-8, 8), vx: 0, vy: -20, life: .4, col: '#c77dff' });
      if (this.t <= 0) {
        if (this.move === 'ring') {
          for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; G.projs.push(new Proj({ x: this.cx, y: this.cy - 4, vx: Math.cos(a) * 80, vy: Math.sin(a) * 80, owner: 'enemy', dmg: this.dmg, kind: 'orb', r: 3, life: 2.6 })); }
        } else {
          for (const off of [-.5, 0, .5]) {
            const a = Math.atan2(p.y + 10 - this.cy, p.x + p.w / 2 - this.cx) + off;
            G.projs.push(new Proj({ x: this.cx, y: this.cy - 4, vx: Math.cos(a) * 95, vy: Math.sin(a) * 95, owner: 'enemy', dmg: this.dmg, kind: 'orb', r: 3, life: 3.2, homing: true }));
          }
        }
        SND.play('zap'); this.setState('rec', 1);
      }
    } else if (s === 'rec') { if (this.t <= 0) { this.state = 'chase'; this.cool = rnd(2.4, 3.4); } }
  },
  warden(dt, p, dx, dy, pd) { this.bossAI(dt, p, dx, pd); }
};

// ---------- the boss ----------
class Warden extends Enemy {
  constructor(x, y) {
    super('warden', x, y, false);
    this.state = 'intro'; this.kbRes = .08; this.enraged = false; this.summoned = false; this.face = -1;
    this.maceAng = .9; this.maceLen = 22;
  }
  stunMe(t) { if (this.state === 'intro') return; this.stun = Math.max(this.stun, Math.min(t, 1.1)); this.state = 'idle'; this.t = 0; this.vx = 0; FX.num(this.cx, this.y - 8, 'STUN', '#ffe56a'); }
  bossAI(dt, p, pdx, pd) {
    const s = this.state, rage = this.enraged ? .75 : 1;
    if (!this.enraged && this.hp < this.maxHp * .5) {
      this.enraged = true; SND.play('roar'); G.addShake(10); UI.toast('The Warden is enraged!', 2);
      if (!this.summoned) { this.summoned = true; for (const dx of [-120, 120]) { const ex = clamp(this.cx + dx, 40, G.level.pw - 40); G.enemies.push(new Enemy(pick(['rotling', 'hound', 'moth']), ex, G.level.bossFloor, false)); } }
    }
    this.maceAng = lerp(this.maceAng, .9, dt * 3); this.maceLen = 22;
    if (s === 'intro') {
      this.vx = 0;
      if (pd < 230 && p.alive) { this.state = 'roar'; this.t = 1.3; SND.play('roar'); G.addShake(8); G.bossIntro(this); }
      return;
    }
    if (s === 'roar') { this.vx = 0; this.maceAng = -1.5; if (this.t <= 0) { this.state = 'idle'; this.cool = .5; } return; }
    if (s === 'idle' || s === 'chase' || s === 'hit') {
      this.state = 'idle';
      this.face = sign(pdx) || this.face;
      if (Math.abs(pdx) > 70) this.vx = approach(this.vx, this.face * this.speed * (this.enraged ? 1.3 : 1), 400 * dt); else this.vx = approach(this.vx, 0, 500 * dt);
      if (this.cool <= 0 && p.alive) {
        const close = Math.abs(pdx) < 70;
        let m;
        if (close && Math.random() < .7) m = 'swing';
        else { const opts = ['charge', 'leap', 'leap']; if (this.enraged) opts.push('rain', 'charge'); m = pick(opts); }
        if (m === this.lastMove && m !== 'swing' && Math.random() < .6) m = close ? 'swing' : 'leap';
        this.lastMove = m; this.move = m; this.vx = 0;
        this.setState('wind', ({ swing: .55, charge: .75, leap: .55, rain: .9 })[m] * rage);
        if (m === 'rain') SND.play('roar');
      }
      return;
    }
    const m = this.move;
    if (s === 'wind') {
      this.vx = 0;
      if (m === 'swing') this.maceAng = lerp(this.maceAng, -2.5, dt * 10);
      if (m === 'charge') { this.maceAng = 0; this.face = sign(pdx) || this.face; if (Math.random() < .5) FX.add({ x: this.cx - this.face * 12, y: this.y + this.h - 2, vx: -this.face * 60, vy: -20, life: .3, col: '#8a8090' }); }
      if (m === 'leap') this.maceAng = -1.4;
      if (m === 'rain') this.maceAng = -1.6;
      if (this.t <= 0) {
        if (m === 'swing') { this.setState('atk', .28); this.vx = this.face * 100; SND.play('heavy'); }
        else if (m === 'charge') { this.setState('atk', 1.3); SND.play('roar'); }
        else if (m === 'leap') {
          const T = .75, tx = p.x + p.w / 2;
          this.vx = clamp((tx - this.cx) / T, -330, 330); this.vy = -440; this.onGround = false; this.setState('atk', 2); this.airT = 0; SND.play('heavy');
        } else if (m === 'rain') {
          for (let i = 0; i < 7; i++) G.objs.push(new Telegraph(clamp(p.x + p.w / 2 + rnd(-150, 150), 30, G.level.pw - 30), G.level.bossFloor, .7 + i * .12, this.dmg * .7));
          G.addShake(6); this.setState('rec', 1.2 * rage);
        }
      }
    } else if (s === 'atk') {
      if (m === 'swing') {
        this.maceAng = lerp(-2.5, 1.3, clamp(this.t2 / .15, 0, 1)); this.maceLen = 30;
        if (this.t2 > .04 && this.t2 < .2) this.meleeCheck(62, 54, this.dmg);
        this.vx = approach(this.vx, 0, 500 * dt);
        if (this.t2 > .12 && !this.slammed) { this.slammed = true; G.addShake(4); FX.burst(this.cx + this.face * 40, this.y + this.h, 12, ['#cfc4ae', '#8a8090'], 120, .4, { dir: -Math.PI / 2, spread: 1.2 }); }
        if (this.t <= 0) { this.slammed = false; this.setState('rec', .55 * rage); }
      } else if (m === 'charge') {
        this.vx = this.face * 330 * (this.enraged ? 1.15 : 1); this.maceAng = 0; this.maceLen = 26;
        this.bodyCheck(this.dmg * 1.1);
        if (Math.random() < .8) FX.add({ x: this.cx - this.face * 14, y: this.y + this.h - rnd(0, 10), vx: -this.face * 80, vy: -rnd(10, 40), life: .35, col: pick(['#8a8090', '#cfc4ae']) });
        if (this.hitWall || this.t <= 0) {
          if (this.hitWall) { SND.play('thud'); G.addShake(9); this.stun = .9; FX.burst(this.cx + this.face * 16, this.cy, 24, ['#cfc4ae', '#8a8090', '#5a5050'], 170, .6, { size: 2 }); }
          this.setState('rec', .6 * rage); this.vx = 0;
        }
      } else if (m === 'leap') {
        this.airT += dt; this.maceAng = lerp(this.maceAng, 1.4, dt * 4);
        if (this.onGround && this.airT > .15) {
          SND.play('thud'); G.addShake(10); G.hitstop = .06;
          FX.burst(this.cx, this.y + this.h, 40, ['#cfc4ae', '#8a8090', '#ff8a3a'], 200, .6, { dir: -Math.PI / 2, spread: 1.5, glow: '#ff8a3a' });
          const hb = { x: this.x - 20, y: this.y + this.h - 24, w: this.w + 40, h: 26 };
          if (overlap(hb, G.player.hurtbox())) G.player.hurt(this.dmg * 1.1, { dir: sign(G.player.x - this.x) || 1, src: this });
          for (const d of [-1, 1]) G.projs.push(new Proj({ x: this.cx + d * 20, y: this.y + this.h - 1, vx: d * (this.enraged ? 240 : 190), owner: 'enemy', kind: 'shock', dmg: this.dmg * .7, life: 1.6, r: 5 }));
          this.vx = 0; this.setState('rec', .75 * rage);
        }
        if (this.t <= 0) this.setState('rec', .5);
      }
    } else if (s === 'rec') {
      this.vx = approach(this.vx, 0, 700 * dt);
      if (this.t <= 0) { this.state = 'idle'; this.cool = rnd(.35, .8) * rage; }
    }
  }
  die() {
    if (this.dead) return;
    this.dead = true; this.state = 'dead'; SND.play('roar'); SND.play('boom'); G.addShake(14); G.slowmo = 2; G.hitstop = .25;
    G.corpses.push({ e: this, t: 0 });
    FX.burst(this.cx, this.cy, 120, ['#6a6a78', '#ff8a3a', '#fff3a8', '#3a3a44'], 220, 1.4, { glow: '#ff8a3a', size: 2 });
    dropCells(this.cx, this.cy, 40); dropGold(this.cx, this.cy, 400);
    G.player.onKill(this);
    G.onBossDeath(this);
  }
}

class Telegraph extends Obj {
  constructor(x, floorY, delay, dmg) { super(x - 7, floorY - 4, 14, 4); this.delay = delay; this.dmg = dmg; }
  update(dt) {
    this.delay -= dt;
    if (this.delay <= 0) {
      this.dead = true;
      G.projs.push(new Proj({ x: this.x + 7, y: 2 * TS + 20, vx: 0, vy: 240, grav: 500, owner: 'enemy', dmg: this.dmg, kind: 'rock', r: 5, life: 2 }));
    }
  }
  draw(ctx, t) {
    if (Math.floor(t * 14) % 2) return;
    ctx.fillStyle = 'rgba(255,60,40,.7)'; ctx.fillRect(Math.round(this.x), Math.round(this.y) + 2, 14, 2);
    ctx.fillRect(Math.round(this.x) + 6, Math.round(this.y) - 4, 2, 4);
  }
}
