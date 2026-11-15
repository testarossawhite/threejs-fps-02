import * as THREE from 'three';
const T = THREE;
	const P = Math.PI;
const NC = (c) => new T.Color(c);
const V3 = T.Vector3;
const BG = T.BoxGeometry;
const MS = T.Mesh;
const MM = T.MeshStandardMaterial;
const CY = T.CylinderGeometry;
const PG = T.PlaneGeometry;
const SM = T.SpriteMaterial;
import { PALETTE } from './palette.js';
import {
	groundTexture,wallTexture,crateTexture,containerTexture,barrelTexture,
	concreteTexture,hazardTexture,skyTexture,cloudTexture,glowTexture,
	decalTexture,posterTexture,buildingTexture,flatTex,fenceTexture,
} from './textures.js';
const WALL_H = 4.6;
const HALF_X = 20;
const HALF_Z = 18;
const WAYPOINTS = [
	[0,15,[1,2,3]],
	[0,10,[0,2,3,6]],
	[-8,10,[0,1,4,7]],
	[8,10,[0,1,5,8]],
	[-8,2,[2,6,7,9]],
	[8,2,[3,6,8,10]],
	[0,2,[1,4,5,11]],
	[-14,2,[2,4,9]],
	[14,2,[3,5,10]],
	[-14,-6,[7,4,12,16]],
	[14,-6,[8,5,14,17]],
	[0,-6,[6,13,15]],
	[-12,-12,[9,13,16]],
	[-6,-12,[11,12,15]],
	[12,-10,[10,15,17]],
	[6,-12,[11,13,14]],
	[-14,-14,[9,12]],
	[14,-14,[10,14]],
];
function makeSign(text,sub,color) {
	const canvas = document.createElement('canvas');
	canvas.width = 512;
	canvas.height = 128;
	const ctx = canvas.getContext('2d');
	ctx.fillStyle = '#1d150e';
	ctx.fillRect(0,0,512,128);
	ctx.strokeStyle = color;
	ctx.lineWidth = 5;
	ctx.strokeRect(6,6,500,116);
	ctx.fillStyle = color;
	ctx.fillRect(6,6,500,12);
	ctx.fillStyle = '#f4ead2';
	ctx.font = 'bold 52px system-ui, sans-serif';
	ctx.textBaseline = 'middle';
	ctx.fillText(text,26,60);
	ctx.fillStyle = '#b3a189';
	ctx.font = '28px system-ui, sans-serif';
	ctx.fillText(sub,26,103);
	return flatTex(canvas,4);
}
function std(map,color,roughness,metalness) {
	return new MM({
		map,color: NC(color),roughness,metalness,
	});
}
export function createWorld(scene) {
	const G = new T.Group();
	scene.add(G);
	const mats = {};
	for (const name of Object.keys(PALETTE)) {
		mats[name] = new MM({
			color: NC(PALETTE[name]),
			roughness: name === 'accent' || name === 'ink' ? 0.55 : 0.92,
			metalness: name === 'steel' ? 0.55 : 0.03,
		});
	}
	const groundMat = std(groundTexture(),'#b3aa99',0.96,0.0);
	const wallMat = std(wallTexture(7),'#d3bda0',0.85,0.12);
	const wallMatLong = std(wallTexture(9),'#d3bda0',0.85,0.12);
	const crM = std(crateTexture(),'#c8a06a',0.9,0.0);
	const ccM = std(concreteTexture(),'#bfae94',0.94,0.0);
	const cS = std(containerTexture(),'#7e8f99',0.58,0.38);
	const cR = std(containerTexture(),'#a05f36',0.68,0.25);
	const siloMat = std(containerTexture(),'#98a0a4',0.5,0.5);
	const bR = std(barrelTexture(),'#b0492f',0.55,0.3);
	const bS = std(barrelTexture(),'#77828a',0.5,0.45);
	const bA = std(barrelTexture(),'#c07f2a',0.55,0.3);
	const hazardMat = std(hazardTexture(),'#e8e2d4',0.8,0.05);
	const wallConc = std(concreteTexture(),'#c9c2b4',0.94,0.0);
	const wallCorr = std(containerTexture(),'#8d9aa0',0.6,0.35);
	const wallPaint = std(concreteTexture(),'#7d9b96',0.9,0.0);
	const wallHoard = std(crateTexture(),'#8a7355',0.95,0.0);
	const fenceMat = new MM({
		map: fenceTexture(),color: NC('#aeb6ba'),roughness: 0.5,metalness: 0.6,
		transparent: true,alphaTest: 0.3,side: T.DoubleSide,
	});
	const glowA = new MM({
		color: NC(PALETTE.accent),emissive: NC(PALETTE.accent),
		emissiveIntensity: 1.8,roughness: 0.4,
	});
	const glowB = new MM({
		color: NC(PALETTE.siteB),emissive: NC(PALETTE.siteB),
		emissiveIntensity: 1.6,roughness: 0.4,
	});
	const colliders = [];
	const shootables = [];
	const raycaster = new T.Raycaster();
	raycaster.far = 90;
	function box(w,h,d,x,y,z,material,collide = true) {
		const mesh = new MS(new BG(w,h,d),mats[material] ?? material);
		mesh.position.set(x,y,z);
		mesh.castShadow = true;
		mesh.receiveShadow = true;
		G.add(mesh);
		if (collide) {
			colliders.push(new T.Box3().setFromObject(mesh));
			shootables.push(mesh);
		}
		return mesh;
	}
	function cyl(rTop,rBottom,h,x,y,z,material,segments = 18) {
		const mesh = new MS(new CY(rTop,rBottom,h,segments),mats[material] ?? material);
		mesh.position.set(x,y,z);
		mesh.castShadow = true;
		mesh.receiveShadow = true;
		G.add(mesh);
		colliders.push(new T.Box3().setFromObject(mesh));
		shootables.push(mesh);
		return mesh;
	}
	function fMark(w,d,x,z,material,opacity = 0.85) {
		const mesh = new MS(
			new PG(w,d),
			new MM({
				color: NC(PALETTE[material]),roughness: 0.9,
				transparent: true,opacity,
			}),
		);
		mesh.rotation.x = -P / 2;
		mesh.position.set(x,0.02,z);
		mesh.receiveShadow = true;
		G.add(mesh);
		return mesh;
	}
	function gStr(w,h,d,x,y,z,material) {
		const mesh = new MS(new BG(w,h,d),material);
		mesh.position.set(x,y,z);
		G.add(mesh);
		return mesh;
	}
	const sky = new MS(
		new T.SphereGeometry(135,28,14),
		new T.MeshBasicMaterial({ map: skyTexture(),side: T.BackSide,fog: false,depthWrite: false }),
	);
	sky.renderOrder = -10;
	scene.add(sky);
	const glowTex = glowTexture();
	const sunHalo = new T.Sprite(new SM({
		map: glowTex,color: NC('#fff3c4'),transparent: true,opacity: 0.95,
		fog: false,depthWrite: false,
	}));
	sunHalo.position.set(58,76,44);
	sunHalo.scale.set(64,64,1);
	scene.add(sunHalo);
	const cloudTex = cloudTexture();
	const cloudSpots = [
		[-70,52,-60,90],[40,58,-80,110],[85,46,30,80],[-30,62,85,95],[10,50,-105,75],
	];
	for (const [x,y,z,s] of cloudSpots) {
		const cloud = new T.Sprite(new SM({
			map: cloudTex,transparent: true,opacity: 0.9,fog: false,depthWrite: false,
		}));
		cloud.position.set(x,y,z);
		cloud.scale.set(s,s * 0.42,1);
		scene.add(cloud);
	}
	const sil = new T.MeshBasicMaterial({ color: NC('#5d6a75') });
	const silF = new T.MeshBasicMaterial({ color: NC('#8b98a3') });
	const facadeTex = buildingTexture();
	const facN = new T.MeshBasicMaterial({ map: facadeTex,color: NC('#c3ccd2') });
	const facF = new T.MeshBasicMaterial({ map: facadeTex,color: NC('#d3dde6') });
	const facN2 = new T.MeshBasicMaterial({ map: buildingTexture(777),color: NC('#bfae94') });
	const facGlass = new T.MeshBasicMaterial({ map: buildingTexture(31337),color: NC('#9fc4de') });
	function sBox(w,h,d,x,y,z,far = false) {
		const mesh = new MS(new BG(w,h,d),far ? silF : sil);
		mesh.position.set(x,y,z);
		scene.add(mesh);
		return mesh;
	}
	function fBox(w,h,d,x,y,z,far = false) {
		const mesh = new MS(new BG(w,h,d),far === 2 ? facGlass : far === 3 ? facN2 : far ? facF : facN);
		mesh.position.set(x,y,z);
		scene.add(mesh);
		return mesh;
	}
	sBox(1.4,21,1.4,-31,10.5,-27);
	sBox(17,1.1,1.1,-25,20.6,-27);
	sBox(5,0.9,0.9,-35.5,20.6,-27);
	sBox(0.18,6.5,0.18,-19.5,17,-27);
	sBox(1.6,1.6,1.6,-19.5,13.4,-27);
	for (const [x,h] of [[27,17],[31.5,21]]) {
		const stack = new MS(new CY(1.5,1.9,h,12),sil);
		stack.position.set(x,h / 2,-26);
		scene.add(stack);
	}
	for (const [x,z] of [[-29.5,15],[-25.5,15],[-27.5,12.6],[-27.5,17.4]]) sBox(0.5,9,0.5,x,4.5,z);
	const tank = new MS(new CY(3.1,3.1,4.4,14),sil);
	tank.position.set(-27.5,11.4,15);
	scene.add(tank);
	const tankRoof = new MS(new CY(0.3,3.2,1.8,14),sil);
	tankRoof.position.set(-27.5,14.5,15);
	scene.add(tankRoof);
	sBox(7,2.6,2.6,29,1.3,6,true);
	sBox(7,2.6,2.6,29,3.9,6.4,true);
	sBox(6,2.6,2.6,-6,1.3,-29,true);
	for (const [w,h,d,x,y,z,f] of [
		[30,8.5,2.5,4,4.25,-31.5,1],[11,15,9,-27,7.5,-33,3],[9,11,8,24,5.5,-34,1],[13,18,10,36,9,-18,2],
		[10,12,9,-36,6,-14,0],[12,9,9,-34,4.5,22,0],[9,14,8,33,7,24,1],[14,10,9,8,5,36,1],[10,16,9,-16,8,35,1],
	]) fBox(w,h,d,x,y,z,f);
	function rBox(w,h,d,x,y,z,m) {
		const mesh = new MS(new BG(w,h,d),m);
		mesh.position.set(x,y,z);
		scene.add(mesh);
		return mesh;
	}
	for (const [bx,bz,top,bw,bd,far,gear] of [
		[4,-31.5,8.5,30,2.5,1,27],[-27,-33,15,11,9,1,5],[24,-34,11,9,8,1,1],[36,-18,18,13,10,1,3],
		[-36,-14,12,10,9,0,1],[-34,22,9,12,9,0,1],[33,24,14,9,8,1,21],[8,36,10,14,9,1,3],[-16,35,16,10,9,1,9],
	]) {
		const m = far ? silF : sil;
		rBox(bw + 0.7,0.55,bd + 0.7,bx,top + 0.27,bz,m);
		rBox(bw + 0.4,0.3,bd + 0.4,bx,top - 0.35,bz,m);
		if (gear & 8) rBox(bw * 0.55,1.6,bd * 0.55,bx - bw * 0.12,top + 0.8,bz,m);
		if (gear & 16) { rBox(3.2,0.55,0.8,bx + bw * 0.18,top + 0.28,bz + bd * 0.2,m); rBox(0.8,1.1,0.8,bx + bw * 0.18 + 1.2,top + 0.55,bz + bd * 0.2,m); }
		if (gear & 1) {
			rBox(2.3,1.15,1.7,bx - bw * 0.28,top + 0.58,bz,m);
			rBox(1.7,0.85,1.4,bx + bw * 0.3,top + 0.43,bz + bd * 0.15,m);
		}
		if (gear & 2) {
			const mast = new MS(new CY(0.07,0.1,4.6,6),m);
			mast.position.set(bx + bw * 0.36,top + 2.8,bz);
			scene.add(mast);
			rBox(1.7,0.09,0.09,bx + bw * 0.36,top + 4.4,bz,m);
		}
		if (gear & 4) {
			rBox(3.4,0.5,3.4,bx,top + 0.25,bz,m);
			const tk = new MS(new CY(1.5,1.5,2.4,12),m);
			tk.position.set(bx,top + 1.7,bz);
			scene.add(tk);
			const roof = new MS(new CY(0.25,1.65,0.9,12),m);
			roof.position.set(bx,top + 3.35,bz);
			scene.add(roof);
		}
	}
	rBox(30.4,0.3,0.2,4,5.7,-30.18,silF);
	rBox(30.4,0.3,0.2,4,2.9,-30.18,silF);
	for (const sx of [-8,-2.7,2.7,8]) rBox(0.12,3.4,0.12,4 + sx,10.2,-30.3,silF);
	rBox(17,0.14,0.7,4,9.6,-30.3,silF);
	rBox(17,0.14,0.7,4,11.2,-30.3,silF);
	const shutter = new MS(new PG(3.2,2.7),cS);
	shutter.position.set(19.96,1.35,-12.27);
	shutter.rotation.y = -P / 2;
	G.add(shutter);
	const awn = box(0.9,0.06,3.6,19.55,2.95,-12.27,hazardMat,false);
	awn.rotation.z = 0.3;
	const door = new MS(new PG(1.1,2.2),mats.ink);
	door.position.set(6,1.1,-17.98);
	G.add(door);
	box(HALF_X * 2 + 0.8,0.4,HALF_Z * 2 + 0.8,0,-0.2,0,groundMat);
	for (const [cx,m] of [[-13.6,wallCorr],[0,wallConc],[13.6,wallPaint]]) box(13.6,WALL_H,0.4,cx,WALL_H / 2,-HALF_Z - 0.2,m);
	for (const [cx,m] of [[-13.6,wallConc],[0,fenceMat],[13.6,wallHoard]]) box(13.6,WALL_H,0.4,cx,WALL_H / 2,HALF_Z + 0.2,m);
	for (const [cz,m] of [[-12.27,wallCorr],[0,wallHoard],[12.27,wallConc]]) box(0.4,WALL_H,12.27,-HALF_X - 0.2,WALL_H / 2,cz,m);
	for (const [cz,m] of [[-12.27,wallPaint],[0,wallConc],[12.27,wallMat]]) box(0.4,WALL_H,12.27,HALF_X + 0.2,WALL_H / 2,cz,m);
	for (const px of [-6.8,0,6.8]) gStr(0.09,WALL_H,0.09,px,WALL_H / 2,HALF_Z + 0.2,mats.steel);
	gStr(13.6,0.07,0.07,0,WALL_H - 0.05,HALF_Z + 0.2,mats.steel);
	gStr(13.6,0.45,0.03,13.6,3.95,-17.97,mats.siteB);
	gStr(0.03,0.45,12.27,19.97,3.95,-12.27,mats.accent);
	for (const s of [-1,1]) {
		box(0.55,0.18,HALF_Z * 2 + 0.8,s * (HALF_X + 0.2),WALL_H + 0.09,0,'steel',false);
		box(HALF_X * 2 + 0.8,0.18,0.55,0,WALL_H + 0.09,s * (HALF_Z + 0.2),'steel',false);
	}
	for (const px of [-15,-7.5,0,7.5,15]) {
		box(0.55,WALL_H,0.26,px,WALL_H / 2,-17.92,ccM);
		box(0.55,WALL_H,0.26,px,WALL_H / 2,17.92,ccM);
	}
	for (const pz of [-12,0,12]) {
		box(0.26,WALL_H,0.55,-19.92,WALL_H / 2,pz,ccM);
		box(0.26,WALL_H,0.55,19.92,WALL_H / 2,pz,ccM);
	}
	box(10,0.5,8,-12,0.25,-12,ccM);
	gStr(10,0.1,0.22,-12,0.52,-8.05,glowA);
	gStr(10,0.1,0.22,-12,0.52,-15.95,glowA);
	gStr(0.22,0.1,8,-16.95,0.52,-12,glowA);
	gStr(0.22,0.1,8,-7.05,0.52,-12,glowA);
	box(3.2,3.4,2.4,-15.5,1.7,-15.5,wallCorr);
	const furnaceMouth = new MS(new PG(1.8,1.4),glowA);
	furnaceMouth.position.set(-13.9,1.3,-15.5);
	furnaceMouth.rotation.y = P / 2;
	G.add(furnaceMouth);
	cyl(0.5,0.7,5.4,-16.6,2.7,-16.2,'steel');
	box(1.4,1.1,1.4,-8.6,0.55,-14.6,crM);
	box(1.4,1.1,1.4,-8.6,0.55,-9.4,crM);
	fMark(7,6,-12,-12,'accent',0.32);
	const signA = new MS(
		new PG(5.2,1.3),
		new T.MeshBasicMaterial({ map: makeSign('SITE A','FOUNDRY','#f0a63e') }),
	);
	signA.position.set(-12,3.4,-17.7);
	G.add(signA);
	box(4.8,2.4,2.4,13.5,1.2,-13.5,cS);
	box(4.8,2.4,2.4,13.5,3.6,-13.5,cR);
	box(2.4,2.4,4.8,8.2,1.2,-15.2,cR);
	box(1.4,1.1,1.4,15.8,0.55,-8.6,crM);
	box(1.4,1.1,1.4,9.4,0.55,-8.2,crM);
	fMark(7,6,12,-11,'siteB',0.32);
	gStr(7,0.08,0.22,12,0.04,-7.6,glowB);
	gStr(0.22,0.08,6.8,8.4,0.04,-11,glowB);
	const signB = new MS(
		new PG(5.2,1.3),
		new T.MeshBasicMaterial({ map: makeSign('SITE B','DEPOT','#3fbfae') }),
	);
	signB.position.set(12,3.4,-17.7);
	G.add(signB);
	const hazardA = new MS(new BG(3.4,0.06,0.9),hazardMat);
	hazardA.position.set(-12,0.03,-6.9);
	G.add(hazardA);
	const hazardB = new MS(new BG(3.4,0.06,0.9),hazardMat);
	hazardB.position.set(12,0.03,-6.9);
	G.add(hazardB);
	cyl(2.2,2.4,7,0,3.5,-2,siloMat,24);
	cyl(0.4,2.2,1.6,0,7.8,-2,'hairline',24);
	const siloBandLow = new MS(new T.TorusGeometry(2.42,0.07,8,28),mats.steel);
	siloBandLow.rotation.x = P / 2;
	siloBandLow.position.set(0,1.4,-2);
	G.add(siloBandLow);
	const siloBandHigh = siloBandLow.clone();
	siloBandHigh.position.y = 5.6;
	G.add(siloBandHigh);
	const siloSkirt = new MS(
		new CY(2.44,2.46,0.5,24,1,true),hazardMat,
	);
	siloSkirt.position.set(0,0.25,-2);
	G.add(siloSkirt);
	for (let i = 0; i < 11; i++) gStr(0.46,0.045,0.045,0,0.7 + i * 0.58,0.44,mats.steel);
	gStr(0.05,6.6,0.05,-0.25,3.6,0.44,mats.steel);
	gStr(0.05,6.6,0.05,0.25,3.6,0.44,mats.steel);
	const siloPipe = new MS(new CY(0.07,0.07,6.8,8),mats.steel);
	siloPipe.position.set(2.34,3.4,-2);
	G.add(siloPipe);
	box(1.6,1.1,1.6,-4.2,0.55,-2,crM);
	box(1.6,1.1,1.6,4.2,0.55,-2,crM);
	box(1.2,2.2,1.2,-3.2,1.1,-6.4,ccM);
	box(1.2,2.2,1.2,3.4,1.1,2.2,wallCorr);
	box(1.2,1.1,3.6,-14.5,0.55,4,ccM);
	box(1.2,2.2,1.2,-14.5,1.1,-2,wallPaint);
	box(3.2,1.1,1.2,-11,0.55,8,ccM);
	box(1.6,1.1,1.6,-17,0.55,10.5,crM);
	box(4.8,2.4,2.4,15.5,1.2,4,cS);
	box(2.4,2.4,2.4,15.5,3.6,3.2,cR);
	for (const [cx,cy,cz,cw,cd,cm] of [
		[13.5,1.2,-13.5,4.8,2.4,cS],[13.5,3.6,-13.5,4.8,2.4,cR],
		[15.5,1.2,4,4.8,2.4,cS],[8.2,1.2,-15.2,2.4,4.8,cR],
	]) {
		for (const sx of [-1,1]) for (const sz of [-1,1]) gStr(0.14,2.44,0.14,cx + sx * (cw / 2 - 0.02),cy,cz + sz * (cd / 2 - 0.02),cm);
		gStr(cw + 0.06,0.1,cd + 0.06,cx,cy + 1.24,cz,cm);
	}
	cyl(0.6,0.6,1.3,11.5,0.65,8,bR);
	cyl(0.6,0.6,1.3,12.8,0.65,8.6,bS);
	cyl(0.6,0.6,1.3,12.15,0.65,6.9,bA);
	box(1.6,1.1,1.6,10,0.55,-1,crM);
	box(2.4,0.9,1.2,-4,0.45,11.5,ccM);
	box(2.4,0.9,1.2,4,0.45,11.5,ccM);
	const signYard = new MS(
		new PG(6.4,1.6),
		new T.MeshBasicMaterial({ map: makeSign('DUSTWORKS YARD','EMBER vs RUST  •  FIRST TO 4 ROUNDS','#f0a63e') }),
	);
	signYard.position.set(0,3.2,17.7);
	signYard.rotation.y = P;
	G.add(signYard);
	function lampPost(x,z,glowMaterial,colorHex) {
		const pole = new MS(new CY(0.07,0.09,4.4,8),mats.steel);
		pole.position.set(x,2.2,z);
		pole.castShadow = true;
		G.add(pole);
		const head = new MS(new BG(0.55,0.14,0.3),glowMaterial);
		head.position.set(x,4.45,z);
		G.add(head);
		const halo = new T.Sprite(new SM({
			map: glowTex,color: NC(colorHex),transparent: true,opacity: 0.22,depthWrite: false,
		}));
		halo.position.set(x,4.45,z);
		halo.scale.set(3.4,3.4,1);
		G.add(halo);
	}
	lampPost(-8.6,-14.9,glowA,PALETTE.accent);
	lampPost(14.8,-7.9,glowB,PALETTE.siteB);
	lampPost(3.4,5.4,glowA,PALETTE.accent);
	const tireMat = new MM({ color: NC('#201d1a'),roughness: 0.96,metalness: 0 });
	const sandMat = std(concreteTexture(),'#a8915f',0.98,0);
	const rockMat = new MM({ color: NC('#4c4238'),roughness: 0.97,metalness: 0 });
	function tireStack(x,z,count) {
		cyl(0.4,0.4,count * 0.26,x,(count * 0.26) / 2,z,tireMat);
		for (let i = 0; i < count; i++) {
			const tire = new MS(new T.TorusGeometry(0.32,0.13,8,18),tireMat);
			tire.rotation.x = P / 2;
			tire.position.set(x,0.14 + i * 0.26,z);
			tire.castShadow = true;
			G.add(tire);
		}
	}
	tireStack(-18.3,6,4);
	tireStack(18.3,-3,3);
	tireStack(3,-17.1,3);
	cyl(0.55,0.55,0.72,-18.2,0.36,12.6,crM);
	cyl(0.55,0.55,0.72,-16.5,0.36,16.6,crM);
	box(1.6,1.1,1.6,-18.2,0.55,-2,crM);
	box(1.6,1.1,1.6,-18.2,1.65,-2.1,crM);
	box(1.6,1.1,1.6,18.3,0.55,8,crM);
	box(1.4,1.1,1.4,18.2,0.55,13.2,crM);
	box(1.4,1.1,1.4,18.2,1.65,13.2,crM);
	cyl(0.6,0.6,1.3,5.8,0.65,5.4,bS);
	cyl(0.6,0.6,1.3,6.9,0.65,4.6,bR);
	cyl(0.6,0.6,1.3,-6.4,0.65,-4.4,bA);
	const rimGeo = new T.TorusGeometry(0.6,0.038,6,20);
	for (const [x,z] of [[11.5,8],[12.8,8.6],[12.15,6.9],[5.8,5.4],[6.9,4.6],[-6.4,-4.4]]) {
		for (const y of [0.3,1]) {
			const rim = new MS(rimGeo,mats.steel);
			rim.rotation.x = P / 2;
			rim.position.set(x,y,z);
			G.add(rim);
		}
	}
	function sandbags(x,z,rotY) {
		const base = box(2.2,0.34,0.62,x,0.17,z,ccM);
		base.rotation.y = rotY;
		for (let row = 0; row < 2; row++) {
			for (let i = 0; i < 5; i++) {
				const bag = new MS(new T.SphereGeometry(0.24,8,6),sandMat);
				bag.scale.set(1.15,0.5,0.72);
				const along = -0.84 + i * 0.42 + (row % 2) * 0.2;
				bag.position.set(
					x + Math.cos(rotY) * along,
					0.4 + row * 0.17,
					z - Math.sin(rotY) * along,
				);
				bag.rotation.y = rotY;
				bag.castShadow = true;
				G.add(bag);
			}
		}
	}
	sandbags(-9.4,-8.6,0.5);
	sandbags(9.8,-7.6,-0.5);
	box(0.26,4.4,0.26,-3.4,2.2,6.5,'steel');
	box(0.26,4.4,0.26,3.4,2.2,6.5,'steel');
	box(7.4,0.3,0.34,0,4.42,6.5,'steel',false);
	const signMid = new MS(
		new PG(2.6,0.65),
		new T.MeshBasicMaterial({ map: makeSign('MID','THE LANES','#f0a63e') }),
	);
	signMid.position.set(0,3.9,6.28);
	G.add(signMid);
	gStr(0.5,0.1,0.24,0,4.22,6.5,glowA);
	for (const s of [-1,1]) {
		const brace = gStr(0.09,1.8,0.09,s * 2.9,3.72,6.5,mats.steel);
		brace.rotation.z = s * 0.72;
	}
	const cable = new MS(new T.TubeGeometry(new T.QuadraticBezierCurve3(new V3(-3.4,4.32,6.5),new V3(0,3.32,6.5),new V3(3.4,4.32,6.5)),10,0.022,5),mats.ink);
	G.add(cable);
	gStr(0.42,0.13,0.26,0,3.8,6.5,glowA);
	function pipe(len,x,y,z,alongZ) {
		const mesh = new MS(new CY(0.08,0.08,len,8),mats.steel);
		if (alongZ) mesh.rotation.x = P / 2;
		else mesh.rotation.z = P / 2;
		mesh.position.set(x,y,z);
		G.add(mesh);
	}
	pipe(30,0,3.35,-17.92,false);
	pipe(30,0,2.95,-17.92,false);
	pipe(28,-19.92,3.1,0,true);
	function vent(x,y,z,rotY) {
		const ventGroup = new T.Group();
		const back = new MS(new BG(1.3,0.85,0.07),mats.ink);
		ventGroup.add(back);
		for (let i = 0; i < 3; i++) {
			const slat = new MS(new BG(1.14,0.09,0.03),mats.steel);
			slat.position.set(0,-0.24 + i * 0.24,-0.05);
			ventGroup.add(slat);
		}
		ventGroup.position.set(x,y,z);
		ventGroup.rotation.y = rotY;
		G.add(ventGroup);
	}
	vent(-6,2.3,-17.94,0);
	vent(19.94,2.5,-4,P / 2);
	vent(-19.94,2.4,8,-P / 2);
	function poster(title,sub,color,x,y,z,rotY) {
		const mesh = new MS(
			new PG(1.15,1.44),
			new MM({ map: posterTexture(title,sub,color),roughness: 0.92 }),
		);
		mesh.position.set(x,y,z);
		mesh.rotation.y = rotY;
		G.add(mesh);
	}
	poster('SAFETY FIRST','helmets on visors down no exceptions in the yard','#b0492f',-6,2,17.94,P);
	poster('BAY 03','keep clear loads move at dawn report damage to the office','#3f6d8e',19.94,2,6,-P / 2);
	poster('FOUNDRY HOT','the furnace eats gloves and excuses mind the amber line','#b0492f',-19.94,2.1,-10,P / 2);
	box(0.5,0.7,0.12,6.2,1.6,-17.9,'steel',false);
	box(0.5,0.7,0.12,-19.9,1.5,-3,'steel',false);
	function decal(kind,size,x,z,rot = 0,opacity = 1) {
		const mesh = new MS(
			new PG(size,size),
			new MM({
				map: decalTexture(kind),transparent: true,opacity,roughness: 1,
				depthWrite: false,polygonOffset: true,polygonOffsetFactor: -2,
			}),
		);
		mesh.rotation.x = -P / 2;
		mesh.rotation.z = rot;
		mesh.position.set(x,0.03,z);
		mesh.renderOrder = 1;
		mesh.receiveShadow = true;
		G.add(mesh);
	}
	decal('oil',3.6,2.2,-0.6);
	decal('oil',2.4,12.1,7.4);
	decal('oil',2.8,-13.9,3.2);
	decal('arrow',1.7,0,7.6);
	decal('arrow',1.7,8,6.2,0.5);
	decal('letterA',3.2,-12,-7.2);
	decal('letterB',3.2,12,-6.4);
	decal('cracks',3,-4.5,12.5,1.2);
	decal('cracks',2.6,6.5,-8.5,2.4);
	decal('ringA',9.4,-12,-12);
	decal('ringB',9.4,12,-11);
	const pudMat = new MM({ color: NC('#394046'),roughness: 0.06,metalness: 0.5,transparent: true,opacity: 0.78 });
	const pudGeo = new T.CircleGeometry(1,16);
	for (const [x,z,s] of [[3.4,3.8,1.7],[-6.4,-7.2,1.25],[13.8,-4.4,1.45]]) {
		const p = new MS(pudGeo,pudMat);
		p.rotation.x = -P / 2;
		p.position.set(x,0.024,z);
		p.scale.set(s,s * 0.72,1);
		p.receiveShadow = true;
		G.add(p);
	}
	for (let i = 0; i < 5; i++) {
		fMark(0.35,2.2,0,11 - i * 4.6,'ink',0.4);
		fMark(0.35,2.2,-8,9 - i * 4.6,'ink',0.3);
		fMark(0.35,2.2,8,9 - i * 4.6,'ink',0.3);
	}
	fMark(9,0.4,-12,-6.6,'accent',0.5);
	fMark(9,0.4,12,-6.6,'siteB',0.5);
	for (const [rx,rz] of [[-19,-9.5],[19.1,1.2],[-18.7,13.8],[7.5,-17.2],[5.5,-17.4],[-2.5,17.4],[18.9,-13]]) {
		for (let i = 0; i < 4; i++) {
			const rock = new MS(new T.IcosahedronGeometry(0.13 + (i % 3) * 0.07,0),rockMat);
			rock.position.set(rx + (i % 2) * 0.34 - 0.17,0.1,rz + Math.floor(i / 2) * 0.3 - 0.15);
			rock.rotation.set(i * 1.3,i * 2.1,i * 0.7);
			rock.castShadow = true;
			G.add(rock);
		}
	}
	const tarpMat = std(concreteTexture(),'#5d6e5a',0.98,0);
	box(0.75,0.08,2.6,-19.55,0.9,-5.5,crM);
	box(0.6,0.86,0.08,-19.6,0.43,-6.6,ccM,false);
	box(0.6,0.86,0.08,-19.6,0.43,-4.4,ccM,false);
	gStr(0.3,0.05,0.09,-19.55,0.97,-6.1,mats.steel);
	gStr(0.2,0.04,0.2,-19.5,0.96,-5.2,mats.ink);
	for (const [px,pz,n] of [[-19,2.5,2],[18.9,16.5,3],[-6,-17,2],[19,-6.5,1]]) {
		box(1.3,0.13,1.1,px,0.07,pz,crM,false);
		if (n > 1) box(1.15,0.13,0.95,px + 0.1,0.2,pz,crM,false);
		if (n > 2) box(1.4,1.1,1.4,px,0.8,pz,crM);
	}
	fMark(34,1.3,0,16.2,'ink',0.28);
	for (let i = 0; i < 5; i++) fMark(0.5,2.6,-2.4 + i * 1.2,13.2,'accent',0.4);
	box(1.6,0.07,0.9,16.5,0.72,14.5,crM,false);
	box(0.5,0.7,0.5,16.5,0.35,14.5,ccM,false);
	box(0.45,0.5,0.45,15.4,0.25,14.5,ccM,false);
	box(0.5,0.32,0.35,17.3,0.16,15.4,cR,false);
	cyl(0.32,0.32,0.82,18.7,0.41,15.9,bS);
	for (const [tx,tz,s] of [[-17.5,-3.5,1.3],[14.5,16.8,1.1],[-3,17,0.9]]) {
		const tarp = new MS(new T.SphereGeometry(1,10,7),tarpMat);
		tarp.scale.set(s,s * 0.38,s * 0.8);
		tarp.position.set(tx,0.1,tz);
		tarp.castShadow = true;
		G.add(tarp);
	}
	poster('SHIFT NOTES','cans in the bin papers in the drum keep the lanes swept','#3f6d8e',-19.94,1.9,3,P / 2);
	poster('NO SHORTCUTS','walk the paint stay alive the lanes are swept for a reason','#b0492f',10,1.9,17.94,P);
	box(0.07,3.4,0.07,17.5,1.7,-16.5,'steel',false);
	const sock = new MS(new CY(0.09,0.3,0.9,8),cR);
	sock.rotation.z = -P / 2;
	sock.position.set(17.95,3.3,-16.5);
	G.add(sock);
	const dustBase = new Float32Array(130 * 3);
	const dustSeed = new Float32Array(130);
	const hash = (n) => {
		const v = Math.sin(n) * 43758.5453;
		return v - Math.floor(v);
	};
	for (let i = 0; i < 130; i++) {
		dustBase[i * 3] = (hash(i * 12.9898) - 0.5) * 36;
		dustBase[i * 3 + 1] = 0.3 + hash(i * 78.233) * 5;
		dustBase[i * 3 + 2] = (hash(i * 39.425) - 0.5) * 32;
		dustSeed[i] = i * 1.71;
	}
	const dustGeo = new T.BufferGeometry();
	dustGeo.setAttribute('position',new T.BufferAttribute(dustBase.slice(),3));
	const dust = new T.Points(dustGeo,new T.PointsMaterial({
		map: glowTex,color: NC('#fff6dd'),size: 0.06,transparent: true,
		opacity: 0.16,depthWrite: false,blending: T.AdditiveBlending,sizeAttenuation: true,
	}));
	scene.add(dust);
	const smokes = [];
	for (const [sx,sz,top] of [[27,-26,17.5],[31.5,-26,21.5],[-16.6,-16.2,5.6]]) {
		for (let i = 0; i < 5; i++) {
			const sprite = new T.Sprite(new SM({
				map: cloudTex,color: NC('#aeb6ba'),transparent: true,opacity: 0,depthWrite: false,
			}));
			scene.add(sprite);
			smokes.push({ sprite,x: sx,z: sz,top,offset: i / 5 });
		}
	}
	let airTime = 0;
	function updateAir(dt) {
		airTime += dt;
		const pos = dustGeo.attributes.position.array;
		for (let i = 0; i < 130; i++) {
			pos[i * 3] = dustBase[i * 3] + Math.sin(airTime * 0.22 + dustSeed[i]) * 0.7;
			pos[i * 3 + 1] = dustBase[i * 3 + 1] + Math.sin(airTime * 0.16 + dustSeed[i] * 2.3) * 0.35;
			pos[i * 3 + 2] = dustBase[i * 3 + 2] + Math.cos(airTime * 0.19 + dustSeed[i]) * 0.7;
		}
		dustGeo.attributes.position.needsUpdate = true;
		for (const smoke of smokes) {
			const age = (airTime * 0.09 + smoke.offset) % 1;
			smoke.sprite.position.set(smoke.x + age * 3.2,smoke.top + age * 8,smoke.z);
			const s = 4 + age * 8;
			smoke.sprite.scale.set(s,s * 0.62,1);
			smoke.sprite.material.opacity = 0.22 * (1 - age) * Math.min(1,age * 5);
		}
	}
	const skyLight = new T.HemisphereLight(NC('#bcd6f2'),NC('#7a6a52'),2.7);
	scene.add(skyLight);
	const key = new T.DirectionalLight(NC('#fff1d6'),3.6);
	key.position.set(24,34,18);
	key.target.position.set(-2,0,-4);
	key.castShadow = true;
	key.shadow.mapSize.set(2048,2048);
	key.shadow.camera.left = -28;
	key.shadow.camera.right = 28;
	key.shadow.camera.top = 28;
	key.shadow.camera.bottom = -28;
	key.shadow.camera.far = 90;
	key.shadow.bias = -0.0003;
	key.shadow.normalBias = 0.025;
	scene.add(key,key.target);
	const fill = new T.DirectionalLight(NC('#a8c4e0'),0.55);
	fill.position.set(-14,18,-12);
	scene.add(fill);
	const lampMid = new T.PointLight(NC('#ffd2a0'),7,15,1.8);
	lampMid.position.set(0,3.9,6.5);
	scene.add(lampMid);
	const lampA = new T.PointLight(NC(PALETTE.accent),12,17,1.8);
	lampA.position.set(-12,4.2,-12);
	scene.add(lampA);
	const lampB = new T.PointLight(NC(PALETTE.siteB),10,16,1.8);
	lampB.position.set(12,4.2,-11);
	scene.add(lampB);
	const sites = [
		{ name: 'A',label: 'Foundry',center: new V3(-12,0,-12),radius: 4.2,color: PALETTE.accent },
		{ name: 'B',label: 'Depot',center: new V3(12,0,-11),radius: 4.2,color: PALETTE.siteB },
	];
	const waypoints = WAYPOINTS.map(([x,z,links]) => ({ pos: new V3(x,0,z),links }));
	const spawns = {
		ember: new V3(0,0,15),
		emberTeam: [
			new V3(-2.6,0,15.6),
			new V3(2.6,0,15.6),
			new V3(-5.2,0,14.4),
			new V3(5.2,0,14.4),
		],
		rust: [
			new V3(-13,0,-15),
			new V3(-4,0,-15),
			new V3(5,0,-15),
			new V3(13,0,-14),
			new V3(0,0,-16),
		],
	};
	const from = new V3();
	const to = new V3();
	const dir = new V3();
	return {
		colliders,
		shootables,
		group: G,
		sites,
		spawns,
		waypoints,
		update: updateAir,
		bounds: { x: HALF_X,z: HALF_Z },
		blockedBetween(a,b) {
			from.copy(a);
			to.copy(b);
			dir.subVectors(to,from);
			const dist = dir.length();
			if (dist < 0.01) return false;
			dir.multiplyScalar(1 / dist);
			raycaster.set(from,dir);
			raycaster.far = dist;
			return raycaster.intersectObjects(shootables,false).length > 0;
		},
		siteAt(x,z) {
			for (const site of sites) {
				const dx = x - site.center.x;
				const dz = z - site.center.z;
				if (dx * dx + dz * dz <= site.radius * site.radius) return site;
			}
			return null;
		},
		nearestWaypoint(x,z) {
			let best = 0;
			let bestDist = Infinity;
			for (let i = 0; i < waypoints.length; i++) {
				const dx = waypoints[i].pos.x - x;
				const dz = waypoints[i].pos.z - z;
				const d = dx * dx + dz * dz;
				if (d < bestDist) {
					bestDist = d;
					best = i;
				}
			}
			return best;
		},
		route(fromIndex,toIndex) {
			if (fromIndex === toIndex) return [toIndex];
			const prev = new Array(waypoints.length).fill(-1);
			const queue = [fromIndex];
			prev[fromIndex] = fromIndex;
			while (queue.length > 0) {
				const current = queue.shift();
				for (const next of waypoints[current].links) {
					if (prev[next] !== -1) continue;
					prev[next] = current;
					if (next === toIndex) {
						const path = [next];
						let node = current;
						while (node !== fromIndex) {
							path.unshift(node);
							node = prev[node];
						}
						path.unshift(fromIndex);
						return path;
					}
					queue.push(next);
				}
			}
			return [toIndex];
		},
	};
}