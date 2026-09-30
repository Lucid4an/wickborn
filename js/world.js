'use strict';
// Room grid (Spelunky-style): each cell is CW x CH tiles, a main path runs left to right,
// branch rooms hang off it with shops, treasure and scrolls.
const CW = 26, CH = 16;
const T_EMPTY = 0, T_SOLID = 1, T_PLAT = 2, T_SPIKE = 3;

function genLevel(bi, seed) {
  const B = BIOMES[bi];
  if (B.boss) return genBossLevel(bi, seed);
  const r = new RNG(seed);
  const GW = B.gw, GH = B.gh, tw = GW * CW, th = GH * CH;
  const L = newLevel(bi, tw, th);
  const cells = [];
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) cells.push({ gx: x, gy: y, used: false, l: 0, r: 0, u: 0, d: 0, kind: null, dist: 0, main: false });
  const C = (x, y) => (x < 0 || y < 0 || x >= GW || y >= GH) ? null : cells[y * GW + x];
  const hEdge = {}, vEdge = {};
  const link = (a, b) => {
    if (b.gx > a.gx) { a.r = b.l = 1; hEdge[a.gx + ',' + a.gy] = r.int(4, 7); }
    else if (b.gx < a.gx) { a.l = b.r = 1; hEdge[b.gx + ',' + b.gy] = r.int(4, 7); }
    else if (b.gy > a.gy) { a.d = b.u = 1; vEdge[a.gx + ',' + a.gy] = r.int(5, CW - 6); }
    else { a.u = b.d = 1; vEdge[b.gx + ',' + b.gy] = r.int(5, CW - 6); }
  };
  // --- main path ---
  let cx = 0, cy = r.int(0, GH - 1), vert = 0;
  let cur = C(cx, cy); cur.used = true; cur.kind = 'start';
  const path = [cur];
  while (cx < GW - 1) {
    const moves = [];
    if (vert < 2) for (const dy of [-1, 1]) { const n = C(cx, cy + dy); if (n && !n.used) moves.push(dy); }
    let nx = cx, ny = cy;
    if (moves.length && r.chance(0.42) && !(cx === 0 && vert > 0)) { ny += r.pick(moves); vert++; } else { nx++; vert = 0; }
    const n = C(nx, ny); link(cur, n); n.used = true; path.push(n); cur = n; cx = nx; cy = ny;
  }
  cur.kind = 'exit';
  path.forEach((c, i) => { c.dist = i; c.main = true; if (!c.kind) c.kind = 'normal'; });
  // --- loops: extra connections between adjacent main cells ---
  for (const c of path) {
    const n = C(c.gx, c.gy + 1);
    if (n && n.main && !c.d && Math.abs(n.dist - c.dist) > 1 && r.chance(0.5)) link(c, n);
  }
  // --- branches ---
  const contents = ['shop', 'scroll', 'treasure', 'weapon'];
  if (bi >= 0 && r.chance(0.6)) contents.push('cursed');
  contents.push(r.chance(0.5) ? 'food' : 'treasure');
  if (B.scrolls > 2) contents.push('scroll');
  while (contents.length < B.branches) contents.push(r.pick(['treasure', 'weapon', 'food']));
  const order = contents.slice(0, B.branches);
  r.shuffle(order); order.unshift(order.splice(order.indexOf('shop'), 1)[0]); // shop is always placed first
  const cand = [];
  for (const c of cells) if (!c.used) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const n = C(c.gx + dx, c.gy + dy); if (n && n.main && n.kind !== 'exit') cand.push([c, n]);
  }
  r.shuffle(cand);
  for (const [c, n] of cand) {
    if (!order.length) break;
    if (c.used) continue;
    c.used = true; c.kind = 'branch'; c.content = order.shift(); c.dist = n.dist; link(n, c);
  }
  // any contents that didn't fit get placed on the main path later
  L.leftover = order;
  // --- carve ---
  const rooms = [];
  for (const c of cells) if (c.used) rooms.push(carveRoom(L, r, c, B));
  // horizontal doorways
  for (const k in hEdge) {
    const [gx, gy] = k.split(',').map(Number), h = hEdge[k];
    const floorY = gy * CH + CH - 3, xA = gx * CW + CW - 1;
    for (let y = floorY - h + 1; y <= floorY; y++) { setT(L, xA, y, 0); setT(L, xA + 1, y, 0); }
    L.hdoors.push({ x: (xA + 1) * TS, y: (floorY - h + 1) * TS, h: h * TS, gx, gy });
  }
  // vertical shafts with ladders
  for (const k in vEdge) {
    const [gx, gy] = k.split(',').map(Number), hx = gx * CW + vEdge[k];
    const topY = gy * CH + CH - 2; // upper room floor top row
    let bot = topY; while (bot < L.th - 1 && L.tiles[(bot) * L.tw + hx] !== 0) bot++;
    // bot = first empty row of lower room; ladder runs to the lower room's floor
    const lowerFloor = (gy + 1) * CH + CH - 3;
    for (let y = topY; y < bot; y++) for (let x = hx - 1; x <= hx + 1; x++) setT(L, x, y, y === topY ? T_PLAT : 0);
    for (let y = topY; y <= lowerFloor; y++) L.lad[y * L.tw + hx] = 1;
  }
  // backwall flags
  for (const rm of rooms) {
    for (let y = rm.oy; y < rm.oy + CH; y++) for (let x = rm.ox; x < rm.ox + CW; x++) L.back[y * L.tw + x] = 1;
    if (r.chance(B.back)) {
      const ex = rm.ox + r.int(4, CW - 5), ey = rm.oy + r.int(3, CH - 6), rx = r.int(4, 10), ry = r.int(3, 6);
      for (let y = rm.oy; y < rm.oy + CH; y++) for (let x = rm.ox; x < rm.ox + CW; x++)
        if (((x - ex) / rx) ** 2 + ((y - ey) / ry) ** 2 < 1 + r.range(-.15, .15)) L.back[y * L.tw + x] = 0;
    }
  }
  L.rooms = rooms;
  populate(L, r, rooms, path, B, bi);
  return L;
}

