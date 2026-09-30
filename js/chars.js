'use strict';
// Character and enemy rendering. Everything is drawn in a facing-aware local space
// whose origin is the feet centre (y grows downward, so the body lives at negative y).

const FLAMES = {
  normal: ['#e0572a', '#ffab3d', '#fff3a8'], blue: ['#2a6ae0', '#5fd4ff', '#e8fbff'], green: ['#1a8a4a', '#6aff9a', '#e8ffe8'],
  red: ['#8a1010', '#ff3a2a', '#ffd0a0'], gold: ['#b07a10', '#ffd84a', '#fffbe0'], purple: ['#5a1a8a', '#b06aff', '#f0d8ff'],
  white: ['#8aa0c0', '#d8f0ff', '#ffffff'], curse: ['#6a1a9a', '#b04ae0', '#f0c8ff']
};
const FLAME_LIGHT = { normal: '#ffb060', blue: '#6ac8ff', green: '#6aff9a', red: '#ff5a3a', gold: '#ffd84a', purple: '#b06aff', white: '#d8f0ff', curse: '#b04ae0' };

function drawFlame(ctx, x, y, t, kind, boost = 0, size = 1) {
  const c = FLAMES[kind] || FLAMES.normal;
  const s = Math.sin(t * 17) + Math.sin(t * 29) * .5;
  const hgt = Math.max(3, Math.round((5 + s + boost) * size)), w = Math.max(2, Math.round(4 * size));
  x = Math.round(x); y = Math.round(y);
  ctx.fillStyle = c[0]; ctx.fillRect(x - (w >> 1), y - hgt + 2, w, hgt - 1); ctx.fillRect(x - 1 + (s > 0 ? 1 : 0), y - hgt, 1, 2);
  ctx.fillStyle = c[1]; ctx.fillRect(x - (w >> 1) + 1, y - hgt + 3, Math.max(1, w - 1), Math.max(1, hgt - 3));
  ctx.fillStyle = c[2]; ctx.fillRect(x, y - hgt + 4, 1, Math.max(1, hgt - 5));
}
function groundBelow(x, y) {
  if (!G.level) return null;
  for (let d = 0; d < 110; d += 3) if (groundPt(x, y + d)) return Math.floor((y + d) / TS) * TS;
  return null;
}
function drawShadow(ctx, x, y, w, fly) {
  const gy = groundBelow(x, y - 1); if (gy == null) return;
  const k = clamp(1 - (gy - y) / 110, .2, 1), ww = Math.max(4, Math.round(w * k));
  ctx.fillStyle = `rgba(0,0,0,${.38 * k})`;
  ctx.fillRect(Math.round(x - ww / 2), gy - 1, ww, 2); ctx.fillRect(Math.round(x - ww / 2) + 2, gy - 2, ww - 4, 1);
}

// ---------------- player ----------------
function playerPose(p, t) {
  const P = { la: 0, lb: 0, liftA: 0, liftB: 0, bob: 0, lean: 0, swing: 0, arm: 'hang' };
  const st = p.state;
  if (st === 'climb') { const c = Math.round(Math.sin(p.climbAnim) * 2); P.liftA = c > 0 ? c : 0; P.liftB = c < 0 ? -c : 0; P.la = -1; P.lb = 1; P.arm = 'climb'; return P; }
  if (st === 'normal' && p.wallDir && !p.onGround) { P.la = 1; P.lb = -1; P.liftA = 3; P.liftB = 1; P.lean = -1; P.arm = 'wall'; return P; }
  if (st === 'dash' || st === 'ultdash') { P.la = 3; P.lb = -3; P.liftA = 2; P.liftB = 1; P.lean = 2; P.arm = 'back'; return P; }
  const run = p.onGround && Math.abs(p.vx) > 10;
  if (run) {
    const ph = p.anim; P.la = Math.round(Math.sin(ph) * 3); P.lb = -P.la;
    P.liftA = Math.round(Math.max(0, Math.cos(ph)) * 2); P.liftB = Math.round(Math.max(0, -Math.cos(ph)) * 2);
    P.bob = Math.abs(Math.sin(ph)) > .7 ? -1 : 0; P.swing = -P.la; P.lean = Math.abs(p.vx) > 90 ? 1 : 0;
  } else if (!p.onGround) {
    if (p.vy < 0) { P.la = 2; P.lb = -1; P.liftA = 3; P.liftB = 1; P.swing = -2; } else { P.la = 1; P.lb = -2; P.liftA = 1; P.swing = 2; }
  } else P.bob = Math.sin(t * 2.4) > .55 ? 1 : 0;
  if (p.atk) { P.arm = 'atk'; if (p.atk.phase === 'act') P.lean = 1; }
  if (st === 'block') P.arm = 'atk';
  if (p.healT > 0) P.arm = 'drink';
  return P;
}

