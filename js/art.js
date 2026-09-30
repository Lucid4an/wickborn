'use strict';
// All art is generated here at runtime: tiles, backgrounds, lights, icons and characters.
const Art = {
  lights: {},
  light(col) {
    if (this.lights[col]) return this.lights[col];
    const c = makeCanvas(128, 128), x = c.getContext('2d');
    const [r, g, b] = hexToRgb(col);
    const gr = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, rgbStr(r, g, b, 1)); gr.addColorStop(0.35, rgbStr(r, g, b, 0.55)); gr.addColorStop(1, rgbStr(r, g, b, 0));
    x.fillStyle = gr; x.fillRect(0, 0, 128, 128);
    return this.lights[col] = c;
  },
  tex(col1, col2, dark, seed, kind) {
    const c = makeCanvas(16, 16), x = c.getContext('2d'), img = x.createImageData(16, 16);
    const r = new RNG(seed), a = hexToRgb(col1), b = hexToRgb(col2), d = hexToRgb(dark);
    const off = r.int(0, 7);
    for (let py = 0; py < 16; py++) for (let px = 0; px < 16; px++) {
      let t = r.next() * 0.35 + (Math.sin((px + seed) * 0.9) + Math.cos((py + seed * 3) * 1.1)) * 0.15 + 0.3;
      let col = [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
      if (kind === 'brick') {
        const row = Math.floor(py / 4), bx = (px + (row % 2 ? 4 : 0) + off) % 8;
        if (py % 4 === 3 || bx === 7) col = d;
        else if (py % 4 === 0) col = col.map(v => v * 1.12);
      } else {
        if (r.chance(0.04)) col = d;
        if ((px + py * 3 + seed) % 23 === 0) col = col.map(v => v * 1.25);
      }
      const i = (py * 16 + px) * 4; img.data[i] = col[0]; img.data[i + 1] = col[1]; img.data[i + 2] = col[2]; img.data[i + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    if (kind === 'rock') { x.fillStyle = dark; for (let i = 0; i < 2; i++) { let cx = r.int(1, 14), cy = r.int(1, 14); for (let k = 0; k < 4; k++) { x.fillRect(cx, cy, 1, 1); cx += r.int(-1, 1); cy += 1; } } }
    return c;
  },

  renderLevel(L) {
    const B = L.B, pal = B.pal, c = makeCanvas(L.pw, L.ph), x = c.getContext('2d');
    const r = new RNG(L.bi * 31 + 7);
    const rockT = [0, 1, 2, 3].map(i => this.tex(pal.rock, pal.rock2, pal.deep, i * 17 + L.bi, 'rock'));
    const wallT = [0, 1, 2].map(i => this.tex(pal.wall, pal.wall2, pal.mortar, i * 13 + 5, 'brick'));
    const T = (tx, ty) => getT(L, tx, ty);
    const solid = (tx, ty) => T(tx, ty) === 1;
    // distance-to-air for solid tiles (0..2)
    const dA = new Uint8Array(L.tw * L.th).fill(3);
    for (let ty = 0; ty < L.th; ty++) for (let tx = 0; tx < L.tw; tx++) {
      if (!solid(tx, ty)) continue;
      let m = 3;
      for (let yy = -2; yy <= 2; yy++) for (let xx = -2; xx <= 2; xx++) {
        const nx = tx + xx, ny = ty + yy;
        if (nx < 0 || ny < 0 || nx >= L.tw || ny >= L.th) continue;
        if (!solid(nx, ny)) m = Math.min(m, Math.max(Math.abs(xx), Math.abs(yy)) - 1);
      }
      dA[ty * L.tw + tx] = m;
    }
    // pass 1: backwall
    for (let ty = 0; ty < L.th; ty++) for (let tx = 0; tx < L.tw; tx++) {
      if (solid(tx, ty)) continue;
      const i = ty * L.tw + tx, px = tx * TS, py = ty * TS;
      if (L.back[i]) {
        x.drawImage(wallT[(tx * 7 + ty * 3) % 3], px, py);
        if (r.chance(0.04)) { x.fillStyle = 'rgba(0,0,0,.25)'; x.fillRect(px + r.int(0, 10), py + r.int(0, 10), r.int(3, 6), r.int(2, 4)); }
        // broken edges near holes
        const edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => { const j = (ty + b) * L.tw + tx + a; return j >= 0 && j < L.back.length && !L.back[j] && !solid(tx + a, ty + b); });
        if (edge) { x.fillStyle = pal.mortar; for (let k = 0; k < 10; k++) x.fillRect(px + r.int(0, 15), py + r.int(0, 15), r.int(1, 3), r.int(1, 3)); }
      }
    }
    // pass 2: ambient occlusion on empty tiles
    for (let ty = 0; ty < L.th; ty++) for (let tx = 0; tx < L.tw; tx++) {
      if (solid(tx, ty)) continue;
      const px = tx * TS, py = ty * TS;
      x.fillStyle = 'rgba(0,0,0,0.32)';
      if (solid(tx, ty - 1)) { x.fillRect(px, py, 16, 4); x.fillRect(px, py + 4, 16, 3); }
      if (solid(tx - 1, ty)) { x.fillRect(px, py, 3, 16); }
      if (solid(tx + 1, ty)) { x.fillRect(px + 13, py, 3, 16); }
      if (solid(tx, ty + 1)) { x.fillStyle = 'rgba(0,0,0,0.18)'; x.fillRect(px, py + 12, 16, 4); }
    }
    // decor that sits behind (static parts)
    for (const d of L.decor) this.drawDecorStatic(x, d, L, r);
    // pass 3: solids, platforms, ladders, spikes
    for (let ty = 0; ty < L.th; ty++) for (let tx = 0; tx < L.tw; tx++) {
      const t = T(tx, ty), px = tx * TS, py = ty * TS;
      if (L.lad[ty * L.tw + tx] && t !== 1) this.ladder(x, px, py, pal);
      if (t === 1) {
        const dd = dA[ty * L.tw + tx];
        if (dd >= 2) { x.fillStyle = pal.deep; x.fillRect(px, py, 16, 16); continue; }
        x.drawImage(rockT[(tx * 5 + ty * 11) % 4], px, py);
        if (dd === 1) { x.fillStyle = 'rgba(8,4,12,0.55)'; x.fillRect(px, py, 16, 16); continue; }
        const up = !solid(tx, ty - 1), dn = !solid(tx, ty + 1), lf = !solid(tx - 1, ty), rt = !solid(tx + 1, ty);
        x.fillStyle = pal.edge;
        if (lf) x.fillRect(px, py, 1, 16);
        if (rt) x.fillRect(px + 15, py, 1, 16);
        if (dn) { x.fillStyle = 'rgba(0,0,0,.45)'; x.fillRect(px, py + 13, 16, 3); if (r.chance(0.3)) { x.fillStyle = pal.rock; x.fillRect(px + r.int(2, 12), py + 16, 2, r.int(2, 4)); } }
        if (up) {
          x.fillStyle = pal.cap2; x.fillRect(px, py, 16, 4);
          x.fillStyle = pal.cap; x.fillRect(px, py, 16, 2);
          x.fillStyle = shade(pal.cap, 0.4); x.fillRect(px, py, 16, 1);
          x.fillStyle = pal.cap2;
          for (let k = 0; k < 3; k++) if (r.chance(0.6)) x.fillRect(px + r.int(0, 14), py + 4, r.int(1, 2), r.int(1, 5));
        }
      } else if (t === T_PLAT) {
        x.fillStyle = pal.plank; x.fillRect(px, py, 16, 5);
        x.fillStyle = shade(pal.plank, 0.25); x.fillRect(px, py, 16, 1);
        x.fillStyle = shade(pal.plank, -0.45); x.fillRect(px, py + 4, 16, 1); x.fillRect(px + (tx % 2 ? 7 : 11), py + 1, 1, 3);
        x.fillStyle = '#9a9aa6'; x.fillRect(px + 2, py + 2, 1, 1); x.fillRect(px + 13, py + 2, 1, 1);
        if (solid(tx - 1, ty) || solid(tx + 1, ty)) { x.fillStyle = shade(pal.plank, -0.3); const bx = solid(tx - 1, ty) ? px : px + 12; x.fillRect(bx, py + 5, 4, 2); x.fillRect(bx + (solid(tx - 1, ty) ? 0 : 3), py + 7, 1, 5); }
      } else if (t === T_SPIKE) {
        x.fillStyle = '#2a2530'; x.fillRect(px, py + 14, 16, 2);
        for (let k = 0; k < 4; k++) {
          const sx = px + k * 4;
          x.fillStyle = '#8a8a96'; x.fillRect(sx + 1, py + 9, 2, 5); x.fillRect(sx, py + 12, 4, 2);
          x.fillStyle = '#d4d4de'; x.fillRect(sx + 1, py + 7, 1, 4);
          x.fillStyle = '#9b2a2a'; if ((k + tx) % 3 === 0) x.fillRect(sx + 1, py + 8, 1, 2);
        }
      }
    }
    L.canvas = c;
    // minimap base
    const mm = makeCanvas(L.tw, L.th), mx = mm.getContext('2d'), md = mx.createImageData(L.tw, L.th);
    for (let i = 0; i < L.tw * L.th; i++) { const t = L.tiles[i]; const v = t === 1 ? [0, 0, 0, 0] : t === T_PLAT ? [150, 120, 90, 255] : t === T_SPIKE ? [200, 60, 60, 255] : [110, 100, 130, 255]; md.data.set(v, i * 4); }
    mx.putImageData(md, 0, 0); L.mmBase = mm;
  },

  ladder(x, px, py, pal) {
    x.fillStyle = shade(pal.plank, -0.2); x.fillRect(px + 3, py, 2, 16); x.fillRect(px + 11, py, 2, 16);
    x.fillStyle = pal.plank; for (let k = 2; k < 16; k += 5) x.fillRect(px + 3, py + k, 10, 2);
    x.fillStyle = shade(pal.plank, 0.2); for (let k = 2; k < 16; k += 5) x.fillRect(px + 3, py + k, 10, 1);
  },

  drawDecorStatic(x, d, L, r) {
    const pal = L.B.pal;
    const iron = '#2d2a33', iron2 = '#4a4652';
    if (d.kind === 'torch') {
      x.fillStyle = iron; x.fillRect(d.x - 1, d.y, 2, 7); x.fillRect(d.x - 3, d.y - 1, 6, 2);
      x.fillStyle = iron2; x.fillRect(d.x - 3, d.y - 1, 6, 1);
    } else if (d.kind === 'candles') {
      const rr = new RNG(d.x);
      d.flames = [];
      for (let i = 0; i < d.n; i++) {
        const cx = d.x - 6 + i * 4 + rr.int(0, 1), hgt = rr.int(4, 9);
        x.fillStyle = '#e6d6ae'; x.fillRect(cx, d.y - hgt, 3, hgt);
        x.fillStyle = '#bba77e'; x.fillRect(cx + 2, d.y - hgt, 1, hgt);
        x.fillStyle = '#f4ead0'; x.fillRect(cx, d.y - hgt, 1, 2); x.fillRect(cx - 1, d.y - 2, 5, 2);
        x.fillStyle = '#222'; x.fillRect(cx + 1, d.y - hgt - 1, 1, 1);
        d.flames.push({ x: cx + 1, y: d.y - hgt - 1 });
      }
    } else if (d.kind === 'chain') {
      for (let k = 0; k < d.len * 16; k += 3) { x.fillStyle = k % 6 ? iron2 : iron; x.fillRect(d.x - (k % 6 ? 0 : 1), d.y + k, k % 6 ? 1 : 3, 3); }
      x.fillStyle = iron2; x.fillRect(d.x - 2, d.y + d.len * 16, 4, 3);
    } else if (d.kind === 'banner') {
      const col = ['#7a1f2a', '#1f5a5a', '#4a2a6a', '#6a1a1a'][L.bi];
      const hgt = 14 + d.len * 6;
      x.fillStyle = iron; x.fillRect(d.x - 8, d.y + 1, 16, 2);
      x.fillStyle = col; x.fillRect(d.x - 6, d.y + 3, 12, hgt);
      x.fillStyle = shade(col, -0.35); x.fillRect(d.x + 4, d.y + 3, 2, hgt);
      x.fillStyle = shade(col, 0.2); x.fillRect(d.x - 6, d.y + 3, 1, hgt);
      for (let k = -6; k < 6; k += 3) { x.clearRect(d.x + k + 1, d.y + 3 + hgt - 2, 2, 2); }
      x.fillStyle = '#d8b55a'; x.fillRect(d.x - 1, d.y + 10, 2, 6); x.fillRect(d.x - 2, d.y + 16, 4, 1); x.fillStyle = '#ffcf6a'; x.fillRect(d.x - 1, d.y + 7, 2, 2);
    } else if (d.kind === 'cage') {
      for (let k = 0; k < 16; k += 3) { x.fillStyle = iron2; x.fillRect(d.x, d.y + k, 1, 2); }
      const cy = d.y + 16; x.fillStyle = iron; x.fillRect(d.x - 7, cy, 14, 2); x.fillRect(d.x - 7, cy + 18, 14, 2);
      for (let k = -7; k <= 6; k += 3) x.fillRect(d.x + k, cy, 1, 20);
      x.fillStyle = '#d8cdb8'; x.fillRect(d.x - 3, cy + 12, 5, 4); x.fillStyle = '#1a1418'; x.fillRect(d.x - 2, cy + 13, 1, 1); x.fillRect(d.x, cy + 13, 1, 1);
    } else if (d.kind === 'bell') {
      x.fillStyle = '#5a4030'; x.fillRect(d.x, d.y, 1, d.len * 8);
      const by = d.y + d.len * 8;
      x.fillStyle = '#8a6a2a'; x.fillRect(d.x - 4, by, 9, 3); x.fillRect(d.x - 5, by + 3, 11, 5); x.fillRect(d.x - 7, by + 8, 15, 3);
      x.fillStyle = '#c9a24a'; x.fillRect(d.x - 3, by + 1, 2, 8);
      x.fillStyle = '#3a2a1a'; x.fillRect(d.x - 1, by + 11, 2, 2);
    } else if (d.kind === 'moss') {
      const rr = new RNG(d.seed);
      for (let k = -6; k <= 6; k += 2) { const l = rr.int(4, 12 + d.len * 3); x.fillStyle = k % 4 ? '#3f7a4a' : '#2e5a38'; x.fillRect(d.x + k, d.y, 1, l); if (rr.chance(.5)) { x.fillStyle = '#6ab86a'; x.fillRect(d.x + k, d.y + l - 1, 1, 1); } }
    } else if (d.kind === 'window') {
      x.fillStyle = '#0c0a14'; x.fillRect(d.x + 2, d.y + 4, 12, 20); x.fillRect(d.x + 4, d.y + 2, 8, 2);
      x.fillStyle = '#26305a'; x.fillRect(d.x + 3, d.y + 5, 10, 18);
      x.fillStyle = '#4a5a9a'; x.fillRect(d.x + 4, d.y + 6, 3, 6);
      x.fillStyle = iron; x.fillRect(d.x + 5, d.y + 3, 1, 21); x.fillRect(d.x + 10, d.y + 3, 1, 21); x.fillRect(d.x + 2, d.y + 12, 12, 1);
      x.fillStyle = pal.edge; x.fillRect(d.x + 1, d.y + 24, 14, 2);
    } else if (d.kind === 'bones') {
      const rr = new RNG(d.seed);
      x.fillStyle = '#cfc4ae'; x.fillRect(d.x - 7, d.y - 2, 8, 2); x.fillRect(d.x + 2, d.y - 1, 6, 1);
      x.fillRect(d.x - 2, d.y - 6, 5, 4); x.fillStyle = '#1a1418'; x.fillRect(d.x - 1, d.y - 5, 1, 1); x.fillRect(d.x + 1, d.y - 5, 1, 1);
      if (rr.chance(.5)) { x.fillStyle = '#a89c86'; x.fillRect(d.x + 4, d.y - 3, 2, 3); }
    } else if (d.kind === 'pipe') {
      x.fillStyle = '#2a3a3a'; x.fillRect(d.x, d.y, d.w, 6);
      x.fillStyle = '#4a6a66'; x.fillRect(d.x, d.y + 1, d.w, 1);
      x.fillStyle = '#18242a'; x.fillRect(d.x, d.y + 5, d.w, 1);
      for (let k = 0; k < d.w; k += 40) { x.fillStyle = '#3a5250'; x.fillRect(d.x + k, d.y - 1, 4, 8); }
    } else if (d.kind === 'grate') {
      x.fillStyle = '#0a1214'; x.fillRect(d.x + 1, d.y + 1, 14, 12);
      x.fillStyle = iron2; for (let k = 2; k < 14; k += 3) x.fillRect(d.x + k, d.y + 1, 1, 12);
      x.fillStyle = 'rgba(110,210,210,0.35)'; x.fillRect(d.x + 5, d.y + 13, 6, d.fall * TS - d.y - 13);
      x.fillStyle = 'rgba(180,255,250,0.35)'; x.fillRect(d.x + 7, d.y + 13, 1, d.fall * TS - d.y - 13);
    }
  },

  // ---- parallax backgrounds ----
  makeBG(bi) {
    const B = BIOMES[bi], pal = B.pal, r = new RNG(bi * 101 + 3), BW = 960, BH = 400;
    const sky = makeCanvas(W, H), sx = sky.getContext('2d');
    const g = sx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, pal.sky1); g.addColorStop(1, pal.sky2);
    sx.fillStyle = g; sx.fillRect(0, 0, W, H);
    if (bi === 2 || bi === 3) {
      for (let i = 0; i < 90; i++) { sx.fillStyle = `rgba(255,255,240,${r.range(.2, .9)})`; sx.fillRect(r.int(0, W), r.int(0, H * .7), 1, 1); }
    }
    if (bi === 2) {
      const mg = sx.createRadialGradient(360, 60, 0, 360, 60, 70); mg.addColorStop(0, 'rgba(255,240,220,.35)'); mg.addColorStop(1, 'rgba(255,240,220,0)');
      sx.fillStyle = mg; sx.fillRect(280, 0, 160, 140);
      sx.fillStyle = '#f2ead8'; sx.beginPath(); sx.arc(360, 60, 22, 0, 7); sx.fill();
      sx.fillStyle = '#d8cfbc'; sx.fillRect(350, 52, 5, 4); sx.fillRect(364, 66, 6, 4); sx.fillRect(368, 50, 3, 3);
    }
    const far = makeCanvas(BW, BH), fx = far.getContext('2d');
    const mid = makeCanvas(BW, BH), mx = mid.getContext('2d');
    fx.fillStyle = pal.far; mx.fillStyle = pal.mid;
    if (bi === 0) {
      for (let x = 0; x < BW; x += 120) {
        const h = r.int(160, 260); fx.fillStyle = pal.far; fx.fillRect(x, BH - h, 100, h);
        for (let wy = BH - h + 20; wy < BH - 20; wy += 26) for (let wx = x + 12; wx < x + 90; wx += 18) if (r.chance(.35)) { fx.fillStyle = r.chance(.5) ? '#ff9a3c' : '#6a4a3a'; fx.fillRect(wx, wy, 4, 6); fx.fillStyle = pal.far; }
        fx.fillStyle = pal.far; fx.beginPath(); fx.arc(x + 110, BH - h + 60, 10, 0, 7); fx.fill();
      }
      for (let x = 0; x < BW; x += 80) { mx.fillStyle = pal.mid; mx.fillRect(x + 20, 0, 14, BH); mx.fillRect(x + 14, 0, 26, 20); mx.fillRect(x + 14, BH - 60, 26, 60); for (let k = 0; k < r.int(5, 14); k++) mx.fillRect(x + 50 + (k % 2), k * 9, k % 2 ? 1 : 3, 7); }
    } else if (bi === 1) {
      for (let x = 0; x < BW; x += 160) {
        fx.fillStyle = pal.far; fx.fillRect(x, 100, 160, 40); fx.fillRect(x, 140, 30, BH);
        fx.fillStyle = pal.sky2; fx.beginPath(); fx.arc(x + 95, 210, 64, Math.PI, 0); fx.fill(); fx.fillRect(x + 31, 210, 128, BH);
        fx.fillStyle = 'rgba(120,220,210,0.18)'; fx.fillRect(x + 90, 140, 10, BH);
      }
      for (let x = 0; x < BW; x += 110) { mx.fillStyle = pal.mid; mx.fillRect(x, 0, 22, BH); mx.fillRect(x - 4, 80, 30, 10); mx.fillRect(x + 22, 160 + (x % 3) * 20, 90, 8); }
      mx.fillStyle = 'rgba(40,110,110,0.5)'; mx.fillRect(0, BH - 40, BW, 40);
    } else if (bi === 2) {
      for (let x = 0; x < BW; x += 140) {
        const h = r.int(150, 250); fx.fillStyle = pal.far; fx.fillRect(x + 20, BH - h, 50, h);
        fx.beginPath(); fx.moveTo(x + 14, BH - h); fx.lineTo(x + 45, BH - h - 40); fx.lineTo(x + 76, BH - h); fx.fill();
        fx.fillStyle = '#ffcf7a'; fx.fillRect(x + 40, BH - h + 20, 6, 8); fx.fillStyle = pal.far;
        fx.fillRect(x + 70, BH - 120, 70, 120); for (let k = 0; k < 70; k += 10) fx.fillRect(x + 70 + k, BH - 128, 6, 8);
      }
      for (let x = 0; x < BW; x += 60) { mx.fillStyle = pal.mid; mx.fillRect(x, BH - 90, 60, 90); mx.fillRect(x + 4, BH - 102, 12, 12); mx.fillRect(x + 34, BH - 102, 12, 12); }
    } else {
      for (let x = 0; x < BW; x += 200) {
        fx.fillStyle = pal.far; fx.fillRect(x + 60, 80, 60, BH); fx.beginPath(); fx.arc(x + 90, 80, 34, 0, 7); fx.fill();
        fx.fillStyle = '#ff5a3a'; fx.fillRect(x + 80, 72, 6, 3); fx.fillRect(x + 94, 72, 6, 3); fx.fillStyle = pal.far;
        fx.fillRect(x + 20, 150, 140, 30);
      }
      for (let x = 0; x < BW; x += 90) { mx.fillStyle = pal.mid; for (let k = 0; k < 6; k++) mx.fillRect(x + k * 6, 40 + k * 20, 60 - k * 8, 6); mx.fillRect(x, 0, 8, BH); }
    }
    return { sky, layers: [{ c: far, f: 0.15 }, { c: mid, f: 0.35 }] };
  },

  // ---- icons (16x16) ----
  iconCache: {},
  icon(id) {
    if (this.iconCache[id]) return this.iconCache[id];
    const c = makeCanvas(16, 16), x = c.getContext('2d'), def = ITEMS[id];
    if (def && (def.kind === 'melee')) { drawWeaponShape(x, def, 3, 13, -Math.PI / 4, 1, 1, true); }
    else if (id === 'bow' || id === 'sparrow') {
      x.strokeStyle = def.blade; x.lineWidth = 2; x.beginPath(); x.arc(4, 8, 8, -1.1, 1.1); x.stroke();
      x.fillStyle = '#ddd'; x.fillRect(5, 1, 1, 14);
      x.fillStyle = '#c9c4b8'; x.fillRect(2, 7, 12, 1); x.fillStyle = id === 'bow' ? '#e5483c' : '#8fd06a'; x.fillRect(12, 6, 3, 3);
    } else if (id === 'buckler') {
      x.fillStyle = '#5a3a22'; x.beginPath(); x.arc(8, 8, 7, 0, 7); x.fill(); x.fillStyle = '#8a5a32'; x.beginPath(); x.arc(8, 8, 5.5, 0, 7); x.fill();
      x.fillStyle = '#b0b0ba'; x.fillRect(6, 6, 4, 4); x.fillStyle = '#e0e0ea'; x.fillRect(7, 6, 2, 1);
    } else if (id === 'frost') {
      x.fillStyle = '#8fdcff'; x.fillRect(7, 1, 2, 14); x.fillRect(1, 7, 14, 2); x.fillStyle = '#d8f4ff';
      for (let k = 2; k < 14; k++) { x.fillRect(k, k, 1, 1); x.fillRect(15 - k, k, 1, 1); } x.fillStyle = '#fff'; x.fillRect(7, 7, 2, 2);
    } else if (id === 'whip') {
      x.fillStyle = '#5a3a22'; x.fillRect(1, 11, 4, 3); x.fillStyle = '#9fd8ff'; const pts = [[4, 11], [7, 8], [6, 7], [10, 4], [9, 3], [14, 1]];
      for (let i = 0; i < pts.length - 1; i++) { const [a, b] = pts[i], [c2, d] = pts[i + 1]; for (let t = 0; t <= 1; t += .1) x.fillRect(Math.round(lerp(a, c2, t)), Math.round(lerp(b, d, t)), 2, 1); }
      x.fillStyle = '#fff'; x.fillRect(14, 1, 1, 1);
    } else if (id === 'firenade' || id === 'icenade' || id === 'keg') {
      const col = id === 'firenade' ? '#d0452a' : id === 'icenade' ? '#5ab8e8' : '#6a4a2a';
      if (id === 'keg') { x.fillStyle = col; x.fillRect(3, 4, 10, 11); x.fillStyle = '#3a2a1a'; x.fillRect(3, 6, 10, 1); x.fillRect(3, 12, 10, 1); x.fillStyle = '#222'; x.fillRect(7, 2, 2, 2); x.fillStyle = '#ffcf5a'; x.fillRect(8, 0, 2, 2); }
      else { x.fillStyle = col; x.beginPath(); x.arc(8, 9, 6, 0, 7); x.fill(); x.fillStyle = shade(col, .4); x.fillRect(5, 6, 2, 2); x.fillStyle = '#333'; x.fillRect(7, 1, 3, 3); x.fillStyle = '#ffcf5a'; x.fillRect(10, 0, 2, 2); }
    } else if (id === 'trap') {
      x.fillStyle = '#6a6a74'; x.fillRect(1, 11, 14, 3); x.fillStyle = '#a0a0aa';
      for (let k = 1; k < 15; k += 3) { x.fillRect(k, 7, 2, 4); } x.fillStyle = '#3a3a44'; x.fillRect(6, 12, 4, 3);
    } else if (id === 'turret') {
      x.fillStyle = '#5a3a22'; x.fillRect(4, 9, 8, 6); x.fillRect(2, 14, 12, 2);
      x.fillStyle = '#8a8a96'; x.fillRect(2, 6, 12, 3); x.fillStyle = '#c9a24a'; x.fillRect(13, 5, 2, 5); x.fillStyle = '#ddd'; x.fillRect(6, 7, 9, 1);
    } else if (id === 'phaser') {
      x.fillStyle = '#a960ea'; x.beginPath(); x.arc(8, 8, 6, 0, 7); x.fill(); x.fillStyle = '#1a0a2a'; x.beginPath(); x.arc(8, 8, 3.5, 0, 7); x.fill();
      x.fillStyle = '#e0c0ff'; x.fillRect(7, 1, 2, 2); x.fillRect(13, 7, 2, 2);
    } else if (id === 'scroll') {
      x.fillStyle = '#e8d6ad'; x.fillRect(3, 3, 10, 10); x.fillStyle = '#b89f76'; x.fillRect(2, 2, 12, 2); x.fillRect(2, 12, 12, 2);
      x.fillStyle = '#a960ea'; x.fillRect(5, 6, 6, 1); x.fillStyle = '#e5483c'; x.fillRect(5, 8, 6, 1); x.fillStyle = '#4fc466'; x.fillRect(5, 10, 4, 1);
    } else if (id === 'food') {
      x.fillStyle = '#c0703a'; x.beginPath(); x.arc(8, 9, 5, 0, 7); x.fill(); x.fillStyle = '#e89a5a'; x.fillRect(5, 6, 3, 2); x.fillStyle = '#5a3a1a'; x.fillRect(8, 2, 1, 3); x.fillStyle = '#4fc466'; x.fillRect(9, 3, 3, 2);
    } else if (id === 'blueprint') {
      x.fillStyle = '#2a5a9a'; x.fillRect(2, 3, 12, 10); x.fillStyle = '#8ac0ff'; x.fillRect(4, 5, 8, 1); x.fillRect(4, 8, 5, 1); x.fillRect(4, 10, 7, 1); x.fillStyle = '#d8ecff'; x.fillRect(2, 3, 12, 1);
    } else if (id === 'knives') {
      for (const [a, b] of [[2, 12], [6, 13], [10, 12]]) { x.fillStyle = '#4a2a1a'; x.fillRect(a, b, 2, 3); x.fillStyle = '#d8e0e8'; x.fillRect(a, b - 8, 2, 8); x.fillStyle = '#fff'; x.fillRect(a, b - 8, 1, 7); }
      x.fillStyle = '#e04060'; x.fillRect(13, 2, 2, 3);
    } else if (id === 'hook') {
      x.fillStyle = '#8a8a96'; for (let k = 0; k < 6; k++) x.fillRect(1 + k * 2, 14 - k * 2, 2, 1);
      x.fillStyle = '#c9ccd8'; x.fillRect(12, 2, 2, 7); x.fillRect(9, 8, 4, 2); x.fillRect(8, 6, 2, 2); x.fillStyle = '#fff'; x.fillRect(12, 2, 1, 3);
    } else if (id === 'nova') {
      x.fillStyle = '#e0572a'; x.beginPath(); x.arc(8, 8, 7, 0, 7); x.fill(); x.fillStyle = '#1a0e08'; x.beginPath(); x.arc(8, 8, 4, 0, 7); x.fill();
      x.fillStyle = '#ffab3d'; for (let k = 0; k < 8; k++) { const a = k * .785; x.fillRect(Math.round(8 + Math.cos(a) * 6) - 1, Math.round(8 + Math.sin(a) * 6) - 1, 2, 2); }
      x.fillStyle = '#fff3a8'; x.fillRect(7, 7, 2, 2);
    } else if (id === 'ward') {
      x.fillStyle = '#b89f76'; x.fillRect(3, 2, 10, 10); x.fillRect(5, 12, 6, 2); x.fillRect(7, 14, 2, 1);
      x.fillStyle = '#e8d6ad'; x.fillRect(4, 3, 8, 8); x.fillRect(6, 11, 4, 2); x.fillStyle = '#ffab3d'; x.fillRect(7, 5, 2, 5); x.fillStyle = '#fff3a8'; x.fillRect(7, 5, 1, 2);
    } else if (id === 'blades') {
      for (const [a, b] of [[3, 12], [8, 13], [13, 12]]) { x.fillStyle = '#6a8aaa'; x.fillRect(a - 1, b, 3, 1); x.fillStyle = '#b8e8ff'; x.fillRect(a, b - 9, 1, 9); x.fillStyle = '#fff'; x.fillRect(a, b - 9, 1, 2); }
    } else if (id === 'decoy') {
      x.fillStyle = '#e8d6ad'; x.fillRect(5, 4, 6, 10); x.fillRect(4, 14, 8, 2); x.fillStyle = '#b89f76'; x.fillRect(10, 4, 1, 10);
      x.fillStyle = '#222'; x.fillRect(7, 3, 1, 1); x.fillStyle = '#ffab3d'; x.fillRect(6, 0, 3, 3); x.fillStyle = '#2a1c14'; x.fillRect(8, 7, 1, 1);
    } else if (id === 'storm') {
      x.fillStyle = '#4a4a62'; x.fillRect(2, 2, 12, 5); x.fillRect(4, 1, 7, 1); x.fillStyle = '#6a6a88'; x.fillRect(3, 2, 10, 1);
      x.fillStyle = '#fff6a0'; x.fillRect(8, 7, 2, 3); x.fillRect(6, 9, 3, 2); x.fillRect(7, 11, 2, 3); x.fillRect(6, 13, 1, 2);
    } else if (id === 'flask') {
      x.fillStyle = '#6a5a4a'; x.fillRect(6, 1, 4, 3); x.fillStyle = '#c93a4a'; x.fillRect(4, 5, 8, 9); x.fillRect(5, 4, 6, 1); x.fillStyle = '#ff7a8a'; x.fillRect(5, 6, 2, 4);
    }
    return this.iconCache[id] = c;
  },
  iconURL(id) { const k = '_url_' + id; if (!this.iconCache[k]) this.iconCache[k] = this.icon(id).toDataURL(); return this.iconCache[k]; }
};

