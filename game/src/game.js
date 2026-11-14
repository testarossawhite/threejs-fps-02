// The game: one state object, one fixed-step simulation, and the wiring between
// player, weapons, bots, spike, grenades and HUD. Rounds end win or loss, money is
// earned and spent in the buy phase, and the first side to 4 rounds takes the yard.
import * as THREE from 'three';
import {
  PHASES, MATCH_TARGET, MAX_ROUNDS, ROUND_SECONDS, BUY_SECONDS, PLANT_SECONDS,
  SPIKE_SECONDS, PRICES, REWARDS, createState, resetMatch,
} from './state.js';
import { WEAPONS } from './weapons.js';

const ROUND_END_SECONDS = 3.5;
const TRACER_POOL = 8;
const TRACER_LIFE = 0.09;

const _dir = new THREE.Vector3();
const _muzzle = new THREE.Vector3();
const _noisePos = new THREE.Vector3();
const _end = new THREE.Vector3();

export function createGame(deps) {
  const { scene, camera, world, player, weapons, bots, spike, grenades, audio, hud, input, random } = deps;
  const state = createState();
  const owned = { pistol: true, smg: false, rifle: false };
  const raycaster = new THREE.Raycaster();
  raycaster.far = 90;

  // Invisible box the bots shoot at; the player's own rays never include it.
  const playerHitbox = new THREE.Mesh(
    new THREE.BoxGeometry(0.68, 1.72, 0.68),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false }),
  );
  scene.add(playerHitbox);

  // Tracer pool: stretched boxes, reused, never allocated in the loop.
  const tracers = [];
  const tracerGeometry = new THREE.BoxGeometry(0.008, 0.008, 1);
  const tracerMaterial = new THREE.MeshBasicMaterial({ color: 0xffc46b, transparent: true, opacity: 0.55 });
  for (let i = 0; i < TRACER_POOL; i += 1) {
    const mesh = new THREE.Mesh(tracerGeometry, tracerMaterial.clone());
    mesh.visible = false;
    scene.add(mesh);
    tracers.push({ mesh, life: 0 });
  }
  let tracerIndex = 0;

  let elapsed = 0;
  let noise = null;
  let grenadeCooldown = 0;
  let shotMode = null;
  const body = player.state;

  function fireTracer(from, to) {
    const tracer = tracers[tracerIndex];
    tracerIndex = (tracerIndex + 1) % TRACER_POOL;
    _dir.subVectors(to, from);
    const len = _dir.length();
    if (len < 0.1) return;
    // The box is centred on its midpoint; a fixed 0.5 offset used to poke it through
    // the camera, which read as a giant beam across the frame.
    tracer.mesh.position.copy(from).addScaledVector(_dir, len / 2);
    tracer.mesh.lookAt(to);
    tracer.mesh.scale.set(1, 1, len);
    tracer.mesh.material.opacity = 0.55;
    tracer.mesh.visible = true;
    tracer.life = TRACER_LIFE;
  }

  function muzzlePoint() {
    // Start the tracer a metre out so its near end never fills the lens.
    camera.getWorldDirection(_dir);
    _muzzle.copy(camera.position).addScaledVector(_dir, 1.0);
    _muzzle.x += Math.cos(body.yaw) * 0.18;
    _muzzle.z -= Math.sin(body.yaw) * 0.18;
    _muzzle.y -= 0.14;
    return _muzzle;
  }

  function shoot(spread) {
    if (!weapons.takeRound()) return;
    camera.getWorldDirection(_dir);
    _dir.x += (random() * 2 - 1) * spread;
    _dir.y += (random() * 2 - 1) * spread;
    _dir.z += (random() * 2 - 1) * spread;
    _dir.normalize();
    scene.updateMatrixWorld(true);
    raycaster.set(camera.position, _dir);
    const targets = world.shootables.concat(bots.hitMeshes);
    const hit = raycaster.intersectObjects(targets, false)[0];
    const end = hit ? hit.point : _end.copy(camera.position).addScaledVector(_dir, 60);
    fireTracer(muzzlePoint(), end);
    if (hit && hit.object.userData.bot) {
      const bot = hit.object.userData.bot;
      const head = hit.object.userData.part === 'head';
      const def = weapons.def();
      const died = bots.damage(hit.object, head ? def.headDamage : def.damage);
      hud.hitMarker(!!died, died ? 4000 : 90);
      audio.hit();
      if (died) {
        state.kills += 1;
        state.money += REWARDS.kill;
        hud.killfeed(`You eliminated Rust-${bot.id + 1}${head ? ' (headshot)' : ''}`, true);
        audio.kill();
      }
    }
    weapons.pullTrigger();
    player.recoil(weapons.def().kick * (0.8 + random() * 0.4), (random() * 2 - 1) * 0.003);
    audio.shot();
    _noisePos.copy(body.position);
    noise = { pos: _noisePos, time: elapsed };
    hud.setAmmo(weapons.state.mag, weapons.state.reserve, weapons.def().name, weapons.state.frags, weapons.state.smokes, weapons.state.selectedGrenade);
  }

  function damagePlayer(amount, fromPos) {
    if (!body.alive || state.phase !== PHASES.LIVE) return;
    const final = body.armour ? Math.round(amount * 0.65) : amount;
    body.health -= final;
    hud.damageFlash();
    audio.hurt();
    if (body.health <= 0) {
      body.health = 0;
      body.alive = false;
      state.deaths += 1;
      if (spike.state.status !== 'planted') endRound(false, 'You were eliminated');
    }
  }

  function damageBot(bot, amount) {
    const died = bots.damage(bot.torso, amount);
    if (died) {
      state.kills += 1;
      state.money += REWARDS.kill;
      hud.killfeed(`Frag eliminated Rust-${bot.id + 1}`, true);
      audio.kill();
    }
  }

  function botContext() {
    return {
      time: elapsed,
      playerPos: body.position,
      playerAlive: body.alive,
      playerSpeed: player.groundSpeed(),
      playerCrouching: body.crouching,
      spikePlanted: spike.state.status === 'planted',
      spikeSite: spike.state.site ? spike.state.site.name : '',
      spikePos: spike.state.pos,
      noise,
      smokeBlocks: (a, b) => grenades.smokeBlocks(a, b),
      playerHitbox,
      onBotShot(bot, from, to, damage, headshot) {
        fireTracer(from, to);
        audio.enemyShot();
        if (damage > 0) damagePlayer(damage, from);
      },
      onDefused() {
        spike.defused();
        endRound(false, 'Rust defused the spike');
      },
    };
  }

  function grenadeContext() {
    return {
      playerPos: body.position,
      bots: bots.items,
      damagePlayer: (dmg) => damagePlayer(dmg, null),
      damageBot: (bot, dmg) => damageBot(bot, dmg),
      onExplosion(pos, radius) {
        audio.explosion();
        _noisePos.copy(pos);
        noise = { pos: _noisePos, time: elapsed };
      },
    };
  }

  function endRound(won, reason) {
    if (state.phase !== PHASES.LIVE) return;
    state.phase = PHASES.ROUND_END;
    state.phaseTime = 0;
    state.roundReason = reason;
    let earned = 0;
    if (won) {
      state.roundsWon += 1;
      earned = REWARDS.roundWin + (spike.state.status === 'planted' || spike.state.status === 'exploded' ? REWARDS.plant : 0);
      audio.roundWin();
    } else {
      state.roundsLost += 1;
      earned = REWARDS.roundLoss;
      audio.roundLose();
    }
    state.money += earned;
    state.earned = earned;
    if (document.pointerLockElement) document.exitPointerLock();
    hud.showOverlay('roundEnd', { won, reason, wonRounds: state.roundsWon, lost: state.roundsLost, earned });
    hud.setScore(state.roundsWon, state.roundsLost, state.round);
  }

  function startBuy() {
    state.phase = PHASES.BUY;
    state.phaseTime = 0;
    player.reset(world.spawns.ember);
    bots.reset();
    spike.reset();
    grenades.reset();
    weapons.equip(state.loadout);
    body.armour = state.loadout.armour;
    state.loadout.armour = false;
    hud.setHealth(body.health, body.maxHealth);
    hud.setAmmo(weapons.state.mag, weapons.state.reserve, weapons.def().name, weapons.state.frags, weapons.state.smokes, weapons.state.selectedGrenade);
    hud.setMoney(state.money);
    hud.setSpike('carried', '', 0);
    hud.setPlant(0, '');
    hud.setScore(state.roundsWon, state.roundsLost, state.round);
    hud.showOverlay('buy', { round: state.round, money: state.money, loadout: state.loadout });
  }

  function startRound() {
    if (state.roundsWon >= MATCH_TARGET || state.roundsLost >= MATCH_TARGET || state.round > MAX_ROUNDS) {
      endMatch();
      return;
    }
    state.phase = PHASES.LIVE;
    state.phaseTime = 0;
    state.roundTimer = ROUND_SECONDS;
    spike.reset();
    hud.hideOverlay();
    hud.setTimer(state.roundTimer, false);
    hud.setSpike('carried', '', 0);
    hud.setScore(state.roundsWon, state.roundsLost, state.round);
    input.requestLock();
    audio.resume();
  }

  function endMatch() {
    state.phase = PHASES.MATCH_END;
    state.phaseTime = 0;
    const won = state.roundsWon > state.roundsLost;
    state.matchWinner = won ? 'Ember' : 'Rust';
    if (document.pointerLockElement) document.exitPointerLock();
    hud.showOverlay('matchEnd', { won, wonRounds: state.roundsWon, lost: state.roundsLost, kills: state.kills, plants: state.plants });
  }

  function startMatch() {
    resetMatch(state);
    owned.pistol = true;
    owned.smg = false;
    owned.rifle = false;
    state.round = 1;
    startBuy();
  }

  function buyItem(id) {
    if (state.phase !== PHASES.BUY) return;
    const price = PRICES[id];
    if (price === undefined || state.money < price) return;
    if (id === 'rifle' || id === 'smg' || id === 'pistol') {
      if (owned[id]) return;
      owned[id] = true;
      state.loadout.primary = id;
    } else if (id === 'frag') {
      if (state.loadout.frags >= 2) return;
      state.loadout.frags += 1;
    } else if (id === 'smoke') {
      if (state.loadout.smokes >= 2) return;
      state.loadout.smokes += 1;
    } else if (id === 'armour') {
      if (state.loadout.armour) return;
      state.loadout.armour = true;
    }
    state.money -= price;
    audio.buy();
    hud.setMoney(state.money);
    hud.showOverlay('buy', { round: state.round, money: state.money, loadout: state.loadout });
  }

  function onPlayButton() {
    if (state.phase === PHASES.MENU) startMatch();
    else if (state.phase === PHASES.BUY) startRound();
    else if (state.phase === PHASES.ROUND_END) startBuy();
    else if (state.phase === PHASES.MATCH_END) startMatch();
    else if (state.phase === PHASES.LIVE) input.requestLock();
  }

  function step(dt) {
    elapsed += dt;
    if (state.phase === PHASES.ROUND_END) {
      state.phaseTime += dt;
      if (state.phaseTime >= ROUND_END_SECONDS) {
        if (state.roundsWon >= MATCH_TARGET || state.roundsLost >= MATCH_TARGET || state.round >= MAX_ROUNDS) {
          endMatch();
        } else {
          state.round += 1;
          startBuy();
        }
      }
      return;
    }
    if (state.phase === PHASES.BUY) {
      state.phaseTime += dt;
      hud.setTimer(Math.max(0, BUY_SECONDS - state.phaseTime), false);
      if (input.takePressed('Enter')) startRound();
      else if (input.takePressed('KeyB')) startRound();
      else if (input.takePressed('Digit1')) buyItem('rifle');
      else if (input.takePressed('Digit2')) buyItem('smg');
      else if (input.takePressed('Digit3')) buyItem('pistol');
      else if (input.takePressed('Digit4')) buyItem('frag');
      else if (input.takePressed('Digit5')) buyItem('smoke');
      else if (input.takePressed('Digit6')) buyItem('armour');
      return;
    }
    if (state.phase !== PHASES.LIVE) return;

    state.phaseTime += dt;
    grenadeCooldown = Math.max(0, grenadeCooldown - dt);

    // Round clock, or the spike clock once planted.
    if (spike.state.status === 'planted') {
      state.roundTimer = spike.state.timer;
    } else {
      state.roundTimer -= dt;
      if (state.roundTimer <= 0) {
        endRound(false, 'Time expired — Rust holds the yard');
        return;
      }
    }

    if (body.alive) player.step(dt, input.state.keys);
    weapons.step(dt);
    bots.step(dt, botContext());
    if (state.phase !== PHASES.LIVE) return;
    spike.step(dt, {
      onBeep: () => audio.beep(),
      onExploded: (site) => endRound(true, `Spike detonated at Site ${site.name}`),
    });
    if (state.phase !== PHASES.LIVE) return;
    grenades.step(dt, grenadeContext());

    // Planting: hold E inside a site, standing still.
    if (body.alive && spike.state.status === 'carried' && input.state.keys.has('KeyE')) {
      const site = world.siteAt(body.position.x, body.position.z);
      if (site && player.groundSpeed() < 0.8) {
        spike.plantTick(dt, body.position, (plantedSite) => {
          state.plants += 1;
          state.money += REWARDS.plant;
          hud.killfeed(`Spike planted at Site ${plantedSite.name}`, true);
          audio.plant();
        });
        hud.setPlant(spike.state.plantProgress / PLANT_SECONDS, 'PLANTING SPIKE…');
      } else {
        spike.state.plantProgress = 0;
        hud.setPlant(0, '');
      }
    } else {
      spike.state.plantProgress = 0;
      hud.setPlant(0, '');
    }

    // Firing, reloading, weapon switching, grenades.
    if (body.alive) {
      if (input.state.firing && weapons.ready()) {
        // Auto weapons fire while held; the semi-auto pistol fires once per click.
        if (weapons.def().auto || input.takePressed('MouseDown')) {
          shoot(shotMode ? 0 : weapons.spread(player.groundSpeed()));
        }
      }
      if (input.takePressed('KeyR')) {
        weapons.reload();
        audio.reload();
      }
      if (input.takePressed('Digit1') && owned.pistol) weapons.select('pistol');
      if (input.takePressed('Digit2') && owned.smg) weapons.select('smg');
      if (input.takePressed('Digit3') && owned.rifle) weapons.select('rifle');
      if (input.takePressed('KeyQ')) {
        weapons.state.selectedGrenade = weapons.state.selectedGrenade === 'frag' ? 'smoke' : 'frag';
      }
      if (input.takePressed('KeyG') && grenadeCooldown <= 0) {
        const kind = weapons.state.selectedGrenade;
        const count = kind === 'frag' ? weapons.state.frags : weapons.state.smokes;
        if (count > 0) {
          camera.getWorldDirection(_dir);
          const from = camera.position.clone().addScaledVector(_dir, 0.6);
          grenades.throwGrenade(kind, from, _dir);
          if (kind === 'frag') weapons.state.frags -= 1;
          else weapons.state.smokes -= 1;
          grenadeCooldown = 0.5;
          hud.setAmmo(weapons.state.mag, weapons.state.reserve, weapons.def().name, weapons.state.frags, weapons.state.smokes, weapons.state.selectedGrenade);
        }
      }
    }

    // Win by elimination.
    if (bots.aliveCount() === 0) {
      endRound(true, 'All Rust bots eliminated');
      return;
    }

    // Player hitbox follows the body for bot rays.
    playerHitbox.position.set(body.position.x, body.position.y + 0.86, body.position.z);
    hud.setHealth(body.health, body.maxHealth);
    hud.setAmmo(weapons.state.mag, weapons.state.reserve, weapons.def().name, weapons.state.frags, weapons.state.smokes, weapons.state.selectedGrenade);
    hud.setTimer(state.roundTimer, spike.state.status === 'planted');
    hud.setMoney(state.money);
    hud.setSpike(spike.state.status, spike.state.site ? spike.state.site.name : '', spike.state.timer);
    hud.setCrosshairSpread(3 + weapons.spread(player.groundSpeed()) * 420);
  }

  function frame(dt) {
    // Per-frame visual only: tracer fade. (Weapon view-model steps in step().)
    for (const tracer of tracers) {
      if (!tracer.mesh.visible) continue;
      if (tracer.life > 0) {
        tracer.life -= dt;
        tracer.mesh.material.opacity = Math.max(0, tracer.life / TRACER_LIFE) * 0.9;
        if (tracer.life <= 0) tracer.mesh.visible = false;
      }
    }
  }

  function syncCamera(cameraOut) {
    cameraOut.position.set(body.position.x, body.position.y + body.eye, body.position.z);
    cameraOut.rotation.set(body.pitch, body.yaw, 0, 'YXZ');
  }

  function aimAt(point) {
    const dx = point.x - body.position.x;
    const dy = point.y - (body.position.y + body.eye);
    const dz = point.z - body.position.z;
    const len = Math.hypot(dx, dy, dz) || 1;
    body.yaw = Math.atan2(-dx, -dz);
    body.pitch = Math.asin(Math.max(-1, Math.min(1, dy / len)));
  }

  function settle(steps) {
    for (let i = 0; i < steps; i += 1) step(1 / 60);
  }

  function setupShot(name) {
    shotMode = name;
    hud.hideOverlay();
    if (name === 'start') {
      state.phase = PHASES.MENU;
      player.reset(world.spawns.ember);
      body.position.set(1.5, 0, 13);
      body.yaw = 0.12;
      body.pitch = -0.02;
      bots.reset();
      settle(30);
      // Walk two bots into the mid lane so the cover shows a fight brewing.
      bots.items[0].mover.position.set(-3, 0, 2);
      bots.items[1].mover.position.set(4, 0, -1);
      bots.items[0].yaw = Math.PI;
      bots.items[1].yaw = Math.PI;
      hud.showOverlay('start', {});
      return;
    }
    if (name === 'play') {
      startMatch();
      state.phase = PHASES.LIVE;
      state.round = 1;
      state.roundTimer = ROUND_SECONDS;
      owned.rifle = true;
      state.loadout.primary = 'rifle';
      weapons.equip(state.loadout);
      body.position.set(0, 0, 6);
      body.yaw = 0;
      body.pitch = 0;
      bots.reset();
      // Clear of the silo so the bot the player aims at is visible in the frame.
      bots.items[0].mover.position.set(4.5, 0, -5);
      bots.items[0].state = 'engage';
      bots.items[0].lastSeen.copy(body.position);
      bots.items[0].lastSeenAt = elapsed;
      bots.items[1].mover.position.set(-4, 0, -4);
      bots.items[2].mover.position.set(5, 0, 3);
      settle(10);
      aimAt(bots.aimPoint(0));
      shoot(0);
      settle(6);
      hud.hideOverlay();
      return;
    }
    if (name === 'plant') {
      startMatch();
      state.phase = PHASES.LIVE;
      state.round = 1;
      state.roundTimer = ROUND_SECONDS;
      owned.rifle = true;
      state.loadout.primary = 'rifle';
      weapons.equip(state.loadout);
      body.position.set(-11, 0, -10.5);
      body.yaw = -2.3;
      body.pitch = 0;
      bots.reset();
      bots.items[0].mover.position.set(-6, 0, -6);
      bots.items[0].state = 'route';
      bots.items[1].mover.position.set(-2, 0, -12);
      bots.items[2].mover.position.set(-13, 0, -4);
      spike.state.plantProgress = PLANT_SECONDS * 0.6;
      hud.setSpike('carried', '', 0);
      settle(8);
      // step() clears the plant bar while E is not held; put it back for the capture.
      spike.state.plantProgress = PLANT_SECONDS * 0.6;
      hud.setPlant(0.6, 'PLANTING SPIKE…');
      hud.hideOverlay();
      return;
    }
    // end: round won, overlay over the yard.
    startMatch();
    state.phase = PHASES.LIVE;
    state.round = 1;
    owned.rifle = true;
    state.loadout.primary = 'rifle';
    weapons.equip(state.loadout);
    body.position.set(0, 0, 4);
    bots.reset();
    bots.items[0].mover.position.set(1, 0, -3);
    bots.items[0].alive = false;
    bots.items[0].state = 'dead';
    bots.items[0].fall = 1;
    bots.items[0].group.rotation.x = -1.45;
    bots.items[1].mover.position.set(-5, 0, -6);
    settle(10);
    // Aim at the fallen bot so the win reads in the frame.
    aimAt(bots.aimPoint(0));
    state.phase = PHASES.ROUND_END;
    state.roundsWon = 1;
    hud.setScore(1, 0, 1);
    hud.showOverlay('roundEnd', { won: true, reason: 'All Rust bots eliminated', wonRounds: 1, lost: 0, earned: 600 });
  }

  return {
    state,
    step,
    frame,
    syncCamera,
    aimAt,
    onPlayButton,
    buyItem,
    setupShot,
    setShotMode(value) {
      shotMode = value;
    },
  };
}
