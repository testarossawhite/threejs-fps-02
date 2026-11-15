// Dustworks Yard: an original salvage yard at dusk, built from boxes and cylinders
// and skinned with textures.js. Two bomb sites — A "Foundry" (north-west, amber),
// B "Depot" (north-east, teal) — joined by three lanes past the silo. Every solid
// is a movement collider and a bullet stop; the skyline and sky are pure backdrop.
import * as THREE from 'three';
import { PALETTE } from './palette.js';
import {
  groundTexture, wallTexture, crateTexture, containerTexture, barrelTexture,
  concreteTexture, hazardTexture, skyTexture, cloudTexture, glowTexture,
  decalTexture, posterTexture,
} from './textures.js';

const WALL_H = 4.6;
const HALF_X = 20;
const HALF_Z = 18;

// Waypoint graph the bots walk: [x, z, [links...]].
const WAYPOINTS = [
  [0, 15, [1, 2, 3]],
  [0, 10, [0, 2, 3, 6]],
  [-8, 10, [0, 1, 4, 7]],
  [8, 10, [0, 1, 5, 8]],
  [-8, 2, [2, 6, 7, 9]],
  [8, 2, [3, 6, 8, 10]],
  [0, 2, [1, 4, 5, 11]],
  [-14, 2, [2, 4, 9]],
  [14, 2, [3, 5, 10]],
  [-14, -6, [7, 4, 12, 16]],
  [14, -6, [8, 5, 14, 17]],
  [0, -6, [6, 13, 15]],
  [-12, -12, [9, 13, 16]],
  [-6, -12, [11, 12, 15]],
  [12, -10, [10, 15, 17]],
  [6, -12, [11, 13, 14]],
  [-14, -14, [9, 12]],
  [14, -14, [10, 14]],
];

function makeSign(text, sub, color) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#1d150e';
  ctx.fillRect(0, 0, 512, 128);
  ctx.strokeStyle = color;
  ctx.lineWidth = 5;
  ctx.strokeRect(6, 6, 500, 116);
  ctx.fillStyle = color;
  ctx.fillRect(6, 6, 500, 12);
  ctx.fillStyle = '#f4ead2';
  ctx.font = 'bold 52px system-ui, sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 26, 60);
  ctx.fillStyle = '#b3a189';
  ctx.font = '28px system-ui, sans-serif';
  ctx.fillText(sub, 26, 103);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function standard(map, color, roughness, metalness) {
  return new THREE.MeshStandardMaterial({
    map, color: new THREE.Color(color), roughness, metalness,
  });
}

