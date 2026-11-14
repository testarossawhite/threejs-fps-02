// Weapons: three guns with different jobs, one view model each, and the numbers that
// make stopping to aim pay — spread grows with speed, recoil kicks the view, and a
// magazine that runs dry mid-fight. game.js owns the ray; this owns the gun.
import * as THREE from 'three';
import { PALETTE } from './palette.js';

export const WEAPONS = {
  pistol: {
    name: 'P-9 Sidearm', short: 'P-9', mag: 12, reserve: 36, gap: 0.22, reload: 1.1,
    damage: 34, headDamage: 68, auto: false, spreadStill: 0.003, spreadMove: 0.02, kick: 0.008,
  },
  smg: {
    name: 'Dusk-9 SMG', short: 'Dusk-9', mag: 32, reserve: 96, gap: 0.075, reload: 1.6,
    damage: 26, headDamage: 60, auto: true, spreadStill: 0.006, spreadMove: 0.034, kick: 0.006,
  },
  rifle: {
    name: 'VK-7 Carbine', short: 'VK-7', mag: 30, reserve: 90, gap: 0.096, reload: 1.9,
    damage: 34, headDamage: 100, auto: true, spreadStill: 0.0022, spreadMove: 0.028, kick: 0.01,
  },
};

const MUZZLE_TIME = 0.06;

function buildViewModel(def, accent) {
  const grip = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.hairline), roughness: 0.7, metalness: 0.2 });
  const body = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.ink), roughness: 0.5, metalness: 0.35 });
  const trim = new THREE.MeshStandardMaterial({ color: new THREE.Color(accent), roughness: 0.45, metalness: 0.2 });
  const model = new THREE.Group();
  const isPistol = def.short === 'P-9';
  const isSmg = def.short === 'Dusk-9';
  const receiver = new THREE.Mesh(new THREE.BoxGeometry(isPistol ? 0.06 : 0.09, isPistol ? 0.09 : 0.1, isPistol ? 0.24 : 0.42), body);
  model.add(receiver);
  const barrel = new THREE.Mesh(
    new THREE.BoxGeometry(0.04, 0.04, isPistol ? 0.16 : isSmg ? 0.3 : 0.4), grip,
  );
  barrel.position.set(0, 0.02, isPistol ? -0.18 : -0.34);
  model.add(barrel);
  if (!isPistol) {
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.08, 0.22), grip);
    stock.position.set(0, -0.02, 0.3);
    model.add(stock);
    const sight = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.05, 0.1), trim);
    sight.position.set(0, 0.075, -0.05);
    model.add(sight);
  }
  if (isSmg) {
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.16, 0.07), trim);
    mag.position.set(0, -0.12, -0.02);
    model.add(mag);
  }
  model.position.set(0.24, -0.2, -0.42);
  return model;
}

export function createWeapons(camera) {
  const models = {};
  const flash = new THREE.Mesh(
    new THREE.PlaneGeometry(0.15, 0.15),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.accent), transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide }),
  );
  flash.position.set(0.24, -0.17, -1.05);
  flash.visible = false;
  camera.add(flash);
  const flashLight = new THREE.PointLight(new THREE.Color(PALETTE.accent), 0, 5);
  flashLight.position.set(0.24, -0.16, -0.6);
  camera.add(flashLight);

  for (const key of Object.keys(WEAPONS)) {
    const model = buildViewModel(WEAPONS[key], key === 'rifle' ? PALETTE.accent : PALETTE.steel);
    model.visible = false;
    camera.add(model);
    models[key] = model;
  }

  const state = {
    current: 'pistol',
    mag: WEAPONS.pistol.mag,
    reserve: WEAPONS.pistol.reserve,
    cooldown: 0,
    reloadLeft: 0,
    flash: 0,
    kick: 0,
    // Grenade counts the player carries this round.
    frags: 0,
    smokes: 0,
    selectedGrenade: 'frag',
  };

  function def() {
    return WEAPONS[state.current];
  }

  function select(name) {
    if (!WEAPONS[name] || name === state.current) return;
    state.current = name;
    state.mag = WEAPONS[name].mag;
    state.reserve = WEAPONS[name].reserve;
    state.cooldown = 0;
    state.reloadLeft = 0;
    for (const key of Object.keys(models)) models[key].visible = key === name;
  }

  function step(dt) {
    state.cooldown = Math.max(0, state.cooldown - dt);
    state.flash = Math.max(0, state.flash - dt);
    state.kick += (0 - state.kick) * Math.min(1, dt * 14);
    const model = models[state.current];
    model.position.z = -0.42 + state.kick;
    model.rotation.x = state.kick * 2.2;
    flash.visible = state.flash > 0;
    flash.rotation.z = state.flash * 30;
    flashLight.intensity = state.flash > 0 ? 18 : 0;
    if (state.reloadLeft > 0) {
      state.reloadLeft = Math.max(0, state.reloadLeft - dt);
      model.rotation.x = -0.55 * Math.min(1, (def().reload - state.reloadLeft) * 2);
      if (state.reloadLeft === 0) {
        const need = def().mag - state.mag;
        const take = Math.min(need, state.reserve);
        state.mag += take;
        state.reserve -= take;
      }
    }
  }

  select('pistol');

  return {
    state,
    def,
    step,
    select,
    ready() {
      return state.mag > 0 && state.cooldown === 0 && state.reloadLeft === 0;
    },
    pullTrigger() {
      state.cooldown = def().gap;
      state.flash = MUZZLE_TIME;
      state.kick = 0.055;
    },
    takeRound() {
      if (state.mag <= 0) return false;
      state.mag -= 1;
      return true;
    },
    reload() {
      if (state.reloadLeft > 0 || state.mag === def().mag || state.reserve === 0) return;
      state.reloadLeft = def().reload;
    },
    spread(speed) {
      const d = def();
      return d.spreadStill + Math.min(1, speed / 5.2) * d.spreadMove;
    },
    // Full refill from the loadout at round start.
    equip(loadout) {
      select(loadout.primary);
      state.mag = def().mag;
      state.reserve = def().reserve;
      state.cooldown = 0;
      state.reloadLeft = 0;
      state.flash = 0;
      state.kick = 0;
      state.frags = loadout.frags;
      state.smokes = loadout.smokes;
      state.selectedGrenade = state.frags > 0 ? 'frag' : 'smoke';
    },
  };
}
