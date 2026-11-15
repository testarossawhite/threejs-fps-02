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
	for (let i = 0; i < world.spawns.emberTeam.length; i++) {
		const spawn = world.spawns.emberTeam[i];
		const built = buildSoldier({ uniform: '#8f7434',accent: PALETTE.accent });
		const { group,torso,head } = built;
		group.position.copy(spawn);
		scene.add(group);
		const mover = createMover(world.colliders,{ x: spawn.x,z: spawn.z,radius: 0.34,height: 1.72 });
		const a = {
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
			pS: 'A',
			route: [],
			routeIndex: 0,
			hP: new T.Vector3(),
			target: null,
			lS: new T.Vector3(),
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
		torso.userData.ally = a;
		head.userData.ally = a;
		hitMeshes.push(torso,head);
		items.push(a);
	}
	function siteWaypoint(sN) {
		return sN === 'A' ? 12 : 14;
	}
	function setRoute(a,targetIndex) {
		const from = world.nearestWaypoint(a.mover.position.x,a.mover.position.z);
		a.route = world.route(from,targetIndex);
		a.routeIndex = 0;
		a.state = 'advance';
	}
	function planRoute(a,sN) {
		a.pS = sN;
		const site = world.sites.find((s) => s.name === sN);
		const [ox,oz] = HOLD_OFFSETS[a.id % HOLD_OFFSETS.length];
		a.hP.set(site.center.x + ox,0,site.center.z + oz);
		setRoute(a,siteWaypoint(sN));
	}
	function damage(a,amount) {
		if (!a || !a.alive) return false;
		a.flinch = 1;
		a.health -= amount;
		if (a.health > 0) return false;
		a.alive = false;
		a.state = 'dead';
		a.fall = 0;
		return true;
	}
	function step(dt,ctx) {
		for (const a of items) {
			if (!a.alive) {
				a.fall = Math.min(1,a.fall + dt / 0.4);
				a.deadTime += dt;
				continue;
			}
			a.flinch = Math.max(0,a.flinch - dt * 4);
			if (ctx.time < a.blindUntil) {
				a.yaw += Math.sin(ctx.time * 1.2 + a.scanPhase) * dt * 1.2;
				continue;
			}
			const wantedSite = ctx.spikePlanted ? ctx.spikeSite : ctx.pS;
			if (wantedSite && a.pS !== wantedSite && a.state !== 'engage') {
				planRoute(a,wantedSite);
			}
			const seen = pickVisible(world,ctx.smokeBlocks,a.mover.position,a.yaw,ctx.enemyViews,SEE_DISTANCE);
			if (seen) {
				a.target = seen.ref;
				a.lS.copy(seen.pos);
				a.lastSeenAt = ctx.time;
				if (a.state !== 'engage') {
					a.state = 'engage';
					a.reactionAt = ctx.time + range(random,0.35,0.65);
					a.burstLeft = 0;
					a.pauseUntil = 0;
					if (!a.contacted) {
						a.contacted = true;
						ctx.onEvent('contact',a);
					}
				}
			}
			if (a.state === 'engage') {
				const target = a.target;
				if (!target || !target.alive) {
					a.state = 'advance';
					setRoute(a,siteWaypoint(a.pS));
					continue;
				}
				engageMove(a,target.mover.position,dt,ctx.time,random,ALLY_SPEED,ALLY_ACCEL,ALLY_FRICTION,() => fireAt(a,ctx));
				if (!seen && ctx.time - a.lastSeenAt > 2.5) {
					a.state = 'advance';
					setRoute(a,siteWaypoint(a.pS));
				}
				continue;
			}
			if (ctx.planter === a && !ctx.spikePlanted) {
				const site = world.siteAt(a.mover.position.x,a.mover.position.z);
				if (site) {
					a.state = 'plant';
					a.yaw += Math.sin(ctx.time * 0.6 + a.scanPhase) * dt * 0.7;
					continue;
				}
			}
			if (a.state === 'plant') {
				a.state = 'advance';
				setRoute(a,siteWaypoint(a.pS));
			}
			if (a.state === 'advance') {
				const target = a.route[a.routeIndex];
				if (target === undefined) {
					const arrived = moveToward(a,a.hP,dt,ALLY_SPEED,ALLY_ACCEL,ALLY_FRICTION);
					if (arrived) a.state = 'hold';
					continue;
				}
				const wp = world.waypoints[target];
				const arrived = moveToward(a,wp.pos,dt,ALLY_SPEED,ALLY_ACCEL,ALLY_FRICTION);
				if (arrived) a.routeIndex++;
				continue;
			}
			a.yaw += Math.sin(ctx.time * 0.5 + a.scanPhase) * dt * 0.9;
			const dx = a.hP.x - a.mover.position.x;
			const dz = a.hP.z - a.mover.position.z;
			if (dx * dx + dz * dz > 4) {
				moveToward(a,a.hP,dt,ALLY_SPEED * 0.6,ALLY_ACCEL,ALLY_FRICTION);
			}
		}
		for (const a of items) {
			a.group.position.x = a.mover.position.x;
			a.group.position.z = a.mover.position.z;
			a.group.rotation.y = a.yaw;
			animateSoldier(a.soldier,{
				dt,
				phase: a.walkPhase,
				moving: a.alive && (a.state === 'advance' || a.state === 'engage'),
				flinch: a.flinch,
				fall: a.fall,
				fade: Math.max(0,Math.min(1,(a.deadTime - 1) / 1.5)),
			});
		}
	}
	function fireAt(a,ctx) {
		const target = a.target;
		if (!target) return;
		_muzzle.set(
			a.mover.position.x + Math.sin(a.yaw) * -0.2,
			1.35,
			a.mover.position.z + Math.cos(a.yaw) * -0.2,
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
		ctx.onAllyShot(a,_muzzle,end,hitMesh,damageDone,headshot);
	}
	function reset(pS) {
		for (let i = 0; i < items.length; i++) {
			const a = items[i];
			const spawn = world.spawns.emberTeam[i];
			a.mover.position.set(spawn.x,0,spawn.z);
			a.mover.velocity.set(0,0,0);
			a.group.position.copy(spawn);
			a.group.rotation.set(0,0,0);
			a.group.position.y = 0;
			a.health = HEALTH;
			a.alive = true;
			a.yaw = 0;
			a.fall = 0;
			a.flinch = 0;
			a.deadTime = 0;
			a.soldier.resetVisual();
			a.target = null;
			a.contacted = false;
			a.burstLeft = 0;
			a.pauseUntil = 0;
			a.blindUntil = 0;
			planRoute(a,pS);
		}
	}
	return {
		items,
		hitMeshes,
		step,
		damage,
		reset,
		aliveCount() {
			return items.filter((a) => a.alive).length;
		},
		firstAlive() {
			return items.find((a) => a.alive) ?? null;
		},
		aimPoint(index) {
			const a = items[index % items.length];
			return new T.Vector3(a.mover.position.x,1.25,a.mover.position.z);
		},
	};
}