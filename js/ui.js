'use strict';
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const UI = {
  screen: 'screen-title', capture: null, back: null, keys: null, toastT: 0, bannerT: 0, slotEls: [], last: {},
  init() {
    // slots
    const slots = $('slots');
    for (let i = 0; i < 4; i++) {
      const d = document.createElement('div'); d.className = 'slot' + (i === 2 ? ' gap' : '');
      d.innerHTML = '<span class="pip"></span><img alt=""><div class="cd"></div><span class="key"></span><span class="tier"></span>';
      slots.appendChild(d); this.slotEls.push(d);
    }
    for (let i = 0; i < 4; i++) { const im = document.createElement('img'); im.alt = ''; $('flasks').appendChild(im); }
    // title
    $('btn-start').onclick = () => { SND.init(); SND.play('ui'); G.newRun(); };
    $('btn-howto').onclick = () => { SND.play('ui'); this.showHowto('screen-title'); };
    $('btn-wardrobe').onclick = () => { SND.init(); SND.play('ui'); this.showWardrobe(); };
    $('btn-wardrobe-close').onclick = () => { SND.play('ui'); this.showTitle(); };
    $('btn-howto-close').onclick = () => { SND.play('ui'); this.closeHowto(); };
    $('btn-controls').onclick = () => { SND.init(); SND.play('ui'); this.showControls('screen-title'); };
    $('btn-p-controls').onclick = () => { SND.play('ui'); this.showControls('screen-pause'); };
    $('btn-howto-rebind').onclick = () => { SND.play('ui'); this.showControls(this.howtoFrom); };
    $('btn-controls-close').onclick = () => { SND.play('ui'); this.closeControls(); };
    $('btn-pad-reset').onclick = () => { Input.resetPad(); this.bindNote = 'Gamepad buttons reset to the defaults.'; SND.play('ui'); this.renderControls(); };
    $('bind-presets').innerHTML = Object.entries(BIND_PRESETS).map(([id, p]) => `<button class="preset" type="button" data-preset="${id}">${esc(p.name)}<small>${esc(p.desc)}</small></button>`).join('');
    $('bind-presets').querySelectorAll('[data-preset]').forEach(b => b.onclick = () => {
      this.capture = null; Input.applyPreset(b.dataset.preset); this.bindNote = BIND_PRESETS[b.dataset.preset].name + ' layout applied.'; SND.play('pickup'); this.renderControls();
    });
    // while a slot is listening, mouse buttons become the new binding instead of clicking things
    addEventListener('mousedown', e => {
      if (!this.capture || this.capture.s === 'pad' || performance.now() - this.capture.t < 120) return;
      e.preventDefault(); e.stopPropagation(); this.swallowClick = true; this.assignKey('Mouse' + e.button);
    }, true);
    addEventListener('click', e => { if (this.swallowClick) { this.swallowClick = false; e.preventDefault(); e.stopPropagation(); } }, true);
    addEventListener('contextmenu', e => { if (this.screen === 'screen-controls') e.preventDefault(); });
    $('btn-sound').onclick = () => { SND.init(); this.toggleSound(); };
    $('btn-ember').onclick = () => { Save.d.ember = (Save.d.ember + 1) % (Save.d.emberMax + 1); Save.write(); this.refreshTitle(); SND.play('ui'); };
    // pause
    $('btn-resume').onclick = () => this.resume();
    $('btn-p-sound').onclick = () => this.toggleSound();
    $('btn-p-shake').onclick = () => { Save.d.shake = !Save.d.shake; Save.write(); this.refreshPause(); };
    $('btn-p-howto').onclick = () => this.showHowto('screen-pause');
    $('btn-abandon').onclick = () => { if (this.confirmAbandon) { this.confirmAbandon = false; G.player.die(); this.resume(); } else { this.confirmAbandon = true; $('btn-abandon').textContent = 'Abandon run: press again to confirm'; } };
    // keyboard for menus
    addEventListener('keydown', e => this.onKey(e));
    // touch controls
    if (!Native.api && matchMedia('(pointer: coarse)').matches) {
      $('touch').hidden = false;
      for (const b of $('touch').querySelectorAll('button')) {
        const a = b.dataset.act;
        const on = e => { e.preventDefault(); SND.init(); Input.touch[a] = true; Input.hit[a] = true; b.classList.add('on'); if (a === 'pause' && G.state === 'play') this.pause(); if (a === 'map') G.toggleMap(); };
        const off = e => { e.preventDefault(); Input.touch[a] = false; b.classList.remove('on'); };
        b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off); b.addEventListener('pointercancel', off); b.addEventListener('pointerleave', off);
      }
    }
    if (Native.api) {
      for (const id of ['btn-fullscreen', 'btn-quit', 'btn-p-fullscreen', 'btn-p-quit']) $(id).hidden = false;
      const fs = () => { Native.api.setFullscreen(!Native.info.fullscreen); Native.info.fullscreen = !Native.info.fullscreen; this.refreshTitle(); this.refreshPause(); SND.play('ui'); };
      $('btn-fullscreen').onclick = fs; $('btn-p-fullscreen').onclick = fs;
      addEventListener('wickborn-fullscreen', e => { Native.info.fullscreen = !!e.detail; this.refreshTitle(); this.refreshPause(); });
      $('btn-quit').onclick = () => { Save.write(); Native.api.quit(); };
      $('btn-p-quit').onclick = () => {
        if (this.confirmQuit) { Save.d.kills += G.run.kills; Save.write(); Native.api.quit(); }
        else { this.confirmQuit = true; $('btn-p-quit').textContent = 'Quit to desktop: this run will be lost. Press again'; }
      };
    }
    this.refreshTitle();
  },
  toggleSound() { Save.d.muted = !Save.d.muted; SND.setMuted(Save.d.muted); Save.write(); this.refreshTitle(); this.refreshPause(); SND.play('ui'); },
  refreshTitle() {
    const d = Save.d;
    $('sound-val').textContent = d.muted ? 'off' : 'on';
    if (Native.api) $('fs-val').textContent = Native.info.fullscreen ? 'fullscreen' : 'windowed';
    $('skin-val').textContent = skinById(d.skin).name;
    $('btn-ember').hidden = d.emberMax <= 0;
    $('ember-val').textContent = d.ember === 0 ? 'none' : d.ember + ' (enemies +' + d.ember * 35 + '% health)';
    $('title-stats').innerHTML = `<span>Runs <b>${d.runs}</b></span><span>Victories <b>${d.wins}</b></span><span>Deepest <b>${d.bestBiome ? esc(BIOMES[Math.min(3, d.bestBiome)].name) : 'None yet'}</b></span><span>Foes slain <b>${d.kills}</b></span>`;
  },
  showScreen(id, back = null, keys = null) {
    for (const s of document.querySelectorAll('.screen')) s.hidden = true;
    this.screen = id; this.back = back; this.keys = keys;
    if (id) { $(id).hidden = false; const b = $(id).querySelector('[data-autofocus]') || $(id).querySelector('button:not([disabled])'); if (b) setTimeout(() => b.focus({ preventScroll: true }), 0); }
  },
  focusables() { return this.screen ? [...$(this.screen).querySelectorAll('button:not([disabled])')].filter(b => b.offsetParent !== null) : []; },
  moveFocus(d) {
    const f = this.focusables(); if (!f.length) return;
    let i = f.indexOf(document.activeElement); i = i < 0 ? 0 : (i + d + f.length) % f.length; f[i].focus(); SND.play('ui');
  },
  onKey(e) {
    if (this.capture) {
      e.preventDefault(); e.stopPropagation();
      if (e.code === 'Escape') this.cancelCapture();
      else if (this.capture.s === 'pad') return;
      else if (e.code === 'Backspace' || e.code === 'Delete') this.clearSlot();
      else this.assignKey(e.code);
      return;
    }
    if (!this.screen) {
      if (G.state === 'play' && (e.code === 'Escape' || e.code === 'KeyP')) { /* handled by game via Input */ }
      return;
    }
    if (this.keys && this.keys[e.code]) { e.preventDefault(); this.keys[e.code](); return; }
    if (['ArrowDown', 'KeyS'].includes(e.code)) { e.preventDefault(); this.moveFocus(1); }
    else if (['ArrowUp', 'KeyW'].includes(e.code)) { e.preventDefault(); this.moveFocus(-1); }
    else if (['ArrowRight', 'KeyD'].includes(e.code) && this.screen === 'screen-choice') { e.preventDefault(); this.moveFocus(1); }
    else if (['ArrowLeft', 'KeyA'].includes(e.code) && this.screen === 'screen-choice') { e.preventDefault(); this.moveFocus(-1); }
    else if (e.code === 'Escape' && this.back) { e.preventDefault(); this.back(); }
    else if ((e.code === 'KeyJ' || e.code === 'KeyX') && document.activeElement && document.activeElement.tagName === 'BUTTON') { e.preventDefault(); document.activeElement.click(); }
  },
  padMenu() {
    const jp = Input.padJustPressed();
    if (this.capture) {
      if (jp >= 0) { if (this.capture.s === 'pad') this.assignPad(jp); else if (jp === 1) this.cancelCapture(); }
      return;
    }
    if (Input.lastDevice !== 'pad') return;
    if (Input.pressed.down || Input.pressed.right) this.moveFocus(1);
    if (Input.pressed.up || Input.pressed.left) this.moveFocus(-1);
    if (jp === 0 && document.activeElement && document.activeElement.tagName === 'BUTTON') document.activeElement.click();
    if ((jp === 1 || jp === 9) && this.back) this.back();
  },
  // ---------- controls / rebinding ----------
  showControls(from) {
    this.controlsFrom = from; this.capture = null; this.bindNote = '';
    this.renderControls();
    this.showScreen('screen-controls', () => this.closeControls());
  },
  closeControls() { this.capture = null; if (this.controlsFrom === 'screen-pause') this.pause(); else this.showTitle(); },
  renderControls() {
    const cap = this.capture;
    const slot = (a, s) => {
      const listening = cap && cap.a === a && cap.s === s;
      const code = s === 'pad' ? Input.padBinds[a] : Input.binds[a][s];
      const name = s === 'pad' ? padName(code) : keyName(code);
      const text = listening ? (s === 'pad' ? 'Press a button' : 'Press a key') : (name || 'Unbound');
      return `<button class="key-slot${name ? '' : ' empty'}${listening ? ' listening' : ''}" type="button" data-a="${a}" data-s="${s}" aria-label="${esc(ACTION_NAMES[a])}, ${s === 'pad' ? 'gamepad' : s ? 'alternate key' : 'key'}: ${esc(name || 'unbound')}">${esc(text)}</button>`;
    };
    $('bind-rows').innerHTML = BIND_ORDER.map(a => {
      const move = ['left', 'right', 'up', 'down'].includes(a), b = Input.binds[a];
      const none = !b[0] && !b[1];
      return `<div class="bind-row${none ? ' unbound' : ''}"><span class="bind-name">${esc(ACTION_NAMES[a])}</span>${slot(a, 0)}${slot(a, 1)}${move ? '<span class="bind-fixed">Stick / D-pad</span>' : slot(a, 'pad')}</div>`;
    }).join('');
    $('bind-rows').querySelectorAll('.key-slot').forEach(b => b.onclick = () => this.startCapture(b.dataset.a, b.dataset.s === 'pad' ? 'pad' : +b.dataset.s));
    for (const [id, p] of Object.entries(BIND_PRESETS)) {
      const same = BIND_ORDER.every(a => Input.binds[a][0] === p.keys[a][0] && Input.binds[a][1] === p.keys[a][1]);
      const el = $('bind-presets').querySelector(`[data-preset="${id}"]`); if (el) el.classList.toggle('on', same);
    }
    $('bind-note').textContent = this.bindNote || 'Esc always pauses, whatever you bind. Backspace clears a slot while it is listening.';
    if (cap) { const el = $('bind-rows').querySelector(`[data-a="${cap.a}"][data-s="${cap.s}"]`); if (el) el.focus({ preventScroll: false }); }
  },
  startCapture(a, s) {
    this.capture = { a, s, t: performance.now() };
    this.bindNote = s === 'pad' ? 'Press a gamepad button for ' + ACTION_NAMES[a] + '. Esc cancels.' : 'Press a key or click a mouse button for ' + ACTION_NAMES[a] + '. Esc cancels, Backspace clears.';
    this.renderControls();
  },
  cancelCapture() { const c = this.capture; this.capture = null; this.bindNote = 'Cancelled.'; this.renderControls(); this.refocus(c); },
  refocus(c) { if (!c) return; const el = $('bind-rows').querySelector(`[data-a="${c.a}"][data-s="${c.s}"]`); if (el) el.focus({ preventScroll: true }); },
  clearSlot() {
    const c = this.capture; this.capture = null;
    if (c.s === 'pad') Input.padBinds[c.a] = null; else Input.binds[c.a][c.s] = null;
    Input.saveBinds(); this.bindNote = ACTION_NAMES[c.a] + ' slot cleared.'; SND.play('ui'); this.renderControls(); this.refocus(c);
  },
  assignKey(code) {
    const c = this.capture; this.capture = null;
    const moved = [];
    for (const o of BIND_ORDER) for (let k = 0; k < 2; k++) {
      if (Input.binds[o][k] === code && !(o === c.a && k === c.s)) { Input.binds[o][k] = null; if (o !== c.a && !moved.includes(ACTION_NAMES[o])) moved.push(ACTION_NAMES[o]); }
    }
    Input.binds[c.a][c.s] = code;
    Input.saveBinds();
    this.bindNote = ACTION_NAMES[c.a] + ' is now ' + keyName(code) + '.' + (moved.length ? ' It was taken from ' + moved.join(' and ') + '.' : '');
    SND.play('ui'); this.renderControls(); this.refocus(c);
  },
  assignPad(i) {
    const c = this.capture; this.capture = null;
    const old = Input.padBinds[c.a]; let swapped = null;
    for (const o of BIND_ORDER) if (o !== c.a && Input.padBinds[o] === i) { Input.padBinds[o] = old; swapped = o; }
    Input.padBinds[c.a] = i;
    Input.saveBinds();
    this.bindNote = ACTION_NAMES[c.a] + ' is now ' + padName(i) + ' on the gamepad.' + (swapped ? ' ' + ACTION_NAMES[swapped] + ' moved to ' + (old != null ? padName(old) : 'no button') + '.' : '');
    SND.play('ui'); this.renderControls(); this.refocus(c);
  },
  renderHowtoKeys() {
    const k = a => { const b = Input.binds[a].filter(Boolean).map(keyName); const p = Input.padBinds[a] != null ? padName(Input.padBinds[a]) : null; return b.map(x => `<kbd>${esc(x)}</kbd>`).join(' ') + (p ? ` <kbd>${esc(p)}</kbd>` : ''); };
    const rows = [
      [k('left') + ' ' + k('right'), 'Move'],
      [k('jump'), 'Jump, double jump. Down + Jump drops through planks'],
      [k('atk1'), 'Primary weapon (tap again to combo)'],
      [k('atk2'), 'Secondary weapon (hold a shield to block)'],
      [k('roll'), 'Roll on the ground, air dash in the air. Both dodge attacks'],
      [k('sk1') + ' ' + k('sk2'), 'Skills'],
      [k('heal'), 'Drink health flask'],
      [k('ult'), 'Ultimate, once the flame meter is full'],
      [k('interact'), 'Interact, pick up, open doors'],
      [k('up'), 'Climb ladders'],
      [k('map') + ' / ' + k('pause'), 'Map / pause']
    ];
    $('howto-keys').innerHTML = rows.map(([a, b]) => `<dt>${a}</dt><dd>${b}</dd>`).join('');
  },
  showWardrobe() {
    this.renderWardrobe();
    this.showScreen('screen-wardrobe', () => this.showTitle());
  },
  skinCard(s, mode) {
    const un = skinUnlocked(s), on = Save.d.skin === s.id, u = ULTS[s.ult];
    let tag = on ? 'Equipped' : '';
    let sub = un ? esc(s.desc) : esc(skinLockText(s));
    if (mode === 'buy') { tag = s.unlock.cost + ' cells'; sub = esc(s.desc); }
    return `<button class="skin${on && mode !== 'buy' ? ' on' : ''}${!un && mode !== 'buy' ? ' locked' : ''}" type="button" data-skin="${s.id}" ${mode === 'buy' && G.player.cells < s.unlock.cost ? 'disabled' : ''}>
      <canvas width="64" height="64" data-prev="${s.id}"></canvas>
      <span><b>${esc(s.name)}</b><span class="ult">★ ${esc(u.name)}: ${esc(u.desc)}</span><small>${un || mode === 'buy' ? '' : 'Locked. '}${sub}</small></span>${tag ? `<span class="tag">${tag}</span>` : ''}</button>`;
  },
  bindPreviews(root) {
    this.previews = [...root.querySelectorAll('canvas[data-prev]')].map(c => ({ c, s: skinById(c.dataset.prev) }));
    this.tickPreviews(G.time);
  },
  tickPreviews(t) { for (const pv of this.previews || []) if (pv.c.isConnected) drawSkinPreview(pv.c, pv.s, t + pv.s.id.length); },
  renderWardrobe() {
    const g = $('skin-grid');
    g.innerHTML = SKINS.map(s => this.skinCard(s)).join('');
    g.querySelectorAll('[data-skin]').forEach(b => b.onclick = () => {
      const s = skinById(b.dataset.skin);
      if (!skinUnlocked(s)) { SND.play('deny'); return; }
      Save.d.skin = s.id; Save.write(); SND.play('pickup');
      if (G.state === 'title' && G.player) G.player.skin = s;
      this.renderWardrobe(); this.refreshTitle();
      const f = $('skin-grid').querySelector(`[data-skin="${s.id}"]`); if (f) f.focus({ preventScroll: true });
    });
    this.bindPreviews(g);
  },
  showHowto(from) { this.howtoFrom = from; this.renderHowtoKeys(); this.showScreen('screen-howto', () => this.closeHowto()); },
  closeHowto() { if (this.howtoFrom === 'screen-pause') this.pause(); else this.showTitle(); },
  showTitle() {
    G.state = 'title'; $('hud').hidden = true; Ach.checkMeta(); this.refreshTitle();
    this.showScreen('screen-title');
    G.startTitleScene();
  },
  // ---------- in-game ----------
  pause() {
    if (G.state !== 'play' && G.state !== 'menu') return;
    G.state = 'menu'; this.confirmAbandon = false; $('btn-abandon').textContent = 'Abandon run';
    this.confirmQuit = false; if (Native.api) $('btn-p-quit').textContent = 'Quit to desktop';
    this.refreshPause();
    const p = G.player;
    $('pause-lede').textContent = `${BIOMES[G.run.biome].name} · ${fmtTime(G.run.time)} · ${G.run.kills} slain`;
    const us = ULTS[p.skin.ult];
    $('pause-loadout').innerHTML = `<div class="card" style="--c:${FLAME_LIGHT[p.skin.flame]}"><canvas width="64" height="64" data-prev="${p.skin.id}" style="width:calc(var(--u)*28);height:calc(var(--u)*28);image-rendering:pixelated"></canvas><div><div class="nm">${esc(p.skin.name)}</div><div class="tag">Ultimate: ${esc(us.name)} (${Math.floor(p.surge)}% charged)</div><div class="ds">${esc(us.desc)}</div></div></div>` + p.slots.map((it, i) => it ? this.cardHTML(it) : `<div class="card"><div class="ds">${i < 2 ? 'Empty weapon slot' : 'Empty skill slot'}</div></div>`).join('');
    $('pause-muts').innerHTML = p.mutations.length ? p.mutations.map(m => { const d = MUTATIONS.find(x => x.id === m); return `<span title="${esc(d.desc)}">${esc(d.name)}: ${esc(d.desc)}</span>`; }).join('') : '<span>None yet. Choose them at the Keeper between biomes.</span>';
    this.bindPreviews($('pause-loadout'));
    this.showScreen('screen-pause', () => this.resume());
  },
  refreshPause() {
    if (Native.api) $('btn-p-fullscreen').textContent = 'Display: ' + (Native.info.fullscreen ? 'fullscreen' : 'windowed'); $('btn-p-sound').textContent = 'Sound: ' + (Save.d.muted ? 'off' : 'on'); $('btn-p-shake').textContent = 'Screen shake: ' + (Save.d.shake ? 'on' : 'off'); },
  resume() { this.showScreen(null); G.state = 'play'; Input.clear(); },
  cardHTML(it) {
    const d = it.def, col = STAT[d.stat].col;
    const kindName = { melee: 'Melee weapon', bow: 'Bow', shield: 'Shield', frost: 'Spell', spark: 'Spell', skill: 'Skill' }[d.kind];
    let dmg = '';
    if (d.combo && d.kind !== 'shield') { const p = G.player, avg = d.combo.reduce((a, s) => a + s.dmg, 0) / d.combo.length; dmg = ` · ~${Math.round(avg * tierMult(it) * p.statMult(d.stat))} dmg/hit`; }
    else if (d.dmg) dmg = ` · ${Math.round(G.player.skillDmg(it))} dmg`;
    if (d.cd) dmg += ` · ${d.cd}s cooldown`;
    return `<div class="card" style="--c:${col}"><img src="${Art.iconURL(it.id)}" alt=""><div><div class="nm">${esc(itemName(it))}</div><div class="tag">${STAT[d.stat].name} ${kindName}${dmg}</div><div class="ds">${esc(d.desc)}</div>${it.affix ? `<div class="af">★ ${esc(affixText(it.affix))}</div>` : ''}</div></div>`;
  },
  offerItem(item, pickupObj, onTake) {
    const p = G.player, skill = item.def.kind === 'skill';
    const idx = skill ? [2, 3] : [0, 1];
    const empty = idx.find(i => !p.slots[i]);
    const take = i => {
      const old = p.slots[i];
      p.slots[i] = item; p.cds[i] = 0; if (p.atk && p.atk.slot === i) p.atk = null;
      if (pickupObj) pickupObj.dead = true;
      if (onTake) onTake();
      if (old) G.objs.push(new Pickup(p.x + p.w / 2, p.y + p.h, 'item', { item: old, vx: -p.face * 40, vy: -120 }));
      SND.play('pickup'); this.toast('Equipped ' + itemName(item));
    };
    if (empty != null) { take(empty); return; }
    G.state = 'menu';
    const acts = skill ? ['sk1', 'sk2'] : ['atk1', 'atk2'];
    const keys = {};
    const html = [`<h2>${esc(itemName(item))}</h2><p class="lede">${onTake ? 'Buy it and swap it for one of your ' + (skill ? 'skills' : 'weapons') + '.' : 'Swap it for one of your ' + (skill ? 'skills' : 'weapons') + '. The old one drops to the floor.'}</p>`, this.cardHTML(item), '<div class="eyebrow">Replace</div>'];
    idx.forEach((i, n) => {
      const cur = p.slots[i];
      html.push(`<button class="btn" type="button" data-slot="${i}"><img src="${Art.iconURL(cur.id)}" alt=""><span>${esc(itemName(cur))}<small>${esc(cur.def.desc)}</small></span><span class="k">${esc(Input.label(acts[n]))}</span></button>`);
      for (const code of Input.binds[acts[n]]) if (code && !code.startsWith('Mouse')) keys[code] = () => { this.resume(); take(i); };
    });
    html.push(`<button class="btn" type="button" id="btn-leave">Leave it<span class="k">Esc</span></button>`);
    $('choice-panel').innerHTML = html.join('');
    $('choice-panel').querySelectorAll('[data-slot]').forEach(b => b.onclick = () => { this.resume(); take(+b.dataset.slot); });
    $('btn-leave').onclick = () => this.resume();
    this.showScreen('screen-choice', () => this.resume(), keys);
  },
  scrollChoice() {
    G.state = 'menu';
    const p = G.player, pair = ['b', 't', 's'].sort(() => Math.random() - .5).slice(0, 2);
    const blurb = { b: 'Boosts red gear: swords, daggers, grenades.', t: 'Boosts purple gear: bows, spells, traps, turrets.', s: 'Boosts green gear: shields, hammers, broadswords. Adds the most health.' };
    const keys = {};
    const html = [`<h2>Scroll of Power</h2><p class="lede">Choose a stat to raise. Matching gear hits 15% harder per level, and you gain max health.</p><div class="choices">`];
    pair.forEach((k, n) => {
      html.push(`<button class="choice" type="button" data-k="${k}" style="--c:${STAT[k].col}"><b>${STAT[k].name} ${p.stats[k]} → ${p.stats[k] + 1}</b><span>${blurb[k]}</span><span class="k" style="display:block;margin-top:calc(var(--u)*4)">Press ${esc(Input.label(n ? 'atk2' : 'atk1'))} or ${n + 1}</span></button>`);
      keys['Digit' + (n + 1)] = () => pickStat(k);
      for (const code of Input.binds[n ? 'atk2' : 'atk1']) if (code && !code.startsWith('Mouse')) keys[code] = () => pickStat(k);
    });
    html.push('</div>');
    const pickStat = k => {
      p.stats[k]++; p.recalcHp(); p.hp = Math.min(p.maxHp, p.hp + p.maxHp * .1); this.resume(); SND.play('scroll');
      FX.burst(p.x + 5, p.y + 10, 30, [STAT[k].col, '#fff'], 120, .8, { grav: -80, glow: STAT[k].col });
      this.toast(STAT[k].name + ' raised to ' + p.stats[k]);
    };
    $('choice-panel').innerHTML = html.join('');
    $('choice-panel').querySelectorAll('.choice').forEach(b => b.onclick = () => pickStat(b.dataset.k));
    this.showScreen('screen-choice', null, keys);
  },
  showKeeper() {
    G.state = 'keeper'; this.keeperMuts = shuffleCopy(MUTATIONS.filter(m => !G.player.mutations.includes(m.id))).slice(0, 3); this.mutChosen = false;
    Music.start(4);
    this.renderKeeper();
    this.showScreen('screen-keeper');
  },
  renderKeeper() {
    const p = G.player, d = Save.d, next = BIOMES[G.run.biome + 1];
    const flaskCost = [30, 70, 140][d.flaskLv], purseCost = [25, 60, 120][d.purseLv];
    const rows = [];
    rows.push(`<h2>The Keeper's Nook</h2><p class="lede">"Spend your cells, little candle. The dead carry nothing." Unspent cells are lost when you die. Your flasks have been refilled.</p>`);
    rows.push(`<div class="stats-grid"><div><b style="color:var(--cells)">${p.cells}</b><span>Cells to spend</span></div><div><b>${Math.ceil(p.hp)}/${p.maxHp}</b><span>Health</span></div><div><b>${p.flask}/${p.flaskMax}</b><span>Flasks</span></div></div>`);
    rows.push(`<div class="cols"><div><div class="eyebrow">Permanent upgrades</div>`);
    const inv = (id, icon, label, sub, cost) => rows.push(`<button class="btn" type="button" data-inv="${id}" ${cost == null || p.cells < cost ? 'disabled' : ''}><img src="${Art.iconURL(icon)}" alt=""><span>${label}<small>${sub}</small></span><span class="cost">${cost == null ? 'Maxed' : cost + ' cells'}</span></button>`);
    inv('flask', 'flask', `Extra flask (${d.flaskLv}/3)`, 'One more healing flask on every run', d.flaskLv < 3 ? flaskCost : null);
    inv('purse', 'food', `Starting purse (${d.purseLv}/3)`, 'Begin each run with ' + [50, 100, 200][Math.min(2, d.purseLv)] + ' gold', d.purseLv < 3 ? purseCost : null);
    inv('skill', 'trap', 'Pack a skill', 'Start every run with a random skill', d.startSkill ? null : 40);
    for (const id of d.blueprints) inv('bp:' + id, id, 'Unlock ' + ITEMS[id].name, 'Adds it to chests, shops and drops', ITEMS[id].cost);
    const forSale = SKINS.filter(s => s.unlock.t === 'cells' && !d.skins.includes(s.id));
    if (forSale.length) { rows.push(`<div class="eyebrow">Characters for sale</div><div class="skins">`); for (const s of forSale) rows.push(this.skinCard(s, 'buy')); rows.push('</div>'); }
    if (!d.blueprints.length) rows.push(`<p class="lede" style="margin:0">Elites drop blueprints for new weapons and skills. Bring them here to unlock them.</p>`);
    rows.push(`</div><div><div class="eyebrow">Choose a mutation (${p.mutations.length}/3 held)</div>`);
    for (const m of this.keeperMuts) rows.push(`<button class="btn" type="button" data-mut="${m.id}" ${this.mutChosen ? 'disabled' : ''}><span>${esc(m.name)}<small>${esc(m.desc)}${p.mutations.length >= 3 ? ' Replaces ' + esc(MUTATIONS.find(x => x.id === p.mutations[0]).name) + '.' : ''}</small></span></button>`);
    if (this.mutChosen) rows.push(`<p class="lede" style="margin:0">Mutation taken: ${esc(this.mutChosen)}.</p>`);
    rows.push(`</div></div>`);
    rows.push(`<button class="btn" type="button" id="btn-descend" data-autofocus style="margin-top:calc(var(--u)*6)"><span>Descend to ${esc(next.name)}<small>${esc(next.sub)}</small></span></button>`);
    $('keeper-panel').innerHTML = rows.join('');
    $('keeper-panel').querySelectorAll('[data-inv]').forEach(b => b.onclick = () => this.invest(b.dataset.inv));
    $('keeper-panel').querySelectorAll('[data-skin]').forEach(b => b.onclick = () => {
      const s = skinById(b.dataset.skin); if (p.cells < s.unlock.cost) { SND.play('deny'); return; }
      p.cells -= s.unlock.cost; G.run.cellsSpent += s.unlock.cost; d.skins.push(s.id); Save.write(); SND.play('buy'); Ach.checkMeta();
      this.toast(s.name + ' unlocked. Equip it from the Wardrobe on the title screen.', 3); this.renderKeeper();
    });
    this.bindPreviews($('keeper-panel'));
    $('keeper-panel').querySelectorAll('[data-mut]').forEach(b => b.onclick = () => {
      const m = MUTATIONS.find(x => x.id === b.dataset.mut);
      if (p.mutations.length >= 3) p.mutations.shift();
      p.mutations.push(m.id); this.mutChosen = m.name; SND.play('scroll'); this.renderKeeper();
    });
    $('btn-descend').onclick = () => { SND.play('door'); G.nextBiome(); };
    $('btn-descend').focus({ preventScroll: true });
  },
  invest(id) {
    const p = G.player, d = Save.d;
    let cost = 0;
    if (id === 'flask') { cost = [30, 70, 140][d.flaskLv]; if (p.cells < cost) return; d.flaskLv++; p.flaskMax++; p.flask = p.flaskMax; }
    else if (id === 'purse') { cost = [25, 60, 120][d.purseLv]; if (p.cells < cost) return; d.purseLv++; }
    else if (id === 'skill') { cost = 40; if (p.cells < cost) return; d.startSkill = true; }
    else if (id.startsWith('bp:')) { const k = id.slice(3); cost = ITEMS[k].cost; if (p.cells < cost) return; d.blueprints = d.blueprints.filter(x => x !== k); d.unlocked.push(k); }
    p.cells -= cost; G.run.cellsSpent += cost; Save.write(); SND.play('buy'); Ach.checkMeta(); this.renderKeeper();
  },
  showEnd(win) {
    const r = G.run, p = G.player;
    G.state = 'end'; $('hud').hidden = true;
    const title = win ? 'The last key is yours' : 'Your wick guttered out';
    const lede = win ? `The Warden falls and the crypt gate groans open. ${r.ember < 3 ? 'A hotter Ember awaits on the title screen.' : 'You have mastered every Ember.'}` : `Slain in ${BIOMES[r.biome].name}. The Keeper strikes a new match.`;
    $('end-panel').innerHTML = `<h2>${title}</h2><p class="lede">${lede}</p>
      <div class="stats-grid">
        <div><b>${fmtTime(r.time)}</b><span>Run time</span></div>
        <div><b>${r.kills}</b><span>Enemies slain</span></div>
        <div><b>${r.cellsTotal}</b><span>Cells gathered</span></div>
        <div><b>${win ? 0 : p.cells}</b><span>Cells lost</span></div>
        <div><b>${r.parries}</b><span>Parries</span></div>
        <div><b>${Math.round(r.dmgTaken)}</b><span>Damage taken</span></div>
      </div>
      <button class="btn" type="button" id="btn-again">Relight the wick<span class="k">Enter</span></button>
      <button class="btn" type="button" id="btn-totitle">Return to title</button>`;
    $('btn-again').onclick = () => { SND.play('ui'); G.newRun(); };
    $('btn-totitle').onclick = () => { SND.play('ui'); this.showTitle(); };
    this.showScreen('screen-end');
  },
  toast(msg, dur = 2.4) { const t = $('toast'); t.textContent = msg; t.hidden = false; this.toastT = dur; },
  banner(t, s, dur = 3) { const b = $('banner'); b.querySelector('.t').textContent = t; b.querySelector('.s').textContent = s; b.hidden = false; this.bannerT = dur; b.style.opacity = 1; },
  tick(dt) {
    if (this.toastT > 0) { this.toastT -= dt; if (this.toastT <= 0) $('toast').hidden = true; }
    if (this.bannerT > 0) { this.bannerT -= dt; $('banner').style.opacity = clamp(this.bannerT / .8, 0, 1); if (this.bannerT <= 0) $('banner').hidden = true; }
  },
  set(id, prop, v) { const k = id + prop; if (this.last[k] === v) return; this.last[k] = v; const el = $(id); if (prop === 'text') el.textContent = v; else if (prop === 'hidden') el.hidden = v; else el.style[prop] = v; },
  updateHUD() {
    const p = G.player; if (!p) return;
    this.set('hp-fill', 'width', (clamp(p.hp / p.maxHp, 0, 1) * 100).toFixed(1) + '%');
    this.set('hp-rally', 'width', (clamp((p.hp + p.rally) / p.maxHp, 0, 1) * 100).toFixed(1) + '%');
    this.set('hp-text', 'text', Math.max(0, Math.ceil(p.hp)) + ' / ' + p.maxHp);
    this.set('st-b', 'text', p.stats.b); this.set('st-t', 'text', p.stats.t); this.set('st-s', 'text', p.stats.s);
    this.set('gold', 'text', p.gold); this.set('cells', 'text', p.cells);
    const full = p.surge >= 100, uname = ULTS[p.skin.ult].name;
    this.set('surge-fill', 'width', p.surge.toFixed(1) + '%');
    if (this.last.surgeFull !== full) { this.last.surgeFull = full; $('surge').classList.toggle('full', full); }
    const sc = FLAME_LIGHT[p.skin.flame]; if (this.last.sc !== sc) { this.last.sc = sc; $('surge').style.setProperty('--sc', sc); }
    this.set('surge-text', 'text', full ? uname + ' ready · ' + Input.label('ult') : uname);
    this.set('curse', 'hidden', p.curse <= 0); this.set('curse', 'text', 'CURSED ' + p.curse);
    const buffs = [];
    if (p.balStacks) buffs.push('Balance ×' + p.balStacks);
    if (p.ward) buffs.push('Ward ' + Math.ceil(p.ward.hp));
    if (p.phantomT > 0) buffs.push('Phantom ' + p.phantomT.toFixed(1) + 's');
    if (p.blades) buffs.push('Blades ' + p.blades.t.toFixed(0) + 's');
    if (p.tempo) buffs.push('Tempo ×' + p.tempo);
    if (p.has('secondwick')) buffs.push(p.wickUsed ? 'Second Wick spent' : 'Second Wick ready');
    this.set('buffs', 'text', buffs.join(' · '));
    this.set('biome-name', 'text', BIOMES[G.run.biome].name + ' · ' + fmtTime(G.run.time));
    const fl = $('flasks').children;
    for (let i = 0; i < 4; i++) {
      const im = fl[i]; const show = i < p.flaskMax;
      if (im.hidden !== !show) im.hidden = !show;
      if (!im.src) im.src = Art.iconURL('flask');
      const cls = i < p.flask ? '' : 'empty'; if (im.className !== cls) im.className = cls;
    }
    const keys = ['atk1', 'atk2', 'sk1', 'sk2'].map(a => Input.label(a));
    this.slotEls.forEach((el, i) => {
      const it = p.slots[i], img = el.children[1];
      const src = it ? Art.iconURL(it.id) : '';
      if (img.dataset.src !== src) { img.dataset.src = src; if (src) img.src = src; img.style.visibility = src ? 'visible' : 'hidden'; }
      const pip = el.children[0]; const pc = it ? STAT[it.def.stat].col : 'transparent'; if (pip.style.background !== pc) pip.style.background = pc;
      const max = (p.cdMax && p.cdMax[i]) || 1, cd = p.cds[i] > 0 ? clamp(p.cds[i] / max, 0, 1) : 0;
      el.children[2].style.height = (cd * 100) + '%';
      const kt = keys[i]; if (el.children[3].textContent !== kt) el.children[3].textContent = kt;
      const tt = it && it.tier > 1 ? '+' + (it.tier - 1) : ''; if (el.children[4].textContent !== tt) el.children[4].textContent = tt;
    });
  },
  drawMinimap() {
    const L = G.level; if (!L || !L.fog) return;
    const c = $('minimap'), x = c.getContext('2d'), p = G.player, S = 2;
    x.clearRect(0, 0, c.width, c.height);
    const ptx = (p.x + p.w / 2) / TS, pty = (p.y + p.h / 2) / TS;
    const ox = c.width / 2 - ptx * S, oy = c.height / 2 - pty * S;
    x.imageSmoothingEnabled = false;
    x.drawImage(L.fog, ox, oy, L.tw * S, L.th * S);
    this.drawMarkers(x, ox, oy, S);
    if (Math.floor(G.time * 4) % 2) { x.fillStyle = '#fff'; x.fillRect(Math.round(c.width / 2) - 1, Math.round(c.height / 2) - 2, 3, 4); }
  },
  drawMarkers(x, ox, oy, S) {
    const L = G.level;
    for (const o of G.objs) {
      if (o.dead) continue;
      const tx = Math.floor((o.x + o.w / 2) / TS), ty = Math.floor((o.y + o.h / 2) / TS);
      if (!L.seen[ty * L.tw + tx]) continue;
      let col = null;
      if (o instanceof ExitDoor && !o.entry) col = '#ff9a3c';
      else if (o instanceof Merchant) col = '#f2c14e';
      else if (o instanceof Chest && !o.open) col = o.cursed ? '#c07af0' : '#f2c14e';
      else if (o instanceof Pickup && o.kind === 'scroll') col = '#ecdcb4';
      else if (o instanceof Pickup && (o.kind === 'item' || o.kind === 'blueprint')) col = '#5aa0ff';
      if (col) { x.fillStyle = '#000'; x.fillRect(ox + tx * S - 2, oy + ty * S - 2, 5, 5); x.fillStyle = col; x.fillRect(ox + tx * S - 1, oy + ty * S - 1, 3, 3); }
    }
  },
  drawBigMap() {
    const L = G.level, c = $('bigmap-c'), S = 3;
    if (c.width !== L.tw * S) { c.width = L.tw * S; c.height = L.th * S; }
    const x = c.getContext('2d'); x.imageSmoothingEnabled = false; x.clearRect(0, 0, c.width, c.height);
    x.drawImage(L.fog, 0, 0, L.tw * S, L.th * S);
    this.drawMarkers(x, 0, 0, S);
    const p = G.player; x.fillStyle = '#fff'; x.fillRect(Math.round((p.x + p.w / 2) / TS * S) - 2, Math.round((p.y + p.h / 2) / TS * S) - 3, 4, 6);
  }
};
function fmtTime(t) { const m = Math.floor(t / 60), s = Math.floor(t % 60); return m + ':' + String(s).padStart(2, '0'); }
function shuffleCopy(a) { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; }
