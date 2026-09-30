'use strict';
// ---------- particles ----------
const FX = {
  parts: [], nums: [], flashes: [], rings: [],
  clear() { this.parts.length = 0; this.nums.length = 0; this.flashes.length = 0; this.rings.length = 0; },
  ring(x, y, r, col, life = .4) { this.rings.push({ x, y, r, col, life, max: life }); },
  add(p) { if (this.parts.length < 900) this.parts.push(Object.assign({ life: .5, max: .5, size: 1, grav: 0, drag: 0, col: '#fff' }, p, { max: p.life || .5 })); },
  burst(x, y, n, col, spd = 80, life = .4, o = {}) {
    for (let i = 0; i < n; i++) {
      const a = o.dir != null ? o.dir + rnd(-(o.spread || .8), o.spread || .8) : rnd(0, Math.PI * 2), s = rnd(spd * .3, spd);
      this.add({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s + (o.up || 0), life: rnd(life * .5, life), col: Array.isArray(col) ? pick(col) : col, size: o.size || rndi(1, 2), grav: o.grav == null ? 200 : o.grav, drag: o.drag || 2, glow: o.glow });
    }
  },
  num(x, y, v, col = '#fff', big = false) { this.nums.push({ x: x + rnd(-4, 4), y, v: typeof v === 'number' ? Math.round(v) : v, col, big, t: 0 }); },
  flash(x, y, r, col, life = .15) { this.flashes.push({ x, y, r, col, life, max: life }); },
  update(dt) {
    for (const p of this.parts) {
      p.life -= dt; p.vy += p.grav * dt; p.vx *= 1 - p.drag * dt; p.vy *= 1 - p.drag * dt * .5;
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.floor && solidPt(p.x, p.y)) { p.y -= p.vy * dt; p.vy *= -0.3; p.vx *= .6; }
    }
    this.parts = this.parts.filter(p => p.life > 0);
    for (const n of this.nums) n.t += dt;
    this.nums = this.nums.filter(n => n.t < .8);
    for (const f of this.flashes) f.life -= dt;
    this.flashes = this.flashes.filter(f => f.life > 0);
    for (const r of this.rings) r.life -= dt;
    this.rings = this.rings.filter(r => r.life > 0);
  },
  draw(ctx) {
    for (const p of this.parts) {
      ctx.globalAlpha = clamp(p.life / p.max * 1.5, 0, 1);
      ctx.fillStyle = p.col; ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
    }
    for (const r of this.rings) {
      const k = 1 - r.life / r.max;
      ctx.globalAlpha = (1 - k) * .8; ctx.strokeStyle = r.col; ctx.lineWidth = 2 + (1 - k) * 2;
      ctx.beginPath(); ctx.arc(Math.round(r.x), Math.round(r.y), Math.max(1, r.r * easeOut(k)), 0, 7); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  },
  drawNums(ctx, cx, cy) {
    for (const n of this.nums) {
      const k = n.t / .8, y = n.y - 14 * easeOut(Math.min(1, n.t * 3)) - k * 6;
      drawText(ctx, n.v, n.x - cx, y - cy, n.col, n.big ? 2 : 1, 'center');
    }
  },
  lights(add) {
    for (const p of this.parts) if (p.glow) add(p.x, p.y, 14, p.glow, p.life / p.max * .8);
    for (const f of this.flashes) add(f.x, f.y, f.r, f.col, f.life / f.max);
    for (const r of this.rings) add(r.x, r.y, r.r * .8, r.col, r.life / r.max * .6);
  }
};

