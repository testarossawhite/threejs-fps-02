// Weapons: three guns, one first-person rig each — textured receiver, attachments,
// and the gloved hands and camo sleeves that hold it, because a gun floating in
// the corner of the screen is the first thing that gives a prototype away. The rig
// breathes, bobs with speed, kicks when fired, and reloads in stages (dip, magazine
// out, magazine in, bolt rack). game.js owns the ray; this owns the gun.
import * as THREE from 'three';
import { PALETTE } from './palette.js';
import { gunMetalTexture, polymerTexture, camoTexture } from './textures.js';

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
const ss = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// Materials are built once and shared by the three rigs.
function rigMaterials(accent) {
  return {
    metal: new THREE.MeshStandardMaterial({ map: gunMetalTexture('DW ARMORY'), roughness: 0.38, metalness: 0.68 }),
    polymer: new THREE.MeshStandardMaterial({ map: polymerTexture(), roughness: 0.82, metalness: 0.08 }),
    camo: new THREE.MeshStandardMaterial({ map: camoTexture(), roughness: 0.72, metalness: 0.05 }),
    steel: new THREE.MeshStandardMaterial({ color: new THREE.Color('#7d848c'), roughness: 0.3, metalness: 0.75 }),
    trim: new THREE.MeshStandardMaterial({ color: new THREE.Color(accent), roughness: 0.45, metalness: 0.2 }),
    lens: new THREE.MeshStandardMaterial({
      color: new THREE.Color('#0e2a30'), roughness: 0.15, metalness: 0.4,
      emissive: new THREE.Color('#2b6f77'), emissiveIntensity: 0.7,
    }),
    dot: new THREE.MeshStandardMaterial({
      color: new THREE.Color('#200a06'), roughness: 0.3, metalness: 0.2,
      emissive: new THREE.Color('#ff2d1e'), emissiveIntensity: 1.6,
    }),
    glove: new THREE.MeshStandardMaterial({ color: new THREE.Color('#2a2521'), roughness: 0.95, metalness: 0 }),
    sleeve: new THREE.MeshStandardMaterial({ map: camoTexture(), roughness: 0.9, metalness: 0 }),
  };
}

// A gloved hand: palm, four curled fingers, a thumb, wrapped around its grip.
function buildGlove(m) {
  const hand = new THREE.Group();
  const palm = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.035, 0.095), m.glove);
  hand.add(palm);
  for (let i = 0; i < 4; i += 1) {
    const finger = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.055, 0.02), m.glove);
    finger.position.set(-0.027 + i * 0.018, -0.038, -0.028);
    finger.rotation.x = 0.5;
    hand.add(finger);
  }
  const thumb = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.045, 0.02), m.glove);
  thumb.position.set(0.045, -0.012, 0.012);
  thumb.rotation.z = -0.5;
  hand.add(thumb);
  return hand;
}

// A forearm from a hand back toward the frame's edge: camo sleeve, cuff, glove.
// yawSign picks which side of the frame it angles out of.
function buildArm(m, yawSign) {
  const arm = new THREE.Group();
  const fore = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.095, 0.4), m.sleeve);
  fore.position.set(0.03 * yawSign, -0.045, 0.21);
  fore.rotation.set(-0.42, 0.38 * yawSign, 0);
  const cuff = new THREE.Mesh(new THREE.BoxGeometry(0.115, 0.115, 0.09), m.polymer);
  cuff.position.set(0.008 * yawSign, -0.012, 0.075);
  cuff.rotation.set(-0.42, 0.38 * yawSign, 0);
  arm.add(fore, cuff, buildGlove(m));
  return arm;
}

