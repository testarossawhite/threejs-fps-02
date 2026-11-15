// The player: acceleration, friction, gravity, crouch and jump on the shared mover,
// plus look and recoil. One body, one eye height, one ground speed.
import * as THREE from 'three';
import { createMover } from './mover.js';

const STAND_HEIGHT = 1.72;
const CROUCH_HEIGHT = 1.12;
const STAND_EYE = 1.6;
const CROUCH_EYE = 1.02;
const WALK_SPEED = 5.2;
const CROUCH_SPEED = 2.4;
const GROUND_ACCEL = 42;
const AIR_ACCEL = 9;
const FRICTION = 9;
const JUMP_SPEED = 6.2;

export function createPlayer(colliders, spawn) {
  const mover = createMover(colliders, { x: spawn.x, z: spawn.z, radius: 0.34, height: STAND_HEIGHT });
  const player = {
    position: mover.position,
    velocity: mover.velocity,
    yaw: 0,
    pitch: 0,
    eye: STAND_EYE,
    onGround: true,
    crouching: false,
    height: STAND_HEIGHT,
    health: 100,
    maxHealth: 100,
    alive: true,
  };
  const wish = new THREE.Vector3();
  let speed = 0;

  function look(dx, dy, sensitivity = 0.0022) {
    player.yaw -= dx * sensitivity;
    player.pitch = Math.max(-1.45, Math.min(1.45, player.pitch - dy * sensitivity));
  }

  function recoil(pitchKick, yawKick) {
    player.pitch = Math.min(1.45, player.pitch + pitchKick);
    player.yaw += yawKick;
  }

  function step(dt, keys) {
    const crouching = keys.has('ControlLeft') || keys.has('ControlRight') || keys.has('KeyC');
    if (crouching && !player.crouching) {
      player.crouching = true;
      player.height = CROUCH_HEIGHT;
      mover.height = CROUCH_HEIGHT;
    } else if (!crouching && player.crouching && !mover.overlaps(player.position.x, player.position.y, player.position.z, STAND_HEIGHT, 0.02)) {
      player.crouching = false;
      player.height = STAND_HEIGHT;
      mover.height = STAND_HEIGHT;
    }
    const eyeTarget = player.crouching ? CROUCH_EYE : STAND_EYE;
    player.eye += (eyeTarget - player.eye) * Math.min(1, dt * 12);

    const forward = (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0);
    const strafe = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0);
    wish.set(0, 0, 0);
    if (forward || strafe) {
      const sin = Math.sin(player.yaw);
      const cos = Math.cos(player.yaw);
      wish.set(-sin * forward + cos * strafe, 0, -cos * forward - sin * strafe).normalize();
    }

    if (keys.has('Space') && mover.onGround) {
      mover.velocity.y = JUMP_SPEED;
      mover.onGround = false;
    }
    const targetSpeed = player.crouching ? CROUCH_SPEED : WALK_SPEED;
    speed = mover.step(dt, wish.x, wish.z, targetSpeed, mover.onGround ? GROUND_ACCEL : AIR_ACCEL, FRICTION);
    player.onGround = mover.onGround;
  }

  function reset(spawnPoint) {
    player.position.set(spawnPoint.x, 0, spawnPoint.z);
    player.velocity.set(0, 0, 0);
    player.yaw = 0;
    player.pitch = 0;
    player.eye = STAND_EYE;
    player.crouching = false;
    player.height = STAND_HEIGHT;
    mover.height = STAND_HEIGHT;
    player.health = player.maxHealth;
    player.alive = true;
    speed = 0;
  }

  return {
    state: player,
    step,
    look,
    recoil,
    reset,
    groundSpeed() {
      return speed;
    },
  };
}