function newLevel(bi, tw, th) {
  return {
    bi, B: BIOMES[bi], tw, th, pw: tw * TS, ph: th * TS,
    tiles: new Uint8Array(tw * th).fill(1), lad: new Uint8Array(tw * th), back: new Uint8Array(tw * th),
    seen: new Uint8Array(tw * th), rooms: [], decor: [], lights: [], spawns: [], objs: [], hdoors: [], marks: []
  };
}
function setT(L, x, y, v) { if (x >= 0 && y >= 0 && x < L.tw && y < L.th) L.tiles[y * L.tw + x] = v; }
function getT(L, x, y) { return (x < 0 || y < 0 || x >= L.tw || y >= L.th) ? 1 : L.tiles[y * L.tw + x]; }

function carveRoom(L, r, c, B) {
  const ox = c.gx * CW, oy = c.gy * CH, floorY = oy + CH - 3;
  const top = oy + 1 + (c.u ? 0 : r.int(0, 2));
  const rm = { c, ox, oy, floorY, top, kind: c.kind, content: c.content, reserved: new Set(), spikes: new Set() };
  for (let y = top; y <= floorY; y++) for (let x = ox + 1; x <= ox + CW - 2; x++) setT(L, x, y, 0);
  // reserve ladder / hole columns
  const reserve = hx => { for (let x = hx - 2; x <= hx + 2; x++) rm.reserved.add(x); };
  if (c.u || c.d) {
    // find the shaft columns from neighbour edges later; approximate by scanning all columns (edges decided before carving)
  }
  rm.reserveFn = reserve;
  return rm;
}

