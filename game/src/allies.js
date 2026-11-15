// The Ember teammates: four attackers who fight beside the player and make the
// match a 5v5. They play the team's plan — at round start game.js calls a site and
// announces it on the radio; the squad routes there through the waypoint graph,
// takes hold positions around the site, engages the Rust bots it can see with the
// same burst discipline the defenders use, and converges to defend the spike once
// it is planted. If the player goes down with the spike unplanted, the first
// living teammate picks the carry up and plants it. Eyes and legs come from
// combat.js, shared with the Rust brain; only the wanting differs.
import * as THREE from 'three';
import { createMover } from './mover.js';
import { buildSoldier } from './soldier.js';
import { faceYaw, moveToward, pickVisible } from './combat.js';
import { PALETTE } from './palette.js';
import { range } from './rng.js';

const HEALTH = 100;
const ALLY_SPEED = 3.4;
const ALLY_ACCEL = 30;
const ALLY_FRICTION = 8;
const SEE_DISTANCE = 34;
const BURST_MIN = 3;
const BURST_MAX = 5;
const SHOT_GAP = 0.11;
const DAMAGE = 14;
const HEAD_DAMAGE = 28;

// Where each teammate settles around a site centre: a loose ring with angles on
// the lanes, never a clump.
const HOLD_OFFSETS = [
  [2.3, 1.1], [-2.3, 1.7], [1.5, -2.5], [-1.9, -2.3],
];

const _dir = new THREE.Vector3();
const _toTarget = new THREE.Vector3();
const _muzzle = new THREE.Vector3();
const _aim = new THREE.Vector3();
const _far = new THREE.Vector3();