// ---------- projectiles ----------
class Proj {
  constructor(o) {
    Object.assign(this, { x: 0, y: 0, vx: 0, vy: 0, r: 2, owner: 'enemy', dmg: 10, grav: 0, life: 3, kind: 'arrow', pierce: 0, dead: false, t: 0 }, o);
    this.hitSet = new Set();
  }
  rect() { return { x: this.x - this.r, y: this.y - this.r, w: this.r * 2, h: this.r * 2 }; }
  update(dt) {
    this.t += dt; this.life -= dt;
    if (this.life <= 0) return this.expire();
    if (this.kind === 'orb' && this.owner === 'enemy' && this.homing) {
      const p = G.player, a = Math.atan2(p.y + 10 - this.y, p.x + p.w / 2 - this.x), sp = Math.hypot(this.vx, this.vy);
      const cur = Math.atan2(this.vy, this.vx); let d = a - cur; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
      const na = cur + clamp(d, -1.6 * dt, 1.6 * dt); this.vx = Math.cos(na) * sp; this.vy = Math.sin(na) * sp;
      if (Math.random() < .5) FX.add({ x: this.x, y: this.y, vx: 0, vy: 0, life: .3, col: '#c77dff', size: 1 });
    }
    this.vy += this.grav * dt;
    const steps = Math.max(1, Math.ceil(Math.hypot(this.vx, this.vy) * dt / 4));
    for (let i = 0; i < steps; i++) {
      this.x += this.vx * dt / steps; this.y += this.vy * dt / steps;
      if (this.kind === 'shock' || this.kind === 'wave') { if (solidPt(this.x + sign(this.vx) * 4, this.y - 4) || !groundPt(this.x, this.y + 2)) return this.expire(); }
      else if (solidPt(this.x, this.y)) { this.x -= this.vx * dt / steps; this.y -= this.vy * dt / steps; return this.onWall(); }
      if (this.collide()) return;
    }
    if (this.kind === 'arrow' || this.kind === 'bolt') { if (Math.random() < .3) FX.add({ x: this.x, y: this.y, vx: 0, vy: 0, life: .15, col: this.owner === 'player' ? '#ffe0a0' : '#ff9a8a' }); }
    if (this.kind === 'wave') for (let i = 0; i < 3; i++) FX.add({ x: this.x + rnd(-6, 6), y: this.y - rnd(0, 18), vx: -sign(this.vx) * rnd(20, 60), vy: -rnd(20, 60), life: .4, col: pick(['#5fe0d0', '#bff8f0', '#2a8a8a']), grav: 200 });
    if (this.kind === 'dagger' && Math.random() < .6) FX.add({ x: this.x, y: this.y - 6, vx: 0, vy: 0, life: .2, col: '#ffd84a', glow: '#ffd84a' });
    if (this.kind === 'shock' && Math.random() < .8) FX.add({ x: this.x + rnd(-4, 4), y: this.y - rnd(0, 8), vx: 0, vy: -30, life: .3, col: pick(['#ffb45a', '#ff6a2a', '#fff3a8']), glow: '#ff8a3a' });
  }
  collide() {
    const R = this.rect();
    if (this.owner === 'enemy') {
      const targets = G.decoy && !G.decoy.dead ? [G.player, G.decoy] : [G.player];
      for (const p of targets) {
        if (!p.alive || !overlap(R, p.hurtbox())) continue;
        const res = p.hurt(this.dmg, { dir: sign(this.vx) || 1, src: this.srcE || this, proj: true });
        if (res === 'parried' && (this.kind === 'arrow' || this.kind === 'orb')) {
          this.owner = 'player'; this.vx = -this.vx * 1.3; this.vy = -this.vy; this.dmg *= 2; this.life = 2; this.hitSet.clear(); return false;
        }
        if (res !== 'ignored') {
          if (this.kind === 'ehook' && res === 'hit' && p === G.player) this.pullPlayer(p);
          this.hitFx(); if (this.kind === 'bomb') this.explode(); this.dead = true; return true;
        }
      }
    } else {
      for (const e of G.enemies) {
        if (e.dead || this.hitSet.has(e)) continue;
        if (overlap(R, e)) {
          this.hitSet.add(e);
          if (this.kind === 'nade') { this.detonate(); return true; }
          if (this.onHit) { this.onHit(e); this.dead = true; return true; }
          const crit = this.critFn ? this.critFn(e) : false;
          const dmg = this.dmgFn ? this.dmgFn(e, crit) : this.dmg;
          e.hurt(dmg, { crit, dir: sign(this.vx) || sign(e.cx - this.x) || 1, kb: this.kb || 40, item: this.item, src: this.srcTag || 'proj', burn: this.burn, bleed: this.bleed, bleedStacks: this.bleedStacks, stun: this.stun });
          this.hitFx();
          if (this.pierce-- <= 0) { this.dead = true; return true; }
        }
      }
      for (const o of G.objs) if (o.breakable && !o.dead && overlap(R, o)) { o.smash(sign(this.vx)); this.dead = true; return true; }
    }
    return false;
  }
  pullPlayer(p) {
    const e = this.srcE; if (!e || e.dead) return;
    const nx = e.face > 0 ? e.x + e.w + 2 : e.x - p.w - 2;
    if (!rectSolid(nx, p.y, p.w, p.h)) p.x = nx;
    p.state = 'hurt'; p.hurtT = .4; p.vx = 0; p.vy = 0; e.hookHit = true;
    SND.play('hook'); FX.burst(p.x + 5, p.y + 10, 10, ['#c9ccd8', '#fff'], 90, .3);
  }
  hitFx() { FX.burst(this.x, this.y, 5, this.kind === 'orb' ? '#c77dff' : this.kind === 'glob' ? '#b6d85a' : '#ffe0a0', 60, .25); }
  onWall() {
    if (this.kind === 'nade') return this.detonate();
    if (this.kind === 'bomb') { this.vx *= .3; this.vy = 0; this.grav = 0; this.stuck = true; return; }
    if (this.kind === 'glob') { G.objs.push(new Puddle(this.x, Math.floor(this.y / TS) * TS + (solidPt(this.x, this.y + 4) ? 0 : TS), this.dmg)); }
    FX.burst(this.x, this.y, 4, '#aaa', 40, .2);
    this.dead = true;
  }
  expire() {
    if (this.kind === 'bomb') return this.explode();
    if (this.kind === 'nade') return this.detonate();
    this.dead = true;
  }
  explode() { explode(this.x, this.y, 30, this.dmg, 'enemy'); this.dead = true; }
  detonate() {
    this.dead = true;
    const s = this.sub;
    if (s === 'fire') { explode(this.x, this.y, 34, this.dmg, 'player', { burn: true, item: this.item }); G.objs.push(new FireGround(this.x, this.y, this.dmg * 0.2)); }
    else if (s === 'ice') {
      SND.play('freeze'); FX.burst(this.x, this.y, 40, ['#bfefff', '#8fdcff', '#fff'], 150, .6, { grav: 20, glow: '#8fdcff' }); FX.flash(this.x, this.y, 110, '#8fdcff', .4);
      for (const e of G.enemies) if (!e.dead && dist(this.x, this.y, e.x + e.w / 2, e.y + e.h / 2) < 70) { e.hurt(this.dmg, { dir: sign(e.x - this.x), kb: 0, item: this.item, freeze: 3 }); }
    } else if (s === 'keg') { explode(this.x, this.y, 64, this.dmg, 'player', { item: this.item, big: true }); }
  }
  draw(ctx) {
    const x = Math.round(this.x), y = Math.round(this.y);
    if (this.kind === 'hook' || this.kind === 'ehook') {
      const src = this.kind === 'hook' ? { x: this.src.x + this.src.w / 2 + this.src.face * 5, y: this.src.y + 9 } : { x: this.srcE.cx + this.srcE.face * 6, y: this.srcE.y + 8 };
      ctx.fillStyle = '#8a8a96'; const n = Math.max(1, Math.floor(dist(src.x, src.y, x, y) / 3));
      for (let k = 0; k < n; k++) ctx.fillRect(Math.round(lerp(src.x, x, k / n)), Math.round(lerp(src.y, y, k / n)), 2, 1);
      ctx.fillStyle = '#c9ccd8'; ctx.fillRect(x - 2, y - 3, 3, 6); ctx.fillRect(x + (this.vx > 0 ? 1 : -3), y + 2, 3, 2);
      return;
    }
    if (this.kind === 'knife') {
      const a = this.t * 30; ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.fillStyle = '#d8e0e8'; ctx.fillRect(-4, -1, 6, 2); ctx.fillStyle = '#4a2a1a'; ctx.fillRect(2, -1, 3, 2); ctx.restore();
      return;
    }
    if (this.kind === 'dagger') {
      ctx.fillStyle = '#ffd84a'; ctx.fillRect(x - 1, y - 8, 2, 8); ctx.fillStyle = '#fff6c0'; ctx.fillRect(x - 1, y - 8, 1, 6); ctx.fillStyle = '#8a5a1a'; ctx.fillRect(x - 2, y - 10, 4, 2);
      return;
    }
    if (this.kind === 'wave') {
      ctx.fillStyle = '#2a8a8a'; ctx.fillRect(x - 6, y - 16, 12, 16); ctx.fillStyle = '#5fe0d0'; ctx.fillRect(x - 5, y - 20, 10, 8);
      ctx.fillStyle = '#bff8f0'; ctx.fillRect(x + (this.vx > 0 ? 1 : -5), y - 22, 5, 4);
      return;
    }
    if (this.kind === 'arrow' || this.kind === 'bolt') {
      const a = Math.atan2(this.vy, this.vx), c = Math.cos(a), s = Math.sin(a);
      ctx.fillStyle = this.owner === 'player' ? '#c9b08a' : '#b8a0a0';
      for (let k = 0; k < 8; k++) ctx.fillRect(Math.round(x - c * k), Math.round(y - s * k), 1, 1);
      ctx.fillStyle = '#e8e8f0'; ctx.fillRect(Math.round(x), Math.round(y) - 1, 2, 2);
      ctx.fillStyle = this.owner === 'player' ? '#e5483c' : '#8a2a2a'; ctx.fillRect(Math.round(x - c * 8), Math.round(y - s * 8) - 1, 2, 2);
    } else if (this.kind === 'orb') {
      ctx.fillStyle = this.owner === 'player' ? '#ffe0a0' : '#8a3ad0'; ctx.fillRect(x - 3, y - 3, 6, 6); ctx.fillStyle = '#f0d8ff'; ctx.fillRect(x - 1, y - 1, 3, 3);
    } else if (this.kind === 'glob') {
      ctx.fillStyle = '#6a8a2a'; ctx.fillRect(x - 3, y - 3, 6, 6); ctx.fillStyle = '#b6d85a'; ctx.fillRect(x - 2, y - 2, 3, 3);
    } else if (this.kind === 'bomb') {
      ctx.fillStyle = '#2a2a2a'; ctx.fillRect(x - 3, y - 3, 7, 7); ctx.fillStyle = Math.floor(this.t * 12) % 2 ? '#ff3a2a' : '#ffcf5a'; ctx.fillRect(x + 1, y - 5, 2, 2);
    } else if (this.kind === 'nade') {
      const col = this.sub === 'fire' ? '#d0452a' : this.sub === 'ice' ? '#5ab8e8' : '#6a4a2a';
      ctx.fillStyle = col; ctx.fillRect(x - 3, y - 3, 7, 7); ctx.fillStyle = '#ffcf5a'; ctx.fillRect(x, y - 5, 2, 2);
    } else if (this.kind === 'rock') {
      ctx.fillStyle = '#4a3a40'; ctx.fillRect(x - 5, y - 5, 10, 10); ctx.fillStyle = '#7a6a70'; ctx.fillRect(x - 5, y - 5, 10, 3); ctx.fillStyle = '#2a1f25'; ctx.fillRect(x + 2, y - 2, 3, 6);
    } else if (this.kind === 'shock') {
      ctx.fillStyle = '#ff8a3a'; ctx.fillRect(x - 3, y - 10, 6, 10); ctx.fillStyle = '#fff3a8'; ctx.fillRect(x - 1, y - 7, 2, 7);
    }
  }
  light() { return this.kind === 'dagger' ? '#ffd84a' : this.kind === 'wave' ? '#5fe0d0' : this.kind === 'orb' ? '#c77dff' : this.kind === 'shock' ? '#ff8a3a' : this.kind === 'nade' ? '#ffb45a' : this.kind === 'bomb' ? '#ff6a2a' : null; }
}