function populate(L, r, rooms, path, B, bi) {
  // mark reserved columns for shafts (ladder columns)
  for (const rm of rooms) {
    for (let x = rm.ox; x < rm.ox + CW; x++) {
      for (let y = rm.oy; y < rm.oy + CH; y++) if (L.lad[y * L.tw + x]) { rm.reserveFn(x); break; }
    }
  }
  const byCell = new Map(rooms.map(rm => [rm.c, rm]));
  for (const rm of rooms) {
    const { ox, floorY, top, c } = rm;
    const free = x => !rm.reserved.has(x) && x > ox + 1 && x < ox + CW - 2;
    const isStart = c.kind === 'start', isShop = c.content === 'shop';
    // --- interior features ---
    const style = isStart || isShop ? 'hall' : r.pick(['hall', 'plats', 'plats', 'steps', 'hang', 'mixed']);
    const plat = (y, x0, len) => { for (let x = x0; x < x0 + len; x++) if (getT(L, x, y) === 0 && getT(L, x, y - 1) === 0) setT(L, x, y, T_PLAT); };
    if (style === 'plats' || style === 'mixed') {
      const n = r.int(1, 3);
      for (let i = 0; i < n; i++) {
        const len = r.int(4, 8), x0 = r.int(ox + 3, ox + CW - 4 - len), y = floorY - (i % 2 === 0 ? r.int(3, 4) : r.int(6, 7));
        plat(y, x0, len);
      }
    }
    if (style === 'steps' || style === 'mixed') {
      const w = r.int(3, 6), hgt = r.int(1, 2), x0 = r.int(ox + 5, ox + CW - 6 - w);
      let ok = true; for (let x = x0 - 1; x <= x0 + w; x++) if (!free(x)) ok = false;
      if (ok) {
        for (let y = floorY - hgt + 1; y <= floorY; y++) for (let x = x0; x < x0 + w; x++) setT(L, x, y, 1);
        if (r.chance(0.6)) plat(floorY - hgt - 3, x0 - 1, w + 2);
      }
    }
    if (style === 'hang' || (style === 'hall' && !isStart && !isShop && r.chance(0.4))) {
      const w = r.int(2, 4), x0 = r.int(ox + 4, ox + CW - 5 - w), len = r.int(2, 5);
      let ok = true; for (let x = x0 - 1; x <= x0 + w; x++) if (!free(x)) ok = false;
      if (ok) for (let y = top; y < top + len; y++) for (let x = x0; x < x0 + w; x++) setT(L, x, y, 1);
    }
    // wall/ceiling bumps for organic edges
    for (let y = top; y <= floorY - 1; y++) {
      for (const [x, side] of [[ox + 1, 'l'], [ox + CW - 2, 'r']]) {
        if (c[side] && y > floorY - 8) continue;
        if (r.chance(0.28) && getT(L, x, y) === 0 && !L.lad[y * L.tw + x]) setT(L, x, y, 1);
      }
    }
    for (let x = ox + 2; x < ox + CW - 2; x++) if (!rm.reserved.has(x) && r.chance(0.25) && getT(L, x, top) === 0) setT(L, x, top, 1);
    // spikes
    if (!isStart && !isShop && c.kind !== 'exit' && r.chance(0.28 + bi * 0.08)) {
      const w = r.int(2, 3), x0 = r.int(ox + 6, ox + CW - 8 - w);
      let ok = true; for (let x = x0 - 1; x <= x0 + w; x++) if (!free(x) || getT(L, x, floorY) !== 0 || getT(L, x, floorY + 1) !== 1) ok = false;
      if (ok) for (let x = x0; x < x0 + w; x++) { setT(L, x, floorY, T_SPIKE); rm.spikes.add(x); }
    }
    // spawn spots: floor and platform tops
    rm.spots = [];
    for (let x = ox + 2; x < ox + CW - 2; x++) {
      for (let y = top + 1; y <= floorY; y++) {
        const t = getT(L, x, y), below = getT(L, x, y + 1);
        if (t === 0 && getT(L, x, y - 1) === 0 && (below === 1 || below === T_PLAT) && !rm.reserved.has(x) && !rm.spikes.has(x)) rm.spots.push({ x: x * TS + 8, y: (y + 1) * TS, floor: y === floorY });
      }
    }
    // decor
    decorate(L, r, rm, B);
  }
  // --- objects & enemies ---
  const start = rooms.find(rm => rm.c.kind === 'start'), exit = rooms.find(rm => rm.c.kind === 'exit');
  L.spawn = { x: (start.ox + 5) * TS, y: (start.floorY + 1) * TS };
  L.objs.push({ type: 'exit', x: (exit.ox + CW - 5) * TS, y: (exit.floorY + 1) * TS });
  L.objs.push({ type: 'entry', x: (start.ox + 3) * TS, y: (start.floorY + 1) * TS });
  const floorSpot = (rm, cx) => {
    const fs = rm.spots.filter(s => s.floor); if (!fs.length) return rm.spots[0];
    fs.sort((a, b) => Math.abs(a.x - cx) - Math.abs(b.x - cx)); return fs[0];
  };
  const place = (rm, content) => {
    const cx = (rm.ox + CW / 2) * TS, s = floorSpot(rm, cx); if (!s) return;
    if (content === 'shop') {
      L.objs.push({ type: 'merchant', x: s.x - 60, y: s.y });
      [-28, 0, 28].forEach((dx, i) => L.objs.push({ type: 'shopitem', x: s.x + dx + 10, y: s.y, food: i === 2 && r.chance(0.5) }));
    } else if (content === 'scroll') L.objs.push({ type: 'scroll', x: s.x, y: s.y });
    else if (content === 'treasure') L.objs.push({ type: 'chest', x: s.x, y: s.y });
    else if (content === 'cursed') L.objs.push({ type: 'cursed', x: s.x, y: s.y });
    else if (content === 'weapon') L.objs.push({ type: 'item', x: s.x, y: s.y });
    else if (content === 'food') L.objs.push({ type: 'food', x: s.x, y: s.y });
  };
  let scrollCount = 0;
  for (const rm of rooms) if (rm.content) { place(rm, rm.content); if (rm.content === 'scroll') scrollCount++; }
  const mains = rooms.filter(rm => rm.c.main && rm.c.kind === 'normal');
  r.shuffle(mains);
  let mi = 0;
  for (const ct of L.leftover) if (mains[mi]) place(mains[mi++], ct);
  while (scrollCount < B.scrolls && mains.length) { const rm = mains[mi++ % mains.length]; const s = r.pick(rm.spots); if (s) L.objs.push({ type: 'scroll', x: s.x, y: s.y }); scrollCount++; }
  // breakable doors on main path doorways
  for (const d of L.hdoors) {
    const a = byCell.get(cells_at(rooms, d.gx, d.gy)), b = byCell.get(cells_at(rooms, d.gx + 1, d.gy));
    if (a && b && a.c.main && b.c.main && a.c.kind !== 'start' && r.chance(0.35)) L.objs.push({ type: 'door', x: d.x - 4, y: d.y, h: d.h });
  }
  // enemies
  const maxDist = Math.max(...rooms.map(rm => rm.c.dist));
  let eliteDone = false;
  const eliteRoomDist = Math.floor(maxDist * 0.55);
  for (const rm of rooms) {
    if (rm.c.kind === 'start' || rm.content === 'shop') continue;
    let n = r.int(B.per[0], B.per[1]);
    if (rm.c.kind === 'branch') n = Math.max(0, n - 1);
    if (rm.c.kind === 'exit') n = Math.max(1, n - 1);
    const spots = r.shuffle(rm.spots.filter(s => Math.abs(s.x - (rm.ox + CW / 2) * TS) < 150));
    for (let i = 0; i < n && i < spots.length; i++) {
      const type = r.pick(B.enemies);
      const elite = !eliteDone && rm.c.main && rm.c.dist >= eliteRoomDist && i === 0;
      if (elite) eliteDone = true;
      L.spawns.push({ type, x: spots[i].x, y: ENEMIES[type].fly && type !== 'gargoyle' ? spots[i].y - 40 : spots[i].y, elite });
    }
    // vases
    const vn = r.int(0, 2);
    for (let i = 0; i < vn; i++) { const s = r.pick(rm.spots.filter(s => s.floor) || []); if (s) L.objs.push({ type: 'vase', x: s.x + r.int(-4, 4), y: s.y }); }
  }
  L.cells = rooms.map(rm => ({ gx: rm.c.gx, gy: rm.c.gy, kind: rm.c.kind, content: rm.content }));
}
function cells_at(rooms, gx, gy) { const rm = rooms.find(rm => rm.c.gx === gx && rm.c.gy === gy); return rm && rm.c; }

