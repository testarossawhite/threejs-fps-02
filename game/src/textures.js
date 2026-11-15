import * as THREE from 'three';
const T = THREE;
	const P = Math.PI;
function prng(seed) {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15),t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7),t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}
function R(X,style,x,y,w,h) {
	X.fillStyle = style;
	X.fillRect(x,y,w,h);
}
function cvOf(w,h) {
	const C = document.createElement('canvas');
	C.width = w;
	C.height = h;
	return [C,C.getContext('2d')];
}
function toTex(C,repeatX = 1,repeatY = 1) {
	const texture = new T.CanvasTexture(C);
	texture.colorSpace = T.SRGBColorSpace;
	texture.wrapS = T.RepeatWrapping;
	texture.wrapT = T.RepeatWrapping;
	texture.repeat.set(repeatX,repeatY);
	texture.anisotropy = 4;
	return texture;
}
export function flatTex(C,aniso = 0) {
	const texture = new T.CanvasTexture(C);
	texture.colorSpace = T.SRGBColorSpace;
	if (aniso) texture.anisotropy = aniso;
	return texture;
}
function grime(X,w,h,rand,speckles,stains,dark,light) {
	for (let i = 0; i < speckles; i++) {
		const v = rand();
		X.fillStyle = v < 0.5 ? dark : light;
		X.globalAlpha = 0.04 + rand() * 0.1;
		const s = 1 + rand() * 3;
		X.fillRect(rand() * w,rand() * h,s,s);
	}
	for (let i = 0; i < stains; i++) {
		const x = rand() * w;
		const y = rand() * h;
		const r = 20 + rand() * 70;
		const grad = X.createRadialGradient(x,y,0,x,y,r);
		grad.addColorStop(0,dark);
		grad.addColorStop(1,'rgba(0,0,0,0)');
		X.globalAlpha = 0.05 + rand() * 0.09;
		R(X,grad,x - r,y - r,r * 2,r * 2);
	}
	X.globalAlpha = 1;
}
export function groundTexture() {
	const [C,X] = cvOf(512,512);
	const rand = prng(101);
	R(X,'#6e675c',0,0,512,512);
	for (let i = 0; i < 30; i++) {
		const x = rand() * 512;
		const y = rand() * 512;
		const r = 40 + rand() * 130;
		const grad = X.createRadialGradient(x,y,0,x,y,r);
		const tone = rand() < 0.5 ? 'rgba(146,134,112,0.20)' : 'rgba(40,36,30,0.20)';
		grad.addColorStop(0,tone);
		grad.addColorStop(1,'rgba(0,0,0,0)');
		R(X,grad,x - r,y - r,r * 2,r * 2);
	}
	X.strokeStyle = 'rgba(28,26,22,0.5)';
	X.lineWidth = 3;
	X.strokeRect(1,1,510,510);
	X.beginPath();
	X.moveTo(256,0);
	X.lineTo(256,512);
	X.moveTo(0,256);
	X.lineTo(512,256);
	X.stroke();
	X.strokeStyle = 'rgba(24,22,18,0.55)';
	for (let i = 0; i < 9; i++) {
		X.lineWidth = 1 + rand() * 1.6;
		let x = rand() * 512;
		let y = rand() * 512;
		X.beginPath();
		X.moveTo(x,y);
		for (let j = 0; j < 5; j++) {
			x += rand() * 70 - 35;
			y += rand() * 70 - 35;
			X.lineTo(x,y);
		}
		X.stroke();
	}
	X.strokeStyle = 'rgba(30,26,20,0.28)';
	for (let i = 0; i < 6; i++) {
		X.lineWidth = 6 + rand() * 8;
		X.beginPath();
		X.arc(rand() * 512,rand() * 512,40 + rand() * 130,rand() * 3,rand() * 2 + 0.6);
		X.stroke();
	}
	grime(X,512,512,rand,9000,14,'rgba(22,20,16,1)','rgba(198,188,168,1)');
	return toTex(C,5,4.5);
}
export function wallTexture(repeatX = 6) {
	const [C,X] = cvOf(512,256);
	const rand = prng(202);
	R(X,'#b3a48f',0,0,512,256);
	const bw = 46;
	const bh = 15;
	for (let row = 0; row * bh < 256; row++) {
		const off = row % 2 ? -bw / 2 : 0;
		for (let col = -1; col * bw < 512 + bw; col++) {
			const x = col * bw + off;
			const y = row * bh;
			const r = 138 + rand() * 44;
			const g = 74 + rand() * 26;
			const b = 54 + rand() * 20;
			R(X,`rgb(${r | 0},${g | 0},${b | 0})`,x + 1.5,y + 1.5,bw - 3,bh - 3);
			R(X,'rgba(255,235,200,0.13)',x + 1.5,y + 1.5,bw - 3,3);
			R(X,'rgba(30,16,10,0.20)',x + 1.5,y + bh - 5.5,bw - 3,3);
			if (rand() < 0.14) {
				R(X,'rgba(40,30,24,0.25)',x + 4 + rand() * 30,y + 3,6 + rand() * 12,bh - 6);
			}
		}
	}
	for (let i = 0; i < 7; i++) {
		const sx = rand() * 512;
		const len = 50 + rand() * 140;
		const grad = X.createLinearGradient(0,0,0,len);
		grad.addColorStop(0,'rgba(70,58,44,0.4)');
		grad.addColorStop(1,'rgba(70,58,44,0)');
		R(X,grad,sx,0,4 + rand() * 8,len);
	}
	const grad = X.createLinearGradient(0,186,0,256);
	grad.addColorStop(0,'rgba(24,18,12,0)');
	grad.addColorStop(1,'rgba(24,18,12,0.5)');
	R(X,grad,0,186,512,70);
	grime(X,512,256,rand,2600,8,'rgba(30,20,12,1)','rgba(215,190,150,1)');
	return toTex(C,repeatX,1);
}
export function fenceTexture() {
	const [C,X] = cvOf(128,128);
	X.clearRect(0,0,128,128);
	X.strokeStyle = 'rgba(196,204,210,0.95)';
	X.lineWidth = 2.5;
	for (let i = -128; i < 256; i += 16) {
		X.beginPath(); X.moveTo(i,0); X.lineTo(i + 128,128); X.stroke();
		X.beginPath(); X.moveTo(i,128); X.lineTo(i + 128,0); X.stroke();
	}
	return toTex(C,7,2);
}
export function crateTexture() {
	const [C,X] = cvOf(256,256);
	const rand = prng(303);
	R(X,'#7a5c36',0,0,256,256);
	const plank = 52;
	for (let y = 0; y < 256; y += plank) {
		R(X,`rgba(${30 + rand() * 26},${18 + rand() * 16},${6 + rand() * 10},0.16)`,0,y,256,plank);
		R(X,'rgba(24,15,7,0.8)',0,y,256,3);
		X.strokeStyle = 'rgba(52,34,14,0.35)';
		X.lineWidth = 1.4;
		for (let i = 0; i < 6; i++) {
			const gy = y + 6 + rand() * (plank - 12);
			X.beginPath();
			X.moveTo(0,gy);
			X.bezierCurveTo(80,gy + rand() * 4 - 2,170,gy + rand() * 4 - 2,256,gy);
			X.stroke();
		}
	}
	X.strokeStyle = '#4c361c';
	X.lineWidth = 22;
	X.strokeRect(0,0,256,256);
	X.fillStyle = 'rgba(30,22,14,0.6)';
	X.font = 'bold 36px ui-monospace, monospace';
	X.fillText('DW-7',86,142);
	X.font = '15px ui-monospace, monospace';
	X.fillText('TOOLS - FRAGILE',86,164);
	X.fillStyle = 'rgba(30,24,20,0.9)';
	for (const [x,y] of [[0,0],[232,0],[0,232],[232,232]]) X.fillRect(x,y,24,24);
	grime(X,256,256,rand,1500,6,'rgba(26,17,8,1)','rgba(215,185,130,1)');
	return toTex(C);
}
export function containerTexture() {
	const [C,X] = cvOf(256,256);
	const rand = prng(404);
	R(X,'#b9b4ac',0,0,256,256);
	const rib = 22;
	for (let x = 0; x < 256; x += rib) {
		R(X,'rgba(255,255,255,0.20)',x,0,6,256);
		R(X,'rgba(40,36,32,0.28)',x + rib - 7,0,7,256);
	}
	R(X,'rgba(52,46,40,0.85)',0,0,256,14);
	X.fillRect(0,242,256,14);
	for (let i = 0; i < 10; i++) {
		const x = rand() * 256;
		const len = 90 + rand() * 150;
		const grad = X.createLinearGradient(0,14,0,len);
		grad.addColorStop(0,'rgba(52,44,36,0.32)');
		grad.addColorStop(1,'rgba(52,44,36,0)');
		R(X,grad,x,14,3 + rand() * 6,len);
	}
	for (let i = 0; i < 16; i++) {
		const x = rand() * 256;
		const grad = X.createRadialGradient(x,250,0,x,250,16 + rand() * 30);
		grad.addColorStop(0,'rgba(150,76,38,0.55)');
		grad.addColorStop(1,'rgba(150,76,38,0)');
		R(X,grad,x - 46,190,92,66);
	}
	X.fillStyle = 'rgba(40,40,44,0.5)';
	X.font = 'bold 30px ui-monospace, monospace';
	X.fillText('DW-2041',22,52);
	X.font = '16px ui-monospace, monospace';
	X.fillText('MAX 30480 KG',22,76);
	grime(X,256,256,rand,1700,7,'rgba(38,32,26,1)','rgba(235,228,215,1)');
	return toTex(C,2,1);
}
export function barrelTexture() {
	const [C,X] = cvOf(128,256);
	const rand = prng(505);
	R(X,'#c9c4bc',0,0,128,256);
	for (const y of [58,168]) {
		R(X,'rgba(38,34,30,0.5)',0,y,128,12);
		R(X,'rgba(255,255,255,0.35)',0,y - 4,128,4);
	}
	R(X,'rgba(38,34,30,0.4)',0,0,128,7);
	grime(X,128,256,rand,700,5,'rgba(40,34,28,1)','rgba(240,234,222,1)');
	return toTex(C);
}
export function concreteTexture() {
	const [C,X] = cvOf(256,256);
	const rand = prng(606);
	R(X,'#7d7264',0,0,256,256);
	R(X,'rgba(30,24,17,0.5)',0,126,256,3);
	R(X,'rgba(235,220,190,0.16)',0,129,256,2);
	for (const hx of [42,128,214]) {
		for (const hy of [42,128,214]) {
			R(X,'rgba(235,225,200,0.18)',hx - 5,hy + 5,10,2);
			X.fillStyle = 'rgba(35,30,24,0.6)';
			X.beginPath();
			X.arc(hx,hy,5,0,P * 2);
			X.fill();
		}
	}
	for (let i = 0; i < 6; i++) {
		const sx = rand() * 256;
		const grad = X.createLinearGradient(sx,0,sx + 14,0);
		grad.addColorStop(0,'rgba(52,44,34,0.22)');
		grad.addColorStop(1,'rgba(52,44,34,0)');
		R(X,grad,sx,0,14,256);
	}
	grime(X,256,256,rand,2400,12,'rgba(28,22,15,1)','rgba(215,198,168,1)');
	return toTex(C,2,2);
}
export function hazardTexture() {
	const [C,X] = cvOf(128,128);
	R(X,'#c8912f',0,0,128,128);
	X.fillStyle = '#2b2119';
	for (let i = -2; i < 6; i++) {
		X.save();
		X.translate(i * 36,0);
		X.rotate(0);
		X.beginPath();
		X.moveTo(0,128);
		X.lineTo(18,128);
		X.lineTo(82,0);
		X.lineTo(64,0);
		X.closePath();
		X.fill();
		X.restore();
	}
	const rand = prng(707);
	grime(X,128,128,rand,500,3,'rgba(24,17,10,1)','rgba(230,200,140,1)');
	return toTex(C,3,1);
}
export function skyTexture() {
	const [C,X] = cvOf(1024,512);
	const grad = X.createLinearGradient(0,0,0,512);
	grad.addColorStop(0,'#2f66b0');
	grad.addColorStop(0.38,'#5f97cc');
	grad.addColorStop(0.66,'#a8c6dd');
	grad.addColorStop(0.88,'#dde4da');
	grad.addColorStop(1,'#e9e2cc');
	R(X,grad,0,0,1024,512);
	const glow = X.createRadialGradient(700,150,0,700,150,420);
	glow.addColorStop(0,'rgba(255,246,214,0.95)');
	glow.addColorStop(0.25,'rgba(255,238,190,0.45)');
	glow.addColorStop(1,'rgba(255,238,190,0)');
	R(X,glow,0,0,1024,512);
	return flatTex(C);
}
export function buildingTexture(seed = 1212) {
	const [C,X] = cvOf(256,256);
	const rand = prng(seed);
	R(X,'#97a1a8',0,0,256,256);
	for (let i = 0; i < 9; i++) {
		const x = rand() * 256;
		const grad = X.createLinearGradient(x,0,x + 30,0);
		grad.addColorStop(0,'rgba(60,58,50,0.16)');
		grad.addColorStop(1,'rgba(60,58,50,0)');
		R(X,grad,x,0,30,256);
	}
	X.strokeStyle = 'rgba(52,54,50,0.35)';
	X.lineWidth = 2;
	for (let x = 0; x <= 256; x += 64) { X.beginPath(); X.moveTo(x,0); X.lineTo(x,256); X.stroke(); }
	for (let y = 0; y <= 256; y += 64) { X.beginPath(); X.moveTo(0,y); X.lineTo(256,y); X.stroke(); }
	for (let row = 0; row < 8; row++) {
		for (let col = 0; col < 6; col++) {
			const x = 14 + col * 40;
			const y = 14 + row * 30;
			const lit = rand();
			R(X,'rgba(18,20,22,0.85)',x - 3,y - 3,30,23);
			R(X,'rgba(255,255,255,0.28)',x - 3,y - 3,30,2);
			const pane = X.createLinearGradient(0,y,0,y + 17);
			const base = lit < 0.22 ? ['#d7e2dc','#aebfb8'] : lit < 0.5 ? ['#71879a','#46586a'] : ['#3d4f61','#27333f'];
			pane.addColorStop(0,base[0]);
			pane.addColorStop(1,base[1]);
			R(X,pane,x,y,24,17);
			R(X,'rgba(240,246,250,0.30)',x + 2,y + 2,9,6);
			R(X,'rgba(15,17,19,0.5)',x + 11,y,2,17);
			R(X,'rgba(20,22,24,0.55)',x - 2,y + 17,28,3);
			const st = rand();
			if (st < 0.09) { R(X,'#5d4a30',x - 2,y + 2,28,6); R(X,'#6e5738',x - 2,y + 10,28,6); }
			else if (st < 0.17) { R(X,'rgba(8,8,10,0.8)',x,y,24,17); X.strokeStyle = 'rgba(200,210,215,0.5)'; X.beginPath(); X.moveTo(x + 3,y + 2); X.lineTo(x + 13,y + 10); X.lineTo(x + 7,y + 16); X.stroke(); }
			if (rand() < 0.2) {
				R(X,'#6d7276',x + 4,y + 21,13,7);
				R(X,'rgba(20,20,20,0.4)',x + 4,y + 27,13,2);
			}
		}
	}
	R(X,'rgba(30,28,24,0.35)',0,238,256,18);
	R(X,'rgba(255,255,255,0.20)',0,236,256,2);
	grime(X,256,256,rand,1500,5,'rgba(40,38,32,1)','rgba(226,228,220,1)');
	return toTex(C);
}
export function cloudTexture() {
	const [C,X] = cvOf(256,128);
	const rand = prng(909);
	for (let i = 0; i < 26; i++) {
		const x = 40 + rand() * 176;
		const y = 52 + rand() * 26;
		const r = 16 + rand() * 30;
		const grad = X.createRadialGradient(x,y,0,x,y,r);
		grad.addColorStop(0,'rgba(255,255,255,0.20)');
		grad.addColorStop(1,'rgba(255,255,255,0)');
		R(X,grad,x - r,y - r,r * 2,r * 2);
	}
	return flatTex(C);
}
export function gunMetalTexture(marking) {
	const [C,X] = cvOf(256,256);
	const rand = prng(111);
	R(X,'#43464c',0,0,256,256);
	for (let i = 0; i < 380; i++) {
		X.strokeStyle = rand() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.16)';
		X.lineWidth = 1;
		const y = rand() * 256;
		X.beginPath();
		X.moveTo(0,y);
		X.lineTo(256,y + rand() * 2 - 1);
		X.stroke();
	}
	for (let i = 0; i < 22; i++) {
		X.strokeStyle = 'rgba(210,214,220,0.35)';
		X.lineWidth = 0.8;
		const x = rand() * 256;
		const y = rand() * 256;
		X.beginPath();
		X.moveTo(x,y);
		X.lineTo(x + 8 + rand() * 26,y + rand() * 3 - 1.5);
		X.stroke();
	}
	R(X,'rgba(10,10,12,0.55)',0,118,256,3);
	R(X,'rgba(215,220,226,0.16)',0,122,256,2);
	R(X,'rgba(10,10,12,0.4)',0,196,256,2);
	grime(X,256,256,rand,900,4,'rgba(10,10,12,1)','rgba(190,196,204,1)');
	if (marking) {
		X.fillStyle = 'rgba(226,230,236,0.85)';
		X.font = 'bold 21px ui-monospace, monospace';
		X.fillText(marking,18,42);
		X.font = '13px ui-monospace, monospace';
		X.fillStyle = 'rgba(226,230,236,0.5)';
		X.fillText('CAL 5.56 · DW ARMORY',18,64);
	}
	return toTex(C);
}
export function polymerTexture() {
	const [C,X] = cvOf(128,128);
	const rand = prng(222);
	R(X,'#242322',0,0,128,128);
	X.fillStyle = 'rgba(255,255,255,0.10)';
	for (let y = 4; y < 128; y += 8) {
		for (let x = 4 + (y % 16 === 4 ? 0 : 4); x < 128; x += 8) {
			X.beginPath();
			X.arc(x,y,1.4,0,P * 2);
			X.fill();
		}
	}
	R(X,'rgba(0,0,0,0.5)',0,62,128,2);
	grime(X,128,128,rand,260,2,'rgba(0,0,0,1)','rgba(200,200,200,1)');
	return toTex(C);
}
export function camoTexture() {
	const [C,X] = cvOf(256,256);
	const rand = prng(333);
	R(X,'#9a7c50',0,0,256,256);
	const tones = ['#6f6a3e','#5d4a30','#3f3a30','#b08d5a'];
	for (let i = 0; i < 46; i++) {
		X.fillStyle = tones[i % tones.length];
		X.globalAlpha = 0.5 + rand() * 0.3;
		const x = rand() * 256;
		const y = rand() * 256;
		X.beginPath();
		X.ellipse(x,y,14 + rand() * 30,8 + rand() * 18,rand() * 3,0,P * 2);
		X.fill();
	}
	X.globalAlpha = 1;
	grime(X,256,256,rand,700,3,'rgba(30,22,12,1)','rgba(230,205,160,1)');
	return toTex(C);
}
export function decalTexture(kind) {
	const [C,X] = cvOf(256,256);
	const rand = prng(444);
	X.clearRect(0,0,256,256);
	if (kind === 'oil') {
		for (let i = 0; i < 9; i++) {
			const x = 70 + rand() * 116;
			const y = 70 + rand() * 116;
			const r = 22 + rand() * 52;
			const grad = X.createRadialGradient(x,y,0,x,y,r);
			grad.addColorStop(0,'rgba(12,10,8,0.82)');
			grad.addColorStop(0.7,'rgba(14,12,9,0.5)');
			grad.addColorStop(1,'rgba(14,12,9,0)');
			R(X,grad,x - r,y - r,r * 2,r * 2);
		}
	} else if (kind === 'arrow') {
		X.fillStyle = 'rgba(232,220,190,0.8)';
		X.beginPath();
		X.moveTo(128,18);
		X.lineTo(196,108);
		X.lineTo(152,108);
		X.lineTo(152,238);
		X.lineTo(104,238);
		X.lineTo(104,108);
		X.lineTo(60,108);
		X.closePath();
		X.fill();
	} else if (kind === 'cracks') {
		X.strokeStyle = 'rgba(16,12,8,0.65)';
		for (let i = 0; i < 7; i++) {
			X.lineWidth = 1 + rand() * 1.6;
			let x = 30 + rand() * 196;
			let y = 30 + rand() * 196;
			X.beginPath();
			X.moveTo(x,y);
			for (let j = 0; j < 5; j++) {
				x += rand() * 44 - 22;
				y += rand() * 44 - 10;
				X.lineTo(x,y);
			}
			X.stroke();
		}
	} else if (kind === 'ringA' || kind === 'ringB') {
		X.strokeStyle = kind === 'ringA' ? 'rgba(240,166,62,0.9)' : 'rgba(47,174,157,0.9)';
		X.lineWidth = 13;
		X.beginPath();
		X.arc(128,128,104,0,P * 2);
		X.stroke();
		X.lineWidth = 4;
		X.beginPath();
		X.arc(128,128,84,0,P * 2);
		X.stroke();
	} else {
		X.fillStyle = kind === 'letterA' ? 'rgba(240,166,62,0.85)' : 'rgba(63,191,174,0.85)';
		X.font = 'bold 190px system-ui, sans-serif';
		X.textAlign = 'center';
		X.textBaseline = 'middle';
		X.fillText(kind === 'letterA' ? 'A' : 'B',128,138);
	}
	X.globalCompositeOperation = 'destination-out';
	for (let i = 0; i < 1500; i++) {
		X.globalAlpha = 0.12 + rand() * 0.4;
		X.fillRect(rand() * 256,rand() * 256,1 + rand() * 4,1 + rand() * 4);
	}
	X.globalCompositeOperation = 'source-over';
	X.globalAlpha = 1;
	return flatTex(C,4);
}
export function posterTexture(title,sub,color) {
	const [C,X] = cvOf(256,320);
	const rand = prng(555);
	R(X,'#c9b892',0,0,256,320);
	R(X,color,0,0,256,14);
	X.fillRect(0,292,256,28);
	X.fillStyle = '#2b2119';
	X.font = 'bold 40px system-ui, sans-serif';
	const words = title.split(' ');
	words.forEach((word,i) => X.fillText(word,20,78 + i * 46));
	X.font = '17px system-ui, sans-serif';
	X.fillStyle = '#57462e';
	const subWords = sub.split(' ');
	let line = '';
	let ly = 78 + words.length * 46 + 16;
	for (const word of subWords) {
		if ((line + word).length > 24) {
			X.fillText(line,20,ly);
			ly += 24;
			line = '';
		}
		line += `${word} `;
	}
	if (line) X.fillText(line,20,ly);
	X.fillStyle = '#1d150e';
	for (let i = 0; i < 5; i++) {
		X.save();
		X.translate(i * 56 - 8,292);
		X.beginPath();
		X.moveTo(0,28);
		X.lineTo(14,28);
		X.lineTo(40,0);
		X.lineTo(26,0);
		X.closePath();
		X.fill();
		X.restore();
	}
	grime(X,256,320,rand,800,4,'rgba(40,30,16,1)','rgba(240,228,200,1)');
	return flatTex(C,4);
}
export function glowTexture() {
	const [C,X] = cvOf(128,128);
	const grad = X.createRadialGradient(64,64,0,64,64,64);
	grad.addColorStop(0,'rgba(255,255,255,1)');
	grad.addColorStop(0.25,'rgba(255,255,255,0.55)');
	grad.addColorStop(1,'rgba(255,255,255,0)');
	R(X,grad,0,0,128,128);
	return flatTex(C);
}