function explode(x, y, R, dmg, owner, o = {}) {
  SND.play('boom'); G.addShake(o.big ? 9 : 6); G.hitstop = Math.max(G.hitstop, .04);
  FX.flash(x, y, R * 2.4, '#ffb45a', .3);
  FX.burst(x, y, o.big ? 60 : 32, ['#fff3a8', '#ffab3d', '#e0572a', '#5a4a4a'], R * 4, .5, { grav: -40, glow: '#ff8a3a', size: 2 });
  FX.burst(x, y, 16, ['#3a3a3a', '#5a5050'], R * 2, .9, { grav: -30, size: 3 });
  if (owner === 'player' || owner === 'both') {
    for (const e of G.enemies) if (!e.dead && dist(x, y, e.x + e.w / 2, e.y + e.h / 2) < R + e.w / 2) e.hurt(dmg, { dir: sign(e.x + e.w / 2 - x) || 1, kb: 180, item: o.item, burn: o.burn, src: o.src || 'boom' });
    for (const ob of G.objs) if (ob.breakable && !ob.dead && dist(x, y, ob.x + ob.w / 2, ob.y + ob.h / 2) < R + 8) ob.smash(sign(ob.x - x));
  }
  if (owner === 'enemy' || owner === 'both') {
    for (const p of [G.player, G.decoy]) if (p && p.alive && dist(x, y, p.x + p.w / 2, p.y + p.h / 2) < R + 6) p.hurt(dmg, { dir: sign(p.x - x) || 1, src: { x, y }, boom: true });
  }
}

// ---------- world objects ----------
class Obj {
  constructor(x, y, w, h) { this.x = x; this.y = y; this.w = w; this.h = h; this.dead = false; this.t = 0; }
  update(dt) { this.t += dt; }
  draw(ctx, t) { }
  center() { return { x: this.x + this.w / 2, y: this.y + this.h / 2 }; }
}

class Pickup extends Obj {
  constructor(x, y, kind, o = {}) {
    super(x - 4, y - 8, 8, 8); this.kind = kind; Object.assign(this, o);
    this.vx = o.vx != null ? o.vx : rnd(-60, 60); this.vy = o.vy != null ? o.vy : rnd(-180, -90);
    this.auto = kind === 'cell' || kind === 'gold';
    this.interactive = !this.auto;
    if (kind === 'item' || kind === 'scroll' || kind === 'blueprint' || kind === 'food') { this.w = 12; this.h = 12; this.x = x - 6; this.y = y - 12; }
  }
  update(dt) {
    this.t += dt;
    const p = G.player;
    if (this.auto && this.t > .45 && p.alive) {
      const cx = p.x + p.w / 2, cy = p.y + p.h / 2, d = dist(this.x + 4, this.y + 4, cx, cy);
      if (d < 90 || this.t > 3) {
        const sp = 260 + this.t * 60, a = Math.atan2(cy - this.y - 4, cx - this.x - 4);
        this.x += Math.cos(a) * sp * dt; this.y += Math.sin(a) * sp * dt;
        if (d < 10) { this.collect(); }
        return;
      }
    }
    this.vy = Math.min(this.vy + 700 * dt, 400); this.vx *= 1 - 3 * dt;
    this.fly = false; moveBody(this, dt);
    if (this.onGround) this.vx *= .8;
  }
  collect() {
    this.dead = true; const p = G.player;
    if (this.kind === 'cell') { p.cells += this.value || 1; G.run.cellsTotal += this.value || 1; SND.play('cell'); FX.burst(p.x + 5, p.y + 10, 3, '#5fd4ff', 40, .3, { glow: '#5fd4ff' }); }
    if (this.kind === 'gold') { p.gold += this.value; SND.play('gold'); }
  }
  label() {
    if (this.kind === 'item') return 'TAKE ' + itemName(this.item);
    if (this.kind === 'scroll') return 'READ SCROLL OF POWER';
    if (this.kind === 'food') return 'EAT ' + this.food.name;
    if (this.kind === 'blueprint') return 'TAKE BLUEPRINT';
    return '';
  }
  interact() {
    const p = G.player;
    if (this.kind === 'item') { UI.offerItem(this.item, this); }
    else if (this.kind === 'scroll') { this.dead = true; SND.play('scroll'); UI.scrollChoice(); }
    else if (this.kind === 'food') {
      if (p.hp >= p.maxHp) { UI.toast('Already at full health'); SND.play('deny'); return; }
      this.dead = true; p.heal(p.maxHp * this.food.heal); SND.play('heal');
    } else if (this.kind === 'blueprint') {
      this.dead = true; SND.play('pickup');
      if (!Save.d.blueprints.includes(this.bp) && !Save.d.unlocked.includes(this.bp)) Save.d.blueprints.push(this.bp);
      Save.write(); G.run.blueprints++;
      UI.toast('Blueprint: ' + ITEMS[this.bp].name + '. Unlock it with cells at the Keeper.');
    }
  }
  draw(ctx, t) {
    const x = Math.round(this.x), y = Math.round(this.y);
    if (this.kind === 'cell') {
      const s = Math.sin(t * 10 + this.x) > 0 ? 1 : 0;
      ctx.fillStyle = '#1a6aa0'; ctx.fillRect(x + 1, y + 1, 6, 6); ctx.fillStyle = '#5fd4ff'; ctx.fillRect(x + 2, y + 2 - s, 4, 4); ctx.fillStyle = '#e8fbff'; ctx.fillRect(x + 3, y + 3 - s, 2, 2);
    } else if (this.kind === 'gold') {
      const big = this.value >= 10;
      ctx.fillStyle = '#8a6a1a'; ctx.fillRect(x + 1, y + 3, big ? 7 : 5, big ? 5 : 4); ctx.fillStyle = '#f2c14e'; ctx.fillRect(x + 1, y + 2, big ? 7 : 5, big ? 4 : 3); ctx.fillStyle = '#fff0a0'; ctx.fillRect(x + 2, y + 2, 1, 1);
    } else {
      const bob = Math.round(Math.sin(t * 3 + this.x) * 1.5) - 2;
      const col = this.kind === 'item' ? STAT[this.item.def.stat].col : this.kind === 'scroll' ? '#e8d6ad' : this.kind === 'blueprint' ? '#5aa0ff' : '#ff9a6a';
      ctx.globalAlpha = .35 + Math.sin(t * 4) * .1; ctx.fillStyle = col; ctx.fillRect(x - 2, y + bob - 2, 16, 16); ctx.globalAlpha = 1;
      const ic = this.kind === 'item' ? this.item.id : this.kind;
      ctx.drawImage(Art.icon(ic), x - 2, y + bob - 2);
    }
  }
  light() { return this.kind === 'cell' ? ['#5fd4ff', 18] : this.kind === 'item' ? [STAT[this.item.def.stat].col, 36] : this.kind === 'scroll' ? ['#ffe6a0', 40] : this.kind === 'blueprint' ? ['#5aa0ff', 36] : null; }
}