function decorate(L, r, rm, B) {
  const { ox, oy, floorY, top } = rm;
  const empty = (x, y) => getT(L, x, y) === 0 && !L.lad[y * L.tw + x];
  const n = r.int(3, 6);
  for (let i = 0; i < n; i++) {
    const kind = r.pick(B.decor);
    const x = r.int(ox + 2, ox + CW - 3);
    if (rm.reserved.has(x)) continue;
    if (kind === 'torch') {
      const y = floorY - r.int(3, 5);
      if (empty(x, y) && empty(x, y + 1)) { L.decor.push({ kind, x: x * TS + 8, y: y * TS + 6 }); L.lights.push({ x: x * TS + 8, y: y * TS + 2, r: 80, col: B.torch, flick: 1 }); }
    } else if (kind === 'candles') {
      if (empty(x, floorY) && getT(L, x, floorY + 1) === 1 && !rm.spikes.has(x)) { L.decor.push({ kind, x: x * TS + 8, y: (floorY + 1) * TS, n: r.int(2, 4) }); L.lights.push({ x: x * TS + 8, y: floorY * TS + 8, r: 50, col: '#ffc070', flick: 1 }); }
    } else if (kind === 'chain' || kind === 'banner' || kind === 'cage' || kind === 'bell' || kind === 'moss') {
      let y = top; while (y < floorY && !empty(x, y)) y++;
      if (getT(L, x, y - 1) === 1 && empty(x, y) && empty(x, y + 2)) L.decor.push({ kind, x: x * TS + 8, y: y * TS, len: r.int(2, 5), seed: r.int(0, 999) });
    } else if (kind === 'window') {
      const y = top + r.int(1, 3);
      if (L.back[y * L.tw + x] !== 0 && empty(x, y) && empty(x, y + 1) && empty(x + 1, y)) { L.decor.push({ kind, x: x * TS, y: y * TS }); L.lights.push({ x: x * TS + 8, y: y * TS + 14, r: 70, col: '#8aa0ff', flick: 0 }); }
    } else if (kind === 'bones') {
      if (empty(x, floorY) && getT(L, x, floorY + 1) === 1) L.decor.push({ kind, x: x * TS + 8, y: (floorY + 1) * TS, seed: r.int(0, 99) });
    } else if (kind === 'pipe') {
      const y = r.int(top + 1, floorY - 2);
      L.decor.push({ kind, x: ox * TS + 16, y: y * TS + 6, w: (CW - 2) * TS - 16 });
    } else if (kind === 'grate') {
      const y = top + r.int(1, 3);
      if (empty(x, y)) { L.decor.push({ kind, x: x * TS, y: y * TS, fall: floorY + 1 }); L.lights.push({ x: x * TS + 8, y: y * TS + 20, r: 60, col: '#6fd8d0', flick: 0 }); }
    }
  }
}