// ---- weapon rendering (shared by icons and characters) ----
// Draws along +x from the grip at (x,y) rotated by ang; f is facing (1/-1)
function drawWeaponShape(ctx, def, x, y, ang, f, sc = 1, icon = false) {
  ctx.save(); ctx.translate(x, y); ctx.scale(f * sc, sc); ctx.rotate(ang);
  const id = Object.keys(ITEMS).find(k => ITEMS[k] === def);
  const bl = def.blade || '#ccc', L = icon ? Math.min(def.len || 10, 14) : (def.len || 10);
  const R = (a, b, c, d, col) => { ctx.fillStyle = col; ctx.fillRect(a, b, c, d); };
  if (id === 'scythe') {
    R(-5, -0.5, L, 1.5, '#5a3a22'); R(L - 5, -1, 2, 2, '#8a7a5a'); R(L - 4, -8, 2, 8, bl); R(L - 9, -9, 6, 2, bl); R(L - 12, -8, 3, 1, bl); R(L - 9, -9, 6, 1, '#fff');
  } else if (id === 'fists') {
    R(-2, -2, 5, 4, '#6a3a22'); R(1, -2, 3, 4, bl); R(2, -1, 2, 2, '#fff3a8');
  } else if (id === 'pike') {
    R(-4, -0.5, L - 2, 1.5, '#6a4a2a'); R(L - 6, -2, 5, 4, bl); R(L - 1, -1, 3, 2, shade(bl, .3)); R(L - 6, -2, 5, 1, '#fff');
  } else if (id === 'hammer') {
    R(-3, -1, L - 2, 2, '#6a4a2a'); R(L - 6, -5, 6, 10, bl); R(L - 6, -5, 6, 2, shade(bl, .3)); R(L - 1, -4, 2, 8, shade(bl, -.3));
  } else if (id === 'daggers' || id === 'cutthroat') {
    R(-2, -1, 3, 2, '#4a2a1a'); R(1, -2, 1, 4, '#8a7a5a'); R(2, -1, L, 2, bl); R(2, -1, L, 1, '#fff'); R(L + 2, -0.5, 1, 1, bl);
  } else if (id === 'broad') {
    R(-4, -1, 5, 2, '#4a2a1a'); R(1, -4, 2, 8, '#8a7a5a'); R(3, -2, L, 4, bl); R(3, -2, L, 1, '#f4f4ff'); R(L + 3, -1, 2, 2, bl);
  } else {
    R(-3, -1, 4, 2, '#4a2a1a'); R(1, -3, 1, 6, '#8a7a5a'); R(2, -1, L, 2, bl); R(2, -1, L, 1, '#fff'); R(L + 2, -0.5, 1, 1, bl);
  }
  ctx.restore();
}

// Painter: draws rects in a character's local, facing-aware space. ov overrides every colour (flash / outline).
function painter(ctx, ox, oy, f, ov) {
  return { r(x, y, w, h, c) { ctx.fillStyle = ov || c; ctx.fillRect(Math.round(f > 0 ? ox + x : ox - x - w), Math.round(oy + y), w, h); } };
}
function withOutline(ctx, col, fn) { for (const [a, b] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) fn(a, b, col); fn(0, 0, null); }

