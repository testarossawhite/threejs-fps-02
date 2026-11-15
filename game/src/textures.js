// Procedural textures, painted on canvases at boot: no image files, no network, the
// same bytes every run (a seeded PRNG does the noise). Each painter returns a
// CanvasTexture ready to drop on a MeshStandardMaterial. The yard reads as dirt and
// worn metal instead of flat colour, which is most of the "finished game" look.
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

// Speckle + blotch pass shared by the matte surfaces: many tiny alpha rects and a
// few big soft stains, so no area of the texture is a single flat tone.
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

// Yard floor: packed dirt over asphalt — warm brown-grey, tyre arcs, pale dust.
export function groundTexture() {
  const [canvas, ctx] = canvasOf(512, 512);
  const rand = prng(101);
  ctx.fillStyle = '#4d3b28';
  ctx.fillRect(0, 0, 512, 512);
  // Large tonal patches so the repeat does not read as wallpaper.
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
  // Tyre arcs swept across the yard.
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

// Perimeter and building walls: vertical steel panels, seams, rivets, rust weeping
// down from the seams and grime rising from the floor line.
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
    // Rivets down each seam.
    ctx.fillStyle = 'rgba(25,18,11,0.9)';
    for (let y = 16; y < 256; y += 32) {
      ctx.beginPath();
      ctx.arc(x + 10, y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // Rust streaks bleeding down from the seam.
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
  // Floor-line grime.
  const grad = ctx.createLinearGradient(0, 176, 0, 256);
  grad.addColorStop(0, 'rgba(20,14,8,0)');
  grad.addColorStop(1, 'rgba(20,14,8,0.55)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 176, 512, 80);
  grime(ctx, 512, 256, rand, 2600, 8, 'rgba(22,16,9,1)', 'rgba(205,175,125,1)');
  return toTexture(canvas, repeatX, 1);
}

// Crates: horizontal planks in a darker frame, corner brackets, stencil wear.
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
    // Wood grain runs.
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
  // Frame and corner brackets.
  ctx.strokeStyle = '#4c361c';
  ctx.lineWidth = 22;
  ctx.strokeRect(0, 0, 256, 256);
  ctx.fillStyle = 'rgba(30,24,20,0.9)';
  for (const [x, y] of [[0, 0], [232, 0], [0, 232], [232, 232]]) ctx.fillRect(x, y, 24, 24);
  grime(ctx, 256, 256, rand, 1500, 6, 'rgba(26,17,8,1)', 'rgba(215,185,130,1)');
  return toTexture(canvas, 1, 1);
}

// Shipping containers: vertical corrugation ribs with light/shade pairs, rust at the
// ribs' feet, a heavier top and bottom rail. Tint comes from the material colour.
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
  // Rust blooming along the bottom rail and around random rib feet.
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

// Barrels: a painted drum with two rolled bands and a worn lid line. The material
// colour tints it (rust red, steel, amber).
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

// Poured concrete for the site platform and low walls: grey-warm, stained, with a
// formwork line across the middle.
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

// Dusk sky for the dome: indigo up top, a mauve band, then the amber afterglow the
// sun has just left at the horizon. Painted wide so it wraps the whole sphere.
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
  // The sun's afterglow, low in the west (the key light comes from -x).
  const glow = ctx.createRadialGradient(180, 430, 0, 180, 430, 340);
  glow.addColorStop(0, 'rgba(255,196,110,0.85)');
  glow.addColorStop(0.4, 'rgba(255,160,80,0.35)');
  glow.addColorStop(1, 'rgba(255,150,70,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 1024, 512);
  // First stars in the upper sky.
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

// One soft cloud blob, alpha-faded at the edges, for billboard clouds catching the
// last light (drawn lit from below: warm base, cool top).
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