function dropCells(x, y, n) { for (let i = 0; i < n; i++) G.objs.push(new Pickup(x, y, 'cell', { value: 1 })); }
function dropGold(x, y, total) {
  while (total > 0) { const v = total >= 25 ? 10 : total >= 8 ? 5 : 1; total -= v; G.objs.push(new Pickup(x, y, 'gold', { value: v })); }
}

class Chest extends Obj {
  constructor(x, y, cursed) { super(x - 10, y - 14, 20, 14); this.interactive = true; this.cursed = cursed; this.open = false; }
  label() { return this.cursed ? 'OPEN CURSED CHEST' : 'OPEN CHEST'; }
  interact() {
    if (this.open) return; this.open = true; this.interactive = false;
    const bi = G.run.biome, cx = this.x + 10, cy = this.y;
    SND.play('door'); SND.play('pickup');
    FX.burst(cx, cy + 4, 20, ['#f2c14e', '#fff0a0'], 120, .6, { glow: '#f2c14e' });
    if (this.cursed) {
      SND.play('curse'); G.player.curse = 10; G.addShake(4);
      UI.toast('CURSED: the next hit you take is fatal. Kill 10 enemies to lift it.', 4);
      G.objs.push(new Pickup(cx, cy, 'item', { item: randomItem(bi + 2, Math.random() < .3 ? 'skill' : null), vx: 0, vy: -160 }));
      dropGold(cx, cy, 60 + bi * 50); dropCells(cx, cy, 6);
    } else {
      dropGold(cx, cy, 25 + bi * 25 + rndi(0, 20));
      if (Math.random() < .55) G.objs.push(new Pickup(cx, cy, 'item', { item: randomItem(bi + 1 + (Math.random() < .3 ? 1 : 0), Math.random() < .35 ? 'skill' : null), vx: rnd(-40, 40), vy: -170 }));
      else G.objs.push(new Pickup(cx, cy, 'food', { food: FOODS[Math.min(2, bi)], vx: 0, vy: -150 }));
    }
  }
  draw(ctx, t) {
    const x = Math.round(this.x), y = Math.round(this.y);
    const wood = this.cursed ? '#3a2240' : '#6a4226', band = this.cursed ? '#8a3ab0' : '#c9a24a';
    ctx.fillStyle = shade(wood, -.3); ctx.fillRect(x, y + 6, 20, 8);
    ctx.fillStyle = wood; ctx.fillRect(x + 1, y + 6, 18, 7);
    if (this.open) { ctx.fillStyle = shade(wood, -.4); ctx.fillRect(x, y, 20, 3); ctx.fillStyle = '#1a1010'; ctx.fillRect(x + 1, y + 4, 18, 2); }
    else { ctx.fillStyle = wood; ctx.fillRect(x, y + 1, 20, 6); ctx.fillStyle = shade(wood, .2); ctx.fillRect(x, y + 1, 20, 1); }
    ctx.fillStyle = band; ctx.fillRect(x + 3, y + 1, 2, 13); ctx.fillRect(x + 15, y + 1, 2, 13); ctx.fillRect(x + 8, y + 5, 4, 4);
    if (this.cursed && !this.open) {
      ctx.fillStyle = '#1a0a20'; ctx.fillRect(x + 9, y + 6, 2, 2);
      if (Math.random() < .3) FX.add({ x: x + rnd(0, 20), y: y + rnd(0, 6), vx: 0, vy: -20, life: .6, col: '#a960ea' });
      drawText(ctx, 'CURSED', x + 10, y - 9, '#c07af0', 1, 'center');
    }
  }
  light() { return !this.open ? [this.cursed ? '#a960ea' : '#f2c14e', 34] : null; }
}

class ShopItem extends Obj {
  constructor(x, y, food) {
    super(x - 8, y - 22, 16, 22); this.interactive = true;
    const bi = G.run.biome;
    if (food) { this.food = FOODS[Math.min(2, bi)]; this.price = 60 + bi * 50; }
    else { this.item = randomItem(bi + 1 + (Math.random() < .35 ? 1 : 0), Math.random() < .35 ? 'skill' : null); this.price = Math.round((110 + bi * 110) * (1 + .25 * (this.item.tier - bi - 1)) / 5) * 5; }
  }
  label() { return (this.food ? 'BUY ' + this.food.name : 'BUY ' + itemName(this.item)) + '  ' + this.price + 'G'; }
  interact() {
    const p = G.player;
    if (p.gold < this.price) { SND.play('deny'); UI.toast('Not enough gold'); return; }
    if (this.food) {
      if (p.hp >= p.maxHp) { UI.toast('Already at full health'); SND.play('deny'); return; }
      p.gold -= this.price; p.heal(p.maxHp * this.food.heal); SND.play('buy'); this.dead = true; return;
    }
    UI.offerItem(this.item, null, () => { p.gold -= this.price; SND.play('buy'); this.dead = true; });
  }
  draw(ctx, t) {
    const x = Math.round(this.x), y = Math.round(this.y);
    ctx.fillStyle = '#3a2a22'; ctx.fillRect(x + 1, y + 14, 14, 8); ctx.fillStyle = '#5a4030'; ctx.fillRect(x, y + 13, 16, 2);
    const bob = Math.round(Math.sin(t * 3 + x) * 1);
    ctx.drawImage(Art.icon(this.food ? 'food' : this.item.id), x, y - 3 + bob);
    drawText(ctx, this.price + 'G', x + 8, y + 16, G.player.gold >= this.price ? '#f2c14e' : '#8a6a5a', 1, 'center');
  }
  light() { return ['#f2c14e', 26]; }
}