export function createWorld(scene) {
  const group = new THREE.Group();
  scene.add(group);
  const materials = {};
  for (const name of Object.keys(PALETTE)) {
    materials[name] = new THREE.MeshStandardMaterial({
      color: new THREE.Color(PALETTE[name]),
      roughness: name === 'accent' || name === 'ink' ? 0.55 : 0.92,
      metalness: name === 'steel' ? 0.55 : 0.03,
    });
  }
  const groundMat = standard(groundTexture(), '#dec39a', 0.96, 0.0);
  const wallMat = standard(wallTexture(7), '#b59a76', 0.85, 0.12);
  const wallMatLong = standard(wallTexture(9), '#b59a76', 0.85, 0.12);
  const crateMat = standard(crateTexture(), '#c8a06a', 0.9, 0.0);
  const concreteMat = standard(concreteTexture(), '#bfae94', 0.94, 0.0);
  const containerSteel = standard(containerTexture(), '#7e8f99', 0.58, 0.38);
  const containerRust = standard(containerTexture(), '#a05f36', 0.68, 0.25);
  const siloMat = standard(containerTexture(), '#98a0a4', 0.5, 0.5);
  const barrelRed = standard(barrelTexture(), '#b0492f', 0.55, 0.3);
  const barrelSteel = standard(barrelTexture(), '#77828a', 0.5, 0.45);
  const barrelAmber = standard(barrelTexture(), '#c07f2a', 0.55, 0.3);
  const hazardMat = standard(hazardTexture(), '#e8e2d4', 0.8, 0.05);
  const glowA = new THREE.MeshStandardMaterial({
    color: new THREE.Color(PALETTE.accent), emissive: new THREE.Color(PALETTE.accent),
    emissiveIntensity: 1.8, roughness: 0.4,
  });
  const glowB = new THREE.MeshStandardMaterial({
    color: new THREE.Color(PALETTE.siteB), emissive: new THREE.Color(PALETTE.siteB),
    emissiveIntensity: 1.6, roughness: 0.4,
  });

  const colliders = [];
  const shootables = [];
  const raycaster = new THREE.Raycaster();
  raycaster.far = 90;

  function box(w, h, d, x, y, z, material, collide = true) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), materials[material] ?? material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    if (collide) {
      colliders.push(new THREE.Box3().setFromObject(mesh));
      shootables.push(mesh);
    }
    return mesh;
  }

  function cylinder(rTop, rBottom, h, x, y, z, material, segments = 18) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, h, segments), materials[material] ?? material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    colliders.push(new THREE.Box3().setFromObject(mesh));
    shootables.push(mesh);
    return mesh;
  }

  function flatMark(w, d, x, z, material, opacity = 0.85) {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(w, d),
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(PALETTE[material]), roughness: 0.9,
        transparent: true, opacity,
      }),
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, 0.02, z);
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  }

  // A glowing strip: site edging that reads across the yard.
  function glowStrip(w, h, d, x, y, z, material) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    group.add(mesh);
    return mesh;
  }

  // Sky: gradient dome, cloud billboards, a halo sprite where the sun just set.
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(135, 28, 14),
    new THREE.MeshBasicMaterial({ map: skyTexture(), side: THREE.BackSide, fog: false, depthWrite: false }),
  );
  sky.renderOrder = -10;
  scene.add(sky);
  const glowTex = glowTexture();
  const sunHalo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTex, color: new THREE.Color('#ffb45e'), transparent: true, opacity: 0.85,
    fog: false, depthWrite: false,
  }));
  sunHalo.position.set(-108, 17, 52);
  sunHalo.scale.set(85, 85, 1);
  scene.add(sunHalo);
  const cloudTex = cloudTexture();
  const cloudSpots = [
    [-70, 52, -60, 90], [40, 58, -80, 110], [85, 46, 30, 80], [-30, 62, 85, 95], [10, 50, -105, 75],
  ];
  for (const [x, y, z, s] of cloudSpots) {
    const cloud = new THREE.Sprite(new THREE.SpriteMaterial({
      map: cloudTex, transparent: true, opacity: 0.75, fog: false, depthWrite: false,
    }));
    cloud.position.set(x, y, z);
    cloud.scale.set(s, s * 0.42, 1);
    scene.add(cloud);
  }

  // Skyline silhouettes beyond the walls: flat dark shapes, no colliders.
  const silhouette = new THREE.MeshBasicMaterial({ color: new THREE.Color('#33231f') });
  const silhouetteFar = new THREE.MeshBasicMaterial({ color: new THREE.Color('#453026') });
  function silhouetteBox(w, h, d, x, y, z, far = false) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), far ? silhouetteFar : silhouette);
    mesh.position.set(x, y, z);
    scene.add(mesh);
    return mesh;
  }
  // Crane, north-west.
  silhouetteBox(1.4, 21, 1.4, -31, 10.5, -27);
  silhouetteBox(17, 1.1, 1.1, -25, 20.6, -27);
  silhouetteBox(5, 0.9, 0.9, -35.5, 20.6, -27);
  silhouetteBox(0.18, 6.5, 0.18, -19.5, 17, -27);
  silhouetteBox(1.6, 1.6, 1.6, -19.5, 13.4, -27);
  // Chimney stacks, north-east.
  for (const [x, h] of [[27, 17], [31.5, 21]]) {
    const stack = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.9, h, 12), silhouette);
    stack.position.set(x, h / 2, -26);
    scene.add(stack);
  }
  // Water tower, south-west.
  silhouetteBox(0.5, 9, 0.5, -29.5, 4.5, 15);
  silhouetteBox(0.5, 9, 0.5, -25.5, 4.5, 15);
  silhouetteBox(0.5, 9, 0.5, -27.5, 4.5, 12.6);
  silhouetteBox(0.5, 9, 0.5, -27.5, 4.5, 17.4);
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(3.1, 3.1, 4.4, 14), silhouette);
  tank.position.set(-27.5, 11.4, 15);
  scene.add(tank);
  const tankRoof = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 3.2, 1.8, 14), silhouette);
  tankRoof.position.set(-27.5, 14.5, 15);
  scene.add(tankRoof);
  // Container piles and a warehouse slab along the north and east.
  silhouetteBox(7, 2.6, 2.6, 29, 1.3, 6, true);
  silhouetteBox(7, 2.6, 2.6, 29, 3.9, 6.4, true);
  silhouetteBox(6, 2.6, 2.6, -6, 1.3, -29, true);
  silhouetteBox(30, 8.5, 2.5, 4, 4.25, -31.5, true);

  box(HALF_X * 2 + 0.8, 0.4, HALF_Z * 2 + 0.8, 0, -0.2, 0, groundMat);
  box(0.4, WALL_H, HALF_Z * 2 + 0.8, -HALF_X - 0.2, WALL_H / 2, 0, wallMat);
  box(0.4, WALL_H, HALF_Z * 2 + 0.8, HALF_X + 0.2, WALL_H / 2, 0, wallMat);
  box(HALF_X * 2 + 0.8, WALL_H, 0.4, 0, WALL_H / 2, -HALF_Z - 0.2, wallMatLong);
  box(HALF_X * 2 + 0.8, WALL_H, 0.4, 0, WALL_H / 2, HALF_Z + 0.2, wallMatLong);
  // A steel cap rail along the walls finishes the silhouette.
  box(0.55, 0.18, HALF_Z * 2 + 0.8, -HALF_X - 0.2, WALL_H + 0.09, 0, 'steel', false);
  box(0.55, 0.18, HALF_Z * 2 + 0.8, HALF_X + 0.2, WALL_H + 0.09, 0, 'steel', false);
  box(HALF_X * 2 + 0.8, 0.18, 0.55, 0, WALL_H + 0.09, -HALF_Z - 0.2, 'steel', false);
  box(HALF_X * 2 + 0.8, 0.18, 0.55, 0, WALL_H + 0.09, HALF_Z + 0.2, 'steel', false);

  // Site A — Foundry: raised concrete platform edged in amber, furnace, chimney.
  box(10, 0.5, 8, -12, 0.25, -12, concreteMat);
  glowStrip(10, 0.1, 0.22, -12, 0.52, -8.05, glowA);
  glowStrip(10, 0.1, 0.22, -12, 0.52, -15.95, glowA);
  glowStrip(0.22, 0.1, 8, -16.95, 0.52, -12, glowA);
  glowStrip(0.22, 0.1, 8, -7.05, 0.52, -12, glowA);
  box(3.2, 3.4, 2.4, -15.5, 1.7, -15.5, wallMat);
  const furnaceMouth = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.4), glowA);
  furnaceMouth.position.set(-13.9, 1.3, -15.5);
  furnaceMouth.rotation.y = Math.PI / 2;
  group.add(furnaceMouth);
  cylinder(0.5, 0.7, 5.4, -16.6, 2.7, -16.2, 'steel');
  box(1.4, 1.1, 1.4, -8.6, 0.55, -14.6, crateMat);
  box(1.4, 1.1, 1.4, -8.6, 0.55, -9.4, crateMat);
  flatMark(7, 6, -12, -12, 'accent', 0.32);
  const signA = new THREE.Mesh(
    new THREE.PlaneGeometry(5.2, 1.3),
    new THREE.MeshBasicMaterial({ map: makeSign('SITE A', 'FOUNDRY', '#f0a63e') }),
  );
  signA.position.set(-12, 3.4, -17.7);
  group.add(signA);

  // Site B — Depot (north-east): stacked containers, teal mark and edging.
  box(4.8, 2.4, 2.4, 13.5, 1.2, -13.5, containerSteel);
  box(4.8, 2.4, 2.4, 13.5, 3.6, -13.5, containerRust);
  box(2.4, 2.4, 4.8, 8.2, 1.2, -15.2, containerRust);
  box(1.4, 1.1, 1.4, 15.8, 0.55, -8.6, crateMat);
  box(1.4, 1.1, 1.4, 9.4, 0.55, -8.2, crateMat);
  flatMark(7, 6, 12, -11, 'siteB', 0.32);
  glowStrip(7, 0.08, 0.22, 12, 0.04, -7.6, glowB);
  glowStrip(0.22, 0.08, 6.8, 8.4, 0.04, -11, glowB);
  const signB = new THREE.Mesh(
    new THREE.PlaneGeometry(5.2, 1.3),
    new THREE.MeshBasicMaterial({ map: makeSign('SITE B', 'DEPOT', '#3fbfae') }),
  );
  signB.position.set(12, 3.4, -17.7);
  group.add(signB);

  const hazardA = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.06, 0.9), hazardMat);
  hazardA.position.set(-12, 0.03, -6.9);
  group.add(hazardA);
  const hazardB = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.06, 0.9), hazardMat);
  hazardB.position.set(12, 0.03, -6.9);
  group.add(hazardB);

  // Mid: the silo and its crate ring, the central sightline breaker.
  cylinder(2.2, 2.4, 7, 0, 3.5, -2, siloMat, 24);
  cylinder(0.4, 2.2, 1.6, 0, 7.8, -2, 'hairline', 24);
  const siloBandLow = new THREE.Mesh(new THREE.TorusGeometry(2.42, 0.07, 8, 28), materials.steel);
  siloBandLow.rotation.x = Math.PI / 2;
  siloBandLow.position.set(0, 1.4, -2);
  group.add(siloBandLow);
  const siloBandHigh = siloBandLow.clone();
  siloBandHigh.position.y = 5.6;
  group.add(siloBandHigh);
  const siloSkirt = new THREE.Mesh(
    new THREE.CylinderGeometry(2.44, 2.46, 0.5, 24, 1, true), hazardMat,
  );
  siloSkirt.position.set(0, 0.25, -2);
  group.add(siloSkirt);
  box(1.6, 1.1, 1.6, -4.2, 0.55, -2, crateMat);
  box(1.6, 1.1, 1.6, 4.2, 0.55, -2, crateMat);
  box(1.2, 2.2, 1.2, -3.2, 1.1, -6.4, wallMat);
  box(1.2, 2.2, 1.2, 3.4, 1.1, 2.2, wallMat);

  box(1.2, 1.1, 3.6, -14.5, 0.55, 4, concreteMat);
  box(1.2, 2.2, 1.2, -14.5, 1.1, -2, wallMat);
  box(3.2, 1.1, 1.2, -11, 0.55, 8, concreteMat);
  box(1.6, 1.1, 1.6, -17, 0.55, 10.5, crateMat);

  box(4.8, 2.4, 2.4, 15.5, 1.2, 4, containerSteel);
  box(2.4, 2.4, 2.4, 15.5, 3.6, 3.2, containerRust);
  cylinder(0.6, 0.6, 1.3, 11.5, 0.65, 8, barrelRed);
  cylinder(0.6, 0.6, 1.3, 12.8, 0.65, 8.6, barrelSteel);
  cylinder(0.6, 0.6, 1.3, 12.15, 0.65, 6.9, barrelAmber);
  box(1.6, 1.1, 1.6, 10, 0.55, -1, crateMat);

  box(2.4, 0.9, 1.2, -4, 0.45, 11.5, concreteMat);
  box(2.4, 0.9, 1.2, 4, 0.45, 11.5, concreteMat);
  const signYard = new THREE.Mesh(
    new THREE.PlaneGeometry(6.4, 1.6),
    new THREE.MeshBasicMaterial({ map: makeSign('DUSTWORKS YARD', 'EMBER vs RUST  •  FIRST TO 4 ROUNDS', '#f0a63e') }),
  );
  signYard.position.set(0, 3.2, 17.7);
  signYard.rotation.y = Math.PI;
  group.add(signYard);

  // Lamp posts: pole, glowing head, soft halo — one over each site and one at mid.
  function lampPost(x, z, glowMaterial, colorHex) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 4.4, 8), materials.steel);
    pole.position.set(x, 2.2, z);
    pole.castShadow = true;
    group.add(pole);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.14, 0.3), glowMaterial);
    head.position.set(x, 4.45, z);
    group.add(head);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex, color: new THREE.Color(colorHex), transparent: true, opacity: 0.5, depthWrite: false,
    }));
    halo.position.set(x, 4.45, z);
    halo.scale.set(3.4, 3.4, 1);
    group.add(halo);
  }
  lampPost(-8.6, -14.9, glowA, PALETTE.accent);
  lampPost(14.8, -7.9, glowB, PALETTE.siteB);
  lampPost(3.4, 5.4, glowA, PALETTE.accent);

  // Dressing: the layer that turns lanes into a workplace. Everything stands clear
  // of the waypoint lanes and spawns — clutter lives at the walls and corners.
  const tireMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#201d1a'), roughness: 0.96, metalness: 0 });
  const sandMat = standard(concreteTexture(), '#a8915f', 0.98, 0);
  const rockMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#4c4238'), roughness: 0.97, metalness: 0 });

  function tireStack(x, z, count) {
    cylinder(0.4, 0.4, count * 0.26, x, (count * 0.26) / 2, z, tireMat);
    for (let i = 0; i < count; i += 1) {
      const tire = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.13, 8, 18), tireMat);
      tire.rotation.x = Math.PI / 2;
      tire.position.set(x, 0.14 + i * 0.26, z);
      tire.castShadow = true;
      group.add(tire);
    }
  }
  tireStack(-18.3, 6, 4);
  tireStack(18.3, -3, 3);
  tireStack(3, -17.1, 3);

  // Cable spools at the walls, crate stacks in dead corners.
  cylinder(0.55, 0.55, 0.72, -18.2, 0.36, 12.6, crateMat);
  cylinder(0.55, 0.55, 0.72, -16.5, 0.36, 16.6, crateMat);
  box(1.6, 1.1, 1.6, -18.2, 0.55, -2, crateMat);
  box(1.6, 1.1, 1.6, -18.2, 1.65, -2.1, crateMat);
  box(1.6, 1.1, 1.6, 18.3, 0.55, 8, crateMat);
  box(1.4, 1.1, 1.4, 18.2, 0.55, 13.2, crateMat);
  box(1.4, 1.1, 1.4, 18.2, 1.65, 13.2, crateMat);
  cylinder(0.6, 0.6, 1.3, 5.8, 0.65, 5.4, barrelSteel);
  cylinder(0.6, 0.6, 1.3, 6.9, 0.65, 4.6, barrelRed);
  cylinder(0.6, 0.6, 1.3, -6.4, 0.65, -4.4, barrelAmber);

  // Sandbag arcs watching the site mouths: a concrete spine, two rows of bags.
  function sandbags(x, z, rotY) {
    const base = box(2.2, 0.34, 0.62, x, 0.17, z, concreteMat);
    base.rotation.y = rotY;
    for (let row = 0; row < 2; row += 1) {
      for (let i = 0; i < 5; i += 1) {
        const bag = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 6), sandMat);
        bag.scale.set(1.15, 0.5, 0.72);
        const along = -0.84 + i * 0.42 + (row % 2) * 0.2;
        bag.position.set(
          x + Math.cos(rotY) * along,
          0.4 + row * 0.17,
          z - Math.sin(rotY) * along,
        );
        bag.rotation.y = rotY;
        bag.castShadow = true;
        group.add(bag);
      }
    }
  }
  sandbags(-9.4, -8.6, 0.5);
  sandbags(9.8, -7.6, -0.5);

  // A gantry over the mid lane: posts, beam, hanging sign and lamp.
  box(0.26, 4.4, 0.26, -3.4, 2.2, 6.5, 'steel');
  box(0.26, 4.4, 0.26, 3.4, 2.2, 6.5, 'steel');
  box(7.4, 0.3, 0.34, 0, 4.42, 6.5, 'steel', false);
  const signMid = new THREE.Mesh(
    new THREE.PlaneGeometry(2.6, 0.65),
    new THREE.MeshBasicMaterial({ map: makeSign('MID', 'THE LANES', '#f0a63e') }),
  );
  signMid.position.set(0, 3.9, 6.28);
  group.add(signMid);
  glowStrip(0.5, 0.1, 0.24, 0, 4.22, 6.5, glowA);

  // Wall dressing, flat on the steel: pipe runs, vents, junction boxes, posters.
  function pipe(len, x, y, z, alongZ) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, len, 8), materials.steel);
    if (alongZ) mesh.rotation.x = Math.PI / 2;
    else mesh.rotation.z = Math.PI / 2;
    mesh.position.set(x, y, z);
    group.add(mesh);
  }
  pipe(30, 0, 3.35, -17.92, false);
  pipe(30, 0, 2.95, -17.92, false);
  pipe(28, -19.92, 3.1, 0, true);
  function vent(x, y, z, rotY) {
    const ventGroup = new THREE.Group();
    const back = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.85, 0.07), materials.ink);
    ventGroup.add(back);
    for (let i = 0; i < 3; i += 1) {
      const slat = new THREE.Mesh(new THREE.BoxGeometry(1.14, 0.09, 0.03), materials.steel);
      slat.position.set(0, -0.24 + i * 0.24, -0.05);
      ventGroup.add(slat);
    }
    ventGroup.position.set(x, y, z);
    ventGroup.rotation.y = rotY;
    group.add(ventGroup);
  }
  vent(-6, 2.3, -17.94, 0);
  vent(19.94, 2.5, -4, Math.PI / 2);
  vent(-19.94, 2.4, 8, -Math.PI / 2);
  function poster(title, sub, color, x, y, z, rotY) {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1.15, 1.44),
      new THREE.MeshStandardMaterial({ map: posterTexture(title, sub, color), roughness: 0.92 }),
    );
    mesh.position.set(x, y, z);
    mesh.rotation.y = rotY;
    group.add(mesh);
  }
  poster('SAFETY FIRST', 'helmets on visors down no exceptions in the yard', '#b0492f', -6, 2, 17.94, Math.PI);
  poster('BAY 03', 'keep clear loads move at dawn report damage to the office', '#3f6d8e', 19.94, 2, 6, -Math.PI / 2);
  poster('FOUNDRY HOT', 'the furnace eats gloves and excuses mind the amber line', '#b0492f', -19.94, 2.1, -10, Math.PI / 2);
  box(0.5, 0.7, 0.12, 6.2, 1.6, -17.9, 'steel', false);
  box(0.5, 0.7, 0.12, -19.9, 1.5, -3, 'steel', false);

  // Ground decals: oil stains, painted arrows, site letters, cracks.
  function decal(kind, size, x, z, rot = 0, opacity = 1) {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(size, size),
      new THREE.MeshStandardMaterial({
        map: decalTexture(kind), transparent: true, opacity, roughness: 1,
        depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2,
      }),
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.rotation.z = rot;
    mesh.position.set(x, 0.03, z);
    mesh.renderOrder = 1;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  decal('oil', 3.6, 2.2, -0.6);
  decal('oil', 2.4, 12.1, 7.4);
  decal('oil', 2.8, -13.9, 3.2);
  decal('arrow', 1.7, 0, 7.6);
  decal('arrow', 1.7, 8, 6.2, 0.5);
  decal('letterA', 3.2, -12, -7.2);
  decal('letterB', 3.2, 12, -6.4);
  decal('cracks', 3, -4.5, 12.5, 1.2);
  decal('cracks', 2.6, 6.5, -8.5, 2.4);

  // Rubble at the wall bases.
  for (const [rx, rz] of [[-19, -9.5], [19.1, 1.2], [-18.7, 13.8], [7.5, -17.2]]) {
    for (let i = 0; i < 4; i += 1) {
      const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(0.13 + (i % 3) * 0.07, 0), rockMat);
      rock.position.set(rx + (i % 2) * 0.34 - 0.17, 0.1, rz + Math.floor(i / 2) * 0.3 - 0.15);
      rock.rotation.set(i * 1.3, i * 2.1, i * 0.7);
      rock.castShadow = true;
      group.add(rock);
    }
  }

  // Air: dust motes in the last light, smoke from the stacks. Advanced by update().
  const dustBase = new Float32Array(130 * 3);
  const dustSeed = new Float32Array(130);
  const hash = (n) => {
    const v = Math.sin(n) * 43758.5453;
    return v - Math.floor(v);
  };
  for (let i = 0; i < 130; i += 1) {
    dustBase[i * 3] = (hash(i * 12.9898) - 0.5) * 36;
    dustBase[i * 3 + 1] = 0.3 + hash(i * 78.233) * 5;
    dustBase[i * 3 + 2] = (hash(i * 39.425) - 0.5) * 32;
    dustSeed[i] = i * 1.71;
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustBase.slice(), 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({
    map: glowTex, color: new THREE.Color('#ffca7a'), size: 0.07, transparent: true,
    opacity: 0.3, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true,
  }));
  scene.add(dust);
  const smokes = [];
  for (const [sx, sz, top] of [[27, -26, 17.5], [31.5, -26, 21.5], [-16.6, -16.2, 5.6]]) {
    for (let i = 0; i < 5; i += 1) {
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: cloudTex, color: new THREE.Color('#8a7672'), transparent: true, opacity: 0, depthWrite: false,
      }));
      scene.add(sprite);
      smokes.push({ sprite, x: sx, z: sz, top, offset: i / 5 });
    }
  }
  let airTime = 0;
  function updateAir(dt) {
    airTime += dt;
    const pos = dustGeo.attributes.position.array;
    for (let i = 0; i < 130; i += 1) {
      pos[i * 3] = dustBase[i * 3] + Math.sin(airTime * 0.22 + dustSeed[i]) * 0.7;
      pos[i * 3 + 1] = dustBase[i * 3 + 1] + Math.sin(airTime * 0.16 + dustSeed[i] * 2.3) * 0.35;
      pos[i * 3 + 2] = dustBase[i * 3 + 2] + Math.cos(airTime * 0.19 + dustSeed[i]) * 0.7;
    }
    dustGeo.attributes.position.needsUpdate = true;
    for (const smoke of smokes) {
      const age = (airTime * 0.09 + smoke.offset) % 1;
      smoke.sprite.position.set(smoke.x + age * 3.2, smoke.top + age * 8, smoke.z);
      const s = 4 + age * 8;
      smoke.sprite.scale.set(s, s * 0.62, 1);
      smoke.sprite.material.opacity = 0.32 * (1 - age) * Math.min(1, age * 5);
    }
  }

  // Light: low amber sun from the west, cool dusk fill, warm point lights over both sites.
  const skyLight = new THREE.HemisphereLight(new THREE.Color('#d8ab72'), new THREE.Color('#4a3423'), 3.1);
  scene.add(skyLight);
  const key = new THREE.DirectionalLight(new THREE.Color('#ffcf99'), 3.7);
  key.position.set(-18, 22, 10);
  key.target.position.set(2, 0, -4);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -26;
  key.shadow.camera.right = 26;
  key.shadow.camera.top = 26;
  key.shadow.camera.bottom = -26;
  key.shadow.camera.far = 70;
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.03;
  scene.add(key, key.target);
  const fill = new THREE.DirectionalLight(new THREE.Color('#7d8aa8'), 0.9);
  fill.position.set(10, 9, 12);
  scene.add(fill);
  const lampMid = new THREE.PointLight(new THREE.Color('#ffd2a0'), 20, 15, 1.8);
  lampMid.position.set(0, 3.9, 6.5);
  scene.add(lampMid);
  const lampA = new THREE.PointLight(new THREE.Color(PALETTE.accent), 34, 17, 1.8);
  lampA.position.set(-12, 4.2, -12);
  scene.add(lampA);
  const lampB = new THREE.PointLight(new THREE.Color(PALETTE.siteB), 26, 16, 1.8);
  lampB.position.set(12, 4.2, -11);
  scene.add(lampB);

  const sites = [
    { name: 'A', label: 'Foundry', center: new THREE.Vector3(-12, 0, -12), radius: 4.2, color: PALETTE.accent },
    { name: 'B', label: 'Depot', center: new THREE.Vector3(12, 0, -11), radius: 4.2, color: PALETTE.siteB },
  ];
  const waypoints = WAYPOINTS.map(([x, z, links]) => ({ pos: new THREE.Vector3(x, 0, z), links }));
  const spawns = {
    ember: new THREE.Vector3(0, 0, 15),
    // The player's four teammates fan out around the Ember spawn.
    emberTeam: [
      new THREE.Vector3(-2.6, 0, 15.6),
      new THREE.Vector3(2.6, 0, 15.6),
      new THREE.Vector3(-5.2, 0, 14.4),
      new THREE.Vector3(5.2, 0, 14.4),
    ],
    rust: [
      new THREE.Vector3(-13, 0, -15),
      new THREE.Vector3(-4, 0, -15),
      new THREE.Vector3(5, 0, -15),
      new THREE.Vector3(13, 0, -14),
      new THREE.Vector3(0, 0, -16),
    ],
  };

  const from = new THREE.Vector3();
  const to = new THREE.Vector3();
  const dir = new THREE.Vector3();

  return {
    colliders,
    shootables,
    group,
    sites,
    spawns,
    waypoints,
    update: updateAir,
    bounds: { x: HALF_X, z: HALF_Z },
    // True when a wall stands between two points (bot sight, grenades).
    blockedBetween(a, b) {
      from.copy(a);
      to.copy(b);
      dir.subVectors(to, from);
      const dist = dir.length();
      if (dist < 0.01) return false;
      dir.multiplyScalar(1 / dist);
      raycaster.set(from, dir);
      raycaster.far = dist;
      return raycaster.intersectObjects(shootables, false).length > 0;
    },
    siteAt(x, z) {
      for (const site of sites) {
        const dx = x - site.center.x;
        const dz = z - site.center.z;
        if (dx * dx + dz * dz <= site.radius * site.radius) return site;
      }
      return null;
    },
    nearestWaypoint(x, z) {
      let best = 0;
      let bestDist = Infinity;
      for (let i = 0; i < waypoints.length; i += 1) {
        const dx = waypoints[i].pos.x - x;
        const dz = waypoints[i].pos.z - z;
        const d = dx * dx + dz * dz;
        if (d < bestDist) {
          bestDist = d;
          best = i;
        }
      }
      return best;
    },
    // Breadth-first route through the waypoint graph.
    route(fromIndex, toIndex) {
      if (fromIndex === toIndex) return [toIndex];
      const prev = new Array(waypoints.length).fill(-1);
      const queue = [fromIndex];
      prev[fromIndex] = fromIndex;
      while (queue.length > 0) {
        const current = queue.shift();
        for (const next of waypoints[current].links) {
          if (prev[next] !== -1) continue;
          prev[next] = current;
          if (next === toIndex) {
            const path = [next];
            let node = current;
            while (node !== fromIndex) {
              path.unshift(node);
              node = prev[node];
            }
            path.unshift(fromIndex);
            return path;
          }
          queue.push(next);
        }
      }
      return [toIndex];
    },
  };
}
