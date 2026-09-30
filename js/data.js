'use strict';
// Stat colors: b = Brutality, t = Tactics, s = Survival
const STAT = {
  b: { name: 'Brutality', col: '#e5483c' },
  t: { name: 'Tactics', col: '#a960ea' },
  s: { name: 'Survival', col: '#4fc466' }
};

// combo step fields: w windup, a active, r recovery (seconds), dmg, reach, hh hitbox height, kb knockback, lunge, style
const ITEMS = {
  rusty: {
    name: 'Rusty Sword', kind: 'melee', stat: 'b', starter: true, icon: 'sword', blade: '#c9c4b8', len: 13,
    desc: 'A reliable three-hit combo. The last swing hits hardest.',
    combo: [
      { w: .07, a: .09, r: .15, dmg: 12, reach: 30, hh: 22, kb: 70, lunge: 70, style: 'slash', sfx: 'swing' },
      { w: .07, a: .09, r: .15, dmg: 12, reach: 30, hh: 22, kb: 70, lunge: 70, style: 'upslash', sfx: 'swing' },
      { w: .11, a: .11, r: .28, dmg: 22, reach: 34, hh: 26, kb: 170, lunge: 110, style: 'slash', sfx: 'heavy' }
    ]
  },
  balanced: {
    name: 'Balanced Blade', kind: 'melee', stat: 'b', icon: 'sword2', blade: '#e8eef5', len: 14, cost: 35, stacking: true,
    desc: 'Every consecutive hit adds +12% damage, up to 10 stacks. Stacks fade 1.5s after your last hit.',
    combo: [
      { w: .06, a: .08, r: .12, dmg: 10, reach: 30, hh: 22, kb: 50, lunge: 60, style: 'slash', sfx: 'swing' },
      { w: .06, a: .08, r: .12, dmg: 10, reach: 30, hh: 22, kb: 50, lunge: 60, style: 'upslash', sfx: 'swing' },
      { w: .08, a: .09, r: .22, dmg: 14, reach: 32, hh: 24, kb: 110, lunge: 80, style: 'thrust', sfx: 'stab' }
    ]
  },
  broad: {
    name: 'Headsman Broadsword', kind: 'melee', stat: 's', icon: 'broad', blade: '#b8bcc8', len: 20, cost: 45, crit: 'last',
    desc: 'Slow, wide, devastating. The final overhead blow always crits.',
    combo: [
      { w: .26, a: .13, r: .26, dmg: 32, reach: 42, hh: 34, kb: 150, lunge: 40, style: 'heavy', sfx: 'heavy' },
      { w: .24, a: .13, r: .26, dmg: 32, reach: 42, hh: 34, kb: 150, lunge: 40, style: 'upheavy', sfx: 'heavy' },
      { w: .36, a: .15, r: .45, dmg: 48, reach: 46, hh: 44, kb: 260, lunge: 30, style: 'overhead', sfx: 'heavy', shake: 5 }
    ]
  },
  daggers: {
    name: 'Twin Daggers', kind: 'melee', stat: 't', starter: true, icon: 'dagger', blade: '#d8e0e8', len: 8, crit: 'combo',
    desc: 'Lightning-fast stabs. The third and fourth hits of the combo crit.',
    combo: [
      { w: .04, a: .06, r: .09, dmg: 7, reach: 24, hh: 16, kb: 30, lunge: 60, style: 'stab', sfx: 'stab' },
      { w: .04, a: .06, r: .09, dmg: 7, reach: 24, hh: 16, kb: 30, lunge: 60, style: 'stab2', sfx: 'stab' },
      { w: .05, a: .06, r: .1, dmg: 8, reach: 26, hh: 18, kb: 40, lunge: 70, style: 'slash', sfx: 'swing' },
      { w: .05, a: .07, r: .2, dmg: 9, reach: 28, hh: 20, kb: 120, lunge: 90, style: 'upslash', sfx: 'swing' }
    ]
  },
  cutthroat: {
    name: 'Cutthroat Dagger', kind: 'melee', stat: 'b', icon: 'dagger2', blade: '#f0d27a', len: 9, cost: 30, crit: 'behind',
    desc: 'Crits when you strike an enemy from behind. Roll through them first.',
    combo: [
      { w: .05, a: .07, r: .1, dmg: 11, reach: 25, hh: 18, kb: 30, lunge: 60, style: 'stab', sfx: 'stab' },
      { w: .05, a: .07, r: .1, dmg: 11, reach: 25, hh: 18, kb: 30, lunge: 60, style: 'stab2', sfx: 'stab' },
      { w: .06, a: .08, r: .2, dmg: 15, reach: 27, hh: 20, kb: 90, lunge: 80, style: 'slash', sfx: 'swing' }
    ]
  },
  pike: {
    name: 'Heron Pike', kind: 'melee', stat: 't', icon: 'spear', blade: '#cfd6de', len: 26, cost: 35, crit: 'tip',
    desc: 'Long thrusts that keep foes at bay. Crits on enemies caught at the tip of its reach.',
    combo: [
      { w: .12, a: .1, r: .2, dmg: 16, reach: 56, hh: 12, kb: 90, lunge: 30, style: 'thrust', sfx: 'stab' },
      { w: .12, a: .1, r: .2, dmg: 16, reach: 56, hh: 12, kb: 90, lunge: 30, style: 'thrust', sfx: 'stab' },
      { w: .18, a: .12, r: .32, dmg: 24, reach: 62, hh: 14, kb: 200, lunge: 60, style: 'thrust', sfx: 'heavy' }
    ]
  },
  hammer: {
    name: 'Bell Hammer', kind: 'melee', stat: 's', icon: 'hammer', blade: '#8e8a82', len: 16, cost: 45, crit: 'disabled',
    desc: 'Crushing blows that stun. Crits against stunned, frozen or rooted enemies.',
    combo: [
      { w: .24, a: .12, r: .3, dmg: 26, reach: 36, hh: 30, kb: 130, lunge: 30, style: 'heavy', sfx: 'heavy', stun: .5 },
      { w: .32, a: .14, r: .44, dmg: 36, reach: 40, hh: 36, kb: 220, lunge: 20, style: 'overhead', sfx: 'heavy', stun: .9, shake: 6, shock: true }
    ]
  },
  bow: {
    name: "Beginner's Bow", kind: 'bow', stat: 't', starter: true, icon: 'bow', blade: '#9a6a3a',
    desc: 'A two-arrow volley. The second arrow flies harder.',
    combo: [
      { w: .17, a: .02, r: .16, dmg: 11, speed: 430 },
      { w: .14, a: .02, r: .3, dmg: 16, speed: 470 }
    ]
  },
  sparrow: {
    name: 'Sparrow Bow', kind: 'bow', stat: 't', icon: 'bow2', blade: '#6a8a5a', cost: 35,
    desc: 'Looses a quick stream of light arrows.',
    combo: [{ w: .05, a: .02, r: .07, dmg: 5, speed: 480, spread: .07 }]
  },
  frost: {
    name: 'Frost Blast', kind: 'frost', stat: 't', icon: 'frost', blade: '#8fdcff', cost: 40, cd: 4,
    desc: 'A cone of cold that freezes enemies for 2s. Frozen enemies take no action. 4s cooldown.',
    combo: [{ w: .16, a: .12, r: .3, dmg: 9, reach: 74 }]
  },
  whip: {
    name: 'Spark Whip', kind: 'spark', stat: 't', icon: 'spark', blade: '#9fd8ff', cost: 40,
    desc: 'Instantly arcs lightning into the nearest enemy ahead, then jumps to one more.',
    combo: [{ w: .04, a: .04, r: .16, dmg: 8, reach: 120 }]
  },
  buckler: {
    name: 'Oaken Buckler', kind: 'shield', stat: 's', starter: true, icon: 'shield', blade: '#8a5a32',
    desc: 'Hold to block 75% of damage. Block just before a hit lands to parry: no damage, the attacker is stunned and arrows fly back.'
  },
  fists: {
    name: 'Ember Fists', kind: 'melee', stat: 'b', icon: 'fists', blade: '#ff8a3a', len: 3, cost: 35,
    desc: 'A flurry of burning punches. Every fourth blow detonates in a small blast.',
    combo: [
      { w: .03, a: .05, r: .07, dmg: 6, reach: 20, hh: 16, kb: 30, lunge: 50, style: 'punch', sfx: 'stab' },
      { w: .03, a: .05, r: .07, dmg: 6, reach: 20, hh: 16, kb: 30, lunge: 50, style: 'punch', sfx: 'stab' },
      { w: .03, a: .05, r: .08, dmg: 7, reach: 20, hh: 16, kb: 30, lunge: 50, style: 'punch', sfx: 'stab' },
      { w: .1, a: .08, r: .22, dmg: 12, reach: 24, hh: 20, kb: 160, lunge: 80, style: 'punch', sfx: 'heavy', boom: true }
    ]
  },
  scythe: {
    name: 'Tallow Scythe', kind: 'melee', stat: 't', icon: 'scythe', blade: '#c9d0da', len: 17, cost: 45, crit: 'bleeding', bleedAlways: true,
    desc: 'Reaping spins that cut both sides and cause Bleeding. Crits on bleeding enemies.',
    combo: [
      { w: .14, a: .14, r: .22, dmg: 14, reach: 36, hh: 28, kb: 80, lunge: 30, style: 'spin', sfx: 'heavy' },
      { w: .12, a: .14, r: .3, dmg: 18, reach: 40, hh: 30, kb: 150, lunge: 40, style: 'spin', sfx: 'heavy' }
    ]
  },
  knives: {
    name: 'Throwing Knives', kind: 'bow', stat: 'b', starter: true, icon: 'knives', blade: '#d8e0e8', proj: 'knife', bleedAlways: true,
    desc: 'Throws a fan of three knives that cause Bleeding.',
    combo: [{ w: .08, a: .02, r: .24, dmg: 5, speed: 420, count: 3, spread: .13 }]
  },
  // ---- skills ----
  firenade: {
    name: 'Fire Grenade', kind: 'skill', stat: 'b', starter: true, icon: 'firenade', cd: 9, dmg: 22,
    desc: 'Explodes and leaves the ground burning for 4s.',
    use(p) { throwGrenade(p, 'fire', this.dmg); }
  },
  icenade: {
    name: 'Ice Grenade', kind: 'skill', stat: 't', icon: 'icenade', cd: 12, dmg: 8, cost: 35,
    desc: 'Freezes every enemy in a wide radius for 3s.',
    use(p) { throwGrenade(p, 'ice', this.dmg); }
  },
  keg: {
    name: 'Powder Keg', kind: 'skill', stat: 'b', icon: 'keg', cd: 16, dmg: 70, cost: 50,
    desc: 'Rolls a keg that detonates in a huge blast after 1s.',
    use(p) { throwGrenade(p, 'keg', this.dmg); }
  },
  trap: {
    name: 'Wolf Trap', kind: 'skill', stat: 't', starter: true, icon: 'trap', cd: 8, dmg: 12,
    desc: 'Snaps shut on the first enemy that steps on it, rooting it for 3s.',
    use(p) { G.objs.push(new WolfTrap(p.x + p.w / 2 + p.face * 14, p.y + p.h, p)); SND.play('ui'); }
  },
  turret: {
    name: 'Crossbow Turret', kind: 'skill', stat: 't', starter: true, icon: 'turret', cd: 14, dmg: 7,
    desc: 'Deploys a turret that fires bolts at nearby enemies for 12s.',
    use(p) { G.objs.push(new Turret(p.x + p.w / 2 + p.face * 12, p.y + p.h, p)); SND.play('door'); }
  },
  phaser: {
    name: 'Phaser', kind: 'skill', stat: 't', icon: 'phaser', cd: 6, dmg: 10, cost: 40,
    desc: 'Teleport behind the nearest enemy and stun it for 1.5s.',
    use(p) { return phaseStrike(p, this.dmg); }
  },
  hook: {
    name: 'Chain Hook', kind: 'skill', stat: 't', starter: true, icon: 'hook', cd: 7, dmg: 14,
    desc: 'Hurls a chain that drags the first enemy it hits to you and stuns it for 1.2s.',
    use(p) { return fireHook(p); }
  },
  nova: {
    name: 'Ember Nova', kind: 'skill', stat: 'b', starter: true, icon: 'nova', cd: 10, dmg: 26,
    desc: 'Erupts in a ring of fire around you, hurling enemies back and setting them ablaze.',
    use(p) { castNova(p); }
  },
  ward: {
    name: 'Tallow Ward', kind: 'skill', stat: 's', icon: 'ward', cd: 15, dmg: 0, cost: 40,
    desc: 'A wax shell absorbs damage worth 35% of your max health for 5s.',
    use(p) { castWard(p); }
  },
  blades: {
    name: 'Spectral Blades', kind: 'skill', stat: 'b', icon: 'blades', cd: 16, dmg: 9, cost: 45,
    desc: 'Three phantom blades orbit you for 8s, cutting anything they touch.',
    use(p) { p.blades = { t: 8, hit: new Map(), it: p.slotOf('blades') }; SND.play('teleport'); }
  },
  decoy: {
    name: 'Wax Effigy', kind: 'skill', stat: 't', icon: 'decoy', cd: 15, dmg: 30, cost: 40,
    desc: 'Leaves a wax double that draws enemy attacks for 7s, then bursts.',
    use(p) { spawnDecoy(p); }
  },
  storm: {
    name: 'Belfry Storm', kind: 'skill', stat: 't', icon: 'storm', cd: 12, dmg: 24, cost: 40,
    desc: 'Calls lightning down on up to four nearby enemies, stunning them briefly.',
    use(p) { return callStorm(p); }
  }
};