// Each rig has its own silhouette and attachments: P-9 slide and suppressor,
// Dusk-9 ribbed shroud under a red-dot, VK-7 camo receiver, scope, folded bipod.
// Returns the moving parts step() animates: magazine, bolt/slide, support hand,
// and the anchors the support hand travels between (grip point, magazine well).
function buildViewModel(def, m) {
  const model = new THREE.Group();
  const part = (parent, w, h, d, material, x, y, z, rotX = 0) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    mesh.rotation.x = rotX;
    parent.add(mesh);
    return mesh;
  };
  const tube = (parent, r, len, material, x, y, z) => {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 12), material);
    mesh.rotation.x = Math.PI / 2;
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  };

  let muzzleZ = -0.21;
  let mag;
  let bolt;
  let gripL;
  let wellL;
  let magTravel = 0.13;
  if (def.short === 'P-9') {
    part(model, 0.055, 0.07, 0.22, m.polymer, 0, -0.01, -0.02);
    const slide = new THREE.Group();
    model.add(slide);
    part(slide, 0.06, 0.05, 0.26, m.metal, 0, 0.055, -0.04);
    part(slide, 0.062, 0.012, 0.18, m.trim, 0, 0.032, -0.04);
    for (let i = 0; i < 3; i += 1) part(slide, 0.064, 0.03, 0.008, m.polymer, 0, 0.055, 0.045 + i * 0.02);
    part(slide, 0.012, 0.03, 0.012, m.steel, 0, 0.095, -0.16);
    part(slide, 0.006, 0.008, 0.006, m.dot, 0, 0.1, -0.16);
    part(slide, 0.04, 0.025, 0.015, m.steel, 0, 0.09, 0.06);
    tube(model, 0.023, 0.13, m.polymer, 0, 0.05, -0.22);
    bolt = slide;
    part(model, 0.052, 0.17, 0.072, m.polymer, 0, -0.115, 0.05, 0.28);
    mag = part(model, 0.042, 0.11, 0.058, m.metal, 0, -0.19, 0.075, 0.28);
    magTravel = 0.1;
    gripL = new THREE.Vector3(-0.012, -0.125, 0.062);
    wellL = new THREE.Vector3(-0.01, -0.21, 0.07);
    muzzleZ = -0.3;
  } else if (def.short === 'Dusk-9') {
    part(model, 0.08, 0.1, 0.4, m.metal, 0, 0, -0.05);
    part(model, 0.07, 0.08, 0.24, m.polymer, 0, 0.01, -0.36);
    for (const z of [-0.28, -0.37, -0.46]) part(model, 0.086, 0.096, 0.03, m.metal, 0, 0.01, z);
    tube(model, 0.026, 0.12, m.polymer, 0, 0.02, -0.55);
    part(model, 0.02, 0.035, 0.02, m.metal, 0, 0.075, -0.1);
    tube(model, 0.021, 0.05, m.metal, 0, 0.1, -0.1);
    const dotLens = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.004, 12), m.dot);
    dotLens.rotation.x = Math.PI / 2;
    dotLens.position.set(0, 0.1, -0.126);
    model.add(dotLens);
    mag = new THREE.Group();
    model.add(mag);
    part(mag, 0.05, 0.14, 0.07, m.trim, 0, -0.11, -0.02);
    part(mag, 0.05, 0.13, 0.07, m.trim, 0, -0.21, 0.015, 0.35);
    part(model, 0.045, 0.11, 0.05, m.polymer, 0, -0.1, -0.3, -0.2);
    part(model, 0.05, 0.13, 0.06, m.polymer, 0, -0.105, 0.1, 0.3);
    part(model, 0.07, 0.08, 0.2, m.polymer, 0, -0.01, 0.24);
    bolt = part(model, 0.014, 0.02, 0.05, m.steel, 0.048, 0.03, -0.12);
    gripL = new THREE.Vector3(0, -0.115, -0.3);
    wellL = new THREE.Vector3(-0.01, -0.19, -0.01);
    muzzleZ = -0.62;
  } else {
    part(model, 0.085, 0.1, 0.44, m.camo, 0, 0, -0.04);
    part(model, 0.075, 0.085, 0.3, m.polymer, 0, 0, -0.36);
    for (const z of [-0.26, -0.36, -0.46]) part(model, 0.078, 0.02, 0.05, m.metal, 0, 0.045, z);
    part(model, 0.03, 0.02, 0.62, m.metal, 0, 0.065, -0.18);
    tube(model, 0.02, 0.22, m.steel, 0, 0.01, -0.6);
    tube(model, 0.032, 0.07, m.metal, 0, 0.01, -0.72);
    part(model, 0.02, 0.04, 0.02, m.metal, 0, 0.085, -0.02);
    part(model, 0.02, 0.04, 0.02, m.metal, 0, 0.085, -0.16);
    tube(model, 0.026, 0.2, m.metal, 0, 0.115, -0.09);
    tube(model, 0.024, 0.006, m.lens, 0, 0.115, -0.192);
    part(model, 0.04, 0.09, 0.05, m.polymer, 0, -0.1, -0.33, 0.5);
    for (const s of [-1, 1]) part(model, 0.008, 0.11, 0.02, m.steel, 0.02 * s, -0.09, -0.44, 0.9);
    mag = new THREE.Group();
    model.add(mag);
    part(mag, 0.05, 0.15, 0.08, m.polymer, 0, -0.12, 0, 0.3);
    part(model, 0.05, 0.13, 0.06, m.polymer, 0, -0.1, 0.12, 0.3);
    bolt = part(model, 0.014, 0.02, 0.05, m.steel, 0.05, 0.03, -0.04);
    part(model, 0.07, 0.09, 0.22, m.polymer, 0, -0.015, 0.26);
    part(model, 0.06, 0.04, 0.14, m.polymer, 0, 0.05, 0.26);
    gripL = new THREE.Vector3(0, -0.115, -0.33);
    wellL = new THREE.Vector3(-0.01, -0.19, 0.01);
    muzzleZ = -0.76;
  }

  // The right hand stays on the grip; the left works the front — and the magazine.
  const handR = buildArm(m, 1);
  handR.position.set(0.005, -0.1, def.short === 'P-9' ? 0.055 : 0.105);
  if (def.short !== 'P-9') handR.rotation.x = 0.28;
  model.add(handR);
  const handL = buildArm(m, -1);
  handL.position.copy(gripL);
  model.add(handL);

  model.position.set(0.24, -0.165, -0.42);
  return {
    model, muzzleZ: muzzleZ - 0.42, mag, bolt, handL, gripL, wellL, magTravel,
    magBaseY: mag.position.y, boltBaseZ: bolt.position.z,
  };
}

