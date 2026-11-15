// Shared axis-separated movement vs box colliders.
import * as THREE from 'three';
const GRAVITY = 20;
export function createMover(colliders, options) {
	const radius = options.radius ?? 0.34;
	const height = options.height ?? 1.72;
	const position = new THREE.Vector3(options.x ?? 0, 0, options.z ?? 0);
	const velocity = new THREE.Vector3();
	const probe = new THREE.Box3();
	const mover = { position, velocity, onGround: true, height };
	function overlaps(x, y, z, h, lift) {
		probe.min.set(x - radius, y + lift, z - radius);
		probe.max.set(x + radius, y + h - lift, z + radius);
		for (const collider of colliders) if (probe.intersectsBox(collider)) return collider;
		return null;
	}
	function step(dt, wishX, wishZ, speed, accel, friction) {
		const blend = Math.min(1, (accel * dt) / Math.max(speed, 0.01));
		velocity.x += (wishX * speed - velocity.x) * blend;
		velocity.z += (wishZ * speed - velocity.z) * blend;
		if (mover.onGround && wishX === 0 && wishZ === 0) {
			const damp = Math.max(0, 1 - friction * dt);
			velocity.x *= damp;
			velocity.z *= damp;
		}
		velocity.y -= GRAVITY * dt;
		const nextX = position.x + velocity.x * dt;
		if (!overlaps(nextX, position.y, position.z, mover.height, 0.04)) position.x = nextX;
		else velocity.x = 0;
		const nextZ = position.z + velocity.z * dt;
		if (!overlaps(position.x, position.y, nextZ, mover.height, 0.04)) position.z = nextZ;
		else velocity.z = 0;
		position.y += velocity.y * dt;
		mover.onGround = false;
		const hit = overlaps(position.x, position.y, position.z, mover.height, 0);
		if (hit && velocity.y <= 0) {
			position.y = hit.max.y;
			velocity.y = 0;
			mover.onGround = true;
		} else if (hit) {
			position.y = hit.min.y - mover.height;
			velocity.y = 0;
		}
		if (position.y < 0) {
			position.y = 0;
			velocity.y = 0;
			mover.onGround = true;
		}
		velocity.y = Math.max(-30, velocity.y);
		return Math.hypot(velocity.x, velocity.z);
	}
	return { ...mover, step, overlaps };
}