class Merchant extends Obj {
  constructor(x, y) { super(x - 8, y - 26, 16, 26); }
  draw(ctx, t) {
    const x = Math.round(this.x + 8), y = Math.round(this.y + 26);
    ctx.fillStyle = '#2a1e2e'; ctx.fillRect(x - 7, y - 18, 14, 18); ctx.fillStyle = '#3a2a40'; ctx.fillRect(x - 7, y - 18, 3, 18);
    ctx.fillStyle = '#4a3a50'; ctx.fillRect(x - 5, y - 25, 10, 8); ctx.fillStyle = '#0c080e'; ctx.fillRect(x - 3, y - 23, 6, 5);
    ctx.fillStyle = '#f2c14e'; ctx.fillRect(x - 2, y - 21, 1, 1); ctx.fillRect(x + 1, y - 21, 1, 1);
    ctx.fillStyle = '#5a4a3a'; ctx.fillRect(x + 7, y - 30, 1, 22); ctx.fillStyle = '#ffcf6a'; ctx.fillRect(x + 6, y - 34, 3, 4);
    ctx.fillStyle = '#6a4a2a'; ctx.fillRect(x - 12, y - 8, 7, 8); ctx.fillStyle = '#8a6a3a'; ctx.fillRect(x - 12, y - 8, 7, 2);
    if (dist(G.player.x, G.player.y, this.x, this.y) < 90) drawText(ctx, 'WARES FOR WAX, FRIEND', x, y - 44, '#e8d6ad', 1, 'center');
  }
  light() { return ['#ffcf6a', 60]; }
}

class ExitDoor extends Obj {
  constructor(x, y, entry) { super(x - 14, y - 40, 28, 40); this.interactive = !entry; this.entry = entry; }
  label() { return G.level.B.boss ? 'CLAIM THE LAST KEY' : G.run.biome >= 2 ? "DESCEND TO THE WARDEN'S CRYPT" : 'LEAVE ' + BIOMES[G.run.biome].name; }
  interact() { G.exitLevel(); }
  draw(ctx, t) {
    const x = Math.round(this.x), y = Math.round(this.y), pal = G.level.B.pal;
    ctx.fillStyle = pal.rock2; ctx.fillRect(x - 3, y + 4, 34, 36); ctx.beginPath(); ctx.arc(x + 14, y + 8, 17, Math.PI, 0); ctx.fill();
    ctx.fillStyle = this.entry ? '#0c0a10' : '#1a0e08'; ctx.fillRect(x + 1, y + 8, 26, 32); ctx.beginPath(); ctx.arc(x + 14, y + 8, 13, Math.PI, 0); ctx.fill();
    if (!this.entry) {
      const g = .5 + Math.sin(t * 3) * .2;
      ctx.globalAlpha = g; ctx.fillStyle = '#ff9a3c'; ctx.fillRect(x + 4, y + 10, 20, 30); ctx.globalAlpha = 1;
      ctx.fillStyle = '#ffd08a'; ctx.fillRect(x + 12, y + 16, 4, 20);
      if (Math.random() < .3) FX.add({ x: x + rnd(4, 24), y: y + 38, vx: rnd(-5, 5), vy: -rnd(20, 50), life: .8, col: '#ffcf6a', glow: '#ff9a3c' });
    } else {
      ctx.fillStyle = '#3a3040'; for (let k = 3; k < 28; k += 5) ctx.fillRect(x + k, y + 4, 2, 36);
    }
  }
  light() { return this.entry ? null : ['#ff9a3c', 80]; }
}

class Door extends Obj {
  constructor(x, y, h) { super(x, y, 8, h); this.solid = true; this.interactive = true; this.breakable = true; this.hp = 1; }
  label() { return 'OPEN DOOR'; }
  interact() { this.openDoor(false, sign(this.x - G.player.x)); }
  smash(dir) { this.openDoor(true, dir || sign(this.x - G.player.x)); }
  openDoor(kick, dir) {
    if (this.dead) return;
    this.dead = true; this.interactive = false;
    SND.play('door'); G.addShake(kick ? 5 : 2);
    FX.burst(this.x + 4, this.y + this.h / 2, kick ? 30 : 12, ['#6a4226', '#4a2e1a', '#8a5a32'], kick ? 200 : 80, .7, { dir: dir > 0 ? 0 : Math.PI, spread: 1, size: 2, floor: true });
    if (kick) {
      const zone = { x: dir > 0 ? this.x + 8 : this.x - 60, y: this.y - 8, w: 60, h: this.h + 16 };
      for (const e of G.enemies) if (!e.dead && overlap(zone, e)) { e.hurt(20 * (1 + G.run.biome * .5), { dir, kb: 200, stun: 2, src: 'door' }); }
      UI.toast('Door smashed! Enemies behind it are stunned', 1.5);
    }
  }
  draw(ctx, t) {
    const x = Math.round(this.x), y = Math.round(this.y);
    ctx.fillStyle = '#4a2e1a'; ctx.fillRect(x, y, 8, this.h); ctx.fillStyle = '#6a4226'; ctx.fillRect(x + 1, y, 6, this.h);
    ctx.fillStyle = '#2a1a10'; for (let k = 3; k < this.h; k += 12) ctx.fillRect(x, y + k, 8, 1);
    ctx.fillStyle = '#5a5a66'; ctx.fillRect(x, y + 6, 8, 2); ctx.fillRect(x, y + this.h - 8, 8, 2); ctx.fillStyle = '#c9a24a'; ctx.fillRect(x + 5, y + this.h / 2, 2, 3);
  }
}

class Vase extends Obj {
  constructor(x, y) { super(x - 5, y - 12, 10, 12); this.breakable = true; this.v = rndi(0, 2); }
  smash(dir) {
    if (this.dead) return; this.dead = true; SND.play('hit');
    FX.burst(this.x + 5, this.y + 6, 14, ['#8a5a3a', '#a8704a', '#5a3a22'], 110, .6, { size: 2, floor: true });
    dropGold(this.x + 5, this.y, rndi(2, 6) + G.run.biome * 3);
    if (Math.random() < .15) dropCells(this.x + 5, this.y, 1);
  }
  draw(ctx) {
    const x = Math.round(this.x), y = Math.round(this.y), c = ['#8a5a3a', '#6a5a7a', '#5a7a6a'][this.v];
    ctx.fillStyle = shade(c, -.3); ctx.fillRect(x + 1, y + 3, 8, 9); ctx.fillStyle = c; ctx.fillRect(x + 1, y + 3, 7, 8); ctx.fillRect(x + 3, y, 4, 3);
    ctx.fillStyle = shade(c, .3); ctx.fillRect(x + 2, y + 4, 1, 5); ctx.fillStyle = shade(c, -.5); ctx.fillRect(x + 1, y + 7, 8, 1);
  }
}