export function createWeapons(camera) {
  const materials = rigMaterials(PALETTE.accent);
  const built = {};
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
  const rigLight = new THREE.PointLight(new THREE.Color('#ffd9a8'), 0.85, 2.6, 1.6);
  rigLight.position.set(-0.25, 0.18, 0.15);
  camera.add(rigLight);

  const muzzles = {};
  for (const key of Object.keys(WEAPONS)) {
    built[key] = buildViewModel(WEAPONS[key], materials);
    built[key].model.visible = key === 'pistol';
    camera.add(built[key].model);
    muzzles[key] = built[key].muzzleZ;
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
  flash.position.set(0.24, -0.17, muzzles.pistol - 0.02);
  flash.scale.setScalar(0.8);
  flashLight.position.set(0.24, -0.16, muzzles.pistol + 0.3);
  let time = 0;
  let bobPhase = 0;
  let smoothSpeed = 0;

  function def() {
    return WEAPONS[state.current];
  }

  function rig() {
    return built[state.current];
  }

  function select(name) {
    if (!WEAPONS[name] || name === state.current) return;
    state.current = name;
    state.mag = WEAPONS[name].mag;
    state.reserve = WEAPONS[name].reserve;
    state.cooldown = 0;
    state.reloadLeft = 0;
    for (const key of Object.keys(built)) {
      built[key].model.visible = key === name;
      built[key].mag.position.y = built[key].magBaseY;
      built[key].bolt.position.z = built[key].boltBaseZ;
      built[key].handL.position.copy(built[key].gripL);
    }
    // The flash and its light sit on this gun's muzzle, not at a fixed depth.
    flash.position.set(0.24, -0.17, muzzles[name] - 0.02);
    flash.scale.setScalar(name === 'rifle' ? 1.3 : name === 'smg' ? 1.05 : 0.8);
    flashLight.position.set(0.24, -0.16, muzzles[name] + 0.3);
  }

  function step(dt, speed = 0) {
    time += dt;
    smoothSpeed += (speed - smoothSpeed) * Math.min(1, dt * 8);
    const moveAmt = Math.min(1, smoothSpeed / 5.2);
    bobPhase += dt * (1.5 + smoothSpeed * 1.5);
    state.cooldown = Math.max(0, state.cooldown - dt);
    state.flash = Math.max(0, state.flash - dt);
    state.kick += (0 - state.kick) * Math.min(1, dt * 14);
    const r = rig();
    const model = r.model;
    // Idle breathing plus a walk bob that grows with speed; kick rides on top.
    const swayX = Math.sin(bobPhase) * 0.007 * moveAmt + Math.sin(time * 1.7) * 0.0016;
    const swayY = -Math.abs(Math.cos(bobPhase)) * 0.008 * moveAmt + Math.sin(time * 2.3) * 0.0013;
    model.position.set(0.24 + swayX, -0.165 + swayY, -0.42 + state.kick);
    flash.visible = state.flash > 0;
    flash.rotation.z = state.flash * 30;
    flashLight.intensity = state.flash > 0 ? 18 : 0;
    let dip = 0;
    let magOut = 0;
    let rack = 0;
    if (state.reloadLeft > 0) {
      state.reloadLeft = Math.max(0, state.reloadLeft - dt);
      const p = 1 - state.reloadLeft / def().reload;
      dip = -0.55 * Math.pow(Math.sin(Math.PI * Math.min(1, p * 1.08)), 1.2);
      magOut = ss(0.12, 0.3, p) * (1 - ss(0.55, 0.78, p));
      rack = ss(0.8, 0.87, p) * (1 - ss(0.9, 0.99, p));
      if (state.reloadLeft === 0) {
        const need = def().mag - state.mag;
        const take = Math.min(need, state.reserve);
        state.mag += take;
        state.reserve -= take;
      }
    }
    r.mag.position.y = r.magBaseY - r.magTravel * magOut;
    r.bolt.position.z = r.boltBaseZ + rack * 0.04 + state.kick * 0.3;
    r.handL.position.lerpVectors(r.gripL, r.wellL, magOut);
    model.rotation.set(state.kick * 2.2 + dip, 0, swayX * 0.7 + state.kick * 0.35);
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