const HEADS = {
  candle(D, c, l, hy) {
    D.r(-3 + l, hy, 6, 6, c.head); D.r(2 + l, hy, 1, 6, c.headD); D.r(-3 + l, hy, 6, 1, c.headL);
    D.r(-3 + l, hy + 5, 1, 2, c.head); D.r(2 + l, hy + 5, 1, 1, c.headD); D.r(1 + l, hy + 2, 1, 2, '#2a1c14'); D.r(0 + l, hy - 1, 1, 1, '#222');
    return { x: l, y: hy - 1, s: 1 };
  },
  hood(D, c, l, hy) {
    D.r(-4 + l, hy - 1, 8, 8, c.head); D.r(-4 + l, hy - 1, 8, 1, c.headL); D.r(-5 + l, hy + 2, 1, 5, c.headD); D.r(-3 + l, hy - 2, 4, 1, c.head);
    D.r(-1 + l, hy + 1, 4, 5, '#0c0a10'); D.r(0 + l, hy + 3, 1, 1, '#9fe8ff'); D.r(2 + l, hy + 3, 1, 1, '#9fe8ff');
    return { x: -2 + l, y: hy - 2, s: .8 };
  },
  skull(D, c, l, hy) {
    D.r(-3 + l, hy, 7, 5, c.head); D.r(-3 + l, hy, 7, 1, c.headL); D.r(-3 + l, hy + 1, 1, 4, c.headD); D.r(-1 + l, hy + 5, 5, 2, c.headD);
    D.r(0 + l, hy + 2, 2, 2, '#0c0a10'); D.r(3 + l, hy + 2, 1, 2, '#0c0a10'); D.r(1 + l, hy + 2, 1, 1, '#7aff9a');
    D.r(0 + l, hy + 6, 1, 1, '#0c0a10'); D.r(2 + l, hy + 6, 1, 1, '#0c0a10');
    return { x: l, y: hy - 1, s: 1 };
  },
  helm(D, c, l, hy) {
    D.r(-4 + l, hy - 1, 8, 8, c.head); D.r(-4 + l, hy - 1, 8, 2, c.headL); D.r(3 + l, hy, 1, 7, c.headD);
    D.r(-1 + l, hy + 3, 5, 1, '#0c0a10'); D.r(1 + l, hy + 3, 2, 1, '#ff6a3a'); D.r(-4 + l, hy + 6, 8, 1, c.headD); D.r(-2 + l, hy + 1, 1, 1, c.headL);
    return { x: -1 + l, y: hy - 2, s: 1.1 };
  },
  crown(D, c, l, hy) {
    D.r(-3 + l, hy + 1, 6, 6, c.head); D.r(2 + l, hy + 1, 1, 6, c.headD); D.r(1 + l, hy + 3, 1, 2, '#2a1020');
    D.r(-3 + l, hy - 1, 7, 2, '#c9a24a'); D.r(-3 + l, hy - 3, 1, 2, '#c9a24a'); D.r(0 + l, hy - 4, 1, 3, '#ffd84a'); D.r(3 + l, hy - 3, 1, 2, '#c9a24a'); D.r(0 + l, hy, 1, 1, '#e04060');
    return { x: l, y: hy - 5, s: .8 };
  },
  diver(D, c, l, hy) {
    D.r(-4 + l, hy - 1, 9, 8, c.head); D.r(-3 + l, hy - 2, 7, 1, c.head); D.r(-4 + l, hy - 1, 9, 1, c.headL); D.r(4 + l, hy, 1, 6, c.headD);
    D.r(0 + l, hy + 1, 4, 4, '#0a1a1a'); D.r(0 + l, hy + 1, 4, 1, c.headD); D.r(-4 + l, hy + 6, 9, 1, c.headD); D.r(-3 + l, hy + 2, 1, 1, c.headL);
    return { x: 2 + l, y: hy + 5, s: .55 };
  },
  ghost(D, c, l, hy, t) {
    D.r(-3 + l, hy, 6, 6, c.head); D.r(-3 + l, hy, 6, 1, c.headL); D.r(-3 + l, hy + 6, 1, 1 + (Math.sin(t * 6) > 0 ? 1 : 0), c.head); D.r(1 + l, hy + 6, 1, 2, c.headD);
    D.r(0 + l, hy + 2, 1, 2, '#6a8aaa'); D.r(2 + l, hy + 2, 1, 2, '#6a8aaa');
    return { x: l, y: hy, s: 1.4 };
  },
  beak(D, c, l, hy) {
    D.r(-3 + l, hy, 6, 6, c.head); D.r(-3 + l, hy, 6, 1, c.headL); D.r(3 + l, hy + 2, 3, 2, c.head); D.r(6 + l, hy + 3, 2, 1, c.headD); D.r(3 + l, hy + 3, 3, 1, c.headD);
    D.r(0 + l, hy + 1, 2, 2, '#1a1a1e'); D.r(0 + l, hy + 1, 1, 1, '#b0ff6a');
    D.r(-5 + l, hy - 1, 11, 1, '#1a1a1e'); D.r(-3 + l, hy - 4, 6, 3, '#2a2a2e'); D.r(-3 + l, hy - 2, 6, 1, '#6a3a8a');
    return { x: l, y: hy - 5, s: .8 };
  }
};

function drawBody(ctx, S, ox, oy, f, P, t, ov, vx = 0) {
  const c = S.pal, D = painter(ctx, ox, oy, f, ov), l = P.lean, b = P.bob;
  if (P.arm !== 'climb') D.r(-4 + l - Math.round(P.swing * .5), -15 + b, 2, 5, c.cloakD);
  const flap = clamp(Math.abs(vx) / 60, 0, 3);
  for (let i = 0; i < 4; i++) { const w = Math.round(Math.sin(t * 8 - i * .9) * (.5 + flap * .35)); D.r(-6 - Math.round(i * .7 * flap) + l + w, -16 + b + i * 3, 3, 3, i % 2 ? c.capeD : c.cape); }
  const leg = (off, lift, col) => { D.r(-2 + Math.round(off * .5), -8 + b, 3, 4, col); D.r(-2 + off, -4 - lift, 3, 3, col); D.r(-2 + off, -2 - lift, 4, 2, c.boots); };
  leg(P.lb - 1, P.liftB, c.legsD);
  D.r(-4 + l, -17 + b, 8, 10, c.cloak); D.r(-4 + l, -17 + b, 2, 10, c.cloakD); D.r(3 + l, -16 + b, 1, 8, c.cloakL);
  D.r(-4 + l, -9 + b, 8, 2, c.cloakD);
  D.r(-4 + l, -11 + b, 8, 1, c.belt); D.r(0 + l, -11 + b, 2, 1, c.buckle);
  for (let k = 0; k < 4; k++) D.r(-2 + k + l, -16 + k + b, 1, 1, c.belt);
  leg(P.la + 1, P.liftA, c.legs);
  D.r(-4 + l, -18 + b, 9, 2, c.scarf); D.r(-4 + l, -17 + b, 9, 1, c.scarfD);
  const sw = Math.sin(t * 10) > 0 ? 0 : 1;
  D.r(-7 - Math.round(flap) + l, -18 + b + sw, 3, 2, c.scarfD); D.r(-9 - Math.round(flap * 1.3) + l, -17 + b + sw, 2, 1, c.scarf);
  const anchor = HEADS[S.head](D, c, l, -24 + b, t);
  const arm = (x, y, w, h) => D.r(x + l, y + b, w, h, c.cloakD);
  if (P.arm === 'hang') { const s = Math.round(P.swing * .5); arm(1 + s, -15, 2, 5); D.r(1 + P.swing + l, -10 + b, 2, 2, c.hand); }
  else if (P.arm === 'atk') { arm(1, -15, 4, 2); D.r(5 + l, -15 + b, 2, 2, c.hand); }
  else if (P.arm === 'drink') { arm(1, -16, 2, 3); D.r(1 + l, -19 + b, 2, 2, c.hand); D.r(2 + l, -23 + b, 2, 4, '#c93a4a'); }
  else if (P.arm === 'climb') { D.r(-4, -21 - (P.liftA ? 1 : 0) + b, 2, 6, c.cloakD); D.r(3, -21 - (P.liftB ? 1 : 0) + b, 2, 6, c.cloakD); }
  else if (P.arm === 'wall') { D.r(-6 + l, -22 + b, 2, 7, c.cloakD); D.r(-7 + l, -23 + b, 2, 2, c.hand); }
  else if (P.arm === 'back') arm(-3, -14, 5, 2);
  return anchor;
}

