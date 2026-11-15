// One soldier, shared by both teams, on articulated pivots (hips, knees, shoulders,
// elbows) so animateSoldier() can run a walk cycle, aim pose, hit flinch and death
// fall instead of sliding a statue. The hit meshes are unchanged — torso box and
// skull sphere; everything else is dress. Team identity reads from any side:
// uniform colour, glowing visor, lit backpack panel.
import * as THREE from 'three';

function mat(color, roughness, metalness, emissive = 0, emissiveColor = null) {
  const material = new THREE.MeshStandardMaterial({
    color: new THREE.Color(color), roughness, metalness,
  });
  if (emissive > 0 && emissiveColor) {
    material.emissive = new THREE.Color(emissiveColor);
    material.emissiveIntensity = emissive;
  }
  return material;
}

// colors: { uniform, accent }; the kit stays dark so uniform and lights carry it.
export function buildSoldier(colors) {
  const uniform = mat(colors.uniform, 0.78, 0.05);
  const dark = mat('#2c2824', 0.85, 0.15);
  const helmMat = mat(new THREE.Color(colors.uniform).multiplyScalar(0.55), 0.8, 0.05);
  const gunmetal = mat('#3d4249', 0.42, 0.62);
  const skin = mat('#d9b08c', 0.6, 0.0);
  const visor = mat('#10151c', 0.2, 0.7, 1.7, colors.accent);
  const lightDot = mat(colors.accent, 0.4, 0.1, 1.7, colors.accent);

  const group = new THREE.Group();

  // Legs: hip pivot at the pelvis, knee pivot halfway down.
  function buildLeg(side) {
    const hip = new THREE.Group();
    hip.position.set(0.13 * side, 0.62, 0);
    const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.32, 0.22), uniform);
    thigh.position.y = -0.15;
    const knee = new THREE.Group();
    knee.position.y = -0.31;
    const shin = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.27, 0.18), dark);
    shin.position.y = -0.12;
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.09, 0.31), gunmetal);
    boot.position.set(0, -0.27, -0.05);
    knee.add(shin, boot);
    hip.add(thigh, knee);
    return { hip, knee };
  }
  const legL = buildLeg(-1);
  const legR = buildLeg(1);

  const pelvis = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.2, 0.28), dark);
  pelvis.position.y = 0.64;

  // The hit torso, with the vest riding over its front and back.
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.72, 0.3), uniform);
  torso.position.y = 1.05;
  torso.userData.part = 'torso';
  const vest = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.48, 0.37), dark);
  vest.position.y = 1.04;
  const chestRig = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.2, 0.06), gunmetal);
  chestRig.position.set(0, 1.16, -0.21);
  // Three magazine pouches across the rig.
  for (let i = -1; i <= 1; i += 1) {
    const pouch = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.16, 0.05), dark);
    pouch.position.set(i * 0.12, 0.95, -0.215);
    group.add(pouch);
  }
  const backpack = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.5, 0.17), uniform);
  backpack.position.set(0, 1.1, 0.25);
  // A lit team strip on the pack: from behind, this is the jersey.
  const backStrip = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.07, 0.02), lightDot);

  backStrip.position.set(0, 1.24, 0.345);
  const packStrap = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.08, 0.19), dark);
  packStrap.position.set(0, 0.94, 0.25);

  const padL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.13, 0.34), uniform);
  padL.position.set(-0.37, 1.34, 0);
  const padR = padL.clone();
  padR.position.x = 0.37;
  const dot = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.05, 0.07), lightDot);
  dot.position.set(-0.37, 1.43, 0);

  // Arms on shoulder and elbow pivots, held in the aim pose by animateSoldier.
  function buildArm(side) {
    const shoulder = new THREE.Group();
    shoulder.position.set(0.37 * side, 1.32, 0);
    const upper = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.34, 0.16), uniform);
    upper.position.y = -0.15;
    const elbow = new THREE.Group();
    elbow.position.y = -0.32;
    const fore = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.3, 0.14), uniform);
    fore.position.y = -0.13;
    const glove = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.13, 0.12), dark);
    glove.position.y = -0.31;
    elbow.add(fore, glove);
    shoulder.add(upper, elbow);
    return { shoulder, elbow };
  }
  const armL = buildArm(-1);
  const armR = buildArm(1);

  // Head: the skull is the hit mesh; helmet and visor dress it.
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.1, 8), skin);
  neck.position.y = 1.45;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.155, 14, 10), skin);
  head.position.y = 1.58;
  head.userData.part = 'head';
  const helmet = new THREE.Mesh(
    new THREE.SphereGeometry(0.178, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.58), helmMat,
  );
  helmet.position.y = 1.615;
  helmet.scale.y = 0.85;
  const visorBand = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.075, 0.06), visor);
  visorBand.position.set(0, 1.6, -0.135);

  const gun = new THREE.Group();
  gun.position.set(0.2, 1.14, -0.28);
  const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.11, 0.5), gunmetal);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.32, 8), gunmetal);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.02, -0.4);
  const magazine = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.17, 0.08), dark);
  magazine.position.set(0, -0.13, -0.02);
  magazine.rotation.x = 0.25;
  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.09, 0.2), dark);
  stock.position.set(0, -0.01, 0.33);
  const sight = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.06, 0.09), gunmetal);
  sight.position.set(0, 0.09, -0.06);
  gun.add(receiver, barrel, magazine, stock, sight);

  group.add(
    torso, head, legL.hip, legR.hip, gun, pelvis, vest, chestRig, backpack,
    backStrip, packStrap, padL, padR, dot, armL.shoulder, armR.shoulder,
    helmet, visorBand, neck,
  );
  const mats = [];
  group.traverse((mesh) => {
    if (mesh.isMesh) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      if (!mats.includes(mesh.material)) mats.push(mesh.material);
    }
  });
  return {
    group, torso, head, gun, mats,
    legL, legR, armL, armR,
    moveBlend: 0,
    // Restore opacity for the next round (death fades the body out).
    resetVisual() {
      group.visible = true;
      for (const material of mats) {
        material.transparent = false;
        material.opacity = 1;
      }
    },
  };
}

