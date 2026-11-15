import * as THREE from 'three';
const { Mesh, Group, Color, MeshStandardMaterial, BoxGeometry, CapsuleGeometry, SphereGeometry, CylinderGeometry, LatheGeometry, TorusGeometry, Vector2 } = THREE;
function mat(c,r,m,e = 0,ec = null) {
	const q = new MeshStandardMaterial({ color: new Color(c),roughness: r,metalness: m });
	if (e > 0 && ec) { q.emissive = new Color(ec); q.emissiveIntensity = e; }
	return q;
}
function M(g,mt,x = 0,y = 0,z = 0) { const q = new Mesh(g,mt); q.position.set(x,y,z); return q; }
function oval(r,w,h,sx,sy,sz,mt,x,y,z) { const g = new SphereGeometry(r,w,h); g.scale(sx,sy,sz); return M(g,mt,x,y,z); }
export function buildSoldier(colors) {
	const uniform = mat(colors.uniform,0.78,0.05);
	const dark = mat('#2c2824',0.85,0.15);
	const helmMat = mat(new Color(colors.uniform).multiplyScalar(0.55),0.8,0.05);
	const gunmetal = mat('#3d4249',0.42,0.62);
	const skin = mat('#d9b08c',0.6,0);
	const visor = mat('#141a20',0.15,0.6);
	const accentMat = mat(colors.accent,0.6,0.05);
	const lightDot = mat(colors.accent,0.4,0.1,0.9,colors.accent);
	const group = new Group();
	function buildLeg(side) {
		const hip = new Group();
		hip.position.set(0.105 * side,0.88,0);
		const thigh = M(new CapsuleGeometry(0.082,0.26,4,12),uniform,0,-0.21,0);
		const knee = new Group();
		knee.position.y = -0.42;
		const shin = M(new CapsuleGeometry(0.06,0.24,4,12),uniform,0,-0.19,0);
		const pad = oval(0.068,10,8,1,1.15,0.55,dark,0,-0.03,-0.052);
		const boot = M(new CapsuleGeometry(0.052,0.15,4,10),gunmetal,0,-0.408,-0.045);
		boot.rotation.x = Math.PI / 2;
		knee.add(shin,boot,pad);
		hip.add(thigh,knee);
		return { hip,knee };
	}
	const legL = buildLeg(-1);
	const legR = buildLeg(1);
	const pelvis = oval(0.16,14,10,1.25,0.78,0.92,dark,0,0.9,0);
	for (let i = -1; i <= 1; i += 1) group.add(M(new CapsuleGeometry(0.032,0.05,3,8),uniform,i * 0.115,0.88,-0.148));
	const prof = [[0.02,0],[0.13,0],[0.158,0.06],[0.172,0.16],[0.19,0.3],[0.198,0.4],[0.185,0.52],[0.15,0.6],[0.085,0.65],[0.05,0.67]].map((p) => new Vector2(p[0],p[1]));
	const torsoGeo = new LatheGeometry(prof,18);
	torsoGeo.scale(1.22,1,0.78);
	const torso = M(torsoGeo,uniform,0,0.84,0);
	torso.userData.part = 'torso';
	const vestGeo = new LatheGeometry([[0.168,0.08],[0.182,0.14],[0.21,0.3],[0.217,0.4],[0.202,0.5]].map((p) => new Vector2(p[0],p[1])),18);
	vestGeo.scale(1.22,1,0.78);
	const vest = M(vestGeo,dark,0,0.84,0);
	const chestRig = oval(0.16,12,10,1,0.68,0.3,gunmetal,0,1.235,-0.163);
	for (let i = -1; i <= 1; i += 1) group.add(M(new CapsuleGeometry(0.03,0.055,3,8),dark,i * 0.105,1.07,-0.163));
	const backpack = oval(0.16,12,10,1.02,1.28,0.6,uniform,0,1.15,0.175);
	const backStrip = M(new BoxGeometry(0.2,0.05,0.02),lightDot,0,1.3,0.242);
	const collar = M(new TorusGeometry(0.088,0.03,8,16),dark,0,1.478,0);
	collar.rotation.x = Math.PI / 2;
	const neck = M(new CylinderGeometry(0.048,0.056,0.1,10),skin,0,1.5,0);
	function buildArm(side) {
		const shoulder = new Group();
		shoulder.position.set(0.265 * side,1.405,0);
		const ball = M(new SphereGeometry(0.088,12,10),uniform);
		const pad = M(new SphereGeometry(0.1,12,8,0,Math.PI * 2,0,Math.PI * 0.55),uniform,0,0.014,0);
		const upper = M(new CapsuleGeometry(0.056,0.17,4,12),uniform,0,-0.145,0);
		const elbow = new Group();
		elbow.position.y = -0.29;
		const fore = M(new CapsuleGeometry(0.047,0.15,4,12),uniform,0,-0.125,0);
		const glove = oval(0.052,10,8,0.85,1.3,0.95,dark,0,-0.285,0);
		elbow.add(fore,glove);
		shoulder.add(ball,pad,upper,elbow);
		return { shoulder,elbow };
	}
	const armL = buildArm(-1);
	const armR = buildArm(1);
	armL.shoulder.add(M(new CylinderGeometry(0.067,0.067,0.07,12),accentMat,0,-0.1,0));
	armL.shoulder.add(M(new BoxGeometry(0.05,0.03,0.05),lightDot,0,0.105,0));
	const headGeo = new SphereGeometry(0.117,16,12);
	headGeo.scale(0.94,1.16,0.98);
	const head = M(headGeo,skin,0,1.635,0);
	head.userData.part = 'head';
	const helmGeo = new SphereGeometry(0.133,16,10,0,Math.PI * 2,0,Math.PI * 0.58);
	helmGeo.scale(1,1.06,1);
	head.add(M(helmGeo,helmMat,0,0.02,0.004));
	const rim = M(new TorusGeometry(0.131,0.014,8,18),helmMat,0,-0.02,0.004);
	rim.rotation.x = Math.PI / 2;
	head.add(rim);
	head.add(M(new BoxGeometry(0.055,0.05,0.035),dark,0,0.058,-0.122));
	head.add(M(new SphereGeometry(0.1215,14,8,Math.PI * 1.22,Math.PI * 0.56,Math.PI * 0.3,Math.PI * 0.24),visor));
	const gun = new Group();
	gun.position.set(0.2,1.14,-0.28);
	const receiver = M(new BoxGeometry(0.07,0.11,0.5),gunmetal);
	const barrel = M(new CylinderGeometry(0.024,0.024,0.32,8),gunmetal,0,0.02,-0.4);
	barrel.rotation.x = Math.PI / 2;
	const magazine = M(new BoxGeometry(0.05,0.17,0.08),dark,0,-0.13,-0.02);
	magazine.rotation.x = 0.25;
	const stock = M(new BoxGeometry(0.06,0.09,0.2),dark,0,-0.01,0.33);
	stock.rotation.x = 0.14;
	const sight = M(new BoxGeometry(0.03,0.06,0.09),gunmetal,0,0.09,-0.06);
	const guard = M(new CylinderGeometry(0.038,0.038,0.22,8),dark,0,-0.045,-0.3);
	guard.rotation.x = Math.PI / 2;
	const post = M(new BoxGeometry(0.015,0.05,0.015),gunmetal,0,0.06,-0.52);
	const mz = M(new CylinderGeometry(0.03,0.024,0.08,8),gunmetal,0,0.02,-0.57);
	mz.rotation.x = Math.PI / 2;
	gun.add(receiver,barrel,magazine,stock,sight,guard,post,mz);
	group.add(
		torso,head,legL.hip,legR.hip,gun,pelvis,vest,chestRig,backpack,
		backStrip,collar,neck,armL.shoulder,armR.shoulder,
	);
	const mats = [];
	group.traverse((mesh) => {
		if (mesh.isMesh) {
			mesh.castShadow = true;
			mesh.receiveShadow = true;
			if (!mats.includes(mesh.material)) mats.push(mesh.material);
		}
	});
	return {
		group,torso,head,gun,mats,
		legL,legR,armL,armR,
		moveBlend: 0,
		resetVisual() {
			group.visible = true;
			for (const material of mats) {
				material.transparent = false;
				material.opacity = 1;
			}
		},
	};
}
export function animateSoldier(soldier,o) {
	soldier.moveBlend += ((o.moving ? 1 : 0) - soldier.moveBlend) * Math.min(1,o.dt * 7);
	const blend = soldier.moveBlend;
	const swing = Math.sin(o.phase) * 0.52 * blend;
	soldier.legL.hip.rotation.x = swing;
	soldier.legR.hip.rotation.x = -swing;
	soldier.legL.knee.rotation.x = -Math.max(0,Math.sin(o.phase + 2.3)) * 0.85 * blend - 0.03;
	soldier.legR.knee.rotation.x = -Math.max(0,Math.sin(o.phase + Math.PI + 2.3)) * 0.85 * blend - 0.03;
	const bob = Math.abs(Math.sin(o.phase)) * 0.035 * blend;
	const armBob = Math.sin(o.phase * 2) * 0.035 * blend;
	soldier.armR.shoulder.rotation.set(0.58 + armBob,0,-0.3);
	soldier.armR.elbow.rotation.x = 0.82;
	soldier.armL.shoulder.rotation.set(0.88 + armBob,0,0.58);
	soldier.armL.elbow.rotation.x = 0.5;
	soldier.gun.position.y = 1.14 + Math.sin(o.phase * 2) * 0.012 * blend;
	soldier.group.rotation.x = -o.fall * 1.45 - o.flinch * 0.13;
	soldier.head.position.y = 1.635 - o.flinch * 0.035;
	soldier.group.position.y = bob - o.fall * 0.08 - (o.fade >= 1 ? 50 : 0);
	if (o.fade > 0) {
		for (const material of soldier.mats) {
			material.transparent = true;
			material.opacity = 1 - o.fade;
		}
		if (o.fade >= 1) soldier.group.visible = false;
	}
}
