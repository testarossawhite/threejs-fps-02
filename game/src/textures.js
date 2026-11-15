import * as THREE from 'three';
const T = THREE;
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
function R(ctx,style,x,y,w,h) {
	ctx.fillStyle = style;
	ctx.fillRect(x,y,w,h);
}
function cvOf(w,h) {
	const canvas = document.createElement('canvas');
	canvas.width = w;
	canvas.height = h;
	return [canvas,canvas.getContext('2d')];
}
function toTex(canvas,repeatX = 1,repeatY = 1) {
	const texture = new T.CanvasTexture(canvas);
	texture.colorSpace = T.SRGBColorSpace;
	texture.wrapS = T.RepeatWrapping;
	texture.wrapT = T.RepeatWrapping;
	texture.repeat.set(repeatX,repeatY);
	texture.anisotropy = 4;
	return texture;
}
function grime(ctx,w,h,rand,speckles,stains,dark,light) {
	for (let i = 0; i < speckles; i += 1) {
		const v = rand();
		ctx.fillStyle = v < 0.5 ? dark : light;
		ctx.globalAlpha = 0.04 + rand() * 0.1;
		const s = 1 + rand() * 3;
		ctx.fillRect(rand() * w,rand() * h,s,s);
	}
	for (let i = 0; i < stains; i += 1) {
		const x = rand() * w;
		const y = rand() * h;
		const r = 20 + rand() * 70;
		const grad = ctx.createRadialGradient(x,y,0,x,y,r);
		grad.addColorStop(0,dark);
		grad.addColorStop(1,'rgba(0,0,0,0)');
		ctx.globalAlpha = 0.05 + rand() * 0.09;
		R(ctx,grad,x - r,y - r,r * 2,r * 2);
	}
	ctx.globalAlpha = 1;
}
export function groundTexture() {
	const [canvas,ctx] = cvOf(512,512);
	const rand = prng(101);
	R(ctx,'#6e675c',0,0,512,512);
	for (let i = 0; i < 30; i += 1) {
		const x = rand() * 512;
		const y = rand() * 512;
		const r = 40 + rand() * 130;
		const grad = ctx.createRadialGradient(x,y,0,x,y,r);
		const tone = rand() < 0.5 ? 'rgba(146,134,112,0.20)' : 'rgba(40,36,30,0.20)';
		grad.addColorStop(0,tone);
		grad.addColorStop(1,'rgba(0,0,0,0)');
		R(ctx,grad,x - r,y - r,r * 2,r * 2);
	}
	ctx.strokeStyle = 'rgba(28,26,22,0.5)';
	ctx.lineWidth = 3;
	ctx.strokeRect(1,1,510,510);
	ctx.beginPath();
	ctx.moveTo(256,0);
	ctx.lineTo(256,512);
	ctx.moveTo(0,256);
	ctx.lineTo(512,256);
	ctx.stroke();
	ctx.strokeStyle = 'rgba(24,22,18,0.55)';
	for (let i = 0; i < 9; i += 1) {
		ctx.lineWidth = 1 + rand() * 1.6;
		let x = rand() * 512;
		let y = rand() * 512;
		ctx.beginPath();
		ctx.moveTo(x,y);
		for (let j = 0; j < 5; j += 1) {
			x += rand() * 70 - 35;
			y += rand() * 70 - 35;
			ctx.lineTo(x,y);
		}
		ctx.stroke();
	}
	ctx.strokeStyle = 'rgba(30,26,20,0.28)';
	for (let i = 0; i < 6; i += 1) {
		ctx.lineWidth = 6 + rand() * 8;
		ctx.beginPath();
		ctx.arc(rand() * 512,rand() * 512,40 + rand() * 130,rand() * 3,rand() * 2 + 0.6);
		ctx.stroke();
	}
	grime(ctx,512,512,rand,9000,14,'rgba(22,20,16,1)','rgba(198,188,168,1)');
	return toTex(canvas,5,4.5);
}
export function wallTexture(repeatX = 6) {
	const [canvas,ctx] = cvOf(512,256);
	const rand = prng(202);
	R(ctx,'#b3a48f',0,0,512,256);
	const bw = 46;
	const bh = 15;
	for (let row = 0; row * bh < 256; row += 1) {
		const off = row % 2 ? -bw / 2 : 0;
		for (let col = -1; col * bw < 512 + bw; col += 1) {
			const x = col * bw + off;
			const y = row * bh;
			const r = 138 + rand() * 44;
			const g = 74 + rand() * 26;
			const b = 54 + rand() * 20;
			R(ctx,`rgb(${r | 0},${g | 0},${b | 0})`,x + 1.5,y + 1.5,bw - 3,bh - 3);
			R(ctx,'rgba(255,235,200,0.13)',x + 1.5,y + 1.5,bw - 3,3);
			R(ctx,'rgba(30,16,10,0.20)',x + 1.5,y + bh - 5.5,bw - 3,3);
			if (rand() < 0.14) {
				R(ctx,'rgba(40,30,24,0.25)',x + 4 + rand() * 30,y + 3,6 + rand() * 12,bh - 6);
			}
		}
	}
	for (let i = 0; i < 7; i += 1) {
		const sx = rand() * 512;
		const len = 50 + rand() * 140;
		const grad = ctx.createLinearGradient(0,0,0,len);
		grad.addColorStop(0,'rgba(70,58,44,0.4)');
		grad.addColorStop(1,'rgba(70,58,44,0)');
		R(ctx,grad,sx,0,4 + rand() * 8,len);
	}
	const grad = ctx.createLinearGradient(0,186,0,256);
	grad.addColorStop(0,'rgba(24,18,12,0)');
	grad.addColorStop(1,'rgba(24,18,12,0.5)');
	R(ctx,grad,0,186,512,70);
	grime(ctx,512,256,rand,2600,8,'rgba(30,20,12,1)','rgba(215,190,150,1)');
	return toTex(canvas,repeatX,1);
}
export function crateTexture() {
	const [canvas,ctx] = cvOf(256,256);
	const rand = prng(303);
	R(ctx,'#7a5c36',0,0,256,256);
	const plank = 52;
	for (let y = 0; y < 256; y += plank) {
		R(ctx,`rgba(${30 + rand() * 26},${18 + rand() * 16},${6 + rand() * 10},0.16)`,0,y,256,plank);
		R(ctx,'rgba(24,15,7,0.8)',0,y,256,3);
		ctx.strokeStyle = 'rgba(52,34,14,0.35)';
		ctx.lineWidth = 1.4;
		for (let i = 0; i < 6; i += 1) {
			const gy = y + 6 + rand() * (plank - 12);
			ctx.beginPath();
			ctx.moveTo(0,gy);
			ctx.bezierCurveTo(80,gy + rand() * 4 - 2,170,gy + rand() * 4 - 2,256,gy);
			ctx.stroke();
		}
	}
	ctx.strokeStyle = '#4c361c';
	ctx.lineWidth = 22;
	ctx.strokeRect(0,0,256,256);
	ctx.fillStyle = 'rgba(30,24,20,0.9)';
	for (const [x,y] of [[0,0],[232,0],[0,232],[232,232]]) ctx.fillRect(x,y,24,24);
	grime(ctx,256,256,rand,1500,6,'rgba(26,17,8,1)','rgba(215,185,130,1)');
	return toTex(canvas);
}
export function containerTexture() {
	const [canvas,ctx] = cvOf(256,256);
	const rand = prng(404);
	R(ctx,'#b9b4ac',0,0,256,256);
	const rib = 22;
	for (let x = 0; x < 256; x += rib) {
		R(ctx,'rgba(255,255,255,0.20)',x,0,6,256);
		R(ctx,'rgba(40,36,32,0.28)',x + rib - 7,0,7,256);
	}
	R(ctx,'rgba(52,46,40,0.85)',0,0,256,14);
	ctx.fillRect(0,242,256,14);
	for (let i = 0; i < 16; i += 1) {
		const x = rand() * 256;
		const grad = ctx.createRadialGradient(x,250,0,x,250,16 + rand() * 30);
		grad.addColorStop(0,'rgba(150,76,38,0.55)');
		grad.addColorStop(1,'rgba(150,76,38,0)');
		R(ctx,grad,x - 46,190,92,66);
	}
	ctx.fillStyle = 'rgba(40,40,44,0.5)';
	ctx.font = 'bold 30px ui-monospace, monospace';
	ctx.fillText('DW-2041',22,52);
	ctx.font = '16px ui-monospace, monospace';
	ctx.fillText('MAX 30480 KG',22,76);
	grime(ctx,256,256,rand,1700,7,'rgba(38,32,26,1)','rgba(235,228,215,1)');
	return toTex(canvas,2,1);
}
export function barrelTexture() {
	const [canvas,ctx] = cvOf(128,256);
	const rand = prng(505);
	R(ctx,'#c9c4bc',0,0,128,256);
	for (const y of [58,168]) {
		R(ctx,'rgba(38,34,30,0.5)',0,y,128,12);
		R(ctx,'rgba(255,255,255,0.35)',0,y - 4,128,4);
	}
	R(ctx,'rgba(38,34,30,0.4)',0,0,128,7);
	grime(ctx,128,256,rand,700,5,'rgba(40,34,28,1)','rgba(240,234,222,1)');
	return toTex(canvas);
}
export function concreteTexture() {
	const [canvas,ctx] = cvOf(256,256);
	const rand = prng(606);
	R(ctx,'#7d7264',0,0,256,256);
	R(ctx,'rgba(30,24,17,0.5)',0,126,256,3);
	R(ctx,'rgba(235,220,190,0.16)',0,129,256,2);
	ctx.fillStyle = 'rgba(35,30,24,0.6)';
	for (const hx of [42,128,214]) {
		for (const hy of [42,128,214]) {
			ctx.beginPath();
			ctx.arc(hx,hy,5,0,Math.PI * 2);
			ctx.fill();
			R(ctx,'rgba(235,225,200,0.18)',hx - 5,hy + 5,10,2);
			ctx.fillStyle = 'rgba(35,30,24,0.6)';
		}
	}
	for (let i = 0; i < 6; i += 1) {
		const sx = rand() * 256;
		const grad = ctx.createLinearGradient(sx,0,sx + 14,0);
		grad.addColorStop(0,'rgba(52,44,34,0.22)');
		grad.addColorStop(1,'rgba(52,44,34,0)');
		R(ctx,grad,sx,0,14,256);
	}
	grime(ctx,256,256,rand,2400,12,'rgba(28,22,15,1)','rgba(215,198,168,1)');
	return toTex(canvas,2,2);
}
export function hazardTexture() {
	const [canvas,ctx] = cvOf(128,128);
	R(ctx,'#c8912f',0,0,128,128);
	ctx.fillStyle = '#2b2119';
	for (let i = -2; i < 6; i += 1) {
		ctx.save();
		ctx.translate(i * 36,0);
		ctx.rotate(0);
		ctx.beginPath();
		ctx.moveTo(0,128);
		ctx.lineTo(18,128);
		ctx.lineTo(82,0);
		ctx.lineTo(64,0);
		ctx.closePath();
		ctx.fill();
		ctx.restore();
	}
	const rand = prng(707);
	grime(ctx,128,128,rand,500,3,'rgba(24,17,10,1)','rgba(230,200,140,1)');
	return toTex(canvas,3,1);
}
export function skyTexture() {
	const [canvas,ctx] = cvOf(1024,512);
	const grad = ctx.createLinearGradient(0,0,0,512);
	grad.addColorStop(0,'#2f66b0');
	grad.addColorStop(0.38,'#5f97cc');
	grad.addColorStop(0.66,'#a8c6dd');
	grad.addColorStop(0.88,'#dde4da');
	grad.addColorStop(1,'#e9e2cc');
	R(ctx,grad,0,0,1024,512);
	const glow = ctx.createRadialGradient(700,150,0,700,150,420);
	glow.addColorStop(0,'rgba(255,246,214,0.95)');
	glow.addColorStop(0.25,'rgba(255,238,190,0.45)');
	glow.addColorStop(1,'rgba(255,238,190,0)');
	R(ctx,glow,0,0,1024,512);
	const texture = new T.CanvasTexture(canvas);
	texture.colorSpace = T.SRGBColorSpace;
	return texture;
}
export function buildingTexture() {
	const [canvas,ctx] = cvOf(256,256);
	const rand = prng(1212);
	R(ctx,'#97a1a8',0,0,256,256);
	for (let i = 0; i < 9; i += 1) {
		const x = rand() * 256;
		const grad = ctx.createLinearGradient(x,0,x + 30,0);
		grad.addColorStop(0,'rgba(60,58,50,0.16)');
		grad.addColorStop(1,'rgba(60,58,50,0)');
		R(ctx,grad,x,0,30,256);
	}
	ctx.strokeStyle = 'rgba(52,54,50,0.35)';
	ctx.lineWidth = 2;
	for (let x = 0; x <= 256; x += 64) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,256); ctx.stroke(); }
	for (let y = 0; y <= 256; y += 64) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(256,y); ctx.stroke(); }
	for (let row = 0; row < 8; row += 1) {
		for (let col = 0; col < 6; col += 1) {
			const x = 14 + col * 40;
			const y = 14 + row * 30;
			const lit = rand();
			R(ctx,'rgba(18,20,22,0.85)',x - 3,y - 3,30,23);
			R(ctx,'rgba(255,255,255,0.28)',x - 3,y - 3,30,2);
			const pane = ctx.createLinearGradient(0,y,0,y + 17);
			const base = lit < 0.22 ? ['#d7e2dc','#aebfb8'] : lit < 0.5 ? ['#71879a','#46586a'] : ['#3d4f61','#27333f'];
			pane.addColorStop(0,base[0]);
			pane.addColorStop(1,base[1]);
			R(ctx,pane,x,y,24,17);
			R(ctx,'rgba(240,246,250,0.30)',x + 2,y + 2,9,6);
			R(ctx,'rgba(15,17,19,0.5)',x + 11,y,2,17);
			R(ctx,'rgba(20,22,24,0.55)',x - 2,y + 17,28,3);
			if (rand() < 0.2) {
				R(ctx,'#6d7276',x + 4,y + 21,13,7);
				R(ctx,'rgba(20,20,20,0.4)',x + 4,y + 27,13,2);
			}
		}
	}
	R(ctx,'rgba(30,28,24,0.35)',0,238,256,18);
	R(ctx,'rgba(255,255,255,0.20)',0,236,256,2);
	grime(ctx,256,256,rand,1500,5,'rgba(40,38,32,1)','rgba(226,228,220,1)');
	return toTex(canvas);
}
export function cloudTexture() {
	const [canvas,ctx] = cvOf(256,128);
	const rand = prng(909);
	for (let i = 0; i < 26; i += 1) {
		const x = 40 + rand() * 176;
		const y = 52 + rand() * 26;
		const r = 16 + rand() * 30;
		const grad = ctx.createRadialGradient(x,y,0,x,y,r);
		grad.addColorStop(0,'rgba(255,255,255,0.20)');
		grad.addColorStop(1,'rgba(255,255,255,0)');
		R(ctx,grad,x - r,y - r,r * 2,r * 2);
	}
	const texture = new T.CanvasTexture(canvas);
	texture.colorSpace = T.SRGBColorSpace;
	return texture;
}
export function gunMetalTexture(marking) {
	const [canvas,ctx] = cvOf(256,256);
	const rand = prng(111);
	R(ctx,'#43464c',0,0,256,256);
	for (let i = 0; i < 380; i += 1) {
		ctx.strokeStyle = rand() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.16)';
		ctx.lineWidth = 1;
		const y = rand() * 256;
		ctx.beginPath();
		ctx.moveTo(0,y);
		ctx.lineTo(256,y + rand() * 2 - 1);
		ctx.stroke();
	}
	for (let i = 0; i < 22; i += 1) {
		ctx.strokeStyle = 'rgba(210,214,220,0.35)';
		ctx.lineWidth = 0.8;
		const x = rand() * 256;
		const y = rand() * 256;
		ctx.beginPath();
		ctx.moveTo(x,y);
		ctx.lineTo(x + 8 + rand() * 26,y + rand() * 3 - 1.5);
		ctx.stroke();
	}
	grime(ctx,256,256,rand,900,4,'rgba(10,10,12,1)','rgba(190,196,204,1)');
	if (marking) {
		ctx.fillStyle = 'rgba(226,230,236,0.85)';
		ctx.font = 'bold 21px ui-monospace, monospace';
		ctx.fillText(marking,18,42);
		ctx.font = '13px ui-monospace, monospace';
		ctx.fillStyle = 'rgba(226,230,236,0.5)';
		ctx.fillText('CAL 5.56 · DW ARMORY',18,64);
	}
	return toTex(canvas);
}
export function polymerTexture() {
	const [canvas,ctx] = cvOf(128,128);
	const rand = prng(222);
	R(ctx,'#242322',0,0,128,128);
	ctx.fillStyle = 'rgba(255,255,255,0.10)';
	for (let y = 4; y < 128; y += 8) {
		for (let x = 4 + (y % 16 === 4 ? 0 : 4); x < 128; x += 8) {
			ctx.beginPath();
			ctx.arc(x,y,1.4,0,Math.PI * 2);
			ctx.fill();
		}
	}
	R(ctx,'rgba(0,0,0,0.5)',0,62,128,2);
	grime(ctx,128,128,rand,260,2,'rgba(0,0,0,1)','rgba(200,200,200,1)');
	return toTex(canvas);
}
export function camoTexture() {
	const [canvas,ctx] = cvOf(256,256);
	const rand = prng(333);
	R(ctx,'#9a7c50',0,0,256,256);
	const tones = ['#6f6a3e','#5d4a30','#3f3a30','#b08d5a'];
	for (let i = 0; i < 46; i += 1) {
		ctx.fillStyle = tones[i % tones.length];
		ctx.globalAlpha = 0.5 + rand() * 0.3;
		const x = rand() * 256;
		const y = rand() * 256;
		ctx.beginPath();
		ctx.ellipse(x,y,14 + rand() * 30,8 + rand() * 18,rand() * 3,0,Math.PI * 2);
		ctx.fill();
	}
	ctx.globalAlpha = 1;
	grime(ctx,256,256,rand,700,3,'rgba(30,22,12,1)','rgba(230,205,160,1)');
	return toTex(canvas);
}
export function decalTexture(kind) {
	const [canvas,ctx] = cvOf(256,256);
	const rand = prng(444);
	ctx.clearRect(0,0,256,256);
	if (kind === 'oil') {
		for (let i = 0; i < 9; i += 1) {
			const x = 70 + rand() * 116;
			const y = 70 + rand() * 116;
			const r = 22 + rand() * 52;
			const grad = ctx.createRadialGradient(x,y,0,x,y,r);
			grad.addColorStop(0,'rgba(12,10,8,0.82)');
			grad.addColorStop(0.7,'rgba(14,12,9,0.5)');
			grad.addColorStop(1,'rgba(14,12,9,0)');
			R(ctx,grad,x - r,y - r,r * 2,r * 2);
		}
	} else if (kind === 'arrow') {
		ctx.fillStyle = 'rgba(232,220,190,0.8)';
		ctx.beginPath();
		ctx.moveTo(128,18);
		ctx.lineTo(196,108);
		ctx.lineTo(152,108);
		ctx.lineTo(152,238);
		ctx.lineTo(104,238);
		ctx.lineTo(104,108);
		ctx.lineTo(60,108);
		ctx.closePath();
		ctx.fill();
	} else if (kind === 'cracks') {
		ctx.strokeStyle = 'rgba(16,12,8,0.65)';
		for (let i = 0; i < 7; i += 1) {
			ctx.lineWidth = 1 + rand() * 1.6;
			let x = 30 + rand() * 196;
			let y = 30 + rand() * 196;
			ctx.beginPath();
			ctx.moveTo(x,y);
			for (let j = 0; j < 5; j += 1) {
				x += rand() * 44 - 22;
				y += rand() * 44 - 10;
				ctx.lineTo(x,y);
			}
			ctx.stroke();
		}
	} else if (kind === 'ringA' || kind === 'ringB') {
		ctx.strokeStyle = kind === 'ringA' ? 'rgba(240,166,62,0.9)' : 'rgba(47,174,157,0.9)';
		ctx.lineWidth = 13;
		ctx.beginPath();
		ctx.arc(128,128,104,0,Math.PI * 2);
		ctx.stroke();
		ctx.lineWidth = 4;
		ctx.beginPath();
		ctx.arc(128,128,84,0,Math.PI * 2);
		ctx.stroke();
	} else {
		ctx.fillStyle = kind === 'letterA' ? 'rgba(240,166,62,0.85)' : 'rgba(63,191,174,0.85)';
		ctx.font = 'bold 190px system-ui, sans-serif';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillText(kind === 'letterA' ? 'A' : 'B',128,138);
	}
	ctx.globalCompositeOperation = 'destination-out';
	for (let i = 0; i < 1500; i += 1) {
		ctx.globalAlpha = 0.12 + rand() * 0.4;
		ctx.fillRect(rand() * 256,rand() * 256,1 + rand() * 4,1 + rand() * 4);
	}
	ctx.globalCompositeOperation = 'source-over';
	ctx.globalAlpha = 1;
	const texture = new T.CanvasTexture(canvas);
	texture.colorSpace = T.SRGBColorSpace;
	texture.anisotropy = 4;
	return texture;
}
export function posterTexture(title,sub,color) {
	const [canvas,ctx] = cvOf(256,320);
	const rand = prng(555);
	R(ctx,'#c9b892',0,0,256,320);
	R(ctx,color,0,0,256,14);
	ctx.fillRect(0,292,256,28);
	ctx.fillStyle = '#2b2119';
	ctx.font = 'bold 40px system-ui, sans-serif';
	const words = title.split(' ');
	words.forEach((word,i) => ctx.fillText(word,20,78 + i * 46));
	ctx.font = '17px system-ui, sans-serif';
	ctx.fillStyle = '#57462e';
	const subWords = sub.split(' ');
	let line = '';
	let ly = 78 + words.length * 46 + 16;
	for (const word of subWords) {
		if ((line + word).length > 24) {
			ctx.fillText(line,20,ly);
			ly += 24;
			line = '';
		}
		line += `${word} `;
	}
	if (line) ctx.fillText(line,20,ly);
	ctx.fillStyle = '#1d150e';
	for (let i = 0; i < 5; i += 1) {
		ctx.save();
		ctx.translate(i * 56 - 8,292);
		ctx.beginPath();
		ctx.moveTo(0,28);
		ctx.lineTo(14,28);
		ctx.lineTo(40,0);
		ctx.lineTo(26,0);
		ctx.closePath();
		ctx.fill();
		ctx.restore();
	}
	grime(ctx,256,320,rand,800,4,'rgba(40,30,16,1)','rgba(240,228,200,1)');
	const texture = new T.CanvasTexture(canvas);
	texture.colorSpace = T.SRGBColorSpace;
	texture.anisotropy = 4;
	return texture;
}
export function glowTexture() {
	const [canvas,ctx] = cvOf(128,128);
	const grad = ctx.createRadialGradient(64,64,0,64,64,64);
	grad.addColorStop(0,'rgba(255,255,255,1)');
	grad.addColorStop(0.25,'rgba(255,255,255,0.55)');
	grad.addColorStop(1,'rgba(255,255,255,0)');
	R(ctx,grad,0,0,128,128);
	const texture = new T.CanvasTexture(canvas);
	texture.colorSpace = T.SRGBColorSpace;
	return texture;
}