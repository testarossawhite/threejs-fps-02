// The spike: carried by the player, planted at a site (hold E, 3 s, standing still),
// ticks 35 s while the Rust bots converge to defuse (5 s). Each outcome ends the round.
import * as THREE from 'three';
import { PALETTE } from './palette.js';
import { PLANT_SECONDS, DEFUSE_SECONDS, SPIKE_SECONDS } from './state.js';

export function createSpike(scene, world) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 0.22, 0.24),
    new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.accent), roughness: 0.4, metalness: 0.3 }),
  );
  body.castShadow = true;
  const light = new THREE.Mesh(
    new THREE.SphereGeometry(0.06, 10, 8),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.accent) }),
  );
  light.position.set(0, 0.16, 0);
  const beacon = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.7, 3.2, 16, 1, true),
    new THREE.MeshBasicMaterial({
      color: new THREE.Color(PALETTE.accent), transparent: true, opacity: 0.16,
      side: THREE.DoubleSide, depthWrite: false,
    }),
  );
  beacon.position.y = 1.6;
  group.add(body, light, beacon);
  group.visible = false;
  scene.add(group);

  const spike = {
    status: 'carried',
    site: null,
    pos: new THREE.Vector3(),
    plantProgress: 0,
    timer: SPIKE_SECONDS,
    beepAt: 0,
  };

  function reset() {
    spike.status = 'carried';
    spike.site = null;
    spike.plantProgress = 0;
    spike.timer = SPIKE_SECONDS;
    group.visible = false;
  }

  function plantTick(dt, playerPos, onPlanted) {
    if (spike.status !== 'carried') return;
    const site = world.siteAt(playerPos.x, playerPos.z);
    if (!site) {
      spike.plantProgress = 0;
      return;
    }
    spike.plantProgress += dt;
    if (spike.plantProgress >= PLANT_SECONDS) {
      spike.status = 'planted';
      spike.site = site;
      spike.pos.set(site.center.x, 0.12, site.center.z);
      spike.timer = SPIKE_SECONDS;
      spike.beepAt = 0;
      group.position.copy(spike.pos);
      group.visible = true;
      onPlanted(site);
    }
  }

  function step(dt, ctx) {
    if (spike.status !== 'planted') return;
    spike.timer -= dt;
    const interval = spike.timer > 15 ? 1 : spike.timer > 7 ? 0.5 : 0.25;
    spike.beepAt += dt;
    const on = (spike.beepAt % interval) < interval * 0.4;
    light.visible = on;
    beacon.material.opacity = on ? 0.22 : 0.08;
    if (spike.beepAt >= interval && ctx.onBeep) {
      ctx.onBeep();
      spike.beepAt = 0;
    }
    if (spike.timer <= 0) {
      spike.status = 'exploded';
      group.visible = false;
      ctx.onExploded(spike.site);
    }
  }

  return {
    state: spike,
    reset,
    plantTick,
    step,
    defused() {
      spike.status = 'defused';
      group.visible = false;
    },
  };
}