const AFFIXES = [
  { id: 'bleed', txt: 'Hits cause Bleeding', kinds: ['melee', 'bow'] },
  { id: 'burn', txt: 'Hits set enemies ablaze', kinds: ['melee', 'bow', 'spark'] },
  { id: 'dmg', txt: '+20% damage', kinds: ['melee', 'bow', 'frost', 'spark', 'skill'] },
  { id: 'critc', txt: '+15% critical chance', kinds: ['melee', 'bow', 'spark'] },
  { id: 'leech', txt: 'Crits heal 2% max health', kinds: ['melee', 'bow'] },
  { id: 'cdr', txt: '-25% cooldown', kinds: ['skill', 'frost'] }
];

const FOODS = [
  { name: 'Stale Bread', heal: .25 }, { name: 'Tallow Pear', heal: .35 }, { name: 'Roast Eel', heal: .5 }
];

const MUTATIONS = [
  { id: 'feast', name: 'Feast', desc: 'Kills heal 4% of your max health.' },
  { id: 'tempo', name: 'Tempo', desc: 'Kills grant +15% attack speed for 5s. Stacks 3 times.' },
  { id: 'bloodlust', name: 'Bloodlust', desc: 'Hits recover twice as much of the health you just lost.' },
  { id: 'farsight', name: 'Far Sight', desc: '+35% damage with bows, Frost Blast and Spark Whip.' },
  { id: 'tinker', name: 'Tinkerer', desc: 'Skill cooldowns are 30% shorter.' },
  { id: 'ironwax', name: 'Iron Wax', desc: 'Take 15% less damage from everything.' },
  { id: 'secondwick', name: 'Second Wick', desc: 'Once per biome, survive a lethal blow with 30% health.' },
  { id: 'bully', name: 'Opportunist', desc: '+40% damage against stunned, frozen or rooted enemies.' },
  { id: 'quickstep', name: 'Quickstep', desc: 'Rolls have no cooldown and travel 25% farther.' }
];