function drawPlayer(ctx, p, t) {
  const S = p.skin || SKINS[0];
  const ox = Math.round(p.x + p.w / 2), oy = Math.round(p.y + p.h), f = p.face;
  if (p.state === 'dead') return drawPlayerDead(ctx, p, S, ox, oy, t);
  if (!p.preview) drawShadow(ctx, ox, oy, 12);
  if (p.ghosts) for (const g of p.ghosts) { ctx.globalAlpha = g.a * .5; drawBody(ctx, S, g.x, g.y, g.f, g.P, t, S.pal.trail, 0); }
  ctx.globalAlpha = 1;
  const blink = p.invuln > 0 && !['roll', 'dash', 'ultdash'].includes(p.state) && !(p.phantomT > 0) && Math.floor(t * 20) % 2 === 0;
  const flameKind = p.curse > 0 ? 'curse' : S.flame;
  ctx.save();
  const sq = p.sq || 0;
  if (sq) { ctx.translate(ox, oy); ctx.scale(1 + sq, 1 - sq); ctx.translate(-ox, -oy); }
  if (p.phantomT > 0) ctx.globalAlpha = .55; else if (S.head === 'ghost') ctx.globalAlpha = .88;
  let anchor = { x: 0, y: -25, s: 1 };
  if (p.state === 'roll') drawRoll(ctx, S, ox, oy, f, p);
  else if (!blink) {
    const P = playerPose(p, t);
    if (p.curse > 0) withOutline(ctx, '#7a2aa8', (a, b, col) => { const r = drawBody(ctx, S, ox + a, oy + b, f, P, t, col, p.vx); if (!col) anchor = r; });
    else anchor = drawBody(ctx, S, ox, oy, f, P, t, null, p.vx);
  }
  ctx.restore(); ctx.globalAlpha = 1;
  if (p.state !== 'roll') {
    const fx = f > 0 ? ox + anchor.x : ox - anchor.x - 1;
    drawFlame(ctx, fx, oy + anchor.y, t, flameKind, (p.flameBoost || 0) + (p.surge >= 100 ? 2 : 0), anchor.s);
  }
  drawPlayerWeapon(ctx, p, ox, oy, t);
  if (p.ward) {
    const a = .45 + Math.sin(t * 6) * .12;
    ctx.globalAlpha = a * .35; ctx.fillStyle = '#ffd070'; ctx.beginPath(); ctx.arc(ox, oy - 11, 16, 0, 7); ctx.fill();
    ctx.globalAlpha = a; ctx.strokeStyle = '#ffe6a0'; ctx.lineWidth = 1; ctx.stroke(); ctx.globalAlpha = 1;
  }
  if (p.blades) for (let i = 0; i < 3; i++) {
    const a = t * 5 + i * 2.094, bx = ox + Math.cos(a) * 22, by = oy - 11 + Math.sin(a) * 15;
    drawWeaponShape(ctx, { blade: '#b8e8ff', len: 8 }, bx, by, a + 1.57, 1);
  }
}
function drawRoll(ctx, S, ox, oy, f, p) {
  const c = S.pal, k = p.rollT / p.rollDur, sq = Math.round(Math.sin(k * Math.PI) * 2), D = painter(ctx, ox, oy, f, null);
  D.r(-6, -11 + sq, 12, 10 - sq, c.cloak); D.r(-6, -11 + sq, 12, 2, c.cloakL); D.r(-6, -6, 3, 4, c.cloakD);
  D.r(-5, -4, 10, 3, c.legsD); D.r(3, -10 + sq, 4, 4, c.head); D.r(-7, -8, 3, 2, c.scarf);
}
function drawPlayerDead(ctx, p, S, ox, oy, t) {
  const c = S.pal;
  ctx.fillStyle = c.cloak; ctx.fillRect(ox - 8, oy - 4, 14, 4); ctx.fillStyle = c.legsD; ctx.fillRect(ox + 6, oy - 3, 5, 3);
  ctx.fillStyle = c.head; ctx.fillRect(ox - 13, oy - 5, 6, 5); ctx.fillStyle = c.scarf; ctx.fillRect(ox - 8, oy - 4, 2, 2);
  if (Math.sin(t * 6) > -0.2) { ctx.fillStyle = '#555'; ctx.fillRect(ox - 11 + Math.round(Math.sin(t * 3)), oy - 8 - ((t * 10) % 6), 1, 1); }
}

const SWING = {
  slash: [-2.0, 0.9], upslash: [1.0, -1.7], heavy: [-2.3, 1.0], upheavy: [1.1, -2.0], overhead: [-2.8, 1.25],
  thrust: [0, 0], stab: [0.1, 0.1], stab2: [-0.15, -0.15], slam: [-2.6, 1.4], punch: [0, 0], spin: [-3.1, 3.1]
};
function drawPlayerWeapon(ctx, p, ox, oy, t) {
  const f = p.face, a = p.atk, sx = ox + f * 2, sy = oy - 14;
  if (p.state === 'block') {
    ctx.fillStyle = '#5a3a22'; ctx.fillRect(ox + (f > 0 ? 5 : -10), oy - 20, 5, 15);
    ctx.fillStyle = p.parryT > 0 ? '#fff6c0' : '#8a5a32'; ctx.fillRect(ox + (f > 0 ? 6 : -9), oy - 19, 3, 13);
    ctx.fillStyle = '#b0b0ba'; ctx.fillRect(ox + (f > 0 ? 6 : -9), oy - 14, 3, 3);
    return;
  }
  if (!a) {
    if (['climb', 'roll', 'wall', 'dash', 'ultdash'].includes(p.state) || p.healT > 0) return;
    const it = p.slots[0]; if (!it || it.def.kind !== 'melee' || it.id === 'fists') return;
    drawWeaponShape(ctx, it.def, sx - f * 1, sy + 5, 1.25, f);
    return;
  }
  const it = a.item, def = it.def, step = a.stepDef;
  if (def.kind === 'bow') {
    if (def.proj === 'knife') {
      const k = a.phase === 'wind' ? a.t / step.w : 1;
      drawWeaponShape(ctx, { blade: '#d8e0e8', len: 5 }, sx + f * (3 - k * 4), sy - 3 + k * 2, -0.6 + k * .6, f);
      return;
    }
    const pull = a.phase === 'wind' ? a.t / step.w : 0;
    ctx.save(); ctx.translate(sx + f * 5, sy); ctx.scale(f, 1);
    ctx.strokeStyle = def.blade; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(-3, 0, 8, -1.2, 1.2); ctx.stroke();
    ctx.strokeStyle = '#ddd'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, -7.5); ctx.lineTo(-3 - pull * 5, 0); ctx.lineTo(0, 7.5); ctx.stroke();
    if (a.phase === 'wind') { ctx.fillStyle = '#c9c4b8'; ctx.fillRect(-3 - pull * 5, -0.5, 14, 1); }
    ctx.restore(); return;
  }
  if (def.kind === 'frost' || def.kind === 'spark') {
    ctx.fillStyle = def.blade; const glow = a.phase === 'wind' ? a.t / step.w : 1;
    ctx.fillRect(sx + f * 6 - 2, sy - 2, 4, 4); ctx.fillStyle = '#fff'; ctx.fillRect(sx + f * 6 - 1, sy - 1, 2 * glow, 2 * glow);
    return;
  }
  if (def.kind !== 'melee') return;
  const sw = SWING[step.style] || SWING.slash;
  let ang, ext = 0;
  if (a.phase === 'wind') { const k = a.t / step.w; ang = sw[0] - 0.25 * k * sign(sw[1] - sw[0] || 1); ext = -k * 3; }
  else if (a.phase === 'act') { const k = easeOut(clamp(a.t / step.a, 0, 1)); ang = lerp(sw[0], sw[1], k); ext = k * 4; }
  else { ang = sw[1]; ext = 3 * (1 - a.t / step.r); }
  const thrust = step.style === 'thrust' || step.style.startsWith('stab') || step.style === 'punch';
  if (thrust) {
    const reachK = a.phase === 'act' ? easeOut(clamp(a.t / step.a, 0, 1)) : a.phase === 'wind' ? -0.3 * (a.t / step.w) : 1 - a.t / step.r;
    const dx = reachK * (step.reach - (def.len || 10) - 6);
    drawWeaponShape(ctx, def, sx + f * dx, sy + 2, ang, f);
    if (a.phase === 'act') {
      ctx.fillStyle = 'rgba(255,255,255,0.5)'; const x0 = f > 0 ? sx + 4 : sx - step.reach; ctx.fillRect(x0, sy + 1, step.reach, 2);
      ctx.fillStyle = STAT[def.stat].col; ctx.globalAlpha = .6; ctx.fillRect(x0, sy + 3, step.reach, 1); ctx.globalAlpha = 1;
      if (step.style === 'punch') { ctx.fillStyle = '#ffab3d'; ctx.globalAlpha = .7; ctx.fillRect(sx + f * (dx + 4) - 3, sy - 1, 6, 6); ctx.globalAlpha = 1; }
    }
    return;
  }
  if (a.phase === 'act' || (a.phase === 'rec' && a.t < 0.05)) {
    const k = a.phase === 'act' ? easeOut(clamp(a.t / step.a, 0, 1)) : 1;
    const a0 = sw[0], a1 = lerp(sw[0], sw[1], k);
    ctx.save(); ctx.translate(sx, sy); ctx.scale(f, 1);
    const lo = Math.min(a0, a1), hi = Math.max(a0, a1), R = step.reach;
    ctx.globalAlpha = a.phase === 'act' ? 0.55 : 0.25;
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, R, lo, hi); ctx.arc(0, 0, R * 0.55, hi, lo, true); ctx.closePath(); ctx.fill();
    ctx.globalAlpha *= 0.9; ctx.fillStyle = STAT[def.stat].col; ctx.beginPath(); ctx.arc(0, 0, R + 1.5, lo, hi); ctx.arc(0, 0, R - 2, hi, lo, true); ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 1; ctx.restore();
  }
  drawWeaponShape(ctx, def, sx + f * ext * Math.cos(ang), sy + ext * Math.sin(ang), ang, f);
}

