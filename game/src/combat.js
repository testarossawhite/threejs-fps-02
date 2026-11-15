// Combat helpers both teams' fighters share: turning toward a heading, walking a
// mover toward a point, and picking the nearest target with a clear line of sight.
// One copy of each, so the Rust brain in bots.js and the Ember brain in allies.js
// differ only in what they want, never in how eyes and legs work.
import * as THREE from 'three';

const _toTarget = new THREE.Vector3();
const _forward = new THREE.Vector3();
const _eye = new THREE.Vector3();
const _chest = new THREE.Vector3();
const _dir = new THREE.Vector3();

// Turn body.yaw toward targetYaw at a capped rate (radians per second).
export function faceYaw(body, targetYaw, dt, rate = 6) {
  let diff = targetYaw - body.yaw;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  body.yaw += Math.max(-rate * dt, Math.min(rate * dt, diff));
}

// Walk body.mover toward a ground point; returns true once inside 0.15 m.
export function moveToward(body, target, dt, speed, accel, friction) {
  _dir.set(target.x - body.mover.position.x, 0, target.z - body.mover.position.z);
  const dist = _dir.length();
  if (dist < 0.15) return true;
  _dir.multiplyScalar(1 / dist);
  body.mover.step(dt, _dir.x, _dir.z, speed, accel, friction);
  faceYaw(body, Math.atan2(-_dir.x, -_dir.z), dt, 8);
  body.walkPhase += dt * 9;
  return false;
}

// The nearest living target with an unobstructed eye-to-chest line, or null.
// Targets are views: { pos (feet), alive }. Walls and smoke both break the line,
// and outside six metres the seeker's facing matters (a 0.25 dot-product cone).
export function pickVisible(world, smokeBlocks, fromPos, yaw, targets, maxDist) {
  let best = null;
  let bestDist = Infinity;
  for (const target of targets) {
    if (!target.alive) continue;
    _toTarget.copy(target.pos).sub(fromPos);
    _toTarget.y = 0;
    const dist = _toTarget.length();
    if (dist > maxDist || dist >= bestDist) continue;
    if (dist > 6) {
      _forward.set(-Math.sin(yaw), 0, -Math.cos(yaw));
      if (_forward.dot(_toTarget) / dist < 0.25) continue;
    }
    _eye.set(fromPos.x, 1.55, fromPos.z);
    _chest.set(target.pos.x, target.pos.y + 1.25, target.pos.z);
    if (world.blockedBetween(_eye, _chest)) continue;
    if (smokeBlocks && smokeBlocks(_eye, _chest)) continue;
    best = target;
    bestDist = dist;
  }
  return best;
}
