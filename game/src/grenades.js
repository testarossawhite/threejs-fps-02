// Grenades: a frag that bounces, fuses and bursts, and a smoke that blooms into a
// cloud bots cannot see through. One pool of projectiles, reused every round.
import * as THREE from 'three';
import { PALETTE } from './palette.js';

const FRAG_FUSE = 1.4;
const FRAG_RADIUS = 5.5;
const FRAG_DAMAGE = 90;
const SMOKE_SECONDS = 12;
const POOL = 6;

const _toTarget = new THREE.Vector3();
const _ab = new THREE.Vector3();
const _ac = new THREE.Vector3();
const _closest = new THREE.Vector3();

export function createGrenades(scene, world) {
  const fragMaterial = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.steel), roughness: 0.4, metalness: 0.6 });
  const smokeMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(PALETTE.muted), transparent: true, opacity: 0.5,
    roughness: 1, depthWrite: false,
  });
  const flashMaterial = new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.accent), transparent: true, opacity: 0.9 });
  const items = [];
  for (let i = 0; i < POOL; i += 1) {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), fragMaterial);
    mesh.visible = false;
    scene.add(mesh);
    const cloud = new THREE.Group();
    for (let j = 0; j < 6; j += 1) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), smokeMaterial);
      puff.position.set((j % 3 - 1) * 1.1, 0.4 + (j % 2) * 0.9, Math.floor(j / 3) * 1.2 - 0.6);
      cloud.add(puff);
    }
    cloud.visible = false;
    scene.add(cloud);
    const flash = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 10), flashMaterial);
    flash.visible = false;
    scene.add(flash);
    items.push({
      mesh, cloud, flash, active: false, kind: 'frag', fuse: 0, left: 0,
      pos: new THREE.Vector3(), vel: new THREE.Vector3(), center: new THREE.Vector3(),
    });
  }

  function freeSlot() {
    for (const item of items) if (!item.active) return item;
    return items[0];
  }

  function throwGrenade(kind, from, dir) {
    const item = freeSlot();
    item.active = true;
    item.kind = kind;
    item.fuse = kind === 'frag' ? FRAG_FUSE : 0.9;
    item.left = kind === 'frag' ? 0 : SMOKE_SECONDS;
    item.pos.copy(from);
    item.vel.copy(dir).multiplyScalar(13);
    item.vel.y += 3.2;
    item.mesh.visible = true;
    item.mesh.position.copy(from);
    item.cloud.visible = false;
    item.flash.visible = false;
  }

  function explode(item, ctx) {
    item.active = false;
    item.mesh.visible = false;
    item.flash.visible = true;
    item.flash.position.copy(item.pos);
    item.flash.scale.setScalar(0.5);
    item.left = 0.18;
    ctx.onExplosion(item.pos.clone(), FRAG_RADIUS);
    // Damage falls off with distance; needs line of sight.
    const targets = [{ pos: ctx.playerPos, hit: (dmg) => ctx.damagePlayer(dmg, item.pos) }];
    for (const bot of ctx.bots) {
      if (bot.alive) targets.push({ pos: bot.mover.position, hit: (dmg) => ctx.damageBot(bot, dmg) });
    }
    // A frag does not check jerseys: teammates take it too.
    for (const ally of ctx.allies ?? []) {
      if (ally.alive) targets.push({ pos: ally.mover.position, hit: (dmg) => ctx.damageAlly(ally, dmg) });
    }
    for (const target of targets) {
      _toTarget.copy(target.pos).sub(item.pos);
      _toTarget.y = 0;
      const dist = _toTarget.length();
      if (dist > FRAG_RADIUS) continue;
      const eye = new THREE.Vector3(item.pos.x, item.pos.y + 0.3, item.pos.z);
      const chest = new THREE.Vector3(target.pos.x, target.pos.y + 1.1, target.pos.z);
      if (world.blockedBetween(eye, chest)) continue;
      target.hit(Math.round(FRAG_DAMAGE * (1 - dist / FRAG_RADIUS) + 10));
    }
  }

  function step(dt, ctx) {
    for (const item of items) {
      if (item.flash.visible) {
        item.left -= dt;
        item.flash.scale.addScalar(dt * 22);
        item.flash.material.opacity = Math.max(0, item.left / 0.18) * 0.9;
        if (item.left <= 0) item.flash.visible = false;
        continue;
      }
      if (!item.active) continue;
      if (item.kind === 'smoke' && item.cloud.visible) {
        item.left -= dt;
        const grow = 1 + (SMOKE_SECONDS - item.left) * 0.04;
        item.cloud.scale.setScalar(grow);
        smokeMaterial.opacity = Math.max(0.12, 0.5 * (item.left / SMOKE_SECONDS));
        if (item.left <= 0) {
          item.active = false;
          item.cloud.visible = false;
        }
        continue;
      }
      item.fuse -= dt;
      item.vel.y -= 14 * dt;
      item.pos.addScaledVector(item.vel, dt);
      if (item.pos.y < 0.09) {
        item.pos.y = 0.09;
        item.vel.y = Math.abs(item.vel.y) * 0.35;
        item.vel.x *= 0.7;
        item.vel.z *= 0.7;
      }
      item.mesh.position.copy(item.pos);
      if (item.fuse <= 0) {
        if (item.kind === 'frag') {
          explode(item, ctx);
        } else {
          item.mesh.visible = false;
          item.cloud.visible = true;
          item.cloud.position.copy(item.pos);
          item.cloud.scale.setScalar(1);
          item.center.copy(item.pos);
          item.left = SMOKE_SECONDS;
        }
      }
    }
  }

  function smokeBlocks(a, b) {
    for (const item of items) {
      if (!item.active || item.kind !== 'smoke' || !item.cloud.visible) continue;
      // Segment-sphere test against the cloud's centre, radius ~2.2.
      _ab.copy(b).sub(a);
      const lenSq = _ab.lengthSq();
      if (lenSq < 0.001) continue;
      _ac.copy(item.center).sub(a);
      const t = Math.max(0, Math.min(1, _ac.dot(_ab) / lenSq));
      _closest.copy(a).addScaledVector(_ab, t);
      if (_closest.distanceToSquared(item.center) < 2.2 * 2.2) return true;
    }
    return false;
  }

  function reset() {
    for (const item of items) {
      item.active = false;
      item.mesh.visible = false;
      item.cloud.visible = false;
      item.flash.visible = false;
    }
  }

  return { throwGrenade, step, smokeBlocks, reset };
}
