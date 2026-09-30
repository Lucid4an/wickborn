'use strict';
// ---- elite modifiers ----
const ELITE_MODS = [
  { id: 'hasted', name: 'Hasted', col: '#6ae0ff' },
  { id: 'armored', name: 'Armored', col: '#d0d4e0' },
  { id: 'vampiric', name: 'Vampiric', col: '#ff4a6a' },
  { id: 'volatile', name: 'Volatile', col: '#ff9a3c' },
  { id: 'warded', name: 'Warded', col: '#c07af0' }
];

// ---- ultimates (one per character) ----
const ULTS = {
  flare: { name: 'Flare', desc: 'Detonate your flame in a huge burning blast.' },
  frost: { name: 'Frost Tide', desc: 'Freeze every enemy nearby for 4s.' },
  toll: { name: 'Death Knell', desc: 'A bell toll stuns every enemy nearby for 2.5s.' },
  charge: { name: 'Iron Charge', desc: 'Barrel forward, invulnerable, trampling everything in your path.' },
  rain: { name: 'Gilded Rain', desc: 'Golden daggers fall on up to ten enemies and make them bleed.' },
  riptide: { name: 'Riptide', desc: 'Twin waves crash outward and hurl enemies away.' },
  phantom: { name: 'Phantom', desc: '6s of invulnerability with +30% speed and damage.' },
  miasma: { name: 'Miasma', desc: 'A plague cloud follows you for 6s, bleeding everything inside.' }
};

