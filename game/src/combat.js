// Combat helpers both brains share: turning toward a heading, walking a mover
// toward a point, picking the nearest target with a clear line of sight, and the
// engage behaviour itself — face the target, strafe at fighting distance, fire in
// bursts with a reaction delay. The brains differ only in what they want.
import * as THREE from 'three';
import { range } from './rng.js';

const BURST_MIN = 3;
const BURST_MAX = 5;
const SHOT_GAP = 0.11;

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

// Fight a visible target: face it, strafe to hold fighting distance, and loose
// bursts once the reaction delay has run, pausing between bursts. fire(unit)
// fires one shot with the brain's own ray and damage rules.
export function engageMove(unit, targetPos, dt, time, random, speed, accel, friction, fire) {
  _toTarget.copy(targetPos).sub(unit.mover.position);
  const dist = Math.hypot(_toTarget.x, _toTarget.z);
  faceYaw(unit, Math.atan2(-_toTarget.x, -_toTarget.z), dt, 8);
  // Strafe to stay at fighting distance and stay hard to hit.
  if (time > unit.strafeUntil) {
    unit.strafeDir = random() < 0.5 ? -1 : 1;
    unit.strafeUntil = time + range(random, 0.7, 1.6);
  }
  const strafeX = Math.cos(unit.yaw) * unit.strafeDir;
  const strafeZ = -Math.sin(unit.yaw) * unit.strafeDir;
  const approach = dist > 16 ? 0.7 : dist < 7 ? -0.5 : 0;
  const wishX = strafeX * 0.8 + (-Math.sin(unit.yaw)) * approach;
  const wishZ = strafeZ * 0.8 + (-Math.cos(unit.yaw)) * approach;
  const wishLen = Math.hypot(wishX, wishZ) || 1;
  unit.mover.step(dt, wishX / wishLen, wishZ / wishLen, speed * 0.7, accel, friction);
  unit.walkPhase += dt * 9;
  if (time >= unit.reactionAt && time >= unit.pauseUntil) {
    if (unit.burstLeft <= 0) {
      unit.burstLeft = BURST_MIN + Math.floor(random() * (BURST_MAX - BURST_MIN + 1));
      unit.nextShotAt = time;
    }
    if (time >= unit.nextShotAt) {
      unit.nextShotAt = time + SHOT_GAP;
      unit.burstLeft -= 1;
      fire(unit);
      if (unit.burstLeft <= 0) unit.pauseUntil = time + range(random, 0.6, 1.2);
    }
  }
}

// The nearest living target with an unobstructed eye-to-chest line, or null. Walls
// and smoke break the line; outside six metres the facing matters (0.25 dot cone).
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