// Render a character standing still into its own canvas (wardrobe previews)
function drawSkinPreview(canvas, S, t) {
  const x = canvas.getContext('2d'); x.imageSmoothingEnabled = false;
  x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, canvas.width, canvas.height);
  const k = canvas.width / 32; x.setTransform(k, 0, 0, k, 0, 0);
  const g = x.createRadialGradient(16, 16, 1, 16, 16, 17); g.addColorStop(0, FLAME_LIGHT[S.flame] + '55'); g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g; x.fillRect(0, 0, 32, 32);
  x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(9, 30, 14, 1);
  const fake = { skin: S, x: 11, y: 8, w: 10, h: 22, face: 1, state: 'normal', vx: 0, vy: 0, onGround: true, anim: 0, atk: null, invuln: 0, preview: true, slots: [], healT: 0 };
  drawPlayer(x, fake, t);
  x.setTransform(1, 0, 0, 1, 0, 0);
}

// ---------------- enemies ----------------
function drawEnemy(ctx, e, t) {
  const ox = Math.round(e.x + e.w / 2), oy = Math.round(e.y + e.h), f = e.face;
  if (e.state !== 'dead' && !(e.type === 'gargoyle' && e.state === 'perch')) drawShadow(ctx, ox, oy, e.w + 4, e.fly);
  let ov = e.flash > 0 ? '#ffffff' : null;
  const draw = (dx, dy, o) => ENEMY_ART[e.type](painter(ctx, ox + dx, oy + dy, f, o), e, t);
  const tele = e.state === 'wind';
  if (e.mod === 'hasted' && Math.abs(e.vx) > 30) { ctx.globalAlpha = .3; draw(-sign(e.vx) * 5, 0, '#6ae0ff'); ctx.globalAlpha = 1; }
  if (tele) withOutline(ctx, Math.floor(t * 16) % 2 ? '#ff6a2a' : '#ffd84a', (a, b, c) => draw(a, b, c || ov));
  else if (e.elite && e.state !== 'dead') withOutline(ctx, (ELITE_MODS.find(m => m.id === e.mod) || {}).col || '#ffcf3a', (a, b, c) => draw(a, b, c || ov));
  else draw(0, 0, ov);
  if (e.frozen > 0) { ctx.globalAlpha = 0.55; draw(0, 0, '#bfefff'); ctx.globalAlpha = 1; }
  if (e.state === 'hit' && e.flash <= 0) { ctx.globalAlpha = .25; draw(0, 0, '#ffffff'); ctx.globalAlpha = 1; }
  if (tele) drawText(ctx, '!', ox, e.y - 10 - (e.type === 'warden' ? 4 : 0), '#ffd84a', 1, 'center');
}