class FireGround extends Obj {
  constructor(x, y, dps) {
    let gy = y; for (let i = 0; i < 6 && !groundPt(x, gy + 1); i++) gy += 8;
    super(x - 30, gy - 10, 60, 10); this.life = 4; this.tick = 0;
  }
  update(dt) {
    this.life -= dt; if (this.life <= 0) this.dead = true;
    this.tick -= dt;
    if (this.tick <= 0) { this.tick = .4; for (const e of G.enemies) if (!e.dead && overlap(this, e)) e.applyBurn(3); }
    if (Math.random() < .7) FX.add({ x: this.x + rnd(0, 60), y: this.y + 9, vx: 0, vy: -rnd(20, 50), life: .5, col: pick(['#ffab3d', '#e0572a', '#fff3a8']), glow: Math.random() < .2 ? '#ff8a3a' : null });
  }
  light() { return ['#ff8a3a', 50]; }
}

class Puddle extends Obj {
  constructor(x, y, dmg) { super(x - 14, y - 4, 28, 4); this.life = 3; this.dmg = dmg * .6; }
  update(dt) {
    this.life -= dt; if (this.life <= 0) this.dead = true;
    const p = G.player; if (p.alive && overlap(this, p.hurtbox())) p.hurt(this.dmg, { dir: 0, src: this, dot: true });
    if (Math.random() < .2) FX.add({ x: this.x + rnd(0, 28), y: this.y + 2, vx: 0, vy: -15, life: .4, col: '#b6d85a' });
  }
  draw(ctx) { ctx.globalAlpha = Math.min(1, this.life); ctx.fillStyle = '#5a7a2a'; ctx.fillRect(Math.round(this.x), Math.round(this.y) + 1, 28, 3); ctx.fillStyle = '#9ac84a'; ctx.fillRect(Math.round(this.x) + 3, Math.round(this.y) + 1, 20, 1); ctx.globalAlpha = 1; }
}

class WolfTrap extends Obj {
  constructor(x, y, p) {
    let gy = y; while (gy < y + 64 && !groundPt(x, gy + 1)) gy += 1;
    super(x - 7, gy - 5, 14, 5); this.armed = true; this.life = 20; this.dmg = p.skillDmg(p.slotOf('trap'));
  }
  update(dt) {
    this.life -= dt; if (this.life <= 0) this.dead = true;
    if (this.armed) for (const e of G.enemies) if (!e.dead && !e.fly && overlap(this, e)) {
      this.armed = false; this.life = .8; SND.play('block'); SND.play('hit');
      e.hurt(this.dmg, { dir: 0, kb: 0, root: 3, src: 'trap' }); FX.burst(this.x + 7, this.y, 8, '#d0d0da', 60, .3);
      break;
    }
  }
  draw(ctx) {
    const x = Math.round(this.x), y = Math.round(this.y);
    ctx.fillStyle = '#5a5a66'; ctx.fillRect(x, y + 3, 14, 2);
    ctx.fillStyle = '#a0a0aa';
    if (this.armed) { for (let k = 0; k < 14; k += 3) ctx.fillRect(x + k, y + 1, 1, 2); ctx.fillRect(x, y + 2, 1, 1); ctx.fillRect(x + 13, y + 2, 1, 1); }
    else for (let k = 2; k < 12; k += 2) ctx.fillRect(x + k, y - 2, 1, 5);
  }
}

class Turret extends Obj {
  constructor(x, y, p) {
    let gy = y; while (gy < y + 64 && !groundPt(x, gy + 1)) gy += 1;
    super(x - 6, gy - 12, 12, 12); this.life = 12; this.cd = .3; this.face = p.face; this.p = p; this.it = p.slotOf('turret');
  }
  update(dt) {
    this.life -= dt; if (this.life <= 0) { this.dead = true; FX.burst(this.x + 6, this.y + 6, 10, '#6a4a2a', 80, .4); }
    this.cd -= dt;
    if (this.cd <= 0) {
      let best = null, bd = 180;
      for (const e of G.enemies) { if (e.dead) continue; const d = dist(this.x + 6, this.y + 4, e.x + e.w / 2, e.y + e.h / 2); if (d < bd && losClear(this.x + 6, this.y + 4, e.x + e.w / 2, e.y + e.h / 2)) { bd = d; best = e; } }
      if (best) {
        this.cd = .55; const a = Math.atan2(best.y + best.h / 2 - this.y - 4, best.x + best.w / 2 - this.x - 6); this.face = Math.cos(a) >= 0 ? 1 : -1;
        const dmg = this.p.skillDmg(this.it);
        G.projs.push(new Proj({ x: this.x + 6, y: this.y + 4, vx: Math.cos(a) * 380, vy: Math.sin(a) * 380, owner: 'player', dmg, kind: 'bolt', item: this.it, kb: 30 }));
        SND.play('bow');
      } else this.cd = .2;
    }
  }
  draw(ctx) {
    const x = Math.round(this.x), y = Math.round(this.y), f = this.face;
    ctx.fillStyle = '#4a321a'; ctx.fillRect(x + 1, y + 8, 2, 4); ctx.fillRect(x + 9, y + 8, 2, 4); ctx.fillRect(x + 5, y + 6, 2, 6);
    ctx.fillStyle = '#6a4a2a'; ctx.fillRect(x + 1, y + 4, 10, 3); ctx.fillStyle = '#8a8a96'; ctx.fillRect(f > 0 ? x + 8 : x, y + 2, 4, 7);
    ctx.fillStyle = '#ddd'; ctx.fillRect(f > 0 ? x + 3 : x + 1, y + 5, 8, 1);
    if (this.life < 3 && Math.floor(this.life * 8) % 2) { ctx.fillStyle = '#ff5a3a'; ctx.fillRect(x + 5, y + 2, 2, 2); }
  }
}

