// The Rust bots: four defenders that walk the waypoint graph to their sites, hold
// positions, sweep for the player, chase what they see or hear, and converge to defuse
// a planted spike. They shoot in bursts with a reaction delay, and their accuracy
// falls off with distance and with how fast the player moves.
import * as THREE from 'three';
import { createMover } from './mover.js';
import { PALETTE } from './palette.js';
import { range } from './rng.js';

const HEALTH = 100;
const BOT_SPEED = 3.4;
const BOT_ACCEL = 30;
const BOT_FRICTION = 8;
const SEE_DISTANCE = 34;
const HEAR_DISTANCE = 30;
const BURST_MIN = 3;
const BURST_MAX = 5;
const SHOT_GAP = 0.11;
const DAMAGE = 14;
const HEAD_DAMAGE = 28;

const _dir = new THREE.Vector3();
const _toPlayer = new THREE.Vector3();
const _muzzle = new THREE.Vector3();
const _aim = new THREE.Vector3();
const _forward = new THREE.Vector3();
const _far = new THREE.Vector3();

export function createBots(scene, world, random) {
  const torsoMaterial = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.foe), roughness: 0.65, metalness: 0.1 });
  const headMaterial = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.ink), roughness: 0.5, metalness: 0.1 });
  const darkMaterial = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.hairline), roughness: 0.85 });
  const torsoGeometry = new THREE.BoxGeometry(0.52, 0.72, 0.3);
  const headGeometry = new THREE.SphereGeometry(0.16, 14, 10);
  const legGeometry = new THREE.BoxGeometry(0.18, 0.55, 0.2);
  const gunGeometry = new THREE.BoxGeometry(0.07, 0.09, 0.55);

  const items = [];
  const hitMeshes = [];
  const raycaster = new THREE.Raycaster();
  raycaster.far = 90;

  for (let i = 0; i < 4; i += 1) {
    const spawn = world.spawns.rust[i];
    const group = new THREE.Group();
    const torso = new THREE.Mesh(torsoGeometry, torsoMaterial);
    torso.position.y = 1.05;
    torso.userData.part = 'torso';
    const head = new THREE.Mesh(headGeometry, headMaterial);
    head.position.y = 1.58;
    head.userData.part = 'head';
    const legL = new THREE.Mesh(legGeometry, darkMaterial);
    legL.position.set(-0.14, 0.28, 0);
    const legR = new THREE.Mesh(legGeometry, darkMaterial);
    legR.position.set(0.14, 0.28, 0);
    const gun = new THREE.Mesh(gunGeometry, darkMaterial);
    gun.position.set(0.2, 1.15, -0.3);
    group.add(torso, head, legL, legR, gun);
    group.traverse((mesh) => {
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });
    group.position.copy(spawn);
    scene.add(group);

    const mover = createMover(world.colliders, { x: spawn.x, z: spawn.z, radius: 0.34, height: 1.72 });
    const bot = {
      id: i,
      group,
      torso,
      head,
      mover,
      health: HEALTH,
      alive: true,
      yaw: Math.PI,
      state: 'hold',
      goalSite: i < 2 ? 'A' : 'B',
      route: [],
      routeIndex: 0,
      holdPoint: new THREE.Vector3(),
      lastSeen: new THREE.Vector3(),
      lastSeenAt: -99,
      reactionAt: 0,
      burstLeft: 0,
      nextShotAt: 0,
      pauseUntil: 0,
      strafeDir: 1,
      strafeUntil: 0,
      defuseProgress: 0,
      scanPhase: random() * Math.PI * 2,
      fall: 0,
      walkPhase: random() * 6,
    };
    torso.userData.bot = bot;
    head.userData.bot = bot;
    hitMeshes.push(torso, head);
    items.push(bot);
  }

  function setRoute(bot, targetIndex) {
    const from = world.nearestWaypoint(bot.mover.position.x, bot.mover.position.z);
    bot.route = world.route(from, targetIndex);
    bot.routeIndex = 0;
    bot.state = 'route';
  }

  function siteWaypoint(siteName) {
    return siteName === 'A' ? 12 : 14;
  }

  function assignGoals() {
    for (const bot of items) {
      bot.goalSite = bot.id < 2 ? 'A' : 'B';
      const site = world.sites.find((s) => s.name === bot.goalSite);
      bot.holdPoint.set(
        site.center.x + range(random, -2.5, 2.5),
        0,
        site.center.z + range(random, -2.5, 2.5),
      );
      setRoute(bot, siteWaypoint(bot.goalSite));
    }
  }

  function damage(mesh, amount) {
    const bot = mesh.userData.bot;
    if (!bot || !bot.alive) return null;
    bot.health -= amount;
    if (bot.health > 0) return bot;
    bot.alive = false;
    bot.state = 'dead';
    bot.fall = 0;
    bot.defuseProgress = 0;
    return bot;
  }

  function canSee(bot, ctx) {
    if (!ctx.playerAlive) return false;
    _toPlayer.copy(ctx.playerPos).sub(bot.mover.position);
    _toPlayer.y = 0;
    const dist = _toPlayer.length();
    if (dist > SEE_DISTANCE) return false;
    if (dist > 6) {
      _forward.set(-Math.sin(bot.yaw), 0, -Math.cos(bot.yaw));
      if (_forward.dot(_toPlayer) / dist < 0.25) return false;
    }
    const eye = new THREE.Vector3(bot.mover.position.x, 1.55, bot.mover.position.z);
    const chest = new THREE.Vector3(ctx.playerPos.x, ctx.playerPos.y + 1.25, ctx.playerPos.z);
    if (world.blockedBetween(eye, chest)) return false;
    if (ctx.smokeBlocks && ctx.smokeBlocks(eye, chest)) return false;
    return true;
  }

  function faceYaw(bot, targetYaw, dt, rate = 6) {
    let diff = targetYaw - bot.yaw;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    bot.yaw += Math.max(-rate * dt, Math.min(rate * dt, diff));
  }

  function moveToward(bot, target, dt, speed = BOT_SPEED) {
    _dir.set(target.x - bot.mover.position.x, 0, target.z - bot.mover.position.z);
    const dist = _dir.length();
    if (dist < 0.15) return true;
    _dir.multiplyScalar(1 / dist);
    bot.mover.step(dt, _dir.x, _dir.z, speed, BOT_ACCEL, BOT_FRICTION);
    faceYaw(bot, Math.atan2(-_dir.x, -_dir.z), dt, 8);
    bot.walkPhase += dt * 9;
    return false;
  }

  function step(dt, ctx) {
    for (const bot of items) {
      if (!bot.alive) {
        bot.fall = Math.min(1, bot.fall + dt / 0.4);
        bot.group.rotation.x = -bot.fall * 1.45;
        bot.group.position.y = -bot.fall * 0.08;
        continue;
      }
      bot.group.rotation.x = 0;
      bot.group.position.y = 0;

      const sees = canSee(bot, ctx);
      if (sees) {
        bot.lastSeen.copy(ctx.playerPos);
        bot.lastSeenAt = ctx.time;
        if (bot.state !== 'engage') {
          bot.state = 'engage';
          bot.reactionAt = ctx.time + range(random, 0.35, 0.65);
          bot.burstLeft = 0;
          bot.pauseUntil = 0;
        }
      }

      // A planted spike pulls every living bot to the site.
      if (ctx.spikePlanted && bot.state !== 'engage' && bot.state !== 'defuse') {
        const site = world.sites.find((s) => s.name === ctx.spikeSite);
        setRoute(bot, siteWaypoint(ctx.spikeSite));
        bot.state = 'route';
        bot.goalSite = ctx.spikeSite;
        bot.holdPoint.copy(site.center);
      }

      if (bot.state === 'engage') {
        _toPlayer.copy(ctx.playerPos).sub(bot.mover.position);
        const dist = Math.hypot(_toPlayer.x, _toPlayer.z);
        const targetYaw = Math.atan2(-_toPlayer.x, -_toPlayer.z);
        faceYaw(bot, targetYaw, dt, 8);
        // Strafe to stay at fighting distance and stay hard to hit.
        if (ctx.time > bot.strafeUntil) {
          bot.strafeDir = random() < 0.5 ? -1 : 1;
          bot.strafeUntil = ctx.time + range(random, 0.7, 1.6);
        }
        const strafeX = Math.cos(bot.yaw) * bot.strafeDir;
        const strafeZ = -Math.sin(bot.yaw) * bot.strafeDir;
        const approach = dist > 16 ? 0.7 : dist < 7 ? -0.5 : 0;
        const wishX = strafeX * 0.8 + (-Math.sin(bot.yaw)) * approach;
        const wishZ = strafeZ * 0.8 + (-Math.cos(bot.yaw)) * approach;
        const wishLen = Math.hypot(wishX, wishZ) || 1;
        bot.mover.step(dt, wishX / wishLen, wishZ / wishLen, BOT_SPEED * 0.7, BOT_ACCEL, BOT_FRICTION);
        bot.walkPhase += dt * 9;

        if (ctx.time >= bot.reactionAt && ctx.time >= bot.pauseUntil && ctx.playerAlive) {
          if (bot.burstLeft <= 0) {
            bot.burstLeft = BURST_MIN + Math.floor(random() * (BURST_MAX - BURST_MIN + 1));
            bot.nextShotAt = ctx.time;
          }
          if (ctx.time >= bot.nextShotAt) {
            bot.nextShotAt = ctx.time + SHOT_GAP;
            bot.burstLeft -= 1;
            fireAt(bot, ctx);
            if (bot.burstLeft <= 0) bot.pauseUntil = ctx.time + range(random, 0.6, 1.2);
          }
        }
        if (!sees && ctx.time - bot.lastSeenAt > 2.5) {
          bot.state = 'investigate';
          bot.investigateAt = bot.lastSeen.clone();
          bot.investigateUntil = ctx.time + 3;
          setRoute(bot, world.nearestWaypoint(bot.lastSeen.x, bot.lastSeen.z));
        }
        continue;
      }

      if (bot.state === 'defuse') {
        const spikePos = ctx.spikePos;
        const arrived = moveToward(bot, spikePos, dt, BOT_SPEED);
        if (arrived) {
          bot.defuseProgress += dt;
          faceYaw(bot, Math.atan2(-(spikePos.x - bot.mover.position.x), -(spikePos.z - bot.mover.position.z)), dt, 8);
          if (bot.defuseProgress >= 5) ctx.onDefused(bot);
        }
        continue;
      }

      if (bot.state === 'route') {
        const target = bot.route[bot.routeIndex];
        if (target === undefined) {
          bot.state = 'hold';
          continue;
        }
        const wp = world.waypoints[target];
        const arrived = moveToward(bot, wp.pos, dt);
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
          const arrived = moveToward(bot, bot.investigateAt, dt);
          if (arrived || ctx.time > bot.investigateUntil) {
            bot.state = 'hold';
            bot.investigateAt = null;
          }
        } else {
          bot.state = 'hold';
        }
        continue;
      }

      // hold: sweep the site, react to noise.
      bot.yaw += Math.sin(ctx.time * 0.5 + bot.scanPhase) * dt * 0.9;
      if (ctx.noise && ctx.time - ctx.noise.time < 1.2) {
        const dx = ctx.noise.pos.x - bot.mover.position.x;
        const dz = ctx.noise.pos.z - bot.mover.position.z;
        if (dx * dx + dz * dz < HEAR_DISTANCE * HEAR_DISTANCE) {
          bot.state = 'investigate';
          bot.investigateAt = ctx.noise.pos.clone();
          bot.investigateUntil = ctx.time + 3;
          setRoute(bot, world.nearestWaypoint(ctx.noise.pos.x, ctx.noise.pos.z));
        }
      }
    }

    // Apply positions and walk bob to the meshes.
    for (const bot of items) {
      bot.group.position.x = bot.mover.position.x;
      bot.group.position.z = bot.mover.position.z;
      bot.group.rotation.y = bot.yaw;
      if (bot.alive && (bot.state === 'route' || bot.state === 'engage' || bot.state === 'investigate' || bot.state === 'defuse')) {
        const bob = Math.sin(bot.walkPhase) * 0.04;
        bot.group.children[2].position.y = 0.28 + Math.max(0, bob);
        bot.group.children[3].position.y = 0.28 + Math.max(0, -bob);
      }
    }
  }

  function fireAt(bot, ctx) {
    _muzzle.set(
      bot.mover.position.x + Math.sin(bot.yaw) * -0.2,
      1.35,
      bot.mover.position.z + Math.cos(bot.yaw) * -0.2,
    );
    _aim.copy(ctx.playerPos);
    _aim.y = ctx.playerPos.y + 1.25;
    const dist = _muzzle.distanceTo(_aim);
    const spread = 0.02 + dist * 0.0011 + ctx.playerSpeed * 0.004 - (ctx.playerCrouching ? 0.008 : 0);
    _dir.subVectors(_aim, _muzzle).normalize();
    _dir.x += (random() * 2 - 1) * spread;
    _dir.y += (random() * 2 - 1) * spread;
    _dir.z += (random() * 2 - 1) * spread;
    _dir.normalize();
    raycaster.set(_muzzle, _dir);
    const targets = [ctx.playerHitbox, ...world.shootables];
    const hit = raycaster.intersectObjects(targets, false)[0];
    let damageDone = 0;
    let headshot = false;
    let end = _far.copy(_muzzle).addScaledVector(_dir, 60);
    if (hit) {
      end = hit.point;
      if (hit.object === ctx.playerHitbox) {
        headshot = hit.point.y > ctx.playerPos.y + 1.45;
        damageDone = headshot ? HEAD_DAMAGE : DAMAGE;
      }
    }
    // game.js copies both vectors into its tracer pool at once; nothing here allocates.
    ctx.onBotShot(bot, _muzzle, end, damageDone, headshot);
  }

  function reset() {
    for (let i = 0; i < items.length; i += 1) {
      const bot = items[i];
      const spawn = world.spawns.rust[i];
      bot.mover.position.set(spawn.x, 0, spawn.z);
      bot.mover.velocity.set(0, 0, 0);
      bot.group.position.copy(spawn);
      bot.group.rotation.set(0, Math.PI, 0);
      bot.group.position.y = 0;
      bot.health = HEALTH;
      bot.alive = true;
      bot.yaw = Math.PI;
      bot.fall = 0;
      bot.defuseProgress = 0;
      bot.lastSeenAt = -99;
      bot.burstLeft = 0;
      bot.pauseUntil = 0;
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
      return new THREE.Vector3(bot.mover.position.x, 1.25, bot.mover.position.z);
    },
  };
}