function genBossLevel(bi, seed) {
  const tw = 44, th = 20; const L = newLevel(bi, tw, th);
  const floorY = 16;
  for (let y = 2; y <= floorY; y++) for (let x = 1; x < tw - 1; x++) setT(L, x, y, 0);
  for (let x = 1; x < tw - 1; x++) { if (x % 7 === 3) setT(L, x, 2, 1); if (x % 9 === 1) { setT(L, x, 3, 1); } }
  for (let x = 6; x < 12; x++) setT(L, x, 12, T_PLAT);
  for (let x = 32; x < 38; x++) setT(L, x, 12, T_PLAT);
  for (let x = 18; x < 26; x++) setT(L, x, 8, T_PLAT);
  L.back.fill(1);
  for (let y = 4; y < 12; y++) for (let x = 14; x < 30; x++) if (((x - 22) / 8) ** 2 + ((y - 8) / 4) ** 2 < 1) L.back[y * tw + x] = 0;
  const B = BIOMES[bi];
  for (const x of [4, 15, 28, 39]) { L.decor.push({ kind: 'torch', x: x * TS + 8, y: 12 * TS + 6 }); L.lights.push({ x: x * TS + 8, y: 12 * TS + 2, r: 90, col: B.torch, flick: 1 }); }
  for (const x of [8, 20, 24, 35]) L.decor.push({ kind: 'chain', x: x * TS + 8, y: 3 * TS, len: 4 + (x % 3), seed: x });
  L.decor.push({ kind: 'bones', x: 12 * TS, y: (floorY + 1) * TS, seed: 3 }, { kind: 'bones', x: 30 * TS, y: (floorY + 1) * TS, seed: 7 });
  L.spawn = { x: 4 * TS, y: (floorY + 1) * TS };
  L.boss = { x: 34 * TS, y: (floorY + 1) * TS };
  L.objs.push({ type: 'entry', x: 2 * TS + 8, y: (floorY + 1) * TS });
  L.rooms = [{ ox: 0, oy: 0, floorY, top: 2, c: { gx: 0, gy: 0, kind: 'boss' }, spots: [] }];
  L.cells = [{ gx: 0, gy: 0, kind: 'boss' }];
  L.bossFloor = (floorY + 1) * TS;
  return L;
}