// ---------- skill helpers ----------
function throwGrenade(p, sub, base) {
  const it = p.slotOf(sub === 'fire' ? 'firenade' : sub === 'ice' ? 'icenade' : 'keg');
  const dmg = p.skillDmg(it);
  G.projs.push(new Proj({ x: p.x + p.w / 2 + p.face * 6, y: p.y + 6, vx: p.face * (sub === 'keg' ? 150 : 210) + p.vx * .3, vy: sub === 'keg' ? -120 : -170, grav: 650, owner: 'player', kind: 'nade', sub, dmg, item: it, life: sub === 'keg' ? 1.1 : 2.5 }));
  SND.play('swing');
}
function phaseStrike(p, base) {
  let best = null, bd = 170;
  for (const e of G.enemies) { if (e.dead || e.type === 'warden' && e.state === 'intro') continue; const d = dist(p.x, p.y, e.x, e.y); if (d < bd && losClear(p.x + 5, p.y + 8, e.x + e.w / 2, e.y + e.h / 2)) { bd = d; best = e; } }
  if (!best) { UI.toast('No enemy in range'); SND.play('deny'); return false; }
  const behind = best.face > 0 ? best.x - p.w - 3 : best.x + best.w + 3;
  const ny = best.y + best.h - p.h;
  FX.burst(p.x + 5, p.y + 11, 16, ['#a960ea', '#e0c0ff'], 90, .4, { glow: '#a960ea', grav: 0 });
  if (!rectSolid(behind, ny, p.w, p.h)) { p.x = behind; p.y = ny; }
  else if (!rectSolid(best.x + best.w / 2 - p.w / 2, best.y - p.h - 2, p.w, p.h)) { p.x = best.x + best.w / 2 - p.w / 2; p.y = best.y - p.h - 2; }
  p.vx = 0; p.vy = 0; p.face = sign(best.x + best.w / 2 - (p.x + p.w / 2)) || 1;
  const it = p.slotOf('phaser');
  best.hurt(p.skillDmg(it), { dir: p.face, kb: 0, stun: 1.5, src: 'phase', item: it });
  FX.burst(p.x + 5, p.y + 11, 16, ['#a960ea', '#e0c0ff'], 90, .4, { glow: '#a960ea', grav: 0 });
  SND.play('teleport'); p.invuln = Math.max(p.invuln, .3);
  return true;
}

// ---------- timed effects & summons ----------
class Delay extends Obj {
  constructor(t, fn, x = 0, y = 0, r = 0) { super(x, y, 0, 0); this.tt = t; this.t0 = t; this.fn = fn; this.r = r; }
  update(dt) { this.tt -= dt; if (this.tt <= 0) { this.dead = true; this.fn(); } }
  draw(ctx, t) {
    if (!this.r) return;
    const k = 1 - this.tt / this.t0;
    ctx.globalAlpha = .35 + .4 * (Math.floor(t * 14) % 2); ctx.strokeStyle = '#ff5a3a'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(Math.round(this.x), Math.round(this.y), Math.max(1, this.r * k), 0, 7); ctx.stroke(); ctx.globalAlpha = 1;
  }
}

class Decoy extends Obj {
  constructor(p) {
    super(p.x, p.y, p.w, p.h); this.face = p.face; this.life = 7; this.maxHp = this.hp = p.maxHp * .5; this.skin = p.skin; this.p = p;
    this.vx = 0; this.vy = 0; this.onGround = true; this.it = p.slotOf('decoy'); G.decoy = this;
  }
  get alive() { return !this.dead; }
  hurtbox() { return this; }
  hurt(dmg) {
    if (this.dead) return 'ignored';
    this.hp -= dmg; FX.num(this.x + 5, this.y - 4, dmg, '#e8d6ad');
    FX.burst(this.x + 5, this.y + 10, 6, ['#e8d6ad', '#b89f76'], 80, .3);
    if (this.hp <= 0) this.pop();
    return 'hit';
  }
  update(dt) { this.life -= dt; this.vy = Math.min(this.vy + 1000 * dt, 400); moveBody(this, dt); if (this.life <= 0) this.pop(); }
  pop() {
    if (this.dead) return; this.dead = true; if (G.decoy === this) G.decoy = null;
    FX.burst(this.x + 5, this.y + 11, 24, ['#e8d6ad', '#b89f76', '#ffab3d'], 140, .6);
    explode(this.x + 5, this.y + 11, 40, this.p.skillDmg(this.it), 'player', { burn: true });
  }
  draw(ctx, t) {
    const fake = { skin: this.skin, x: this.x, y: this.y, w: this.w, h: this.h, face: this.face, state: 'normal', vx: 0, vy: 0, onGround: true, anim: 0, atk: null, invuln: 0, slots: [], healT: 0 };
    ctx.globalAlpha = .8; drawPlayer(ctx, fake, t); ctx.globalAlpha = 1;
    const bw = 14, k = clamp(this.life / 7, 0, 1);
    ctx.fillStyle = '#000'; ctx.fillRect(Math.round(this.x + 5 - bw / 2) - 1, Math.round(this.y) - 9, bw + 2, 3);
    ctx.fillStyle = '#e8d6ad'; ctx.fillRect(Math.round(this.x + 5 - bw / 2), Math.round(this.y) - 8, Math.ceil(bw * k), 1);
  }
  light() { return ['#ffb060', 60]; }
}

class Miasma extends Obj {
  constructor(p, dmg) { super(p.x, p.y, 0, 0); this.p = p; this.life = 6; this.tick = 0; this.dmg = dmg; }
  update(dt) {
    this.life -= dt; if (this.life <= 0) this.dead = true;
    const cx = this.p.x + 5, cy = this.p.y + 11; this.x = cx; this.y = cy; this.tick -= dt;
    if (this.tick <= 0) {
      this.tick = .5;
      for (const e of G.enemies) if (!e.dead && dist(cx, cy, e.cx, e.cy) < 72) { e.bleed = Math.min(6, e.bleed + 1); e.bleedT = 4; e.aggro = true; e.dotDamage(this.dmg, '#b06aff'); }
    }
    for (let i = 0; i < 3; i++) FX.add({ x: cx + rnd(-64, 64), y: cy + rnd(-34, 18), vx: rnd(-10, 10), vy: -rnd(5, 15), life: .9, col: pick(['#6a3a8a', '#8aba4a', '#4a2a5a', '#b06aff']), size: 2 });
  }
  light() { return ['#b06aff', 90]; }
}

