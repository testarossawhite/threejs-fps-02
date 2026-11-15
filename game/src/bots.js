import * as THREE from 'three';
const T = THREE;
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
	for (let i = 0; i < world.spawns.rust.length; i += 1) {
		const spawn = world.spawns.rust[i];
		const built = buildSoldier({ uniform: PALETTE.foe,accent: PALETTE.foe });
		const { group,torso,head } = built;
		group.position.copy(spawn);
		scene.add(group);
		const mover = createMover(world.colliders,{ x: spawn.x,z: spawn.z,radius: 0.34,height: 1.72 });
		const bot = {
			id: i,
			group,
			torso,
			head,
			soldier: built,
			mover,
			health: HEALTH,
			alive: true,
			yaw: Math.PI,
			state: 'hold',
			goalSite: i % 2 === 0 ? 'A' : 'B',
			route: [],
			routeIndex: 0,
			holdPoint: new T.Vector3(),
			lastSeen: new T.Vector3(),
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
			utilUsed: false,
			scanPhase: random() * Math.PI * 2,
			fall: 0,
			flinch: 0,
			deadTime: 0,
			walkPhase: random() * 6,
		};
		torso.userData.bot = bot;
		head.userData.bot = bot;
		hitMeshes.push(torso,head);
		items.push(bot);
	}
	function setRoute(bot,targetIndex) {
		const from = world.nearestWaypoint(bot.mover.position.x,bot.mover.position.z);
		bot.route = world.route(from,targetIndex);
		bot.routeIndex = 0;
		bot.state = 'route';
	}
	function siteWaypoint(siteName) {
		return siteName === 'A' ? 12 : 14;
	}
	function assignGoals() {
		for (const bot of items) {
			bot.goalSite = bot.id % 2 === 0 ? 'A' : 'B';
			const site = world.sites.find((s) => s.name === bot.goalSite);
			bot.holdPoint.set(
				site.center.x + range(random,-2.5,2.5),
				0,
				site.center.z + range(random,-2.5,2.5),
			);
			setRoute(bot,siteWaypoint(bot.goalSite));
		}
	}
	function damage(mesh,amount) {
		const bot = mesh.userData.bot;
		if (!bot || !bot.alive) return null;
		bot.flinch = 1;
		bot.health -= amount;
		if (bot.health > 0) return null;
		bot.alive = false;
		bot.state = 'dead';
		bot.fall = 0;
		bot.defuseProgress = 0;
		return bot;
	}
	function step(dt,ctx) {
		for (const bot of items) {
			if (!bot.alive) {
				bot.fall = Math.min(1,bot.fall + dt / 0.4);
				bot.deadTime += dt;
				continue;
			}
			bot.flinch = Math.max(0,bot.flinch - dt * 4);
			if (ctx.time < bot.blindUntil) {
				bot.yaw += Math.sin(ctx.time * 1.3 + bot.scanPhase) * dt * 1.4;
				continue;
			}
			const seen = pickVisible(world,ctx.smokeBlocks,bot.mover.position,bot.yaw,ctx.targets,SEE_DISTANCE);
			if (seen) {
				bot.target = seen;
				bot.lastSeen.copy(seen.pos);
				bot.lastSeenAt = ctx.time;
				if (bot.state !== 'engage') {
					bot.state = 'engage';
					bot.reactionAt = ctx.time + range(random,0.35,0.65);
					bot.burstLeft = 0;
					bot.pauseUntil = 0;
				}
			}
			if (ctx.spikePlanted && bot.state !== 'engage' && bot.state !== 'defuse') {
				const site = world.sites.find((s) => s.name === ctx.spikeSite);
				setRoute(bot,siteWaypoint(ctx.spikeSite));
				bot.state = 'route';
				bot.goalSite = ctx.spikeSite;
				bot.holdPoint.copy(site.center);
			}
			if (bot.state === 'engage') {
				const target = bot.target;
				if (!target || !target.alive) {
					bot.state = 'investigate';
					bot.investigateAt = bot.lastSeen.clone();
					bot.investigateUntil = ctx.time + 3;
					setRoute(bot,world.nearestWaypoint(bot.lastSeen.x,bot.lastSeen.z));
					continue;
				}
				if (!bot.utilUsed && bot.util === 'flash' && ctx.throwUtil) {
					const dx = target.pos.x - bot.mover.position.x;
					const dz = target.pos.z - bot.mover.position.z;
					if (dx * dx + dz * dz > 49) {
						bot.utilUsed = true;
						bot.pauseUntil = ctx.time + 0.9;
						ctx.throwUtil(bot,'flash',null);
					}
				}
				engageMove(bot,target.pos,dt,ctx.time,random,BOT_SPEED,BOT_ACCEL,BOT_FRICTION,() => fireAt(bot,ctx));
				if (!seen && ctx.time - bot.lastSeenAt > 2.5) {
					bot.state = 'investigate';
					bot.investigateAt = bot.lastSeen.clone();
					bot.investigateUntil = ctx.time + 3;
					setRoute(bot,world.nearestWaypoint(bot.lastSeen.x,bot.lastSeen.z));
				}
				continue;
			}
			if (bot.state === 'defuse') {
				const spikePos = ctx.spikePos;
				const arrived = moveToward(bot,spikePos,dt,BOT_SPEED,BOT_ACCEL,BOT_FRICTION);
				if (arrived) {
					bot.defuseProgress += dt;
					faceYaw(bot,Math.atan2(-(spikePos.x - bot.mover.position.x),-(spikePos.z - bot.mover.position.z)),dt,8);
					if (bot.defuseProgress >= 5) ctx.onDefused(bot);
				}
				continue;
			}
			if (bot.state === 'route') {
				if (!bot.utilUsed && bot.util === 'smoke' && ctx.spikePlanted && ctx.throwUtil) {
					const dx = ctx.spikePos.x - bot.mover.position.x;
					const dz = ctx.spikePos.z - bot.mover.position.z;
					if (dx * dx + dz * dz < 100) {
						bot.utilUsed = true;
						ctx.throwUtil(bot,'smoke',ctx.spikePos);
					}
				}
				const target = bot.route[bot.routeIndex];
				if (target === undefined) {
					bot.state = 'hold';
					continue;
				}
				const wp = world.waypoints[target];
				const arrived = moveToward(bot,wp.pos,dt,BOT_SPEED,BOT_ACCEL,BOT_FRICTION);
				if (arrived) {
					bot.routeIndex += 1;
					if (bot.routeIndex >= bot.route.length) {
						if (ctx.spikePlanted && bot.goalSite === ctx.spikeSite) {
							bot.state = 'defuse';
							bot.defuseProgress = 0;
						} else {
							bot.state = 'hold';
						}
					}
				}
				continue;
			}
			if (bot.state === 'investigate') {
				if (bot.investigateAt) {
					const arrived = moveToward(bot,bot.investigateAt,dt,BOT_SPEED,BOT_ACCEL,BOT_FRICTION);
					if (arrived || ctx.time > bot.investigateUntil) {
						bot.state = 'hold';
						bot.investigateAt = null;
					}
				} else {
					bot.state = 'hold';
				}
				continue;
			}
			bot.yaw += Math.sin(ctx.time * 0.5 + bot.scanPhase) * dt * 0.9;
			if (ctx.noise && ctx.time - ctx.noise.time < 1.2) {
				const dx = ctx.noise.pos.x - bot.mover.position.x;
				const dz = ctx.noise.pos.z - bot.mover.position.z;
				if (dx * dx + dz * dz < HEAR_DISTANCE * HEAR_DISTANCE) {
					bot.state = 'investigate';
					bot.investigateAt = ctx.noise.pos.clone();
					bot.investigateUntil = ctx.time + 3;
					setRoute(bot,world.nearestWaypoint(ctx.noise.pos.x,ctx.noise.pos.z));
				}
			}
		}
		for (const bot of items) {
			bot.group.position.x = bot.mover.position.x;
			bot.group.position.z = bot.mover.position.z;
			bot.group.rotation.y = bot.yaw;
			animateSoldier(bot.soldier,{
				dt,
				phase: bot.walkPhase,
				moving: bot.alive && bot.state !== 'hold',
				flinch: bot.flinch,
				fall: bot.fall,
				fade: Math.max(0,Math.min(1,(bot.deadTime - 1) / 1.5)),
			});
		}
	}
	function fireAt(bot,ctx) {
		const target = bot.target;
		if (!target) return;
		_muzzle.set(
			bot.mover.position.x + Math.sin(bot.yaw) * -0.2,
			1.35,
			bot.mover.position.z + Math.cos(bot.yaw) * -0.2,
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
			ctx.onBotShot(bot,_muzzle,end,0,false);
			return;
		}
		end = hit.point;
		if (hit.object === ctx.playerHitbox) {
			const headshot = hit.point.y > target.pos.y + 1.45;
			ctx.onBotShot(bot,_muzzle,end,Math.round((headshot ? HEAD_DAMAGE : DAMAGE) * bot.gun.mul),headshot);
		} else if (hit.object.userData.ally) {
			const headshot = hit.object.userData.part === 'head';
			ctx.onBotShotAlly(bot,_muzzle,end,hit.object.userData.ally,Math.round((headshot ? HEAD_DAMAGE : DAMAGE) * bot.gun.mul),headshot);
		} else {
			ctx.onBotShot(bot,_muzzle,end,0,false);
		}
	}
	function reset() {
		for (let i = 0; i < items.length; i += 1) {
			const bot = items[i];
			const spawn = world.spawns.rust[i];
			bot.mover.position.set(spawn.x,0,spawn.z);
			bot.mover.velocity.set(0,0,0);
			bot.group.position.copy(spawn);
			bot.group.rotation.set(0,Math.PI,0);
			bot.group.position.y = 0;
			bot.health = HEALTH;
			bot.alive = true;
			bot.yaw = Math.PI;
			bot.fall = 0;
			bot.flinch = 0;
			bot.deadTime = 0;
			bot.soldier.resetVisual();
			bot.target = null;
			bot.defuseProgress = 0;
			bot.lastSeenAt = -99;
			bot.burstLeft = 0;
			bot.pauseUntil = 0;
			bot.blindUntil = 0;
			bot.utilUsed = false;
			bot.util = random() < 0.35 ? 'flash' : random() < 0.3 ? 'smoke' : null;
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
			return items.filter((bot) => bot.alive).length;
		},
		aimPoint(index) {
			const bot = items[index % items.length];
			return new T.Vector3(bot.mover.position.x,1.25,bot.mover.position.z);
		},
	};
}