const ENEMY_ART = {
  rotling(P, e, t) {
    const w = Math.sin(e.anim), la = Math.round(w * 2), atk = e.state === 'atk', wind = e.state === 'wind', h = wind ? 2 : 0;
    P.r(-3 + la, -7, 3, 7, '#3a3a2a'); P.r(1 - la, -7, 3, 7, '#44442f'); P.r(-4 + la, -1, 4, 1, '#2a2a20'); P.r(1 - la, -1, 4, 1, '#2a2a20');
    P.r(-4 + la, -3, 4, 1, '#6a6a74');
    P.r(-5, -16 + h, 10, 10 - h, '#5b4a3a'); P.r(-5, -16 + h, 3, 10 - h, '#4a3a2e'); P.r(3, -15 + h, 2, 8, '#6b5a48');
    P.r(-5, -7, 2, 2, '#5b4a3a'); P.r(0, -7, 2, 2, '#5b4a3a'); P.r(-2, -13 + h, 1, 3, '#3a2a20');
    P.r(-5, -14 + h, 2, 6, '#5a7a4a');
    const hx = atk ? 3 : wind ? 2 : 1, hy = -21 + h + (atk ? 1 : 0);
    P.r(hx - 2, hy, 7, 6, '#7a9a6a'); P.r(hx - 2, hy, 7, 1, '#9aba84'); P.r(hx - 2, hy + 1, 1, 4, '#5a7a4a');
    P.r(hx + 2, hy + 2, 2, 1, wind ? '#ffffff' : '#ffcf5a'); P.r(hx, hy + 2, 1, 1, '#ffcf5a');
    P.r(hx + 1, hy + 4, 4, 1, '#2a1a14'); P.r(hx + 2, hy + 5, 1, 1, '#d8cdb8'); P.r(hx - 1, hy - 1, 2, 1, '#4a5a3a');
    const ay = (atk ? -15 : wind ? -18 : -13 + Math.round(w)) + h;
    P.r(3, ay, atk ? 9 : 5, 2, '#6a8a5a'); P.r(atk ? 11 : 7, ay - 1, 2, 3, '#7a9a6a'); P.r(atk ? 12 : 8, ay + 2, 1, 1, '#d8cdb8');
  },
  archer(P, e, t) {
    const la = Math.round(Math.sin(e.anim) * 2), draw = e.state === 'wind' ? clamp(1 - e.t / e.wt, 0, 1) : 0;
    P.r(-3 + la, -7, 2, 7, '#d8cdb8'); P.r(1 - la, -7, 2, 7, '#c8bca6'); P.r(-3 + la, -4, 2, 1, '#a89c86'); P.r(1 - la, -4, 2, 1, '#a89c86');
    P.r(-6, -15, 2, 8, '#2e2439'); P.r(-4, -17, 8, 11, '#3b2f4a'); P.r(-4, -17, 2, 11, '#2e2439'); P.r(-5, -8, 10, 2, '#2e2439');
    P.r(-6, -19, 3, 8, '#6a4a2a'); P.r(-6, -21, 1, 2, '#e5483c'); P.r(-5, -21, 1, 2, '#e5483c');
    P.r(-1, -15, 3, 1, '#d8cdb8'); P.r(-1, -13, 3, 1, '#d8cdb8');
    P.r(-4, -23, 8, 7, '#3b2f4a'); P.r(-4, -23, 8, 1, '#4c3e5c'); P.r(-1, -21, 5, 5, '#d8cdb8'); P.r(-1, -21, 5, 1, '#e8dcc8');
    P.r(1, -19, 1, 1, '#88ffff'); P.r(3, -19, 1, 1, '#88ffff'); P.r(1, -17, 3, 1, '#a89c86');
    P.r(6, -22, 2, 14, '#7a5a3a'); P.r(7, -23, 2, 2, '#7a5a3a'); P.r(7, -9, 2, 2, '#7a5a3a'); P.r(8, -21, 1, 12, '#9a7a5a');
    const sx = 5 - Math.round(draw * 5);
    P.r(sx, -21, 1, 6, '#dddddd'); P.r(sx, -15, 1, 6, '#dddddd');
    if (e.state === 'wind') { P.r(sx, -15, 12, 1, '#c9c4b8'); P.r(sx + 12, -16, 2, 3, '#e8e8f0'); }
    P.r(sx - 1, -16, 3, 2, '#d8cdb8');
  },
  moth(P, e, t) {
    const fl = Math.sin(t * 30 + e.x) > 0, dive = e.state === 'atk';
    const wy = dive ? -9 : fl ? -13 : -7, wh = dive ? 3 : fl ? 7 : 4;
    P.r(-8, wy, 7, wh, '#8a7a5a'); P.r(1, wy, 7, wh, '#8a7a5a'); P.r(-8, wy, 7, 1, '#a89a74'); P.r(1, wy, 7, 1, '#a89a74');
    if (wh > 3) { P.r(-6, wy + 1, 2, 2, '#ffcf5a'); P.r(4, wy + 1, 2, 2, '#ffcf5a'); P.r(-5, wy + 1, 1, 1, '#3a2a1a'); P.r(5, wy + 1, 1, 1, '#3a2a1a'); }
    P.r(-3, -8, 7, 5, '#d9c9a0'); P.r(-3, -8, 7, 1, '#f0e2bc'); P.r(-5, -6, 2, 2, '#c8b890'); P.r(-6, -5, 1, 1, '#b8a47c'); P.r(-2, -5, 5, 1, '#b8a47c');
    P.r(3, -7, 2, 2, '#1a0a0a'); P.r(4, -7, 1, 1, '#e0402a');
    P.r(3, -11, 1, 3, '#6a5a3a'); P.r(5, -11, 1, 3, '#6a5a3a'); P.r(2, -12, 1, 1, '#6a5a3a'); P.r(6, -12, 1, 1, '#6a5a3a');
  },
  hound(P, e, t) {
    const run = Math.abs(e.vx) > 20, ph = e.anim * 1.4, a = run ? Math.round(Math.sin(ph) * 2) : 0, lunge = e.state === 'atk', c = e.state === 'wind' ? 2 : 0;
    P.r(-7 + a, -4, 2, 4, '#2a1f22'); P.r(-5 - a, -4, 2, 4, '#3a2a2e'); P.r(4 - a, -4, 2, 4, '#2a1f22'); P.r(6 + a, -4, 2, 4, '#3a2a2e');
    P.r(-8, -9 + c, 15, 6 - (c >> 1), '#3a2a2e'); P.r(-8, -9 + c, 15, 1, '#5a4248'); P.r(-8, -5, 15, 1, '#2a1f22');
    P.r(-5, -10 + c, 3, 1, '#e8d6ad'); P.r(-4, -9 + c, 1, 2, '#e8d6ad'); P.r(1, -10 + c, 2, 1, '#e8d6ad'); P.r(2, -9 + c, 1, 1, '#e8d6ad');
    P.r(-2, -13 + c, 2, 3, '#e8d6ad'); P.r(-1, -13 + c, 1, 3, '#c8b68c');
    P.r(-11, -10 + c + (run ? Math.round(Math.sin(ph * 2)) : 0), 3, 1, '#3a2a2e');
    const hx = lunge ? 9 : 6, hy = -11 + c + (lunge ? 1 : 0);
    P.r(hx, hy, 5, 5, '#3a2a2e'); P.r(hx + 3, hy + 2, 4, 3, '#2a1f22'); P.r(hx + 2, hy + 1, 1, 1, '#ff9a3c');
    P.r(hx, hy - 2, 2, 2, '#2a1f22'); P.r(hx + 4, hy + 4, 3, 1, lunge ? '#d8cdb8' : '#1a1012');
  },
  bloat(P, e, t) {
    const inf = e.state === 'wind' ? clamp(1 - e.t / e.wt, 0, 1) : 0, pulse = Math.round(Math.sin(t * 4) + inf * 3);
    const r = 6 + pulse, cy = -7;
    const col = inf > 0 && Math.floor(t * (8 + inf * 16)) % 2 ? '#ffb0a0' : '#d8c9a0';
    P.r(-r + 2, cy - r, 2 * r - 4, 2 * r, col); P.r(-r, cy - r + 2, 2 * r, 2 * r - 4, col); P.r(-r + 1, cy - r + 1, 2 * r - 2, 2 * r - 2, col);
    P.r(-r + 2, cy - r, 2 * r - 4, 1, '#f0e4c4'); P.r(-r + 1, cy + r - 2, 2 * r - 2, 1, '#b8a47c'); P.r(-r, cy, 1, 3, '#b8a47c');
    P.r(-3, cy - 3, 2, 1, '#b8a47c'); P.r(-4, cy + 2, 2, 2, '#c8b890');
    P.r(1, cy - 2, 2, 2, '#1a1010'); P.r(-2, cy - 2, 2, 2, '#1a1010'); P.r(-1, cy + 2, 4, 1 + (inf > 0 ? 1 : 0), '#3a1a10');
    P.r(0, cy - r - 2, 1, 2, '#222222');
  },
  leaper(P, e, t) {
    const crouch = e.state === 'wind' ? 2 : 0, air = !e.onGround;
    P.r(-8, air ? -7 : -3, 5, 3, '#3f6a3a'); P.r(3, air ? -7 : -3, 5, 3, '#3f6a3a'); P.r(-9, air ? -5 : -1, 3, 1, '#2f5a2a'); P.r(7, air ? -5 : -1, 3, 1, '#2f5a2a');
    P.r(-7, -11 + crouch, 15, 8 - crouch, '#4f7a4a'); P.r(-7, -11 + crouch, 15, 2, '#6a9a5a'); P.r(-5, -5, 11, 2, '#a8c27a');
    P.r(-4, -10 + crouch, 2, 1, '#3a5a36'); P.r(0, -9 + crouch, 2, 1, '#3a5a36');
    P.r(3, -14 + crouch, 4, 4, '#e8e070'); P.r(5, -13 + crouch, 1, 2, '#111111'); P.r(-3, -13 + crouch, 3, 3, '#d8d060'); P.r(-2, -12 + crouch, 1, 1, '#111111');
    P.r(4, -6 + crouch, 5, 1, '#2a3a1a'); if (e.state === 'atk') P.r(6, -5 + crouch, 3, 1, '#d86a6a');
  },
  spitter(P, e, t) {
    const puff = e.state === 'wind' ? Math.round(Math.sin(t * 30)) + 2 : 0;
    P.r(-8, -5, 16, 5, '#4a6a2a'); P.r(-8, -1, 16, 1, '#3a5a1a');
    P.r(-7 - (puff >> 1), -14 - puff, 12 + puff, 10 + puff, '#6a8a3a'); P.r(-7 - (puff >> 1), -14 - puff, 12 + puff, 1, '#8aaa4a');
    P.r(-5, -12 - puff, 6, 5, '#b6d85a'); P.r(-4, -11 - puff, 2, 2, '#e8ffa0'); P.r(-6, -8, 2, 2, '#b6d85a');
    P.r(4, -10, 5, 4, '#3a4a1a'); P.r(6, -9, 3, 2, '#b6d85a'); P.r(1, -13 - puff, 2, 2, '#111111'); P.r(2, -13 - puff, 1, 1, '#ffd84a');
    if (Math.sin(t * 3 + e.x) > .8) P.r(7, -6, 1, 2, '#b6d85a');
  },
  shield(P, e, t) {
    const la = Math.round(Math.sin(e.anim) * 2), bash = e.state === 'atk' ? 3 : 0;
    P.r(-3 + la, -8, 3, 8, '#2a2a33'); P.r(1 - la, -8, 3, 8, '#33333d'); P.r(-4 + la, -1, 4, 1, '#1a1a20'); P.r(1 - la, -1, 4, 1, '#1a1a20');
    P.r(-5, -18, 9, 11, '#5a5e68'); P.r(-5, -18, 3, 11, '#484b54'); P.r(-5, -10, 9, 2, '#3a3a44'); P.r(-6, -17, 2, 4, '#6b6f78');
    P.r(-4, -24, 7, 7, '#6b6f78'); P.r(-4, -24, 7, 2, '#8a8e98'); P.r(-5, -20, 9, 1, '#6b6f78'); P.r(0, -21, 3, 1, '#111111'); P.r(1, -21, 1, 1, '#ff8a3a');
    P.r(4 + bash, -23, 6, 22, '#6a4a2a'); P.r(4 + bash, -23, 6, 2, '#8a6a3a'); P.r(9 + bash, -23, 1, 22, '#4a321a'); P.r(4 + bash, -3, 6, 2, '#4a321a');
    P.r(5 + bash, -15, 4, 4, '#9a9aa6'); P.r(6 + bash, -14, 2, 2, '#c9ccd8'); P.r(5 + bash, -22, 4, 1, '#9a9aa6'); P.r(5 + bash, -6, 4, 1, '#9a9aa6');
  },
  hookman(P, e, t) {
    const la = Math.round(Math.sin(e.anim) * 2), wind = e.state === 'wind';
    P.r(-3 + la, -8, 3, 8, '#2a2a33'); P.r(1 - la, -8, 3, 8, '#33333d'); P.r(-4 + la, -1, 4, 1, '#1a1a20'); P.r(1 - la, -1, 4, 1, '#1a1a20');
    P.r(-5, -18, 10, 11, '#5a4a3a'); P.r(-5, -18, 3, 11, '#4a3a2e'); P.r(-5, -10, 10, 2, '#3a2a22'); P.r(-6, -9, 2, 3, '#5a4a3a');
    P.r(-7, -11, 3, 4, '#8a8a96'); P.r(-6, -10, 1, 2, '#3a3a44');
    for (let k = 0; k < 5; k++) P.r(-4 + k * 2, -17 + k * 2, 1, 1, '#9a9aa6');
    P.r(-4, -25, 8, 8, '#3a3040'); P.r(-4, -25, 8, 1, '#4a4050'); P.r(-5, -21, 1, 4, '#2a2030'); P.r(-1, -22, 4, 4, '#0c0a10'); P.r(0, -21, 1, 1, '#ff6a3a'); P.r(2, -21, 1, 1, '#ff6a3a');
    const ay = wind && e.move === 'hook' ? -22 : -15;
    P.r(3, ay, 3, 5, '#4a3a2e'); P.r(4, ay + 4, 2, 2, '#8a7a6a');
    if (!e.hookOut) {
      if (wind && e.move === 'hook') { const a = t * 22; P.r(4 + Math.round(Math.cos(a) * 5), ay - 3 + Math.round(Math.sin(a) * 5), 3, 3, '#c9ccd8'); }
      else { P.r(5, ay - 3, 1, 4, '#9a9aa6'); P.r(6, ay - 4, 2, 1, '#c9ccd8'); P.r(7, ay - 3, 1, 2, '#c9ccd8'); }
    }
  },
  knight(P, e, t) {
    const la = Math.round(Math.sin(e.anim) * 2);
    P.r(-4 + la, -10, 4, 10, '#4a4e58'); P.r(1 - la, -10, 4, 10, '#555a64'); P.r(-5 + la, -2, 5, 2, '#3a3e48'); P.r(1 - la, -2, 5, 2, '#3a3e48');
    P.r(-8, -22, 4, 14, '#6a1a1a'); P.r(-8, -10, 3, 3, '#4a1010');
    P.r(-6, -22, 12, 13, '#7a808c'); P.r(-6, -22, 3, 13, '#626874'); P.r(-6, -12, 12, 2, '#3a3e48'); P.r(3, -21, 2, 10, '#9aa0ab'); P.r(-2, -19, 4, 4, '#b3353d');
    P.r(-7, -23, 4, 4, '#8a909c'); P.r(4, -23, 4, 4, '#8a909c');
    P.r(-4, -30, 9, 8, '#8a909c'); P.r(-4, -30, 9, 2, '#aab0bb'); P.r(0, -27, 5, 1, '#111111'); P.r(1, -27, 3, 1, e.state === 'wind' ? '#ffffff' : '#ffcf6a'); P.r(-4, -24, 9, 1, '#626874');
    P.r(-3, -34, 3, 5, '#b3353d'); P.r(-5, -33, 2, 4, '#8a2530'); P.r(-6, -30, 1, 3, '#8a2530');
    let sa;
    if (e.state === 'wind') sa = e.move === 'thrust' ? 0 : e.move === 'slam' ? -2.7 : -2.2;
    else if (e.state === 'atk') sa = e.move === 'thrust' ? 0 : lerp(e.move === 'slam' ? -2.7 : -2.2, e.move === 'slam' ? 1.3 : 1.0, clamp(e.t2 / 0.15, 0, 1));
    else sa = 0.9;
    e._swordAng = sa;
  },
  bomber(P, e, t) {
    const la = Math.round(Math.sin(e.anim) * 2);
    P.r(-3 + la, -5, 2, 5, '#3a2a2a'); P.r(1 - la, -5, 2, 5, '#3a2a2a');
    P.r(-4, -12, 8, 8, '#6a3a2a'); P.r(-4, -12, 2, 8, '#5a2e22'); P.r(-5, -7, 10, 2, '#4a2a1a'); P.r(-6, -11, 3, 5, '#8a6a3a'); P.r(-5, -10, 1, 1, '#2a2a2a');
    P.r(-4, -17, 8, 6, '#8a5a3a'); P.r(-5, -18, 10, 2, '#4a2a1a'); P.r(1, -15, 2, 1, '#ff6a2a'); P.r(-6, -20, 2, 3, '#4a2a1a'); P.r(3, -13, 3, 1, '#2a1a10');
    if (e.state === 'wind') { P.r(-2, -25, 6, 6, '#2a2a2a'); P.r(-1, -24, 2, 2, '#4a4a4a'); P.r(2, -27, 2, 2, Math.floor(t * 12) % 2 ? '#ff3a2a' : '#ffcf5a'); P.r(4, -17, 2, 5, '#6a3a2a'); }
    else { P.r(-9, -10, 5, 5, '#2a2a2a'); P.r(-8, -9, 1, 1, '#4a4a4a'); P.r(4, -11, 2, 4, '#6a3a2a'); }
  },
  caster(P, e, t) {
    const hov = Math.round(Math.sin(t * 3 + e.x) * 2);
    P.r(-5, -14 + hov, 10, 14, '#40305a'); P.r(-5, -14 + hov, 3, 14, '#322548'); P.r(3, -13 + hov, 2, 12, '#50406a');
    for (let k = -5; k < 5; k += 3) P.r(k, 0 + hov + (Math.sin(t * 8 + k) > 0 ? 1 : 0), 2, 2, '#322548');
    P.r(-4, -21 + hov, 8, 8, '#4c3a6a'); P.r(-4, -21 + hov, 8, 1, '#5c4a7a'); P.r(-2, -19 + hov, 5, 5, '#0e0a16'); P.r(0, -18 + hov, 1, 1, '#e0a0ff'); P.r(2, -18 + hov, 1, 1, '#e0a0ff');
    P.r(-1, -10 + hov, 2, 5, '#c9a24a'); P.r(-2, -9 + hov, 4, 1, '#c9a24a');
    const glow = e.state === 'wind' ? '#ffffff' : '#c77dff';
    P.r(5, -12 + hov, 3, 3, glow); P.r(-8, -12 + hov, 3, 3, glow);
  },
  gargoyle(P, e, t) {
    const st = e.state, stone = '#6a6a72', stoneD = '#4a4a52', stoneL = '#8a8a94', eye = st === 'perch' ? '#2a2a30' : '#ff4a3a';
    if (st === 'perch' || st === 'wake') {
      const sh = st === 'wake' ? Math.round(Math.sin(t * 60)) : 0;
      P.r(-7 + sh, -13, 14, 13, stone); P.r(-7 + sh, -13, 14, 1, stoneL); P.r(-7 + sh, -12, 2, 12, stoneD);
      P.r(-8 + sh, -16, 4, 7, stoneD); P.r(-9 + sh, -17, 2, 2, stoneD);
      P.r(2 + sh, -18, 6, 6, stone); P.r(3 + sh, -20, 1, 2, stoneD); P.r(6 + sh, -20, 1, 2, stoneD);
      P.r(5 + sh, -16, 1, 1, eye); P.r(3 + sh, -13, 4, 1, stoneD); P.r(-6 + sh, -2, 3, 2, stoneD); P.r(3 + sh, -2, 3, 2, stoneD);
      P.r(-3 + sh, -8, 1, 3, stoneD); P.r(0 + sh, -10, 1, 1, stoneL);
      return;
    }
    const fl = Math.sin(t * 22) > 0, dive = st === 'atk', grounded = st === 'rec' && e.onGround;
    const wy = grounded ? -10 : dive ? -12 : fl ? -16 : -8, wh = grounded ? 6 : dive ? 4 : fl ? 8 : 5;
    P.r(-11, wy, 8, wh, stoneD); P.r(3, wy, 8, wh, stoneD); P.r(-11, wy, 8, 1, stone); P.r(3, wy, 8, 1, stone);
    P.r(-10, wy + wh - 1, 2, 2, stoneD); P.r(8, wy + wh - 1, 2, 2, stoneD);
    P.r(-5, -11, 10, 9, stone); P.r(-5, -11, 10, 1, stoneL); P.r(-5, -10, 2, 8, stoneD);
    P.r(3, -14, 6, 6, stone); P.r(4, -16, 1, 2, stoneD); P.r(7, -16, 1, 2, stoneD); P.r(6, -12, 1, 1, eye); P.r(5, -10, 4, 1, '#2a2a30');
    P.r(-4, -2, 2, 3, stoneD); P.r(2, -2, 2, 3, stoneD); P.r(-7, -6, 2, 1, stone); P.r(-9, -7, 2, 1, stoneD);
  },
  warden(P, e, t) {
    const la = Math.round(Math.sin(e.anim) * 3), crouch = e.state === 'wind' && e.move === 'leap' ? 4 : 0;
    P.r(-10 + la, -16, 8, 16, '#2a2a33'); P.r(3 - la, -16, 8, 16, '#33333d'); P.r(-11 + la, -3, 10, 3, '#1a1a20'); P.r(2 - la, -3, 10, 3, '#1a1a20');
    P.r(-16, -36 + crouch, 5, 22, '#3a1a1a');
    P.r(-14, -38 + crouch, 28, 24, '#3a3a44'); P.r(-14, -38 + crouch, 6, 24, '#2e2e36'); P.r(8, -36 + crouch, 4, 20, '#4a4a56');
    for (let k = 0; k < 4; k++) P.r(-10 + k * 6, -34 + crouch, 3, 2, '#5a5a66');
    P.r(-14, -18 + crouch, 28, 4, '#5a3a22'); P.r(-2, -18 + crouch, 5, 4, '#c9a24a');
    for (let k = 0; k < 3; k++) P.r(-12 + k * 4, -14 + crouch, 2, 4, '#c9a24a');
    P.r(-18, -38 + crouch, 8, 7, '#4a4a56'); P.r(10, -38 + crouch, 8, 7, '#4a4a56'); P.r(-18, -38 + crouch, 8, 2, '#6a6a78'); P.r(10, -38 + crouch, 8, 2, '#6a6a78');
    P.r(-8, -50 + crouch, 16, 13, '#4a4a56'); P.r(-8, -50 + crouch, 16, 3, '#6a6a78'); P.r(-6, -45 + crouch, 12, 2, '#111111');
    const eyeC = e.enraged ? '#ff2a2a' : '#ff8a3a';
    P.r(-4, -45 + crouch, 3, 2, eyeC); P.r(2, -45 + crouch, 3, 2, eyeC);
    P.r(-1, -54 + crouch, 2, 4, '#6a6a78'); P.r(-3, -52 + crouch, 6, 2, '#5a5a66');
    P.r(-17, -17 + crouch, 6, 8, '#2a2020'); P.r(-16, -16 + crouch, 4, 6, '#ffb45a'); P.r(-15, -15 + crouch, 2, 3, '#fff0c0');
  }
};