export function createAllies(scene, world, random) {
  const items = [];
  const hitMeshes = [];
  const raycaster = new THREE.Raycaster();
  raycaster.far = 90;

  for (let i = 0; i < world.spawns.emberTeam.length; i += 1) {
    const spawn = world.spawns.emberTeam[i];
    const built = buildSoldier({ uniform: '#a87c2f', accent: PALETTE.accent });
    const { group, torso, head } = built;
    group.position.copy(spawn);
    scene.add(group);

    const mover = createMover(world.colliders, { x: spawn.x, z: spawn.z, radius: 0.34, height: 1.72 });
    const ally = {
      id: i,
      name: `Ember-${i + 2}`,
      group,
      torso,
      head,
      mover,
      health: HEALTH,
      alive: true,
      yaw: 0,
      state: 'advance',
      planSite: 'A',
      route: [],
      routeIndex: 0,
      holdPoint: new THREE.Vector3(),
      target: null,
      lastSeen: new THREE.Vector3(),
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
      walkPhase: random() * 6,
    };
    torso.userData.ally = ally;
    head.userData.ally = ally;
    hitMeshes.push(torso, head);
    items.push(ally);
  }

  function siteWaypoint(siteName) {
    return siteName === 'A' ? 12 : 14;
  }

  function setRoute(ally, targetIndex) {
    const from = world.nearestWaypoint(ally.mover.position.x, ally.mover.position.z);
    ally.route = world.route(from, targetIndex);
    ally.routeIndex = 0;
    ally.state = 'advance';
  }

  function planRoute(ally, siteName) {
    ally.planSite = siteName;
    const site = world.sites.find((s) => s.name === siteName);
    const [ox, oz] = HOLD_OFFSETS[ally.id % HOLD_OFFSETS.length];
    ally.holdPoint.set(site.center.x + ox, 0, site.center.z + oz);
    setRoute(ally, siteWaypoint(siteName));
  }

  // Taking damage is routed here from Rust fire and from grenades alike; game.js
  // hears about a death through the return value and puts it on the radio.
  function damage(ally, amount) {
    if (!ally || !ally.alive) return false;
    ally.health -= amount;
    if (ally.health > 0) return false;
    ally.alive = false;
    ally.state = 'dead';
    ally.fall = 0;
    return true;
  }

  function step(dt, ctx) {
    for (const ally of items) {
      if (!ally.alive) {
        ally.fall = Math.min(1, ally.fall + dt / 0.4);
        ally.group.rotation.x = -ally.fall * 1.45;
        ally.group.position.y = -ally.fall * 0.08;
        continue;
      }
      ally.group.rotation.x = 0;
      ally.group.position.y = 0;

      // The plan changed under them (a rotation call, or the spike went down at
      // the other site): re-route, unless they are mid-fight.
      const wantedSite = ctx.spikePlanted ? ctx.spikeSite : ctx.planSite;
      if (wantedSite && ally.planSite !== wantedSite && ally.state !== 'engage') {
        planRoute(ally, wantedSite);
      }

      const seen = pickVisible(world, ctx.smokeBlocks, ally.mover.position, ally.yaw, ctx.enemyViews, SEE_DISTANCE);
      if (seen) {
        ally.target = seen.ref;
        ally.lastSeen.copy(seen.pos);
        ally.lastSeenAt = ctx.time;
        if (ally.state !== 'engage') {
          ally.state = 'engage';
          ally.reactionAt = ctx.time + range(random, 0.35, 0.65);
          ally.burstLeft = 0;
          ally.pauseUntil = 0;
          if (!ally.contacted) {
            ally.contacted = true;
            ctx.onEvent('contact', ally);
          }
        }
      }

      if (ally.state === 'engage') {
        const target = ally.target;
        if (!target || !target.alive) {
          ally.state = 'advance';
          setRoute(ally, siteWaypoint(ally.planSite));
          continue;
        }
        _toTarget.copy(target.mover.position).sub(ally.mover.position);
        const dist = Math.hypot(_toTarget.x, _toTarget.z);
        faceYaw(ally, Math.atan2(-_toTarget.x, -_toTarget.z), dt, 8);
        if (ctx.time > ally.strafeUntil) {
          ally.strafeDir = random() < 0.5 ? -1 : 1;
          ally.strafeUntil = ctx.time + range(random, 0.7, 1.6);
        }
        const strafeX = Math.cos(ally.yaw) * ally.strafeDir;
        const strafeZ = -Math.sin(ally.yaw) * ally.strafeDir;
        const approach = dist > 16 ? 0.7 : dist < 7 ? -0.5 : 0;
        const wishX = strafeX * 0.8 + (-Math.sin(ally.yaw)) * approach;
        const wishZ = strafeZ * 0.8 + (-Math.cos(ally.yaw)) * approach;
        const wishLen = Math.hypot(wishX, wishZ) || 1;
        ally.mover.step(dt, wishX / wishLen, wishZ / wishLen, ALLY_SPEED * 0.7, ALLY_ACCEL, ALLY_FRICTION);
        ally.walkPhase += dt * 9;

        if (ctx.time >= ally.reactionAt && ctx.time >= ally.pauseUntil) {
          if (ally.burstLeft <= 0) {
            ally.burstLeft = BURST_MIN + Math.floor(random() * (BURST_MAX - BURST_MIN + 1));
            ally.nextShotAt = ctx.time;
          }
          if (ctx.time >= ally.nextShotAt) {
            ally.nextShotAt = ctx.time + SHOT_GAP;
            ally.burstLeft -= 1;
            fireAt(ally, ctx);
            if (ally.burstLeft <= 0) ally.pauseUntil = ctx.time + range(random, 0.6, 1.2);
          }
        }
        if (!seen && ctx.time - ally.lastSeenAt > 2.5) {
          ally.state = 'advance';
          setRoute(ally, siteWaypoint(ally.planSite));
        }
        continue;
      }

      // The designated carrier plants when the player is down: walk the plan,
      // and inside the site, stop and work. game.js runs the plant clock itself
      // while state reads 'plant'.
      if (ctx.planter === ally && !ctx.spikePlanted) {
        const site = world.siteAt(ally.mover.position.x, ally.mover.position.z);
        if (site) {
          ally.state = 'plant';
          ally.yaw += Math.sin(ctx.time * 0.6 + ally.scanPhase) * dt * 0.7;
          continue;
        }
      }

      if (ally.state === 'plant') {
        // Lost the moment (moved off the site or the plan changed): walk again.
        ally.state = 'advance';
        setRoute(ally, siteWaypoint(ally.planSite));
      }

      if (ally.state === 'advance') {
        const target = ally.route[ally.routeIndex];
        if (target === undefined) {
          const arrived = moveToward(ally, ally.holdPoint, dt, ALLY_SPEED, ALLY_ACCEL, ALLY_FRICTION);
          if (arrived) ally.state = 'hold';
          continue;
        }
        const wp = world.waypoints[target];
        const arrived = moveToward(ally, wp.pos, dt, ALLY_SPEED, ALLY_ACCEL, ALLY_FRICTION);
        if (arrived) ally.routeIndex += 1;
        continue;
      }

      // hold: keep the site, sweep the lanes.
      ally.yaw += Math.sin(ctx.time * 0.5 + ally.scanPhase) * dt * 0.9;
      const dx = ally.holdPoint.x - ally.mover.position.x;
      const dz = ally.holdPoint.z - ally.mover.position.z;
      if (dx * dx + dz * dz > 4) {
        moveToward(ally, ally.holdPoint, dt, ALLY_SPEED * 0.6, ALLY_ACCEL, ALLY_FRICTION);
      }
    }

    for (const ally of items) {
      ally.group.position.x = ally.mover.position.x;
      ally.group.position.z = ally.mover.position.z;
      ally.group.rotation.y = ally.yaw;
      if (ally.alive && (ally.state === 'advance' || ally.state === 'engage')) {
        const bob = Math.sin(ally.walkPhase) * 0.04;
        ally.group.children[2].position.y = 0.28 + Math.max(0, bob);
        ally.group.children[3].position.y = 0.28 + Math.max(0, -bob);
      }
    }
  }

  function fireAt(ally, ctx) {
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
    const targetSpeed = Math.hypot(target.mover.velocity.x, target.mover.velocity.z);
    const spread = 0.02 + dist * 0.0011 + targetSpeed * 0.004;
    _dir.subVectors(_aim, _muzzle).normalize();
    _dir.x += (random() * 2 - 1) * spread;
    _dir.y += (random() * 2 - 1) * spread;
    _dir.z += (random() * 2 - 1) * spread;
    _dir.normalize();
    raycaster.set(_muzzle, _dir);
    const hit = raycaster.intersectObjects(ctx.raycastTargets, false)[0];
    const end = hit ? hit.point : _far.copy(_muzzle).addScaledVector(_dir, 60);
    let hitMesh = null;
    let damageDone = 0;
    let headshot = false;
    if (hit && hit.object.userData.bot) {
      hitMesh = hit.object;
      headshot = hit.object.userData.part === 'head';
      damageDone = headshot ? HEAD_DAMAGE : DAMAGE;
    }
    ctx.onAllyShot(ally, _muzzle, end, hitMesh, damageDone, headshot);
  }

  function reset(planSite) {
    for (let i = 0; i < items.length; i += 1) {
      const ally = items[i];
      const spawn = world.spawns.emberTeam[i];
      ally.mover.position.set(spawn.x, 0, spawn.z);
      ally.mover.velocity.set(0, 0, 0);
      ally.group.position.copy(spawn);
      ally.group.rotation.set(0, 0, 0);
      ally.group.position.y = 0;
      ally.health = HEALTH;
      ally.alive = true;
      ally.yaw = 0;
      ally.fall = 0;
      ally.target = null;
      ally.contacted = false;
      ally.burstLeft = 0;
      ally.pauseUntil = 0;
      planRoute(ally, planSite);
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
      return new THREE.Vector3(ally.mover.position.x, 1.25, ally.mover.position.z);
    },
  };
}
