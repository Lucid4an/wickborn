'use strict';
// Steam achievements. The API names below must match the ones created in Steamworks
// (App Admin > Stats & Achievements). See steam/achievements.json for the full list.
const ACHIEVEMENTS = [
  { id: 'ACH_FIRST_SNUFF', name: 'First Snuff', desc: 'Slay your first enemy.' },
  { id: 'ACH_AQUEDUCT', name: 'Down the Drain', desc: 'Reach the Brine Aqueduct.' },
  { id: 'ACH_RAMPARTS', name: 'For Whom It Tolls', desc: 'Reach the Belfry Ramparts.' },
  { id: 'ACH_CRYPT', name: 'Into the Crypt', desc: "Reach the Warden's Crypt." },
  { id: 'ACH_WARDEN', name: 'The Last Key', desc: 'Defeat the Warden.' },
  { id: 'ACH_EMBER_1', name: 'Burning Bright', desc: 'Defeat the Warden on Ember 1.' },
  { id: 'ACH_EMBER_2', name: 'White Hot', desc: 'Defeat the Warden on Ember 2.' },
  { id: 'ACH_EMBER_3', name: 'Inferno', desc: 'Defeat the Warden on Ember 3.' },
  { id: 'ACH_DRY_WICK', name: 'Dry Wick', desc: 'Defeat the Warden without drinking from a flask.' },
  { id: 'ACH_QUICK_BURN', name: 'Quick Burn', desc: 'Defeat the Warden in under 12 minutes.' },
  { id: 'ACH_STEADY_HAND', name: 'Steady Hand', desc: 'Parry 10 attacks in a single run.' },
  { id: 'ACH_UNCURSED', name: 'Uncursed', desc: 'Lift a curse by slaying 10 enemies.' },
  { id: 'ACH_ELITE_10', name: 'Elite Snuffer', desc: 'Slay 10 elite enemies.' },
  { id: 'ACH_REAPER', name: 'Tallow Reaper', desc: 'Slay 500 enemies in total.' },
  { id: 'ACH_SURGE_50', name: 'Overflowing Flame', desc: 'Unleash 50 ultimates.' },
  { id: 'ACH_WARDROBE', name: 'Full Wardrobe', desc: 'Unlock every character.' },
  { id: 'ACH_CHANDLER', name: 'Master Chandler', desc: 'Unlock every blueprint.' }
];

const Native = {
  api: window.wickbornNative || null, info: { steam: false, deck: false, fullscreen: false },
  init() { if (this.api) { try { this.info = this.api.info(); } catch (e) { } } }
};
Native.init();

const Ach = {
  has(id) { return Save.d.achievements.includes(id); },
  unlock(id) {
    if (this.has(id)) return;
    Save.d.achievements.push(id); Save.write();
    if (Native.api) Native.api.achieve(id);
    const a = ACHIEVEMENTS.find(x => x.id === id);
    if (!Native.info.steam && a && typeof UI !== 'undefined' && G.state !== 'title') UI.toast('Achievement unlocked: ' + a.name, 3);
  },
  // Re-send everything earned offline so Steam catches up the next time it is running.
  sync() { if (Native.api && Native.info.steam) for (const id of Save.d.achievements) Native.api.achieve(id); },
  checkMeta() {
    const d = Save.d, live = G.run && G.state !== 'title' ? G.run.kills : 0;
    if (d.kills + live >= 500) this.unlock('ACH_REAPER');
    if (d.ultsTotal >= 50) this.unlock('ACH_SURGE_50');
    if (d.elites >= 10) this.unlock('ACH_ELITE_10');
    if (SKINS.every(skinUnlocked)) this.unlock('ACH_WARDROBE');
    if (Object.keys(ITEMS).filter(k => ITEMS[k].cost).every(k => d.unlocked.includes(k))) this.unlock('ACH_CHANDLER');
  }
};
