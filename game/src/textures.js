// Procedural textures, painted on canvases at boot: no image files, no network,
// the same bytes every run (a seeded PRNG does the noise). Each painter returns a
// CanvasTexture for a MeshStandardMaterial.
import * as THREE from 'three';

// Small deterministic PRNG so the grime lands in the same place on every load.
function prng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvasOf(w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return [canvas, canvas.getContext('2d')];
}

function toTexture(canvas, repeatX = 1, repeatY = 1) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  texture.anisotropy = 4;
  return texture;
}

// Speckle + blotch pass shared by the matte surfaces, so no area is one flat tone.
function grime(ctx, w, h, rand, speckles, stains, dark, light) {
  for (let i = 0; i < speckles; i += 1) {
    const v = rand();
    ctx.fillStyle = v < 0.5 ? dark : light;
    ctx.globalAlpha = 0.04 + rand() * 0.1;
    const s = 1 + rand() * 3;
    ctx.fillRect(rand() * w, rand() * h, s, s);
  }
  for (let i = 0; i < stains; i += 1) {
    const x = rand() * w;
    const y = rand() * h;
    const r = 20 + rand() * 70;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, dark);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = 0.05 + rand() * 0.09;
    ctx.fillStyle = grad;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  ctx.globalAlpha = 1;
}

// Yard floor: packed dirt over asphalt, tyre arcs, pale dust.
export function groundTexture() {
  const [canvas, ctx] = canvasOf(512, 512);
  const rand = prng(101);
  ctx.fillStyle = '#4d3b28';
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 26; i += 1) {
    const x = rand() * 512;
    const y = rand() * 512;
    const r = 40 + rand() * 120;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    const tone = rand() < 0.5 ? 'rgba(122,94,60,0.20)' : 'rgba(38,28,18,0.22)';
    grad.addColorStop(0, tone);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  ctx.strokeStyle = 'rgba(30,22,14,0.35)';
  for (let i = 0; i < 7; i += 1) {
    ctx.lineWidth = 5 + rand() * 7;
    ctx.beginPath();
    ctx.arc(rand() * 512, rand() * 512, 40 + rand() * 130, rand() * 3, rand() * 2 + 0.6);
    ctx.stroke();
  }
  grime(ctx, 512, 512, rand, 5200, 14, 'rgba(24,17,10,1)', 'rgba(196,164,116,1)');
  return toTexture(canvas, 5, 4.5);
}