const BIOMES = [
  {
    name: 'The Tallow Cells', sub: 'Where the Keeper relights the dead', gw: 6, gh: 3, song: 0,
    enemies: ['rotling', 'rotling', 'archer', 'moth', 'hound', 'bloat'], per: [1, 3], scrolls: 2, branches: 5,
    back: .35, ambient: '#5b4d68', torch: '#ffb45a',
    pal: { rock: '#2e2636', rock2: '#3b3144', edge: '#6a5876', cap: '#e8d6ad', cap2: '#b89f76', deep: '#120e17', wall: '#221b29', wall2: '#2b2233', mortar: '#17121c', plank: '#6b4a32', sky1: '#140f1c', sky2: '#2a1d33', far: '#1e1627', mid: '#170f1d', glow: '#ff9a3c' },
    decor: ['candles', 'candles', 'chain', 'torch', 'banner', 'window', 'cage', 'bones']
  },
  {
    name: 'The Brine Aqueduct', sub: 'Old water remembers every drowning', gw: 7, gh: 3, song: 1,
    enemies: ['rotling', 'leaper', 'spitter', 'moth', 'shield', 'hound', 'bloat', 'hookman'], per: [2, 3], scrolls: 2, branches: 5,
    back: .55, ambient: '#40606a', torch: '#7fe6c8',
    pal: { rock: '#1c2c30', rock2: '#24393e', edge: '#4f7a78', cap: '#5fae7a', cap2: '#3c7a57', deep: '#081113', wall: '#142226', wall2: '#1a2b30', mortar: '#0d1719', plank: '#5a4a3a', sky1: '#07161a', sky2: '#14343a', far: '#0f2529', mid: '#0a1a1d', glow: '#7fe6c8' },
    decor: ['pipe', 'pipe', 'grate', 'torch', 'chain', 'moss', 'bones']
  },
  {
    name: 'The Belfry Ramparts', sub: 'The bells toll for the relit', gw: 7, gh: 4, song: 2,
    enemies: ['knight', 'bomber', 'caster', 'gargoyle', 'leaper', 'shield', 'archer', 'hookman', 'gargoyle'], per: [2, 3], scrolls: 3, branches: 6,
    back: .85, ambient: '#6a6890', torch: '#ff9a3c',
    pal: { rock: '#35303a', rock2: '#453e48', edge: '#8a8098', cap: '#d6dcf0', cap2: '#9aa2bc', deep: '#141119', wall: '#29232f', wall2: '#322b39', mortar: '#1b1720', plank: '#6a4a36', sky1: '#10102a', sky2: '#3a2a52', far: '#221c38', mid: '#161226', glow: '#ffcf7a' },
    decor: ['banner', 'torch', 'bell', 'window', 'chain', 'banner']
  },
  {
    name: "The Warden's Crypt", sub: 'He holds the last key', gw: 1, gh: 1, song: 3, boss: true,
    enemies: [], per: [0, 0], scrolls: 0, branches: 0, back: .2, ambient: '#5a3440', torch: '#ff5a3a',
    pal: { rock: '#2a1f25', rock2: '#36272f', edge: '#7a5a60', cap: '#d8cdb8', cap2: '#a89a86', deep: '#0e080b', wall: '#1f161b', wall2: '#281c22', mortar: '#140d11', plank: '#5a3a2a', sky1: '#12070b', sky2: '#3a1219', far: '#240d13', mid: '#16080c', glow: '#ff5a3a' },
    decor: ['torch', 'chain', 'bones']
  }
];

