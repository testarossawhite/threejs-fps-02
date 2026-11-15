// One soldier, built from composed primitives and shared by both teams: boots,
// legs, a uniform torso under a dark plate vest, shoulder pads, arms, a backpack,
// and a helmet with a glowing visor band over the skull. Reads as a person with a
// gun at ten metres, which a box never did. The caller owns the hit bookkeeping:
// torso and head (the skull) are the two hit meshes; everything else is dress.
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

// colors: { uniform, accent } — the team's identity; the kit (vest, helmet, gun)
// stays dark on both sides so the uniform and the visor carry the team read.
export function buildSoldier(colors) {
  const uniform = mat(colors.uniform, 0.72, 0.08);
  const dark = mat('#2e2a26', 0.85, 0.15);
  const gunmetal = mat('#3a3f45', 0.45, 0.6);
  const skin = mat('#c9a189', 0.65, 0.0);
  const visor = mat('#10151c', 0.22, 0.7, 0.9, colors.accent);
  const lightDot = mat(colors.accent, 0.4, 0.1, 1.6, colors.accent);

  const group = new THREE.Group();

  // Legs are groups pivoted at the hip (y 0.28 is the walk-bob anchor the bot
  // step writes): thigh, shin and a boot that points the way the soldier faces.
  function buildLeg(side) {
    const leg = new THREE.Group();
    leg.position.set(0.14 * side, 0.28, 0);
    const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.34, 0.22), dark);
    thigh.position.y = 0.1;
    const shin = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.3, 0.18), dark);
    shin.position.y = -0.17;
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.09, 0.31), gunmetal);
    boot.position.set(0, -0.26, -0.05);
    leg.add(thigh, shin, boot);
    return leg;
  }
  const legL = buildLeg(-1);
  const legR = buildLeg(1);

  const pelvis = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.2, 0.28), dark);
  pelvis.position.y = 0.64;

  // The hit torso: uniform, with the vest riding over its front and back.
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.72, 0.3), uniform);
  torso.position.y = 1.05;
  torso.userData.part = 'torso';
  const vest = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.48, 0.37), dark);
  vest.position.y = 1.04;
  const chestRig = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.2, 0.06), gunmetal);
  chestRig.position.set(0, 1.16, -0.21);
  const backpack = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.5, 0.17), dark);
  backpack.position.set(0, 1.1, 0.25);

  const padL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.13, 0.34), uniform);
  padL.position.set(-0.37, 1.34, 0);
  const padR = padL.clone();
  padR.position.x = 0.37;
  // A team light on the left shoulder: the dot your eye catches first at range.
  const dot = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.05, 0.07), lightDot);
  dot.position.set(-0.37, 1.43, 0);

  // Arms: the left hangs ready, the right reaches forward to the gun.
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.44, 0.15), uniform);
  armL.position.set(-0.38, 1.06, -0.06);
  armL.rotation.x = -0.45;
  const armR = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.44, 0.15), uniform);
  armR.position.set(0.36, 1.08, -0.14);
  armR.rotation.x = -0.95;

  // Head: the skull is the hit mesh; helmet dome and visor band dress it.
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.155, 14, 10), skin);
  head.position.y = 1.58;
  head.userData.part = 'head';
  const helmet = new THREE.Mesh(
    new THREE.SphereGeometry(0.178, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.58), dark,
  );
  helmet.position.y = 1.615;
  helmet.scale.y = 0.85;
  const visorBand = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.07, 0.06), visor);
  visorBand.position.set(0, 1.6, -0.135);

  // The gun, held at the right side: receiver, barrel, magazine, stock, sight.
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

  // Child order matters: the bot step bobs children 2 and 3 as the legs.
  group.add(torso, head, legL, legR, gun, pelvis, vest, chestRig, backpack, padL, padR, dot, armL, armR, helmet, visorBand);
  group.traverse((mesh) => {
    if (mesh.isMesh) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    }
  });
  return { group, torso, head, legL, legR };
}