// Walls: vertical steel panels, seams, rivets, rust weeping down, floor-line grime.
export function wallTexture(repeatX = 6) {
  const [canvas, ctx] = canvasOf(512, 256);
  const rand = prng(202);
  ctx.fillStyle = '#5d4a35';
  ctx.fillRect(0, 0, 512, 256);
  const panel = 128;
  for (let x = 0; x < 512; x += panel) {
    ctx.fillStyle = `rgba(${20 + rand() * 30},${14 + rand() * 20},${8 + rand() * 12},0.18)`;
    ctx.fillRect(x, 0, panel, 256);
    ctx.fillStyle = 'rgba(18,12,7,0.85)';
    ctx.fillRect(x, 0, 3, 256);
    ctx.fillStyle = 'rgba(230,205,160,0.20)';
    ctx.fillRect(x + 3, 0, 2, 256);
    ctx.fillStyle = 'rgba(25,18,11,0.9)';
    for (let y = 16; y < 256; y += 32) {
      ctx.beginPath();
      ctx.arc(x + 10, y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    for (let i = 0; i < 5; i += 1) {
      const sx = x + 4 + rand() * 14;
      const len = 40 + rand() * 130;
      const grad = ctx.createLinearGradient(0, 0, 0, len);
      grad.addColorStop(0, 'rgba(146,74,40,0.5)');
      grad.addColorStop(1, 'rgba(146,74,40,0)');
      ctx.fillStyle = grad;
      ctx.save();
      ctx.translate(sx, 0);
      ctx.fillRect(0, 0, 3 + rand() * 5, len);
      ctx.restore();
    }
  }
  const grad = ctx.createLinearGradient(0, 176, 0, 256);
  grad.addColorStop(0, 'rgba(20,14,8,0)');
  grad.addColorStop(1, 'rgba(20,14,8,0.55)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 176, 512, 80);
  grime(ctx, 512, 256, rand, 2600, 8, 'rgba(22,16,9,1)', 'rgba(205,175,125,1)');
  return toTexture(canvas, repeatX, 1);
}

// Crates: horizontal planks in a darker frame, corner brackets.
export function crateTexture() {
  const [canvas, ctx] = canvasOf(256, 256);
  const rand = prng(303);
  ctx.fillStyle = '#7a5c36';
  ctx.fillRect(0, 0, 256, 256);
  const plank = 52;
  for (let y = 0; y < 256; y += plank) {
    ctx.fillStyle = `rgba(${30 + rand() * 26},${18 + rand() * 16},${6 + rand() * 10},0.16)`;
    ctx.fillRect(0, y, 256, plank);
    ctx.fillStyle = 'rgba(24,15,7,0.8)';
    ctx.fillRect(0, y, 256, 3);
    ctx.strokeStyle = 'rgba(52,34,14,0.35)';
    ctx.lineWidth = 1.4;
    for (let i = 0; i < 6; i += 1) {
      const gy = y + 6 + rand() * (plank - 12);
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.bezierCurveTo(80, gy + rand() * 4 - 2, 170, gy + rand() * 4 - 2, 256, gy);
      ctx.stroke();
    }
  }
  ctx.strokeStyle = '#4c361c';
  ctx.lineWidth = 22;
  ctx.strokeRect(0, 0, 256, 256);
  ctx.fillStyle = 'rgba(30,24,20,0.9)';
  for (const [x, y] of [[0, 0], [232, 0], [0, 232], [232, 232]]) ctx.fillRect(x, y, 24, 24);
  grime(ctx, 256, 256, rand, 1500, 6, 'rgba(26,17,8,1)', 'rgba(215,185,130,1)');
  return toTexture(canvas, 1, 1);
}

// Containers: corrugation ribs, rust at the feet, heavy rails. Tint from material.
export function containerTexture() {
  const [canvas, ctx] = canvasOf(256, 256);
  const rand = prng(404);
  ctx.fillStyle = '#b9b4ac';
  ctx.fillRect(0, 0, 256, 256);
  const rib = 22;
  for (let x = 0; x < 256; x += rib) {
    ctx.fillStyle = 'rgba(255,255,255,0.20)';
    ctx.fillRect(x, 0, 6, 256);
    ctx.fillStyle = 'rgba(40,36,32,0.28)';
    ctx.fillRect(x + rib - 7, 0, 7, 256);
  }
  ctx.fillStyle = 'rgba(52,46,40,0.85)';
  ctx.fillRect(0, 0, 256, 14);
  ctx.fillRect(0, 242, 256, 14);
  for (let i = 0; i < 16; i += 1) {
    const x = rand() * 256;
    const grad = ctx.createRadialGradient(x, 250, 0, x, 250, 16 + rand() * 30);
    grad.addColorStop(0, 'rgba(150,76,38,0.55)');
    grad.addColorStop(1, 'rgba(150,76,38,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(x - 46, 190, 92, 66);
  }
  grime(ctx, 256, 256, rand, 1700, 7, 'rgba(38,32,26,1)', 'rgba(235,228,215,1)');
  return toTexture(canvas, 2, 1);
}

// Barrels: a painted drum with two rolled bands. Tint from the material colour.
export function barrelTexture() {
  const [canvas, ctx] = canvasOf(128, 256);
  const rand = prng(505);
  ctx.fillStyle = '#c9c4bc';
  ctx.fillRect(0, 0, 128, 256);
  for (const y of [58, 168]) {
    ctx.fillStyle = 'rgba(38,34,30,0.5)';
    ctx.fillRect(0, y, 128, 12);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(0, y - 4, 128, 4);
  }
  ctx.fillStyle = 'rgba(38,34,30,0.4)';
  ctx.fillRect(0, 0, 128, 7);
  grime(ctx, 128, 256, rand, 700, 5, 'rgba(40,34,28,1)', 'rgba(240,234,222,1)');
  return toTexture(canvas, 1, 1);
}

// Poured concrete: grey-warm, stained, a formwork line across the middle.
export function concreteTexture() {
  const [canvas, ctx] = canvasOf(256, 256);
  const rand = prng(606);
  ctx.fillStyle = '#6f6152';
  ctx.fillRect(0, 0, 256, 256);
  ctx.fillStyle = 'rgba(30,24,17,0.5)';
  ctx.fillRect(0, 126, 256, 3);
  ctx.fillStyle = 'rgba(235,220,190,0.16)';
  ctx.fillRect(0, 129, 256, 2);
  grime(ctx, 256, 256, rand, 2400, 12, 'rgba(28,22,15,1)', 'rgba(215,198,168,1)');
  return toTexture(canvas, 2, 2);
}

// Hazard chevrons for site thresholds and the silo base ring.
export function hazardTexture() {
  const [canvas, ctx] = canvasOf(128, 128);
  ctx.fillStyle = '#c8912f';
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = '#2b2119';
  for (let i = -2; i < 6; i += 1) {
    ctx.save();
    ctx.translate(i * 36, 0);
    ctx.rotate(0);
    ctx.beginPath();
    ctx.moveTo(0, 128);
    ctx.lineTo(18, 128);
    ctx.lineTo(82, 0);
    ctx.lineTo(64, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  const rand = prng(707);
  grime(ctx, 128, 128, rand, 500, 3, 'rgba(24,17,10,1)', 'rgba(230,200,140,1)');
  return toTexture(canvas, 3, 1);
}

// Dusk sky: indigo up top, a mauve band, amber afterglow at the horizon.
export function skyTexture() {
  const [canvas, ctx] = canvasOf(1024, 512);
  const grad = ctx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, '#1d2440');
  grad.addColorStop(0.42, '#3c3350');
  grad.addColorStop(0.62, '#7a4a3a');
  grad.addColorStop(0.78, '#c47a35');
  grad.addColorStop(0.9, '#e8a34e');
  grad.addColorStop(1, '#8a5a30');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1024, 512);
  const glow = ctx.createRadialGradient(180, 430, 0, 180, 430, 340);
  glow.addColorStop(0, 'rgba(255,196,110,0.85)');
  glow.addColorStop(0.4, 'rgba(255,160,80,0.35)');
  glow.addColorStop(1, 'rgba(255,150,70,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 1024, 512);
  const rand = prng(808);
  ctx.fillStyle = '#dfe6ff';
  for (let i = 0; i < 130; i += 1) {
    const y = rand() * 190;
    ctx.globalAlpha = (1 - y / 200) * (0.25 + rand() * 0.6);
    const s = rand() < 0.12 ? 2 : 1;
    ctx.fillRect(rand() * 1024, y, s, s);
  }
  ctx.globalAlpha = 1;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// One soft cloud blob, alpha-faded at the edges, for billboards and stack smoke.
export function cloudTexture() {
  const [canvas, ctx] = canvasOf(256, 128);
  const rand = prng(909);
  for (let i = 0; i < 26; i += 1) {
    const x = 40 + rand() * 176;
    const y = 52 + rand() * 26;
    const r = 16 + rand() * 30;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, 'rgba(214,178,160,0.16)');
    grad.addColorStop(1, 'rgba(214,178,160,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// Gunmetal: near-black steel, horizontal brushing, wear scratches, stencil marking.
export function gunMetalTexture(marking) {
  const [canvas, ctx] = canvasOf(256, 256);
  const rand = prng(111);
  ctx.fillStyle = '#43464c';
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 380; i += 1) {
    ctx.strokeStyle = rand() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.16)';
    ctx.lineWidth = 1;
    const y = rand() * 256;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(256, y + rand() * 2 - 1);
    ctx.stroke();
  }
  for (let i = 0; i < 22; i += 1) {
    ctx.strokeStyle = 'rgba(210,214,220,0.35)';
    ctx.lineWidth = 0.8;
    const x = rand() * 256;
    const y = rand() * 256;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 8 + rand() * 26, y + rand() * 3 - 1.5);
    ctx.stroke();
  }
  grime(ctx, 256, 256, rand, 900, 4, 'rgba(10,10,12,1)', 'rgba(190,196,204,1)');
  if (marking) {
    ctx.fillStyle = 'rgba(226,230,236,0.85)';
    ctx.font = 'bold 21px ui-monospace, monospace';
    ctx.fillText(marking, 18, 42);
    ctx.font = '13px ui-monospace, monospace';
    ctx.fillStyle = 'rgba(226,230,236,0.5)';
    ctx.fillText('CAL 5.56 · DW ARMORY', 18, 64);
  }
  return toTexture(canvas, 1, 1);
}

// Polymer furniture: near-black with a stippled grip texture and mould seams.
export function polymerTexture() {
  const [canvas, ctx] = canvasOf(128, 128);
  const rand = prng(222);
  ctx.fillStyle = '#242322';
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = 'rgba(255,255,255,0.10)';
  for (let y = 4; y < 128; y += 8) {
    for (let x = 4 + (y % 16 === 4 ? 0 : 4); x < 128; x += 8) {
      ctx.beginPath();
      ctx.arc(x, y, 1.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(0, 62, 128, 2);
  grime(ctx, 128, 128, rand, 260, 2, 'rgba(0,0,0,1)', 'rgba(200,200,200,1)');
  return toTexture(canvas, 1, 1);
}

// Desert camo for the carbine receiver and the squad's sleeves.
export function camoTexture() {
  const [canvas, ctx] = canvasOf(256, 256);
  const rand = prng(333);
  ctx.fillStyle = '#9a7c50';
  ctx.fillRect(0, 0, 256, 256);
  const tones = ['#6f6a3e', '#5d4a30', '#3f3a30', '#b08d5a'];
  for (let i = 0; i < 46; i += 1) {
    ctx.fillStyle = tones[i % tones.length];
    ctx.globalAlpha = 0.5 + rand() * 0.3;
    const x = rand() * 256;
    const y = rand() * 256;
    ctx.beginPath();
    ctx.ellipse(x, y, 14 + rand() * 30, 8 + rand() * 18, rand() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  grime(ctx, 256, 256, rand, 700, 3, 'rgba(30,22,12,1)', 'rgba(230,205,160,1)');
  return toTexture(canvas, 1, 1);
}

// Ground decals, worn transparent: oil stains, an arrow, site letters, cracks.
// Speckled with destination-out so the dirt shows through the wear.
export function decalTexture(kind) {
  const [canvas, ctx] = canvasOf(256, 256);
  const rand = prng(444);
  ctx.clearRect(0, 0, 256, 256);
  if (kind === 'oil') {
    for (let i = 0; i < 9; i += 1) {
      const x = 70 + rand() * 116;
      const y = 70 + rand() * 116;
      const r = 22 + rand() * 52;
      const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, 'rgba(12,10,8,0.82)');
      grad.addColorStop(0.7, 'rgba(14,12,9,0.5)');
      grad.addColorStop(1, 'rgba(14,12,9,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
  } else if (kind === 'arrow') {
    ctx.fillStyle = 'rgba(232,220,190,0.8)';
    ctx.beginPath();
    ctx.moveTo(128, 18);
    ctx.lineTo(196, 108);
    ctx.lineTo(152, 108);
    ctx.lineTo(152, 238);
    ctx.lineTo(104, 238);
    ctx.lineTo(104, 108);
    ctx.lineTo(60, 108);
    ctx.closePath();
    ctx.fill();
  } else if (kind === 'cracks') {
    ctx.strokeStyle = 'rgba(16,12,8,0.65)';
    for (let i = 0; i < 7; i += 1) {
      ctx.lineWidth = 1 + rand() * 1.6;
      let x = 30 + rand() * 196;
      let y = 30 + rand() * 196;
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let j = 0; j < 5; j += 1) {
        x += rand() * 44 - 22;
        y += rand() * 44 - 10;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  } else {
    ctx.fillStyle = kind === 'letterA' ? 'rgba(240,166,62,0.85)' : 'rgba(63,191,174,0.85)';
    ctx.font = 'bold 190px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(kind === 'letterA' ? 'A' : 'B', 128, 138);
  }
  ctx.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 1500; i += 1) {
    ctx.globalAlpha = 0.12 + rand() * 0.4;
    ctx.fillRect(rand() * 256, rand() * 256, 1 + rand() * 4, 1 + rand() * 4);
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

// A worn paper poster for the walls: stencil headline, small print, hazard foot.
export function posterTexture(title, sub, color) {
  const [canvas, ctx] = canvasOf(256, 320);
  const rand = prng(555);
  ctx.fillStyle = '#c9b892';
  ctx.fillRect(0, 0, 256, 320);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 256, 14);
  ctx.fillRect(0, 292, 256, 28);
  ctx.fillStyle = '#2b2119';
  ctx.font = 'bold 40px system-ui, sans-serif';
  const words = title.split(' ');
  words.forEach((word, i) => ctx.fillText(word, 20, 78 + i * 46));
  ctx.font = '17px system-ui, sans-serif';
  ctx.fillStyle = '#57462e';
  const subWords = sub.split(' ');
  let line = '';
  let ly = 78 + words.length * 46 + 16;
  for (const word of subWords) {
    if ((line + word).length > 24) {
      ctx.fillText(line, 20, ly);
      ly += 24;
      line = '';
    }
    line += `${word} `;
  }
  if (line) ctx.fillText(line, 20, ly);
  ctx.fillStyle = '#1d150e';
  for (let i = 0; i < 5; i += 1) {
    ctx.save();
    ctx.translate(i * 56 - 8, 292);
    ctx.beginPath();
    ctx.moveTo(0, 28);
    ctx.lineTo(14, 28);
    ctx.lineTo(40, 0);
    ctx.lineTo(26, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  grime(ctx, 256, 320, rand, 800, 4, 'rgba(40,30,16,1)', 'rgba(240,228,200,1)');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

// Radial glow dot: sun halo, lamp halos and hit sparks all sample this falloff.
export function glowTexture() {
  const [canvas, ctx] = canvasOf(128, 128);
  const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