function drawEnemyExtras(ctx, e, t) {
  const ox = Math.round(e.x + e.w / 2), oy = Math.round(e.y + e.h), f = e.face;
  if (e.state === 'dead') return;
  if (e.type === 'knight') {
    const def = { blade: '#c9ccd8', len: 20 };
    drawWeaponShape(ctx, def, ox + f * 5, oy - 17, e._swordAng || 0.9, f);
    if (e.state === 'atk' && e.t2 < 0.2 && e.move !== 'thrust') {
      ctx.save(); ctx.translate(ox + f * 5, oy - 17); ctx.scale(f, 1); ctx.globalAlpha = 0.45; ctx.fillStyle = '#ffb0a0';
      ctx.beginPath(); ctx.arc(0, 0, 30, -2.2, e._swordAng || 1); ctx.arc(0, 0, 16, e._swordAng || 1, -2.2, true); ctx.fill(); ctx.restore(); ctx.globalAlpha = 1;
    }
  }
  if (e.type === 'warden') {
    const a = e.maceAng != null ? e.maceAng : 0.8, len = e.maceLen || 22;
    const hx = ox + f * 14, hy = oy - 32;
    const mx = hx + Math.cos(a) * len * f, my = hy + Math.sin(a) * len;
    ctx.fillStyle = '#4a4652'; for (let k = 0; k <= 1; k += 0.1) ctx.fillRect(Math.round(lerp(hx, mx, k)), Math.round(lerp(hy, my, k)), 2, 2);
    ctx.fillStyle = '#2a2a33'; ctx.fillRect(mx - 6, my - 6, 12, 12); ctx.fillStyle = '#6a6a78'; ctx.fillRect(mx - 5, my - 5, 10, 3);
    ctx.fillStyle = '#9a9aa6'; ctx.fillRect(mx - 8, my - 1, 3, 2); ctx.fillRect(mx + 5, my - 1, 3, 2); ctx.fillRect(mx - 1, my - 8, 2, 3); ctx.fillRect(mx - 1, my + 5, 2, 3);
  }
  if (e.type === 'bloat') drawFlame(ctx, ox + (f > 0 ? 0 : -1), oy - 7 - (6 + Math.round(Math.sin(t * 4))) - 2, t + e.x, e.state === 'wind' ? 'red' : 'normal', e.state === 'wind' ? 3 : 0, .8);
  if (e.type === 'hound') drawFlame(ctx, ox + (f > 0 ? -1 : 0), oy - 13 + (e.state === 'wind' ? 2 : 0), t + e.x, 'normal', 0, .6);
  if (e.wardUp) { ctx.globalAlpha = .35 + Math.sin(t * 5) * .1; ctx.strokeStyle = '#c07af0'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(ox, e.y + e.h / 2, Math.max(e.w, e.h) * .75 + 2, 0, 7); ctx.stroke(); ctx.globalAlpha = 1; }
  if (e.hp < e.maxHp && e.type !== 'warden' && e.hp > 0) {
    const bw = Math.max(14, e.w + 4), bx = ox - bw / 2, by = e.y - 6 - (e.type === 'knight' ? 6 : 0);
    ctx.fillStyle = '#000'; ctx.fillRect(bx - 1, by - 1, bw + 2, 4);
    ctx.fillStyle = '#5a1a1a'; ctx.fillRect(bx, by, bw, 2);
    ctx.fillStyle = e.elite ? '#ffcf3a' : '#e5483c'; ctx.fillRect(bx, by, Math.ceil(bw * e.hp / e.maxHp), 2);
  }
  let sx = ox - 6; const sy = e.y - 12;
  if (e.burn > 0) { ctx.fillStyle = '#ff8a2a'; ctx.fillRect(sx, sy - (t * 8 % 2), 3, 3); sx += 4; }
  if (e.bleed > 0) { ctx.fillStyle = '#c0203a'; ctx.fillRect(sx, sy, 2, 3); sx += 4; }
  if (e.stun > 0 && e.type !== 'warden') { for (let k = 0; k < 3; k++) { const a = t * 6 + k * 2.1; ctx.fillStyle = '#ffe56a'; ctx.fillRect(Math.round(ox + Math.cos(a) * 6), Math.round(e.y - 4 + Math.sin(a) * 2), 2, 2); } }
  if (e.root > 0) { ctx.fillStyle = '#9a9aa6'; ctx.fillRect(ox - 6, oy - 3, 12, 3); ctx.fillStyle = '#d0d0da'; for (let k = -6; k < 6; k += 3) ctx.fillRect(ox + k, oy - 6, 1, 3); }
  if (e.alertT > 0 && e.state !== 'wind') { const b = Math.round(Math.sin((0.6 - e.alertT) * 18) * 2); drawText(ctx, '!', ox, e.y - 14 - Math.abs(b), '#ffffff', 1, 'center'); }
  if (e.elite && e.hp > 0) { const m = ELITE_MODS.find(x => x.id === e.mod); drawText(ctx, (m ? m.name + ' ' : '') + 'ELITE', ox, e.y - 18 - (e.type === 'knight' ? 6 : 0), m ? m.col : '#ffcf3a', 1, 'center'); }
}
