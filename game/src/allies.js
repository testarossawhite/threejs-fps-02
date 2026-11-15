import * as THREE from 'three';
const T = THREE;
import { createMover } from './mover.js';
import { buildSoldier,animateSoldier } from './soldier.js';
import { engageMove,moveToward,pickVisible } from './combat.js';
import { PALETTE } from './palette.js';
import { range } from './rng.js';
const HEALTH = 100;
const ALLY_SPEED = 3.4;
const ALLY_ACCEL = 30;
const ALLY_FRICTION = 8;
const SEE_DISTANCE = 34;
const DAMAGE = 14;
const HEAD_DAMAGE = 28;
const ALLY_GUNS = ['VK-7','Dusk-9','KR-9','BR-12'];
const HOLD_OFFSETS = [
	[2.3,1.1],[-2.3,1.7],[1.5,-2.5],[-1.9,-2.3],
];
const _dir = new T.Vector3();
const _muzzle = new T.Vector3();
const _aim = new T.Vector3();
const _far = new T.Vector3();
export function createAllies(scene,world,random) {
	const items = [];
	const hitMeshes = [];
	const raycaster = new T.Raycaster();
	raycaster.far = 90;
	for (let i = 0; i < world.spawns.emberTeam.length; i += 1) {
		const spawn = world.spawns.emberTeam[i];
		const built = buildSoldier({ uniform: '#8f7434',accent: PALETTE.accent });
		const { group,torso,head } = built;
		group.position.copy(spawn);
		scene.add(group);
		const mover = createMover(world.colliders,{ x: spawn.x,z: spawn.z,radius: 0.34,height: 1.72 });
		const ally = {
			id: i,
			name: `Ember-${i + 2}`,
			gunShort: ALLY_GUNS[i % ALLY_GUNS.length],
			blindUntil: 0,
			group,
			torso,
			head,
			soldier: built,
			mover,
			health: HEALTH,
			alive: true,
			yaw: 0,
			state: 'advance',
			planSite: 'A',
			route: [],
			routeIndex: 0,
			holdPoint: new T.Vector3(),
			target: null,
			lastSeen: new T.Vector3(),
			lastSeenAt: -99,
			contacted: false,
			reactionAt: 0,
			burstLeft: 0,
			nextShotAt: 0,
			pauseUntil: 0,
			strafeDir: 1,
			strafeUntil: 0,
			scanPhase: random() * Math.PI * 2,
			fall: 0,
			flinch: 0,
			deadTime: 0,
			walkPhase: random() * 6,
		};
		torso.userData.ally = ally;
		head.userData.ally = ally;
		hitMeshes.push(torso,head);
		items.push(ally);
	}
	function siteWaypoint(siteName) {
		return siteName === 'A' ? 12 : 14;
	}
	function setRoute(ally,targetIndex) {
		const from = world.nearestWaypoint(ally.mover.position.x,ally.mover.position.z);
		ally.route = world.route(from,targetIndex);
		ally.routeIndex = 0;
		ally.state = 'advance';
	}
	function planRoute(ally,siteName) {
		ally.planSite = siteName;
		const site = world.sites.find((s) => s.name === siteName);
		const [ox,oz] = HOLD_OFFSETS[ally.id % HOLD_OFFSETS.length];
		ally.holdPoint.set(site.center.x + ox,0,site.center.z + oz);
		setRoute(ally,siteWaypoint(siteName));
	}
	function damage(ally,amount) {
		if (!ally || !ally.alive) return false;
		ally.flinch = 1;
		ally.health -= amount;
		if (ally.health > 0) return false;
		ally.alive = false;
		ally.state = 'dead';
		ally.fall = 0;
		return true;
	}
	function step(dt,ctx) {
		for (const ally of items) {
			if (!ally.alive) {
				ally.fall = Math.min(1,ally.fall + dt / 0.4);
				ally.deadTime += dt;
				continue;
			}
			ally.flinch = Math.max(0,ally.flinch - dt * 4);
			if (ctx.time < ally.blindUntil) {
				ally.yaw += Math.sin(ctx.time * 1.2 + ally.scanPhase) * dt * 1.2;
				continue;
			}
			const wantedSite = ctx.spikePlanted ? ctx.spikeSite : ctx.planSite;
			if (wantedSite && ally.planSite !== wantedSite && ally.state !== 'engage') {
				planRoute(ally,wantedSite);
			}
			const seen = pickVisible(world,ctx.smokeBlocks,ally.mover.position,ally.yaw,ctx.enemyViews,SEE_DISTANCE);
			if (seen) {
				ally.target = seen.ref;
				ally.lastSeen.copy(seen.pos);
				ally.lastSeenAt = ctx.time;
				if (ally.state !== 'engage') {
					ally.state = 'engage';
					ally.reactionAt = ctx.time + range(random,0.35,0.65);
					ally.burstLeft = 0;
					ally.pauseUntil = 0;
					if (!ally.contacted) {
						ally.contacted = true;
						ctx.onEvent('contact',ally);
					}
				}
			}
			if (ally.state === 'engage') {
				const target = ally.target;
				if (!target || !target.alive) {
					ally.state = 'advance';
					setRoute(ally,siteWaypoint(ally.planSite));
					continue;
				}
				engageMove(ally,target.mover.position,dt,ctx.time,random,ALLY_SPEED,ALLY_ACCEL,ALLY_FRICTION,() => fireAt(ally,ctx));
				if (!seen && ctx.time - ally.lastSeenAt > 2.5) {
					ally.state = 'advance';
					setRoute(ally,siteWaypoint(ally.planSite));
				}
				continue;
			}
			if (ctx.planter === ally && !ctx.spikePlanted) {
				const site = world.siteAt(ally.mover.position.x,ally.mover.position.z);
				if (site) {
					ally.state = 'plant';
					ally.yaw += Math.sin(ctx.time * 0.6 + ally.scanPhase) * dt * 0.7;
					continue;
				}
			}
			if (ally.state === 'plant') {
				ally.state = 'advance';
				setRoute(ally,siteWaypoint(ally.planSite));
			}
			if (ally.state === 'advance') {
				const target = ally.route[ally.routeIndex];
				if (target === undefined) {
					const arrived = moveToward(ally,ally.holdPoint,dt,ALLY_SPEED,ALLY_ACCEL,ALLY_FRICTION);
					if (arrived) ally.state = 'hold';
					continue;
				}
				const wp = world.waypoints[target];
				const arrived = moveToward(ally,wp.pos,dt,ALLY_SPEED,ALLY_ACCEL,ALLY_FRICTION);
				if (arrived) ally.routeIndex += 1;
				continue;
			}
			ally.yaw += Math.sin(ctx.time * 0.5 + ally.scanPhase) * dt * 0.9;
			const dx = ally.holdPoint.x - ally.mover.position.x;
			const dz = ally.holdPoint.z - ally.mover.position.z;
			if (dx * dx + dz * dz > 4) {
				moveToward(ally,ally.holdPoint,dt,ALLY_SPEED * 0.6,ALLY_ACCEL,ALLY_FRICTION);
			}
		}
		for (const ally of items) {
			ally.group.position.x = ally.mover.position.x;
			ally.group.position.z = ally.mover.position.z;
			ally.group.rotation.y = ally.yaw;
			animateSoldier(ally.soldier,{
				dt,
				phase: ally.walkPhase,
				moving: ally.alive && (ally.state === 'advance' || ally.state === 'engage'),
				flinch: ally.flinch,
				fall: ally.fall,
				fade: Math.max(0,Math.min(1,(ally.deadTime - 1) / 1.5)),
			});
		}
	}
	function fireAt(ally,ctx) {
		const target = ally.target;
		if (!target) return;
		_muzzle.set(
			ally.mover.position.x + Math.sin(ally.yaw) * -0.2,
			1.35,
			ally.mover.position.z + Math.cos(ally.yaw) * -0.2,
		);
		_aim.copy(target.mover.position);
		_aim.y = target.mover.position.y + 1.25;
		const dist = _muzzle.distanceTo(_aim);
		const targetSpeed = Math.hypot(target.mover.velocity.x,target.mover.velocity.z);
		const spread = 0.02 + dist * 0.0011 + targetSpeed * 0.004;
		_dir.subVectors(_aim,_muzzle).normalize();
		_dir.x += (random() * 2 - 1) * spread;
		_dir.y += (random() * 2 - 1) * spread;
		_dir.z += (random() * 2 - 1) * spread;
		_dir.normalize();
		raycaster.set(_muzzle,_dir);
		const hit = raycaster.intersectObjects(ctx.raycastTargets,false)[0];
		const end = hit ? hit.point : _far.copy(_muzzle).addScaledVector(_dir,60);
		let hitMesh = null;
		let damageDone = 0;
		let headshot = false;
		if (hit && hit.object.userData.bot) {
			hitMesh = hit.object;
			headshot = hit.object.userData.part === 'head';
			damageDone = headshot ? HEAD_DAMAGE : DAMAGE;
		}
		ctx.onAllyShot(ally,_muzzle,end,hitMesh,damageDone,headshot);
	}
	function reset(planSite) {
		for (let i = 0; i < items.length; i += 1) {
			const ally = items[i];
			const spawn = world.spawns.emberTeam[i];
			ally.mover.position.set(spawn.x,0,spawn.z);
			ally.mover.velocity.set(0,0,0);
			ally.group.position.copy(spawn);
			ally.group.rotation.set(0,0,0);
			ally.group.position.y = 0;
			ally.health = HEALTH;
			ally.alive = true;
			ally.yaw = 0;
			ally.fall = 0;
			ally.flinch = 0;
			ally.deadTime = 0;
			ally.soldier.resetVisual();
			ally.target = null;
			ally.contacted = false;
			ally.burstLeft = 0;
			ally.pauseUntil = 0;
			ally.blindUntil = 0;
			planRoute(ally,planSite);
		}
	}
	return {
		items,
		hitMeshes,
		step,
		damage,
		reset,
		aliveCount() {
			return items.filter((ally) => ally.alive).length;
		},
		firstAlive() {
			return items.find((ally) => ally.alive) ?? null;
		},
		aimPoint(index) {
			const ally = items[index % items.length];
			return new T.Vector3(ally.mover.position.x,1.25,ally.mover.position.z);
		},
	};
}