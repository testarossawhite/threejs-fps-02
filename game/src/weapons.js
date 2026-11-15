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

// Each view model is a small composition with its own silhouette: the P-9 is all
// slide and grip, the Dusk-9 a ribbed shroud over a curved magazine, the VK-7 a
// long handguard under a proper scope. Shared gunmetal/polymer/trim materials;
// the muzzle z is returned so the flash can sit on the barrel's end, not near it.
function buildViewModel(def, accent) {
  const polymer = new THREE.MeshStandardMaterial({ color: new THREE.Color('#26221e'), roughness: 0.75, metalness: 0.15 });
  const body = new THREE.MeshStandardMaterial({ color: new THREE.Color('#5b636e'), roughness: 0.42, metalness: 0.55 });
  const steel = new THREE.MeshStandardMaterial({ color: new THREE.Color('#6a7076'), roughness: 0.35, metalness: 0.7 });
  const trim = new THREE.MeshStandardMaterial({ color: new THREE.Color(accent), roughness: 0.45, metalness: 0.2 });
  const lens = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#0e2a30'), roughness: 0.15, metalness: 0.4,
    emissive: new THREE.Color('#2b6f77'), emissiveIntensity: 0.7,
  });
  const model = new THREE.Group();
  const part = (w, h, d, material, x, y, z, rotX = 0) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    mesh.rotation.x = rotX;
    model.add(mesh);
    return mesh;
  };
  const tube = (r, len, material, x, y, z) => {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 10), material);
    mesh.rotation.x = Math.PI / 2;
    mesh.position.set(x, y, z);
    model.add(mesh);
    return mesh;
  };

  let muzzleZ = -0.21;
  if (def.short === 'P-9') {
    part(0.055, 0.07, 0.22, polymer, 0, -0.01, -0.02); // frame
    part(0.06, 0.05, 0.26, body, 0, 0.055, -0.04); // slide
    part(0.062, 0.012, 0.18, trim, 0, 0.03, -0.04); // slide stripe
    tube(0.016, 0.05, steel, 0, 0.05, -0.19); // barrel tip
    part(0.05, 0.16, 0.07, polymer, 0, -0.11, 0.05, 0.28); // grip
    part(0.012, 0.03, 0.012, steel, 0, 0.095, -0.16); // front post
    part(0.04, 0.025, 0.015, steel, 0, 0.09, 0.06); // rear sight
  } else if (def.short === 'Dusk-9') {
    part(0.08, 0.1, 0.4, body, 0, 0, -0.05); // receiver
    part(0.07, 0.08, 0.24, polymer, 0, 0.01, -0.36); // shroud
    for (const z of [-0.28, -0.37, -0.46]) part(0.086, 0.096, 0.03, body, 0, 0.01, z); // shroud ribs
    tube(0.018, 0.12, steel, 0, 0.02, -0.55); // barrel
    part(0.05, 0.14, 0.07, trim, 0, -0.11, -0.02); // magazine, upper
    part(0.05, 0.13, 0.07, trim, 0, -0.21, 0.015, 0.35); // magazine, curved toe
    part(0.045, 0.11, 0.05, polymer, 0, -0.1, -0.3, -0.2); // foregrip
    part(0.07, 0.08, 0.2, polymer, 0, -0.01, 0.24); // stock
    part(0.03, 0.05, 0.16, trim, 0, 0.08, -0.08); // carry sight
    muzzleZ = -0.61;
  } else {
    part(0.085, 0.1, 0.44, body, 0, 0, -0.04); // receiver
    part(0.075, 0.085, 0.3, polymer, 0, 0, -0.36); // handguard
    part(0.03, 0.02, 0.62, steel, 0, 0.065, -0.18); // top rail
    tube(0.02, 0.22, steel, 0, 0.01, -0.6); // barrel
    tube(0.032, 0.07, body, 0, 0.01, -0.72); // muzzle brake
    part(0.02, 0.04, 0.02, body, 0, 0.085, -0.02); // scope mounts
    part(0.02, 0.04, 0.02, body, 0, 0.085, -0.16);
    tube(0.026, 0.2, body, 0, 0.115, -0.09); // scope tube
    tube(0.024, 0.006, lens, 0, 0.115, -0.192); // scope lens
    part(0.05, 0.15, 0.08, polymer, 0, -0.12, 0, 0.3); // magazine
    part(0.05, 0.13, 0.06, polymer, 0, -0.1, 0.12, 0.3); // grip
    part(0.07, 0.09, 0.22, polymer, 0, -0.015, 0.26); // stock
    part(0.06, 0.04, 0.14, polymer, 0, 0.05, 0.26); // cheek rest
    muzzleZ = -0.76;
  }
  model.position.set(0.24, -0.2, -0.42);
  return { model, muzzleZ: muzzleZ - 0.42 };
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

  const muzzles = {};
  for (const key of Object.keys(WEAPONS)) {
    const built = buildViewModel(WEAPONS[key], key === 'rifle' ? PALETTE.accent : PALETTE.steel);
    built.model.visible = false;
    camera.add(built.model);
    models[key] = built.model;
    muzzles[key] = built.muzzleZ;
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
    // The flash and its light sit on this gun's muzzle, not at a fixed depth.
    flash.position.set(0.24, -0.17, muzzles[name] - 0.02);
    flash.scale.setScalar(name === 'rifle' ? 1.3 : name === 'smg' ? 1.05 : 0.8);
    flashLight.position.set(0.24, -0.16, muzzles[name] + 0.3);
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
