// Dustworks Yard: an original salvage yard at dusk, built from boxes, cylinders and
// painted floor marks. Two bomb sites — A "Foundry" in the north-west, B "Depot" in the
// north-east — joined by three lanes: west corridor, mid past the silo, east yard.
// Every solid is a collider for movement and a surface a bullet stops on.
import * as THREE from 'three';
import { PALETTE } from './palette.js';

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
  ctx.fillStyle = '#241c14';
  ctx.fillRect(0, 0, 512, 128);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 512, 10);
  ctx.fillStyle = '#f0e7d6';
  ctx.font = 'bold 52px system-ui, sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 24, 58);
  ctx.fillStyle = '#a89a83';
  ctx.font = '28px system-ui, sans-serif';
  ctx.fillText(sub, 24, 102);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
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
  const glowA = new THREE.MeshStandardMaterial({
    color: new THREE.Color(PALETTE.accent), emissive: new THREE.Color(PALETTE.accent),
    emissiveIntensity: 1.6, roughness: 0.4,
  });
  const glowB = new THREE.MeshStandardMaterial({
    color: new THREE.Color(PALETTE.foe), emissive: new THREE.Color(PALETTE.foe),
    emissiveIntensity: 1.2, roughness: 0.4,
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

  // Floor and perimeter.
  box(HALF_X * 2 + 0.8, 0.4, HALF_Z * 2 + 0.8, 0, -0.2, 0, 'canvas');
  box(0.4, WALL_H, HALF_Z * 2 + 0.8, -HALF_X - 0.2, WALL_H / 2, 0, 'surface');
  box(0.4, WALL_H, HALF_Z * 2 + 0.8, HALF_X + 0.2, WALL_H / 2, 0, 'surface');
  box(HALF_X * 2 + 0.8, WALL_H, 0.4, 0, WALL_H / 2, -HALF_Z - 0.2, 'surface');
  box(HALF_X * 2 + 0.8, WALL_H, 0.4, 0, WALL_H / 2, HALF_Z + 0.2, 'surface');

  // Site A — Foundry (north-west): raised platform, furnace with a glowing mouth, chimney.
  box(10, 0.5, 8, -12, 0.25, -12, 'hairline');
  box(3.2, 3.4, 2.4, -15.5, 1.7, -15.5, 'surface');
  const furnaceMouth = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.4), glowA);
  furnaceMouth.position.set(-13.9, 1.3, -15.5);
  furnaceMouth.rotation.y = Math.PI / 2;
  group.add(furnaceMouth);
  cylinder(0.5, 0.7, 5.4, -16.6, 2.7, -16.2, 'steel');
  box(1.4, 1.1, 1.4, -8.6, 0.55, -14.6, 'hairline');
  box(1.4, 1.1, 1.4, -8.6, 0.55, -9.4, 'hairline');
  flatMark(7, 6, -12, -12, 'accent', 0.5);
  const signA = new THREE.Mesh(
    new THREE.PlaneGeometry(5.2, 1.3),
    new THREE.MeshBasicMaterial({ map: makeSign('SITE A', 'FOUNDRY', '#e8a33d') }),
  );
  signA.position.set(-12, 3.4, -17.7);
  group.add(signA);

  // Site B — Depot (north-east): stacked containers, rust-red mark.
  box(4.8, 2.4, 2.4, 13.5, 1.2, -13.5, 'steel');
  box(4.8, 2.4, 2.4, 13.5, 3.6, -13.5, 'surface');
  box(2.4, 2.4, 4.8, 8.2, 1.2, -15.2, 'hairline');
  box(1.4, 1.1, 1.4, 15.8, 0.55, -8.6, 'hairline');
  box(1.4, 1.1, 1.4, 9.4, 0.55, -8.2, 'hairline');
  flatMark(7, 6, 12, -11, 'foe', 0.5);
  const signB = new THREE.Mesh(
    new THREE.PlaneGeometry(5.2, 1.3),
    new THREE.MeshBasicMaterial({ map: makeSign('SITE B', 'DEPOT', '#c8503c') }),
  );
  signB.position.set(12, 3.4, -17.7);
  group.add(signB);

  // Mid: the silo and its crate ring, the yard's central sightline breaker.
  cylinder(2.2, 2.4, 7, 0, 3.5, -2, 'steel', 24);
  cylinder(0.4, 2.2, 1.6, 0, 7.8, -2, 'hairline', 24);
  box(1.6, 1.1, 1.6, -4.2, 0.55, -2, 'hairline');
  box(1.6, 1.1, 1.6, 4.2, 0.55, -2, 'hairline');
  box(1.2, 2.2, 1.2, -3.2, 1.1, -6.4, 'surface');
  box(1.2, 2.2, 1.2, 3.4, 1.1, 2.2, 'surface');

  // West lane: corridor crates and a low wall to vault behind.
  box(1.2, 1.1, 3.6, -14.5, 0.55, 4, 'hairline');
  box(1.2, 2.2, 1.2, -14.5, 1.1, -2, 'surface');
  box(3.2, 1.1, 1.2, -11, 0.55, 8, 'hairline');
  box(1.6, 1.1, 1.6, -17, 0.55, 10.5, 'hairline');

  // East lane: container stack and barrels.
  box(4.8, 2.4, 2.4, 15.5, 1.2, 4, 'steel');
  box(2.4, 2.4, 2.4, 15.5, 3.6, 3.2, 'surface');
  cylinder(0.6, 0.6, 1.3, 11.5, 0.65, 8, 'foe');
  cylinder(0.6, 0.6, 1.3, 12.8, 0.65, 8.6, 'steel');
  box(1.6, 1.1, 1.6, 10, 0.55, -1, 'hairline');

  // South (Ember spawn): low cover and the yard's name board.
  box(2.4, 0.9, 1.2, -4, 0.45, 11.5, 'hairline');
  box(2.4, 0.9, 1.2, 4, 0.45, 11.5, 'hairline');
  const signYard = new THREE.Mesh(
    new THREE.PlaneGeometry(6.4, 1.6),
    new THREE.MeshBasicMaterial({ map: makeSign('DUSTWORKS YARD', 'EMBER vs RUST  •  FIRST TO 4 ROUNDS', '#e8a33d') }),
  );
  signYard.position.set(0, 3.2, 17.7);
  signYard.rotation.y = Math.PI;
  group.add(signYard);

  // Light: low amber sun from the west, cool dusk fill, warm point lights over both sites.
  const sky = new THREE.HemisphereLight(new THREE.Color('#8a7a63'), new THREE.Color('#241a12'), 1.6);
  scene.add(sky);
  const key = new THREE.DirectionalLight(new THREE.Color('#ffd9a0'), 2.8);
  key.position.set(-14, 16, 10);
  key.target.position.set(2, 0, -4);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -24;
  key.shadow.camera.right = 24;
  key.shadow.camera.top = 24;
  key.shadow.camera.bottom = -24;
  key.shadow.camera.far = 60;
  key.shadow.bias = -0.0006;
  scene.add(key, key.target);
  const fill = new THREE.DirectionalLight(new THREE.Color('#7d8aa8'), 0.5);
  fill.position.set(10, 9, 12);
  scene.add(fill);
  const lampA = new THREE.PointLight(new THREE.Color(PALETTE.accent), 30, 16, 1.8);
  lampA.position.set(-12, 4.2, -12);
  scene.add(lampA);
  const lampB = new THREE.PointLight(new THREE.Color(PALETTE.foe), 22, 15, 1.8);
  lampB.position.set(12, 4.2, -11);
  scene.add(lampB);

  const sites = [
    { name: 'A', label: 'Foundry', center: new THREE.Vector3(-12, 0, -12), radius: 4.2, color: PALETTE.accent },
    { name: 'B', label: 'Depot', center: new THREE.Vector3(12, 0, -11), radius: 4.2, color: PALETTE.foe },
  ];
  const waypoints = WAYPOINTS.map(([x, z, links]) => ({ pos: new THREE.Vector3(x, 0, z), links }));
  const spawns = {
    ember: new THREE.Vector3(0, 0, 15),
    rust: [
      new THREE.Vector3(-13, 0, -15),
      new THREE.Vector3(-4, 0, -15),
      new THREE.Vector3(5, 0, -15),
      new THREE.Vector3(13, 0, -14),
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
    bounds: { x: HALF_X, z: HALF_Z },
    // True when a wall stands between two points (used for bot sight and grenades).
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
    // Breadth-first route through the waypoint graph; returns waypoint indices.
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