const ENEMIES = {
  rotling: { name: 'Rotling', hp: 44, dmg: 12, w: 12, h: 20, speed: 56, sight: 160, cells: .6, jumper: true, light: true },
  hound: { name: 'Wick Hound', hp: 32, dmg: 11, w: 16, h: 11, speed: 118, sight: 190, cells: .6, jumper: true, light: true },
  bloat: { name: 'Wax Bloat', hp: 22, dmg: 26, w: 14, h: 14, speed: 38, sight: 170, fly: true, cells: .5, light: true },
  hookman: { name: 'Chain Gaoler', hp: 72, dmg: 14, w: 14, h: 22, speed: 44, sight: 190, cells: 1.1 },
  gargoyle: { name: 'Belfry Gargoyle', hp: 64, dmg: 18, w: 16, h: 14, speed: 90, sight: 150, fly: true, cells: 1.2 },
  archer: { name: 'Hollow Archer', hp: 30, dmg: 10, w: 12, h: 20, speed: 46, sight: 240, cells: .7, jumper: true, light: true },
  moth: { name: 'Wax Moth', hp: 24, dmg: 9, w: 14, h: 10, speed: 74, sight: 170, fly: true, cells: .5, light: true },
  leaper: { name: 'Bilgehopper', hp: 55, dmg: 14, w: 16, h: 12, speed: 50, sight: 180, cells: .8, light: true },
  spitter: { name: 'Brine Spitter', hp: 42, dmg: 11, w: 16, h: 16, speed: 18, sight: 210, cells: .8 },
  shield: { name: 'Gaoler', hp: 80, dmg: 14, w: 14, h: 22, speed: 40, sight: 160, cells: 1 },
  knight: { name: 'Bell Knight', hp: 150, dmg: 22, w: 16, h: 28, speed: 36, sight: 170, cells: 1.5 },
  bomber: { name: 'Powder Imp', hp: 42, dmg: 18, w: 12, h: 16, speed: 52, sight: 220, cells: .9, jumper: true, light: true },
  caster: { name: 'Toll Wraith', hp: 50, dmg: 12, w: 12, h: 22, speed: 0, sight: 230, fly: true, cells: 1.2, light: true },
  warden: { name: 'The Warden', hp: 2200, dmg: 24, w: 30, h: 44, speed: 72, sight: 999, cells: 40 }
};

function itemPool(kind) {
  const unl = new Set(Save.d.unlocked);
  return Object.keys(ITEMS).filter(id => (ITEMS[id].starter || unl.has(id)) && (!kind || (kind === 'skill') === (ITEMS[id].kind === 'skill')));
}
function makeItem(id, tier) {
  const def = ITEMS[id];
  const it = { id, def, tier: Math.max(1, tier), affix: null };
  if (Math.random() < 0.3 + 0.12 * tier) {
    const opts = AFFIXES.filter(a => a.kinds.includes(def.kind));
    if (opts.length) it.affix = pick(opts).id;
  }
  return it;
}
function randomItem(tier, kind) { return makeItem(pick(itemPool(kind)), tier); }
function itemName(it) { return it.def.name + (it.tier > 1 ? ' +' + (it.tier - 1) : ''); }
function affixText(id) { const a = AFFIXES.find(x => x.id === id); return a ? a.txt : ''; }
function tierMult(it) { return 1 + 0.28 * (it.tier - 1); }
