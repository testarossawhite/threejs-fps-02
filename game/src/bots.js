import * as THREE from 'three';
const T = THREE;
	const P = Math.PI;
import { createMover } from './mover.js';
import { buildSoldier,animateSoldier } from './soldier.js';
import { engageMove,faceYaw,moveToward,pickVisible } from './combat.js';
import { PALETTE } from './palette.js';
import { range } from './rng.js';
const HEALTH = 100;
const BOT_SPEED = 3.4;
const BOT_ACCEL = 30;
const BOT_FRICTION = 8;
const SEE_DISTANCE = 34;
const HEAR_DISTANCE = 30;
const DAMAGE = 14;
const HEAD_DAMAGE = 28;
const BOT_GUNS = [
	{ short: 'VK-7',mul: 1.1 },
	{ short: 'Dusk-9',mul: 0.85 },
	{ short: 'KR-9',mul: 0.9 },
	{ short: 'BR-12',mul: 1.2 },
	{ short: 'P-9',mul: 0.7 },
];
const _dir = new T.Vector3();
const _muzzle = new T.Vector3();
const _aim = new T.Vector3();
const _far = new T.Vector3();
export function createBots(scene,world,random) {
	const items = [];
	const hitMeshes = [];
	const raycaster = new T.Raycaster();
	raycaster.far = 90;
	for (let i = 0; i < world.spawns.rust.length; i++) {
		const spawn = world.spawns.rust[i];
		const built = buildSoldier({ uniform: PALETTE.foe,accent: PALETTE.foe });
		const { group,torso,head } = built;
		group.position.copy(spawn);
		scene.add(group);
		const mover = createMover(world.colliders,{ x: spawn.x,z: spawn.z,radius: 0.34,height: 1.72 });
		const b = {
			id: i,
			group,
			torso,
			head,
			soldier: built,
			mover,
			health: HEALTH,
			alive: true,
			yaw: P,
			state: 'hold',
			goalSite: i % 2 === 0 ? 'A' : 'B',
			route: [],
			routeIndex: 0,
			hP: new T.Vector3(),
			lS: new T.Vector3(),
			lastSeenAt: -99,
			target: null,
			reactionAt: 0,
			burstLeft: 0,
			nextShotAt: 0,
			pauseUntil: 0,
			strafeDir: 1,
			strafeUntil: 0,
			defuseProgress: 0,
			gun: BOT_GUNS[i % BOT_GUNS.length],
			blindUntil: 0,
			util: null,
			uu: false,
			scanPhase: random() * P * 2,
			fall: 0,
			flinch: 0,
			deadTime: 0,
			walkPhase: random() * 6,
		};
		torso.userData.bot = b;
		head.userData.bot = b;
		hitMeshes.push(torso,head);
		items.push(b);
	}
	function setRoute(b,targetIndex) {
		const from = world.nearestWaypoint(b.mover.position.x,b.mover.position.z);
		b.route = world.route(from,targetIndex);
		b.routeIndex = 0;
		b.state = 'route';
	}
	function siteWaypoint(sN) {
		return sN === 'A' ? 12 : 14;
	}
	function assignGoals() {
		for (const b of items) {
			b.goalSite = b.id % 2 === 0 ? 'A' : 'B';
			const site = world.sites.find((s) => s.name === b.goalSite);
			b.hP.set(
				site.center.x + range(random,-2.5,2.5),
				0,
				site.center.z + range(random,-2.5,2.5),
			);
			setRoute(b,siteWaypoint(b.goalSite));
		}
	}
	function damage(mesh,amount) {
		const b = mesh.userData.bot;
		if (!b || !b.alive) return null;
		b.flinch = 1;
		b.health -= amount;
		if (b.health > 0) return null;
		b.alive = false;
		b.state = 'dead';
		b.fall = 0;
		b.defuseProgress = 0;
		return b;
	}
	function step(dt,ctx) {
		for (const b of items) {
			if (!b.alive) {
				b.fall = Math.min(1,b.fall + dt / 0.4);
				b.deadTime += dt;
				continue;
			}
			b.flinch = Math.max(0,b.flinch - dt * 4);
			if (ctx.time < b.blindUntil) {
				b.yaw += Math.sin(ctx.time * 1.3 + b.scanPhase) * dt * 1.4;
				continue;
			}
			const seen = pickVisible(world,ctx.smokeBlocks,b.mover.position,b.yaw,ctx.targets,SEE_DISTANCE);
			if (seen) {
				b.target = seen;
				b.lS.copy(seen.pos);
				b.lastSeenAt = ctx.time;
				if (b.state !== 'engage') {
					b.state = 'engage';
					b.reactionAt = ctx.time + range(random,0.35,0.65);
					b.burstLeft = 0;
					b.pauseUntil = 0;
				}
			}
			if (ctx.spikePlanted && b.state !== 'engage' && b.state !== 'defuse') {
				const site = world.sites.find((s) => s.name === ctx.spikeSite);
				setRoute(b,siteWaypoint(ctx.spikeSite));
				b.state = 'route';
				b.goalSite = ctx.spikeSite;
				b.hP.copy(site.center);
			}
			if (b.state === 'engage') {
				const target = b.target;
				if (!target || !target.alive) {
					b.state = 'investigate';
					b.investigateAt = b.lS.clone();
					b.investigateUntil = ctx.time + 3;
					setRoute(b,world.nearestWaypoint(b.lS.x,b.lS.z));
					continue;
				}
				if (!b.uu && b.util === 'flash' && ctx.throwUtil) {
					const dx = target.pos.x - b.mover.position.x;
					const dz = target.pos.z - b.mover.position.z;
					if (dx * dx + dz * dz > 49) {
						b.uu = true;
						b.pauseUntil = ctx.time + 0.9;
						ctx.throwUtil(b,'flash',null);
					}
				}
				engageMove(b,target.pos,dt,ctx.time,random,BOT_SPEED,BOT_ACCEL,BOT_FRICTION,() => fireAt(b,ctx));
				if (!seen && ctx.time - b.lastSeenAt > 2.5) {
					b.state = 'investigate';
					b.investigateAt = b.lS.clone();
					b.investigateUntil = ctx.time + 3;
					setRoute(b,world.nearestWaypoint(b.lS.x,b.lS.z));
				}
				continue;
			}
			if (b.state === 'defuse') {
				const sP = ctx.sP;
				const arrived = moveToward(b,sP,dt,BOT_SPEED,BOT_ACCEL,BOT_FRICTION);
				if (arrived) {
					b.defuseProgress += dt;
					faceYaw(b,Math.atan2(-(sP.x - b.mover.position.x),-(sP.z - b.mover.position.z)),dt,8);
					if (b.defuseProgress >= 5) ctx.onDefused(b);
				}
				continue;
			}
			if (b.state === 'route') {
				if (!b.uu && b.util === 'smoke' && ctx.spikePlanted && ctx.throwUtil) {
					const dx = ctx.sP.x - b.mover.position.x;
					const dz = ctx.sP.z - b.mover.position.z;
					if (dx * dx + dz * dz < 100) {
						b.uu = true;
						ctx.throwUtil(b,'smoke',ctx.sP);
					}
				}
				const target = b.route[b.routeIndex];
				if (target === undefined) {
					b.state = 'hold';
					continue;
				}
				const wp = world.waypoints[target];
				const arrived = moveToward(b,wp.pos,dt,BOT_SPEED,BOT_ACCEL,BOT_FRICTION);
				if (arrived) {
					b.routeIndex++;
					if (b.routeIndex >= b.route.length) {
						if (ctx.spikePlanted && b.goalSite === ctx.spikeSite) {
							b.state = 'defuse';
							b.defuseProgress = 0;
						} else {
							b.state = 'hold';
						}
					}
				}
				continue;
			}
			if (b.state === 'investigate') {
				if (b.investigateAt) {
					const arrived = moveToward(b,b.investigateAt,dt,BOT_SPEED,BOT_ACCEL,BOT_FRICTION);
					if (arrived || ctx.time > b.investigateUntil) {
						b.state = 'hold';
						b.investigateAt = null;
					}
				} else {
					b.state = 'hold';
				}
				continue;
			}
			b.yaw += Math.sin(ctx.time * 0.5 + b.scanPhase) * dt * 0.9;
			if (ctx.noise && ctx.time - ctx.noise.time < 1.2) {
				const dx = ctx.noise.pos.x - b.mover.position.x;
				const dz = ctx.noise.pos.z - b.mover.position.z;
				if (dx * dx + dz * dz < HEAR_DISTANCE * HEAR_DISTANCE) {
					b.state = 'investigate';
					b.investigateAt = ctx.noise.pos.clone();
					b.investigateUntil = ctx.time + 3;
					setRoute(b,world.nearestWaypoint(ctx.noise.pos.x,ctx.noise.pos.z));
				}
			}
		}
		for (const b of items) {
			b.group.position.x = b.mover.position.x;
			b.group.position.z = b.mover.position.z;
			b.group.rotation.y = b.yaw;
			animateSoldier(b.soldier,{
				dt,
				phase: b.walkPhase,
				moving: b.alive && b.state !== 'hold',
				flinch: b.flinch,
				fall: b.fall,
				fade: Math.max(0,Math.min(1,(b.deadTime - 1) / 1.5)),
			});
		}
	}
	function fireAt(b,ctx) {
		const target = b.target;
		if (!target) return;
		_muzzle.set(
			b.mover.position.x + Math.sin(b.yaw) * -0.2,
			1.35,
			b.mover.position.z + Math.cos(b.yaw) * -0.2,
		);
		_aim.copy(target.pos);
		_aim.y = target.pos.y + 1.25;
		const dist = _muzzle.distanceTo(_aim);
		const spread = 0.02 + dist * 0.0011 + target.speed * 0.004 - (target.crouching ? 0.008 : 0);
		_dir.subVectors(_aim,_muzzle).normalize();
		_dir.x += (random() * 2 - 1) * spread;
		_dir.y += (random() * 2 - 1) * spread;
		_dir.z += (random() * 2 - 1) * spread;
		_dir.normalize();
		raycaster.set(_muzzle,_dir);
		const hit = raycaster.intersectObjects(ctx.raycastTargets,false)[0];
		let end = _far.copy(_muzzle).addScaledVector(_dir,60);
		if (!hit) {
			ctx.onBotShot(b,_muzzle,end,0,false);
			return;
		}
		end = hit.point;
		if (hit.object === ctx.playerHitbox) {
			const headshot = hit.point.y > target.pos.y + 1.45;
			ctx.onBotShot(b,_muzzle,end,Math.round((headshot ? HEAD_DAMAGE : DAMAGE) * b.gun.mul),headshot);
		} else if (hit.object.userData.ally) {
			const headshot = hit.object.userData.part === 'head';
			ctx.onBotShotAlly(b,_muzzle,end,hit.object.userData.ally,Math.round((headshot ? HEAD_DAMAGE : DAMAGE) * b.gun.mul),headshot);
		} else {
			ctx.onBotShot(b,_muzzle,end,0,false);
		}
	}
	function reset() {
		for (let i = 0; i < items.length; i++) {
			const b = items[i];
			const spawn = world.spawns.rust[i];
			b.mover.position.set(spawn.x,0,spawn.z);
			b.mover.velocity.set(0,0,0);
			b.group.position.copy(spawn);
			b.group.rotation.set(0,P,0);
			b.group.position.y = 0;
			b.health = HEALTH;
			b.alive = true;
			b.yaw = P;
			b.fall = 0;
			b.flinch = 0;
			b.deadTime = 0;
			b.soldier.resetVisual();
			b.target = null;
			b.defuseProgress = 0;
			b.lastSeenAt = -99;
			b.burstLeft = 0;
			b.pauseUntil = 0;
			b.blindUntil = 0;
			b.uu = false;
			b.util = random() < 0.35 ? 'flash' : random() < 0.3 ? 'smoke' : null;
		}
		assignGoals();
	}
	return {
		items,
		hitMeshes,
		step,
		damage,
		reset,
		aliveCount() {
			return items.filter((b) => b.alive).length;
		},
		aimPoint(index) {
			const b = items[index % items.length];
			return new T.Vector3(b.mover.position.x,1.25,b.mover.position.z);
		},
	};
}