// ---------- new skills ----------
function fireHook(p) {
  const it = p.slotOf('hook');
  G.projs.push(new Proj({
    x: p.x + p.w / 2 + p.face * 6, y: p.y + 9, vx: p.face * 480, owner: 'player', kind: 'hook', life: .34, r: 3, src: p, item: it,
    onHit: e => {
      e.hurt(p.skillDmg(it), { dir: -p.face, kb: 0, stun: 1.2, item: it, src: 'proj' });
      if (e.type !== 'warden' && !e.dead) {
        const nx = p.face > 0 ? p.x + p.w + 3 : p.x - e.w - 3;
        if (!rectSolid(nx, e.y, e.w, e.h)) e.x = nx;
        else if (!rectSolid(nx, p.y + p.h - e.h, e.w, e.h)) { e.x = nx; e.y = p.y + p.h - e.h; }
      }
      SND.play('hook'); FX.burst(e.cx, e.cy, 10, ['#c9ccd8', '#fff'], 100, .3);
    }
  }));
  SND.play('hook');
}
function castNova(p) {
  const it = p.slotOf('nova'), cx = p.x + p.w / 2, cy = p.y + p.h / 2, dmg = p.skillDmg(it);
  SND.play('boom'); G.addShake(5); G.hitstop = Math.max(G.hitstop, .04);
  FX.ring(cx, cy, 62, '#ff8a3a', .35); FX.flash(cx, cy, 140, '#ffb45a', .3);
  for (let k = 0; k < 40; k++) { const a = k / 40 * Math.PI * 2; FX.add({ x: cx + Math.cos(a) * 8, y: cy + Math.sin(a) * 8, vx: Math.cos(a) * 220, vy: Math.sin(a) * 220, life: .35, col: pick(['#ffab3d', '#e0572a', '#fff3a8']), drag: 5, glow: k % 6 ? null : '#ff8a3a' }); }
  for (const e of G.enemies) if (!e.dead && dist(cx, cy, e.cx, e.cy) < 62) e.hurt(dmg, { dir: sign(e.cx - cx) || 1, kb: 240, burn: true, item: it, src: 'boom' });
  for (const ob of G.objs) if (ob.breakable && !ob.dead && dist(cx, cy, ob.x + ob.w / 2, ob.y + ob.h / 2) < 62) ob.smash(sign(ob.x - cx));
}
function castWard(p) {
  p.ward = { hp: p.maxHp * .35, t: 5 }; SND.play('parry');
  FX.burst(p.x + 5, p.y + 11, 20, ['#ffe6a0', '#e8d6ad'], 100, .5, { grav: 0, glow: '#ffd070' });
}
function spawnDecoy(p) {
  if (G.decoy && !G.decoy.dead) G.decoy.pop();
  G.objs.push(new Decoy(p)); SND.play('teleport'); p.invuln = Math.max(p.invuln, .3);
  FX.burst(p.x + 5, p.y + 11, 16, ['#e8d6ad', '#fff'], 90, .4, { grav: 0 });
}
function callStorm(p) {
  const it = p.slotOf('storm'), cx = p.x + p.w / 2, cy = p.y + p.h / 2;
  const tg = G.enemies.filter(e => !e.dead && dist(cx, cy, e.cx, e.cy) < 230).sort((a, b) => dist(cx, cy, a.cx, a.cy) - dist(cx, cy, b.cx, b.cy)).slice(0, 4);
  if (!tg.length) { UI.toast('No enemy in range'); SND.play('deny'); return false; }
  tg.forEach((e, i) => G.objs.push(new Delay(i * .09, () => {
    if (e.dead) return;
    G.addBolt(e.cx + rnd(-12, 12), e.y - 130, e.cx, e.cy); FX.flash(e.cx, e.cy, 60, '#fff6a0', .15);
    e.hurt(p.skillDmg(it), { dir: sign(e.cx - cx) || 1, kb: 0, stun: .45, item: it, crit: e.disabled(), src: 'storm' });
    SND.play('zap');
  })));
  G.addShake(3);
  return true;
}

// ---------- ultimates ----------
function ultDamage(p, base) { return base * (1 + .6 * Math.min(G.run.biome, 2)) * (1 + .06 * (p.stats.b + p.stats.t + p.stats.s)); }
const ULT_FX = {
  flare(p) {
    const cx = p.x + 5, cy = p.y + 11;
    explode(cx, cy, 96, ultDamage(p, 70), 'player', { burn: true, big: true, src: 'ult' });
    FX.ring(cx, cy, 120, '#ffab3d', .5); FX.flash(cx, cy, 280, '#ffb45a', .5); p.invuln = Math.max(p.invuln, .5);
  },
  frost(p) {
    const cx = p.x + 5, cy = p.y + 11; SND.play('freeze');
    FX.ring(cx, cy, 260, '#8fdcff', .6); FX.flash(cx, cy, 320, '#8fdcff', .6);
    FX.burst(cx, cy, 70, ['#bfefff', '#8fdcff', '#ffffff'], 260, .8, { grav: 20, glow: '#8fdcff' });
    for (const e of G.enemies) if (!e.dead && dist(cx, cy, e.cx, e.cy) < 260) e.hurt(ultDamage(p, 25), { freeze: 4, dir: sign(e.cx - cx) || 1, kb: 0, src: 'ult' });
  },
  toll(p) {
    const cx = p.x + 5, cy = p.y + 11; SND.play('bell'); G.addShake(8);
    FX.ring(cx, cy, 260, '#7aff9a', .7); FX.ring(cx, cy, 170, '#e8ffe8', .5); FX.flash(cx, cy, 300, '#7aff9a', .4);
    for (const e of G.enemies) if (!e.dead && dist(cx, cy, e.cx, e.cy) < 260) e.hurt(ultDamage(p, 45), { stun: 2.5, dir: sign(e.cx - cx) || 1, kb: 120, src: 'ult' });
  },
  charge(p) {
    p.state = 'ultdash'; p.dashT = .4; p.dashDir = p.face; p.invuln = Math.max(p.invuln, .6); p.dashHit = new Set(); p.dashDmg = ultDamage(p, 90); p.atk = null;
    SND.play('dash'); SND.play('roar'); G.addShake(5);
  },
  rain(p) {
    const cx = p.x + 5, cy = p.y + 11;
    const tg = G.enemies.filter(e => !e.dead && dist(cx, cy, e.cx, e.cy) < 280);
    for (let i = 0; i < 10; i++) G.objs.push(new Delay(i * .07, () => {
      const e = tg.length ? tg[i % tg.length] : null;
      const x = e && !e.dead ? e.cx + rnd(-6, 6) : cx + rnd(-110, 110);
      let y = (e && !e.dead ? e.y : p.y) - 90; for (let k = 0; k < 12 && solidPt(x, y); k++) y += 8;
      G.projs.push(new Proj({ x, y, vx: 0, vy: 560, owner: 'player', kind: 'dagger', srcTag: 'ult', dmg: ultDamage(p, 24), bleed: true, bleedStacks: 2, life: 1.4, r: 3, kb: 20 }));
      SND.play('stab');
    }));
    FX.flash(cx, cy, 200, '#ffd84a', .4); SND.play('gold');
  },
  riptide(p) {
    for (const d of [-1, 1]) G.projs.push(new Proj({ x: p.x + 5 + d * 8, y: p.y + p.h - 1, vx: d * 290, owner: 'player', kind: 'wave', srcTag: 'ult', dmg: ultDamage(p, 50), life: 1.3, r: 10, pierce: 99, kb: 320 }));
    SND.play('boom'); G.addShake(6); FX.ring(p.x + 5, p.y + 11, 80, '#5fe0d0', .4);
  },
  phantom(p) {
    p.phantomT = 6; p.invuln = Math.max(p.invuln, .2); SND.play('teleport');
    FX.burst(p.x + 5, p.y + 11, 30, ['#c8f0ff', '#ffffff'], 120, .6, { grav: -40, glow: '#c8f0ff' });
  },
  miasma(p) { G.objs.push(new Miasma(p, ultDamage(p, 7))); SND.play('curse'); FX.ring(p.x + 5, p.y + 11, 72, '#b06aff', .5); }
};