// ---------- collision ----------
function rectSolid(x, y, w, h, withPlatFrom, fly) {
  const L = G.level;
  const x0 = Math.floor(x / TS), x1 = Math.floor((x + w - 0.001) / TS), y0 = Math.floor(y / TS), y1 = Math.floor((y + h - 0.001) / TS);
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
    const t = getT(L, tx, ty);
    if (t === 1) return true;
    if (t === T_PLAT && withPlatFrom != null && !fly && ty === y1 && withPlatFrom <= ty * TS + 0.01) return true;
  }
  for (const s of G.solids) if (!s.dead && x < s.x + s.w && x + w > s.x && y < s.y + s.h && y + h > s.y) return true;
  return false;
}
function moveBody(e, dt) {
  e.hitWall = 0; e.hitCeil = false;
  let dx = e.vx * dt;
  while (dx !== 0) {
    const st = Math.abs(dx) > 1 ? sign(dx) : dx;
    if (rectSolid(e.x + st, e.y, e.w, e.h)) { e.hitWall = sign(dx); e.vx = 0; break; }
    e.x += st; dx -= st;
  }
  let dy = e.vy * dt; e.onGround = false;
  while (dy !== 0) {
    const st = Math.abs(dy) > 1 ? sign(dy) : dy;
    const platFrom = (st > 0 && !e.dropping && !e.climbing) ? e.y + e.h : null;
    if (rectSolid(e.x, e.y + st, e.w, e.h, platFrom, e.fly)) {
      if (st > 0) e.onGround = true; else e.hitCeil = true;
      e.vy = 0; break;
    }
    e.y += st; dy -= st;
  }
  if (!e.onGround && e.vy >= 0 && !e.fly) e.onGround = rectSolid(e.x, e.y + 1, e.w, e.h, e.dropping || e.climbing ? null : e.y + e.h, false) && !rectSolid(e.x, e.y, e.w, e.h);
}
function solidPt(px, py) { return getT(G.level, Math.floor(px / TS), Math.floor(py / TS)) === 1; }
function groundPt(px, py) { const t = getT(G.level, Math.floor(px / TS), Math.floor(py / TS)); return t === 1 || t === T_PLAT; }
function losClear(x0, y0, x1, y1) {
  const d = dist(x0, y0, x1, y1), n = Math.ceil(d / 6);
  for (let i = 1; i < n; i++) if (solidPt(lerp(x0, x1, i / n), lerp(y0, y1, i / n))) return false;
  return true;
}
function ladderAt(px, py) { const L = G.level, tx = Math.floor(px / TS), ty = Math.floor(py / TS); if (tx < 0 || ty < 0 || tx >= L.tw || ty >= L.th) return false; return !!L.lad[ty * L.tw + tx]; }
function spikeAt(x, y, w, h) {
  const L = G.level;
  for (let ty = Math.floor(y / TS); ty <= Math.floor((y + h - 0.01) / TS); ty++) for (let tx = Math.floor(x / TS); tx <= Math.floor((x + w - 0.01) / TS); tx++)
    if (getT(L, tx, ty) === T_SPIKE && y + h > ty * TS + 9) return true;
  return false;
}
