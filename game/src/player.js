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
export function createPlayer(colliders,spawn) {
	const mover = createMover(colliders,{ x: spawn.x,z: spawn.z,radius: 0.34,height: STAND_HEIGHT });
	const P = {
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
	function look(dx,dy,sensitivity = 0.0022) {
		P.yaw -= dx * sensitivity;
		P.pitch = Math.max(-1.45,Math.min(1.45,P.pitch - dy * sensitivity));
	}
	function recoil(pitchKick,yawKick) {
		P.pitch = Math.min(1.45,P.pitch + pitchKick);
		P.yaw += yawKick;
	}
	function step(dt,keys) {
		const crouching = keys.has('ControlLeft') || keys.has('ControlRight') || keys.has('KeyC');
		if (crouching && !P.crouching) {
			P.crouching = true;
			P.height = CROUCH_HEIGHT;
			mover.height = CROUCH_HEIGHT;
		} else if (!crouching && P.crouching && !mover.overlaps(P.position.x,P.position.y,P.position.z,STAND_HEIGHT,0.02)) {
			P.crouching = false;
			P.height = STAND_HEIGHT;
			mover.height = STAND_HEIGHT;
		}
		const eyeTarget = P.crouching ? CROUCH_EYE : STAND_EYE;
		P.eye += (eyeTarget - P.eye) * Math.min(1,dt * 12);
		const forward = (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0);
		const strafe = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0);
		wish.set(0,0,0);
		if (forward || strafe) {
			const sin = Math.sin(P.yaw);
			const cos = Math.cos(P.yaw);
			wish.set(-sin * forward + cos * strafe,0,-cos * forward - sin * strafe).normalize();
		}
		if (keys.has('Space') && mover.onGround) {
			mover.velocity.y = JUMP_SPEED;
			mover.onGround = false;
		}
		const targetSpeed = P.crouching ? CROUCH_SPEED : WALK_SPEED;
		speed = mover.step(dt,wish.x,wish.z,targetSpeed,mover.onGround ? GROUND_ACCEL : AIR_ACCEL,FRICTION);
		P.onGround = mover.onGround;
	}
	function reset(spawnPoint) {
		P.position.set(spawnPoint.x,0,spawnPoint.z);
		P.velocity.set(0,0,0);
		P.yaw = 0;
		P.pitch = 0;
		P.eye = STAND_EYE;
		P.crouching = false;
		P.height = STAND_HEIGHT;
		mover.height = STAND_HEIGHT;
		P.health = P.maxHealth;
		P.alive = true;
		speed = 0;
	}
	return {
		state: P,
		step,
		look,
		recoil,
		reset,
		groundSpeed() {
			return speed;
		},
	};
}