import * as THREE from 'three';
const T = THREE;
	const P = Math.PI;
const V3 = T.Vector3;
const MS = T.Mesh;
import { PALETTE } from './palette.js';
import { gunMetalTexture,polymerTexture,camoTexture } from './textures.js';
export const WEAPONS = {
	pistol: {
		name: 'P-9 Sidearm',short: 'P-9',mag: 12,reserve: 36,gap: 0.22,reload: 1.1,
		damage: 34,headDamage: 68,auto: false,spreadStill: 0.003,spreadMove: 0.02,kick: 0.008,zoom: 1.3,
	},
	smg: {
		name: 'Dusk-9 SMG',short: 'Dusk-9',mag: 32,reserve: 96,gap: 0.075,reload: 1.6,
		damage: 26,headDamage: 60,auto: true,spreadStill: 0.006,spreadMove: 0.034,kick: 0.006,zoom: 1.35,
	},
	smg2: {
		name: 'KR-9 Kestrel',short: 'KR-9',mag: 40,reserve: 120,gap: 0.062,reload: 1.7,
		damage: 22,headDamage: 55,auto: true,spreadStill: 0.008,spreadMove: 0.04,kick: 0.005,zoom: 1.4,
	},
	shotgun: {
		name: 'BR-12 Breacher',short: 'BR-12',mag: 6,reserve: 24,gap: 0.85,reload: 2.4,
		damage: 11,headDamage: 22,auto: false,spreadStill: 0.055,spreadMove: 0.07,kick: 0.03,
		zoom: 1.25,pellets: 8,pump: true,
	},
	rifle: {
		name: 'VK-7 Carbine',short: 'VK-7',mag: 30,reserve: 90,gap: 0.096,reload: 1.9,
		damage: 34,headDamage: 100,auto: true,spreadStill: 0.0022,spreadMove: 0.028,kick: 0.01,zoom: 2,
	},
};
const MUZZLE_TIME = 0.06;
const ss = (a,b,x) => {
	const t = Math.max(0,Math.min(1,(x - a) / (b - a)));
	return t * t * (3 - 2 * t);
};
function rigMats(accent) {
	const M = (o) => new T.MeshStandardMaterial(o);
	return {
		metal: M({ map: gunMetalTexture('DW ARMORY'),roughness: 0.38,metalness: 0.68 }),
		polymer: M({ map: polymerTexture(),roughness: 0.82,metalness: 0.08 }),
		camo: M({ map: camoTexture(),roughness: 0.72,metalness: 0.05 }),
		steel: M({ color: '#7d848c',roughness: 0.3,metalness: 0.75 }),
		trim: M({ color: new T.Color(accent),roughness: 0.45,metalness: 0.2 }),
		lens: M({
			color: '#0e2a30',roughness: 0.15,metalness: 0.4,
			emissive: '#2b6f77',emissiveIntensity: 0.3,
		}),
		dot: M({
			color: '#200a06',roughness: 0.3,metalness: 0.2,
			emissive: '#ff2d1e',emissiveIntensity: 1.6,
		}),
		glove: M({ color: '#2a2521',roughness: 0.95,metalness: 0 }),
		sleeve: M({ map: camoTexture(),roughness: 0.9,metalness: 0 }),
	};
}
function buildGlove(m) {
	const hand = new T.Group();
	const palm = new MS(new T.SphereGeometry(0.05,10,8),m.glove);
	palm.scale.set(0.75,0.36,0.95);
	hand.add(palm);
	for (let i = 0; i < 4; i++) {
		const finger = new MS(new T.BoxGeometry(0.016,0.055,0.02),m.glove);
		finger.position.set(-0.027 + i * 0.018,-0.038,-0.028);
		finger.rotation.x = 0.5;
		hand.add(finger);
	}
	const thumb = new MS(new T.BoxGeometry(0.018,0.045,0.02),m.glove);
	thumb.position.set(0.045,-0.012,0.012);
	thumb.rotation.z = -0.5;
	hand.add(thumb);
	return hand;
}
function buildArm(m,yawSign) {
	const arm = new T.Group();
	const fore = new MS(new T.CapsuleGeometry(0.05,0.3,4,10),m.sleeve);
	fore.position.set(0.03 * yawSign,-0.045,0.21);
	fore.rotation.set(1.15,0.38 * yawSign,0);
	const cuff = new MS(new T.CylinderGeometry(0.06,0.066,0.1,10),m.polymer);
	cuff.position.set(0.008 * yawSign,-0.012,0.075);
	cuff.rotation.set(1.15,0.38 * yawSign,0);
	arm.add(fore,cuff,buildGlove(m));
	return arm;
}
function buildVM(def,m) {
	const model = new T.Group();
	const part = (parent,w,h,d,material,x,y,z,rotX = 0,rotY = 0,rotZ = 0) => {
		const mesh = new MS(new T.BoxGeometry(w,h,d),material);
		mesh.position.set(x,y,z);
		mesh.rotation.set(rotX,rotY,rotZ);
		parent.add(mesh);
		return mesh;
	};
	const tube = (parent,r,len,material,x,y,z,seg = 12) => {
		const mesh = new MS(new T.CylinderGeometry(r,r,len,seg),material);
		mesh.rotation.x = P / 2;
		mesh.position.set(x,y,z);
		parent.add(mesh);
		return mesh;
	};
	const tube2 = (parent,rRear,rFront,len,material,x,y,z) => {
		const mesh = new MS(new T.CylinderGeometry(rRear,rFront,len,12),material);
		mesh.rotation.x = P / 2;
		mesh.position.set(x,y,z);
		parent.add(mesh);
		return mesh;
	};
	const rail = (parent,z,len,y) => {
		part(parent,0.024,0.013,len,m.metal,0,y,z);
		for (let i = 0; i < Math.floor(len / 0.045); i++) part(parent,0.03,0.009,0.018,m.metal,0,y + 0.009,z - len / 2 + 0.028 + i * 0.045);
	};
	const dotSight = (parent,y,z) => {
		tube(parent,0.021,0.05,m.metal,0,y,z);
		tube(parent,0.015,0.004,m.dot,0,y,z + 0.026);
		part(parent,0.013,0.026,0.013,m.metal,0,y - 0.03,z);
	};
	const curveMag = (parent,mat,w,len,d,x,y,z,tilt) => {
		const mag = new T.Group();
		mag.position.set(x,y,z);
		parent.add(mag);
		for (let i = 0; i < 3; i++) part(mag,w,len,d,mat,0,-len * (0.5 + i),-0.016 * i * i,tilt + i * 0.17);
		part(mag,w + 0.012,0.018,d + 0.01,m.glove,0,-len * 3.02,-0.05,tilt + 0.42);
		return mag;
	};
	let muzzleZ = -0.21;
	let mag;
	let bolt;
	let gripL;
	let wellL;
	let magTravel = 0.13;
	if (def.short === 'P-9') {
		part(model,0.05,0.055,0.21,m.polymer,0,-0.015,-0.03);
		part(model,0.046,0.028,0.1,m.metal,0,0.008,-0.1);
		const slide = new T.Group();
		model.add(slide);
		part(slide,0.056,0.048,0.25,m.metal,0,0.052,-0.045);
		part(slide,0.038,0.014,0.24,m.metal,0,0.082,-0.045);
		part(slide,0.058,0.01,0.17,m.trim,0,0.029,-0.05);
		for (let i = 0; i < 3; i++) part(slide,0.06,0.034,0.008,m.polymer,0,0.052,0.048 + i * 0.017);
		for (let i = 0; i < 2; i++) part(slide,0.06,0.034,0.008,m.polymer,0,0.052,-0.128 - i * 0.017);
		part(slide,0.034,0.02,0.012,m.steel,0,0.09,0.062);
		part(slide,0.007,0.026,0.007,m.steel,0,0.092,-0.152);
		tube(slide,0.019,0.09,m.steel,0,0.05,-0.19);
		tube(slide,0.012,0.01,m.glove,0,0.05,-0.232);
		bolt = slide;
		part(model,0.01,0.042,0.085,m.polymer,0,-0.05,-0.055,0.12);
		part(model,0.008,0.036,0.01,m.steel,0,-0.048,-0.028,0.3);
		part(model,0.05,0.16,0.066,m.polymer,0,-0.115,0.048,0.26);
		part(model,0.052,0.09,0.018,m.polymer,0,-0.095,0.086,0.26);
		part(model,0.05,0.018,0.045,m.polymer,0,-0.026,0.082);
		mag = part(model,0.04,0.115,0.054,m.metal,0,-0.2,0.068,0.26);
		part(mag,0.05,0.016,0.064,m.polymer,0,-0.062,0.002);
		magTravel = 0.1;
		gripL = new V3(-0.012,-0.125,0.062);
		wellL = new V3(-0.01,-0.21,0.07);
		muzzleZ = -0.26;
	} else if (def.short === 'Dusk-9') {
		tube(model,0.048,0.36,m.metal,0,0.01,-0.08);
		part(model,0.055,0.05,0.3,m.polymer,0,-0.045,-0.06);
		tube(model,0.052,0.16,m.polymer,0,0.01,-0.33);
		for (const z of [-0.27,-0.33,-0.39]) tube(model,0.0545,0.012,m.metal,0,0.01,z);
		tube(model,0.016,0.12,m.steel,0,0.01,-0.47);
		tube2(model,0.02,0.024,0.05,m.metal,0,0.01,-0.545);
		for (const sx of [-1,1]) part(model,0.006,0.042,0.02,m.metal,0.02 * sx,0.048,-0.42);
		part(model,0.007,0.03,0.007,m.steel,0,0.055,-0.42);
		dotSight(model,0.088,0.03);
		part(model,0.048,0.12,0.055,m.polymer,0,-0.115,0.06,0.35);
		mag = curveMag(model,m.metal,0.045,0.075,0.06,0,-0.06,-0.05,0.08);
		bolt = part(model,0.05,0.014,0.032,m.steel,0,0.066,-0.17);
		for (const sx of [-1,1]) tube(model,0.011,0.15,m.steel,0.02 * sx,-0.005,0.18);
		part(model,0.06,0.07,0.045,m.metal,0,0.005,0.115);
		part(model,0.075,0.11,0.024,m.polymer,0,-0.005,0.265,0.08);
		gripL = new V3(0,-0.1,-0.33);
		wellL = new V3(-0.01,-0.17,-0.05);
		muzzleZ = -0.6;
	} else if (def.short === 'KR-9') {
		part(model,0.075,0.11,0.3,m.polymer,0,0,0.16);
		part(model,0.06,0.032,0.17,m.polymer,0,0.071,0.17);
		part(model,0.078,0.12,0.02,m.glove,0,0,0.315);
		part(model,0.07,0.09,0.24,m.metal,0,0.005,-0.08);
		part(model,0.004,0.028,0.08,m.glove,0.037,0.02,0.08);
		rail(model,-0.04,0.24,0.058);
		dotSight(model,0.098,-0.1);
		part(model,0.072,0.08,0.18,m.polymer,0,-0.005,-0.28);
		for (let i = 0; i < 3; i++) part(model,0.076,0.018,0.02,m.glove,0,0.012,-0.22 - i * 0.05);
		tube(model,0.014,0.07,m.steel,0,0.015,-0.385);
		tube2(model,0.036,0.032,0.2,m.metal,0,0.015,-0.49);
		tube(model,0.027,0.016,m.glove,0,0.015,-0.595);
		part(model,0.01,0.04,0.075,m.polymer,0,-0.048,-0.06,0.1);
		part(model,0.047,0.12,0.055,m.polymer,0,-0.108,0,0.4);
		mag = curveMag(model,m.camo,0.046,0.065,0.06,0,-0.055,0.15,0.04);
		bolt = part(model,0.014,0.02,0.05,m.steel,0.045,0.032,-0.04);
		part(model,0.04,0.085,0.042,m.polymer,0,-0.08,-0.29,0.18);
		gripL = new V3(0,-0.095,-0.29);
		wellL = new V3(-0.01,-0.16,0.15);
		muzzleZ = -0.62;
	} else if (def.short === 'BR-12') {
		part(model,0.072,0.085,0.3,m.metal,0,0.01,0.03);
		part(model,0.05,0.02,0.2,m.metal,0,0.062,0.02);
		tube(model,0.025,0.44,m.steel,0,0.045,-0.3);
		tube2(model,0.025,0.028,0.05,m.metal,0,0.045,-0.545);
		part(model,0.008,0.02,0.008,m.steel,0,0.082,-0.52);
		tube(model,0.017,0.4,m.metal,0,-0.028,-0.28);
		tube(model,0.02,0.02,m.steel,0,-0.028,-0.485);
		bolt = new T.Group();
		bolt.position.set(0,-0.028,-0.3);
		model.add(bolt);
		tube(bolt,0.033,0.15,m.polymer,0,0,0);
		for (let i = 0; i < 4; i++) tube(bolt,0.0365,0.012,m.polymer,0,0,-0.056 + i * 0.037);
		for (const sz of [-0.03,0.035]) tube(model,0.011,0.055,m.trim,-0.046,0.005,sz);
		part(model,0.048,0.12,0.055,m.polymer,0,-0.105,0.13,0.4);
		part(model,0.06,0.1,0.22,m.polymer,0,-0.008,0.3,0.05);
		part(model,0.062,0.115,0.02,m.glove,0,-0.014,0.412,0.05);
		mag = part(model,0.04,0.03,0.09,m.glove,0,-0.055,-0.02);
		magTravel = 0.05;
		gripL = new V3(0,-0.05,-0.3);
		wellL = new V3(-0.01,-0.12,-0.02);
		muzzleZ = -0.59;
	} else {
		part(model,0.07,0.075,0.24,m.metal,0,-0.01,0.02);
		part(model,0.062,0.055,0.34,m.metal,0,0.045,-0.06);
		rail(model,-0.08,0.3,0.08);
		part(model,0.004,0.03,0.09,m.glove,0.036,0.045,-0.02);
		bolt = part(model,0.04,0.013,0.03,m.steel,0,0.075,0.115);
		part(model,0.06,0.05,0.095,m.metal,0,-0.052,-0.03,0.08);
		mag = curveMag(model,m.camo,0.046,0.07,0.056,0,-0.06,-0.03,0.05);
		part(model,0.047,0.125,0.055,m.polymer,0,-0.115,0.09,0.42);
		tube(model,0.032,0.3,m.polymer,0,0.02,-0.35,8);
		for (let i = 0; i < 4; i++) part(model,0.02,0.012,0.042,m.metal,0,0.062,-0.24 - i * 0.07);
		part(model,0.034,0.095,0.042,m.polymer,0,-0.048,-0.38,0.32);
		part(model,0.03,0.048,0.032,m.metal,0,0.038,-0.5);
		part(model,0.007,0.046,0.007,m.steel,0,0.078,-0.5);
		tube(model,0.015,0.24,m.steel,0,0.02,-0.56);
		tube2(model,0.017,0.023,0.07,m.metal,0,0.02,-0.715);
		for (const rz of [-0.7,-0.728]) tube(model,0.0245,0.009,m.glove,0,0.02,rz);
		for (const mz of [-0.03,-0.15]) part(model,0.016,0.028,0.016,m.metal,0,0.09,mz);
		tube(model,0.019,0.2,m.metal,0,0.11,-0.09);
		tube2(model,0.019,0.024,0.05,m.metal,0,0.11,-0.215);
		tube2(model,0.022,0.018,0.04,m.metal,0,0.11,0.032);
		tube(model,0.016,0.005,m.lens,0,0.11,0.054);
		part(model,0.018,0.02,0.018,m.metal,0,0.128,-0.09);
		tube(model,0.017,0.14,m.metal,0,0.03,0.18);
		part(model,0.055,0.1,0.2,m.polymer,0,0.002,0.31,0.05);
		part(model,0.05,0.032,0.13,m.polymer,0,0.062,0.29);
		part(model,0.058,0.115,0.02,m.glove,0,-0.004,0.415,0.05);
		gripL = new V3(0,-0.065,-0.38);
		wellL = new V3(-0.01,-0.17,-0.03);
		muzzleZ = -0.77;
	}
	const handR = buildArm(m,1);
	handR.position.set(0.005,-0.1,def.short === 'P-9' ? 0.055 : 0.105);
	if (def.short !== 'P-9') handR.rotation.x = 0.28;
	model.add(handR);
	const handL = buildArm(m,-1);
	handL.position.copy(gripL);
	model.add(handL);
	model.position.set(0.24,-0.165,-0.42);
	return {
		model,muzzleZ: muzzleZ - 0.42,mag,bolt,handL,gripL,wellL,magTravel,
		magBaseY: mag.position.y,boltBaseZ: bolt.position.z,
	};
}
export function createWeapons(camera) {
	const materials = rigMats(PALETTE.accent);
	const built = {};
	const flash = new MS(
		new T.PlaneGeometry(0.15,0.15),
		new T.MeshBasicMaterial({ color: new T.Color(PALETTE.accent),transparent: true,opacity: 0.85,depthWrite: false,side: T.DoubleSide }),
	);
	flash.visible = false;
	camera.add(flash);
	const fLight = new T.PointLight(new T.Color(PALETTE.accent),0,5);
	camera.add(fLight);
	const rigLight = new T.PointLight('#ffd9a8',0.85,2.6,1.6);
	rigLight.position.set(-0.25,0.18,0.15);
	camera.add(rigLight);
	const muzzles = {};
	for (const key of Object.keys(WEAPONS)) {
		built[key] = buildVM(WEAPONS[key],materials);
		built[key].model.visible = key === 'pistol';
		camera.add(built[key].model);
		muzzles[key] = built[key].muzzleZ;
	}
	const state = {
		current: 'pistol',
		mag: WEAPONS.pistol.mag,
		reserve: WEAPONS.pistol.reserve,
		cooldown: 0,
		reloadLeft: 0,
		flash: 0,
		kick: 0,
		ads: 0,
		inspectT: 0,
		pumpT: 0,
		frags: 0,
		smokes: 0,
		flashes: 0,
		selectedGrenade: 'frag',
	};
	flash.position.set(0.24,-0.17,muzzles.pistol - 0.02);
	flash.scale.setScalar(0.8);
	fLight.position.set(0.24,-0.16,muzzles.pistol + 0.3);
	let time = 0;
	let bobPhase = 0;
	let smoothSpeed = 0;
	function def() {
		return WEAPONS[state.current];
	}
	function rig() {
		return built[state.current];
	}
	function select(name) {
		if (!WEAPONS[name] || name === state.current) return;
		state.current = name;
		state.mag = WEAPONS[name].mag;
		state.reserve = WEAPONS[name].reserve;
		state.cooldown = 0;
		state.reloadLeft = 0;
		for (const key of Object.keys(built)) {
			built[key].model.visible = key === name;
			built[key].mag.position.y = built[key].magBaseY;
			built[key].bolt.position.z = built[key].boltBaseZ;
			built[key].handL.position.copy(built[key].gripL);
		}
		flash.position.set(0.24,-0.17,muzzles[name] - 0.02);
		flash.scale.setScalar(name === 'rifle' ? 1.3 : name === 'shotgun' ? 1.6 : name === 'smg' || name === 'smg2' ? 1.05 : 0.8);
		fLight.position.set(0.24,-0.16,muzzles[name] + 0.3);
	}
	function step(dt,speed = 0,aiming = false) {
		time += dt;
		smoothSpeed += (speed - smoothSpeed) * Math.min(1,dt * 8);
		const moveAmt = Math.min(1,smoothSpeed / 5.2);
		bobPhase += dt * (1.5 + smoothSpeed * 1.5);
		state.cooldown = Math.max(0,state.cooldown - dt);
		state.flash = Math.max(0,state.flash - dt);
		state.kick += (0 - state.kick) * Math.min(1,dt * 14);
		state.ads += ((aiming && state.reloadLeft === 0 ? 1 : 0) - state.ads) * Math.min(1,dt * 11);
		state.inspectT = Math.max(0,state.inspectT - dt);
		state.pumpT = Math.max(0,state.pumpT - dt);
		const r = rig();
		const model = r.model;
		const swayAmt = 1 - state.ads * 0.9;
		const swayX = (Math.sin(bobPhase) * 0.007 * moveAmt + Math.sin(time * 1.7) * 0.0016) * swayAmt;
		const swayY = (-Math.abs(Math.cos(bobPhase)) * 0.008 * moveAmt + Math.sin(time * 2.3) * 0.0013) * swayAmt;
		const hipX = 0.24 + swayX;
		const hipY = -0.165 + swayY;
		model.position.set(
			hipX + (0 - hipX) * state.ads,
			hipY + (-0.118 - hipY) * state.ads,
			-0.42 + state.kick + state.ads * 0.08,
		);
		flash.visible = state.flash > 0;
		flash.rotation.z = state.flash * 30;
		fLight.intensity = state.flash > 0 ? 18 : 0;
		let dip = 0;
		let magOut = 0;
		let rack = 0;
		if (state.reloadLeft > 0) {
			state.reloadLeft = Math.max(0,state.reloadLeft - dt);
			const p = 1 - state.reloadLeft / def().reload;
			dip = -0.55 * Math.pow(Math.sin(P * Math.min(1,p * 1.08)),1.2);
			magOut = ss(0.12,0.3,p) * (1 - ss(0.55,0.78,p));
			rack = ss(0.8,0.87,p) * (1 - ss(0.9,0.99,p));
			if (state.reloadLeft === 0) {
				const need = def().mag - state.mag;
				const take = Math.min(need,state.reserve);
				state.mag += take;
				state.reserve -= take;
			}
		}
		r.mag.position.y = r.magBaseY - r.magTravel * magOut;
		const pumpCurve = def().pump && state.pumpT > 0 ? Math.sin((1 - state.pumpT / 0.38) * P) * 0.11 : 0;
		r.bolt.position.z = r.boltBaseZ + rack * 0.04 + state.kick * 0.3 + pumpCurve;
		r.handL.position.lerpVectors(r.gripL,r.wellL,magOut);
		if (def().pump) r.handL.position.z += pumpCurve * (1 - magOut);
		let rotY = swayX * 0.7 + state.kick * 0.35;
		let rotX = state.kick * 2.2 + dip;
		if (state.inspectT > 0) {
			const p = 1 - state.inspectT / 1.15;
			const arc = Math.sin(p * P);
			rotY += arc * 0.85;
			rotX += arc * 0.3;
		}
		model.rotation.set(rotX,rotY,swayX * 0.4 + Math.sin(bobPhase) * 0.006 * moveAmt * swayAmt);
	}
	select('pistol');
	return {
		state,
		def,
		step,
		select,
		ready() {
			return state.mag > 0 && state.cooldown === 0 && state.reloadLeft === 0 && state.inspectT === 0;
		},
		adsAmount() {
			return state.ads;
		},
		inspect() {
			if (state.reloadLeft === 0 && state.inspectT === 0) state.inspectT = 1.15;
		},
		pullTrigger() {
			state.cooldown = def().gap;
			state.flash = MUZZLE_TIME;
			state.kick = 0.055;
			if (def().pump) state.pumpT = 0.38;
		},
		takeRound() {
			if (state.mag <= 0) return false;
			state.mag--;
			return true;
		},
		reload() {
			if (state.reloadLeft > 0 || state.mag === def().mag || state.reserve === 0) return;
			state.reloadLeft = def().reload;
		},
		spread(speed) {
			const d = def();
			return d.spreadStill + Math.min(1,speed / 5.2) * d.spreadMove;
		},
		equip(loadout) {
			select(loadout.primary);
			state.mag = def().mag;
			state.reserve = def().reserve;
			state.cooldown = 0;
			state.reloadLeft = 0;
			state.flash = 0;
			state.kick = 0;
			state.frags = loadout.frags;
			state.smokes = loadout.smokes;
			state.flashes = loadout.flashes ?? 0;
			state.selectedGrenade = state.frags > 0 ? 'frag' : state.smokes > 0 ? 'smoke' : 'flash';
		},
	};
}