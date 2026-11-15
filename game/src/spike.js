import * as THREE from 'three';
const T = THREE;
import { PALETTE } from './palette.js';
import { PLANT_SECONDS,DEFUSE_SECONDS,SPIKE_SECONDS } from './state.js';
export function createSpike(scene,world) {
	const group = new T.Group();
	const body = new T.Mesh(
		new T.BoxGeometry(0.34,0.22,0.24),
		new T.MeshStandardMaterial({ color: new T.Color(PALETTE.accent),roughness: 0.4,metalness: 0.3 }),
	);
	body.castShadow = true;
	const light = new T.Mesh(
		new T.SphereGeometry(0.06,10,8),
		new T.MeshBasicMaterial({ color: new T.Color(PALETTE.accent) }),
	);
	light.position.set(0,0.16,0);
	const beacon = new T.Mesh(
		new T.CylinderGeometry(0.5,0.7,3.2,16,1,true),
		new T.MeshBasicMaterial({
			color: new T.Color(PALETTE.accent),transparent: true,opacity: 0.16,
			side: T.DoubleSide,depthWrite: false,
		}),
	);
	beacon.position.y = 1.6;
	group.add(body,light,beacon);
	group.visible = false;
	scene.add(group);
	const K = {
		status: 'carried',
		site: null,
		pos: new T.Vector3(),
		plantProgress: 0,
		timer: SPIKE_SECONDS,
		beepAt: 0,
	};
	function reset() {
		K.status = 'carried';
		K.site = null;
		K.plantProgress = 0;
		K.timer = SPIKE_SECONDS;
		group.visible = false;
	}
	function plantTick(dt,playerPos,onPlanted) {
		if (K.status !== 'carried') return;
		const site = world.siteAt(playerPos.x,playerPos.z);
		if (!site) {
			K.plantProgress = 0;
			return;
		}
		K.plantProgress += dt;
		if (K.plantProgress >= PLANT_SECONDS) {
			K.status = 'planted';
			K.site = site;
			K.pos.set(site.center.x,0.12,site.center.z);
			K.timer = SPIKE_SECONDS;
			K.beepAt = 0;
			group.position.copy(K.pos);
			group.visible = true;
			onPlanted(site);
		}
	}
	function step(dt,ctx) {
		if (K.status !== 'planted') return;
		K.timer -= dt;
		const interval = K.timer > 15 ? 1 : K.timer > 7 ? 0.5 : 0.25;
		K.beepAt += dt;
		const on = (K.beepAt % interval) < interval * 0.4;
		light.visible = on;
		beacon.material.opacity = on ? 0.22 : 0.08;
		if (K.beepAt >= interval && ctx.onBeep) {
			ctx.onBeep();
			K.beepAt = 0;
		}
		if (K.timer <= 0) {
			K.status = 'exploded';
			group.visible = false;
			ctx.onExploded(K.site);
		}
	}
	return {
		state: K,
		reset,
		plantTick,
		step,
		defused() {
			K.status = 'defused';
			group.visible = false;
		},
	};
}