// ---- playable characters ----
const SKINS = [
  { id: 'wick', name: 'The Wickborn', ult: 'flare', head: 'candle', flame: 'normal', unlock: { t: 'free' }, desc: 'The prisoner the Keeper keeps relighting.',
    pal: { cloak: '#2e5560', cloakD: '#24434c', cloakL: '#3f7480', cape: '#1f3a42', capeD: '#17303a', scarf: '#b3353d', scarfD: '#8a2530', legs: '#2a2538', legsD: '#1f1b2b', boots: '#5a3a2a', belt: '#6b4a2a', buckle: '#d8b55a', head: '#eadcb6', headD: '#c8b68c', headL: '#f6ecd2', hand: '#eadcb6', trail: '#ff9a3c' } },
  { id: 'monk', name: 'Ashen Monk', ult: 'frost', head: 'hood', flame: 'blue', unlock: { t: 'reach', n: 1 }, desc: 'Took a vow of silence. The fire kept talking.',
    pal: { cloak: '#6a6670', cloakD: '#4e4a56', cloakL: '#8a8692', cape: '#3e3a46', capeD: '#2e2a36', scarf: '#3a6ab0', scarfD: '#2a4a80', legs: '#3a3640', legsD: '#2a2630', boots: '#4a3a30', belt: '#8a7a5a', buckle: '#c9d6ff', head: '#5a5662', headD: '#3e3a46', headL: '#7a7682', hand: '#d8cbb0', trail: '#5fd4ff' } },
  { id: 'ringer', name: 'Bell Ringer', ult: 'toll', head: 'skull', flame: 'green', unlock: { t: 'reach', n: 2 }, desc: 'Rang the belfry bells until only bone was left.',
    pal: { cloak: '#4a2a6a', cloakD: '#3a1f55', cloakL: '#6a4a8a', cape: '#2a1a3a', capeD: '#1f1230', scarf: '#c9a24a', scarfD: '#8a6a2a', legs: '#2a2233', legsD: '#1c1624', boots: '#3a2a22', belt: '#c9a24a', buckle: '#fff0a0', head: '#e0d6c0', headD: '#b0a48c', headL: '#f6f0e0', hand: '#e0d6c0', trail: '#7aff9a' } },
  { id: 'bane', name: "Warden's Bane", ult: 'charge', head: 'helm', flame: 'red', unlock: { t: 'win' }, desc: 'Wears the armour of the jailer it broke.',
    pal: { cloak: '#5a5e68', cloakD: '#40434c', cloakL: '#8a8e98', cape: '#6a1a1a', capeD: '#4a1010', scarf: '#8a1a1a', scarfD: '#5a1010', legs: '#3a3d45', legsD: '#2a2c33', boots: '#2a2a30', belt: '#3a2a22', buckle: '#ff8a3a', head: '#7a808c', headD: '#5a5e68', headL: '#aab0bb', hand: '#8a8e98', trail: '#ff4a3a' } },
  { id: 'king', name: 'Hollow King', ult: 'rain', head: 'crown', flame: 'gold', unlock: { t: 'ember', n: 2 }, desc: 'Ruled an empty kingdom of wax.',
    pal: { cloak: '#6a1a2a', cloakD: '#4a1020', cloakL: '#8a2a3a', cape: '#e8d6ad', capeD: '#b89f76', scarf: '#e8d6ad', scarfD: '#b89f76', legs: '#2a1a22', legsD: '#1a1016', boots: '#c9a24a', belt: '#c9a24a', buckle: '#fff0a0', head: '#d8c9e0', headD: '#a898b0', headL: '#f0e8f4', hand: '#d8c9e0', trail: '#ffd84a' } },
  { id: 'diver', name: 'Brine Diver', ult: 'riptide', head: 'diver', flame: 'blue', unlock: { t: 'cells', cost: 150 }, desc: 'Went down into the aqueduct and came back with a lantern for a face.',
    pal: { cloak: '#2a5a5a', cloakD: '#1a4040', cloakL: '#3a7a78', cape: '#1a3a3a', capeD: '#102a2a', scarf: '#d0703a', scarfD: '#a0502a', legs: '#1f3a3a', legsD: '#142a2a', boots: '#3a2a1a', belt: '#8a6a3a', buckle: '#c9a24a', head: '#b08a4a', headD: '#8a6a2a', headL: '#e0c07a', hand: '#b08a4a', trail: '#5fe0d0' } },
  { id: 'ghost', name: 'Pale Tallow', ult: 'phantom', head: 'ghost', flame: 'white', unlock: { t: 'kills', n: 300 }, desc: 'Burned so long it forgot to have a body.',
    pal: { cloak: '#d8dce8', cloakD: '#a8acb8', cloakL: '#f0f4ff', cape: '#b8bcc8', capeD: '#9094a0', scarf: '#8ad8c0', scarfD: '#5aa890', legs: '#a8acb8', legsD: '#8a8e9a', boots: '#7a7e8a', belt: '#8ad8c0', buckle: '#ffffff', head: '#f0f4ff', headD: '#c8ccd8', headL: '#ffffff', hand: '#f0f4ff', trail: '#c8f0ff' } },
  { id: 'doctor', name: 'Plague Chandler', ult: 'miasma', head: 'beak', flame: 'purple', unlock: { t: 'cells', cost: 200 }, desc: 'Treats the dead with smoke and wax.',
    pal: { cloak: '#2a2a2e', cloakD: '#1a1a1e', cloakL: '#4a4a50', cape: '#1a1a1e', capeD: '#101012', scarf: '#6a3a8a', scarfD: '#4a2a6a', legs: '#222226', legsD: '#18181a', boots: '#4a3a2a', belt: '#6a4a2a', buckle: '#b0ff6a', head: '#d8cdb8', headD: '#a89c86', headL: '#f0e8d8', hand: '#3a3a3e', trail: '#b06aff' } }
];
function skinById(id) { return SKINS.find(s => s.id === id) || SKINS[0]; }
function skinUnlocked(s) {
  const d = Save.d, u = s.unlock;
  if (u.t === 'free') return true;
  if (u.t === 'reach') return d.bestBiome >= u.n;
  if (u.t === 'win') return d.wins >= 1;
  if (u.t === 'ember') return d.emberMax >= u.n;
  if (u.t === 'kills') return d.kills >= u.n;
  if (u.t === 'cells') return d.skins.includes(s.id);
  return false;
}
function skinLockText(s) {
  const u = s.unlock;
  if (u.t === 'reach') return 'Reach ' + BIOMES[u.n].name;
  if (u.t === 'win') return 'Defeat the Warden';
  if (u.t === 'ember') return 'Defeat the Warden on Ember 1';
  if (u.t === 'kills') return 'Slay ' + u.n + ' foes in total (' + Math.min(Save.d.kills, u.n) + ' so far)';
  if (u.t === 'cells') return 'Buy it from the Keeper for ' + u.cost + ' cells';
  return '';
}