// Pose one soldier for this step. phase is the walk-cycle clock; fall runs 0..1 as
// a corpse topples; fade runs 0..1 as the body is cleared (dropping it under the
// yard at the end so its hit meshes stop eating bullets). Owns group.position.y
// and group.rotation.x — callers set x, z and rotation.y only.
export function animateSoldier(soldier, o) {
  soldier.moveBlend += ((o.moving ? 1 : 0) - soldier.moveBlend) * Math.min(1, o.dt * 7);
  const blend = soldier.moveBlend;
  const swing = Math.sin(o.phase) * 0.52 * blend;
  soldier.legL.hip.rotation.x = swing;
  soldier.legR.hip.rotation.x = -swing;
  soldier.legL.knee.rotation.x = -Math.max(0, Math.sin(o.phase + 2.3)) * 0.85 * blend - 0.03;
  soldier.legR.knee.rotation.x = -Math.max(0, Math.sin(o.phase + Math.PI + 2.3)) * 0.85 * blend - 0.03;
  const bob = Math.abs(Math.sin(o.phase)) * 0.035 * blend;
  // Aim pose: right arm to the grip, left arm across to the receiver.
  const armBob = Math.sin(o.phase * 2) * 0.035 * blend;
  soldier.armR.shoulder.rotation.set(0.58 + armBob, 0, -0.3);
  soldier.armR.elbow.rotation.x = 0.82;
  soldier.armL.shoulder.rotation.set(0.88 + armBob, 0, 0.58);
  soldier.armL.elbow.rotation.x = 0.5;
  soldier.gun.position.y = 1.14 + Math.sin(o.phase * 2) * 0.012 * blend;
  soldier.group.rotation.x = -o.fall * 1.45 - o.flinch * 0.13;
  soldier.head.position.y = 1.58 - o.flinch * 0.035;
  soldier.group.position.y = bob - o.fall * 0.08 - (o.fade >= 1 ? 50 : 0);
  if (o.fade > 0) {
    for (const material of soldier.mats) {
      material.transparent = true;
      material.opacity = 1 - o.fade;
    }
    if (o.fade >= 1) soldier.group.visible = false;
  }
}
