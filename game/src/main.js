// Dustworks Yard: boot and the one loop. A fixed 60 Hz simulation feeds a render at
// the display's rate; per-frame work is only tracer fades and the camera sync.
// ?shot=start|play|plant|end with &seed=N sets up a deterministic frame for a capture,
// renders it twice, then freezes it and sets window.__shotReady.
import * as THREE from 'three';
import { PALETTE } from './palette.js';
import { skyTexture } from './textures.js';
import { mulberry32 } from './rng.js';
import { createWorld } from './world.js';
import { createInput } from './input.js';
import { createPlayer } from './player.js';
import { createWeapons } from './weapons.js';
import { createBots } from './bots.js';
import { createAllies } from './allies.js';
import { createSpike } from './spike.js';
import { createGrenades } from './grenades.js';
import { createAudio } from './audio.js';
import { createHud } from './hud.js';
import { createGame } from './game.js';
import { PHASES } from './state.js';

const FIXED_STEP = 1 / 60;
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seed = Number.parseInt(params.get('seed') ?? '1', 10) || 1;
const random = mulberry32(seed);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
// Filmic colour: ACES rolls the dusk highlights off; output is sRGB.
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.5;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.getElementById('game').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(PALETTE.skyTop);
scene.fog = new THREE.Fog(new THREE.Color(PALETTE.horizon), 36, 100);
// Image-based light: a faint PMREM of the sky, so steel picks up the sunset.
const pmrem = new THREE.PMREMGenerator(renderer);
const envSky = skyTexture();
envSky.mapping = THREE.EquirectangularReflectionMapping;
scene.environment = pmrem.fromEquirectangular(envSky).texture;
scene.environmentIntensity = 0.5;
const camera = new THREE.PerspectiveCamera(74, window.innerWidth / window.innerHeight, 0.05, 160);
scene.add(camera);

const world = createWorld(scene);
const player = createPlayer(world.colliders, world.spawns.ember);
const weapons = createWeapons(camera);
const bots = createBots(scene, world, random);
const allies = createAllies(scene, world, random);
const spike = createSpike(scene, world);
const grenades = createGrenades(scene, world);
const audio = createAudio();
const hud = createHud();
const input = createInput(renderer.domElement, onLockChange);
const game = createGame({ scene, camera, world, player, weapons, bots, allies, spike, grenades, audio, hud, input, random });

let frozen = false;
let accumulator = 0;
let lastTime = performance.now();

hud.setHealth(player.state.health, player.state.maxHealth);
hud.setAmmo(weapons.state.mag, weapons.state.reserve, weapons.def().name, 0, 0, 'frag');
hud.setMoney(800);
hud.setTimer(100, false);
hud.setScore(0, 0, 1);
hud.setSpike('carried', '', 0);
hud.onPlay(() => {
  if (shot) return;
  audio.resume();
  game.onPlayButton();
});
hud.onBuy((id) => {
  if (shot) return;
  game.buyItem(id);
});

function onLockChange(locked) {
  if (shot) return;
  if (locked) {
    if (game.state.phase === PHASES.LIVE) hud.hideOverlay();
  } else if (game.state.phase === PHASES.LIVE && player.state.alive) {
    hud.showOverlay('paused', {});
  }
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  if (!frozen) {
    const look = input.takeLook();
    player.look(look.x, look.y);
    accumulator += dt;
    let steps = 0;
    while (accumulator >= FIXED_STEP && steps < 5) {
      game.step(FIXED_STEP);
      accumulator -= FIXED_STEP;
      steps += 1;
    }
    if (accumulator > FIXED_STEP * 5) accumulator = 0;
    game.frame(dt);
    game.syncCamera(camera);
    input.clearPressed();
  }
  renderer.render(scene, camera);
}

function paintTwiceThenReady() {
  let painted = 0;
  function paint() {
    requestAnimationFrame(paint);
    game.syncCamera(camera);
    renderer.render(scene, camera);
    painted += 1;
    if (painted === 2) {
      window.__shotReady = true;
      frozen = true;
    }
  }
  requestAnimationFrame(paint);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

game.syncCamera(camera);
if (shot) {
  game.setupShot(shot);
  game.syncCamera(camera);
  paintTwiceThenReady();
} else {
  hud.showOverlay('start', {});
  requestAnimationFrame(frame);
}
