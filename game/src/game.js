// The game: one state object, one fixed-step simulation, wiring player, weapons,
// bots, spike, grenades and HUD. First side to 4 rounds takes the yard.
import * as THREE from 'three';
import {
  PHASES, MATCH_TARGET, MAX_ROUNDS, ROUND_SECONDS, BUY_SECONDS, PLANT_SECONDS,
  SPIKE_SECONDS, PRICES, REWARDS, createState, resetMatch,
} from './state.js';
import { WEAPONS } from './weapons.js';
import { glowTexture } from './textures.js';

const ROUND_END_SECONDS = 3.5;
const TRACER_POOL = 8;
const TRACER_LIFE = 0.09;
const SPARK_POOL = 12;
const SPARK_LIFE = 0.16;

const _dir = new THREE.Vector3();
const _muzzle = new THREE.Vector3();
const _noisePos = new THREE.Vector3();
const _end = new THREE.Vector3();

export function createGame(deps) {
  const { scene, camera, world, player, weapons, bots, allies, spike, grenades, audio, hud, input, random } = deps;
  const state = createState();
  const owned = { pistol: true, smg: false, rifle: false };
  const raycaster = new THREE.Raycaster();
  raycaster.far = 90;

  // The round's team plan: the site the squad pushes, called on the radio. It can
  // rotate once if the push bleeds; the planted site overrides it. planter is the
  // teammate carrying the spike while the player is down (null: player carries).
  let planSite = 'A';
  let rotated = false;
  let planter = null;

  // Sight views both brains pick targets from; only the flags refresh each step.
  const emberViews = [
    { pos: player.state.position, alive: true, speed: 0, crouching: false, isPlayer: true, ref: null },
    ...allies.items.map((ally) => ({
      pos: ally.mover.position, alive: true, speed: 0, crouching: false, isPlayer: false, ref: ally,
    })),
  ];
  const rustViews = bots.items.map((bot) => ({ pos: bot.mover.position, alive: true, ref: bot }));
  // What each side's rays can hit: the world, plus the other side's bodies.
  const rustRaycastTargets = [null, ...allies.hitMeshes, ...world.shootables];
  const emberRaycastTargets = [...world.shootables, ...bots.hitMeshes];

  // Invisible box the bots shoot at; the player's own rays never include it.
  const playerHitbox = new THREE.Mesh(
    new THREE.BoxGeometry(0.68, 1.72, 0.68),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false }),
  );
  scene.add(playerHitbox);
  rustRaycastTargets[0] = playerHitbox;

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

  // Hit-spark pool: one additive glow sprite per impact, scaled and faded in frame().
  const sparks = [];
  const sparkTexture = glowTexture();
  for (let i = 0; i < SPARK_POOL; i += 1) {
    const material = new THREE.SpriteMaterial({
      map: sparkTexture, color: new THREE.Color('#ffd9a0'), transparent: true,
      opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const mesh = new THREE.Sprite(material);
    mesh.visible = false;
    scene.add(mesh);
    sparks.push({ mesh, life: 0 });
  }
  let sparkIndex = 0;

  function spawnSpark(point) {
    const spark = sparks[sparkIndex];
    sparkIndex = (sparkIndex + 1) % SPARK_POOL;
    spark.mesh.position.copy(point);
    spark.mesh.scale.setScalar(0.14);
    spark.life = SPARK_LIFE;
    spark.mesh.visible = true;
  }

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
    // Centred on its midpoint — a fixed offset used to poke it through the camera.
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
    const hit = raycaster.intersectObjects(emberRaycastTargets, false)[0];
    const end = hit ? hit.point : _end.copy(camera.position).addScaledVector(_dir, 60);
    fireTracer(muzzlePoint(), end);
    if (hit) spawnSpark(hit.point);
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
      // Down is not out while the squad stands: the round plays on (see syncCamera).
      if (spike.state.status !== 'planted' && allies.aliveCount() === 0) {
        endRound(false, 'Ember team eliminated');
      } else if (spike.state.status !== 'planted') {
        hud.killfeed('You are down — your squad fights on', false);
      }
    }
  }

  // Whoever plants, the team gets paid and the squad hears it, then digs in.
  function onPlanted(plantedSite, byAlly) {
    state.plants += 1;
    state.money += REWARDS.plant;
    if (byAlly) hud.killfeed(`${byAlly.name}: Spike planted — holding Site ${plantedSite.name}`, true);
    else hud.killfeed(`Spike planted at Site ${plantedSite.name}`, true);
    audio.plant();
  }

  // A teammate takes a hit. A death goes on the radio; a fallen carrier drops the carry.
  function damageAlly(ally, amount) {
    const died = allies.damage(ally, amount);
    if (!died) return;
    hud.killfeed(`${ally.name} is down`, false);
    if (planter === ally) {
      planter = null;
      spike.state.plantProgress = 0;
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

  // Refresh the sight views' flags from the bodies they point at.
  function refreshViews() {
    emberViews[0].alive = body.alive;
    emberViews[0].speed = player.groundSpeed();
    emberViews[0].crouching = body.crouching;
    for (let i = 0; i < allies.items.length; i += 1) {
      const ally = allies.items[i];
      emberViews[i + 1].alive = ally.alive;
      emberViews[i + 1].speed = Math.hypot(ally.mover.velocity.x, ally.mover.velocity.z);
    }
    for (let i = 0; i < bots.items.length; i += 1) rustViews[i].alive = bots.items[i].alive;
  }

  function botContext() {
    return {
      time: elapsed,
      spikePlanted: spike.state.status === 'planted',
      spikeSite: spike.state.site ? spike.state.site.name : '',
      spikePos: spike.state.pos,
      noise,
      smokeBlocks: (a, b) => grenades.smokeBlocks(a, b),
      targets: emberViews,
      raycastTargets: rustRaycastTargets,
      playerHitbox,
      onBotShot(bot, from, to, damage, headshot) {
        fireTracer(from, to);
        audio.enemyShot();
        if (damage > 0) damagePlayer(damage, from);
      },
      onBotShotAlly(bot, from, to, ally, damage, headshot) {
        fireTracer(from, to);
        audio.enemyShot();
        spawnSpark(to);
        damageAlly(ally, damage);
      },
      onDefused() {
        spike.defused();
        endRound(false, 'Rust defused the spike');
      },
    };
  }

  function allyContext() {
    return {
      time: elapsed,
      enemyViews: rustViews,
      planSite,
      spikePlanted: spike.state.status === 'planted',
      spikeSite: spike.state.site ? spike.state.site.name : '',
      planter,
      smokeBlocks: (a, b) => grenades.smokeBlocks(a, b),
      raycastTargets: emberRaycastTargets,
      onAllyShot(ally, from, to, hitMesh, damage, headshot) {
        fireTracer(from, to);
        audio.enemyShot();
        _noisePos.copy(ally.mover.position);
        noise = { pos: _noisePos, time: elapsed };
        if (hitMesh) {
          spawnSpark(to);
          const died = bots.damage(hitMesh, damage);
          if (died) {
            const bot = hitMesh.userData.bot;
            hud.killfeed(`${ally.name} eliminated Rust-${bot.id + 1}${headshot ? ' (headshot)' : ''}`, true);
            audio.kill();
          }
        }
      },
      onEvent(kind, ally) {
        if (kind === 'contact') {
          const site = world.siteAt(ally.mover.position.x, ally.mover.position.z);
          const where = site ? `Site ${site.name}` : ally.mover.position.z < -6 ? 'the north yard' : 'the lanes';
          hud.killfeed(`${ally.name}: Contact — ${where}`, true);
        }
      },
    };
  }

  function grenadeContext() {
    return {
      playerPos: body.position,
      bots: bots.items,
      allies: allies.items,
      damagePlayer: (dmg) => damagePlayer(dmg, null),
      damageBot: (bot, dmg) => damageBot(bot, dmg),
      damageAlly: (ally, dmg) => damageAlly(ally, dmg),
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
    // Call the round's plan now, so the squad lines up behind it from the buy phase.
    planSite = random() < 0.5 ? 'A' : 'B';
    rotated = false;
    planter = null;
    player.reset(world.spawns.ember);
    bots.reset();
    allies.reset(planSite);
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
    hud.killfeed(`Ember-1: All units — hit Site ${planSite}`, true);
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
    weapons.step(dt, player.groundSpeed());
    refreshViews();
    allies.step(dt, allyContext());
    if (state.phase !== PHASES.LIVE) return;
    bots.step(dt, botContext());
    if (state.phase !== PHASES.LIVE) return;
    spike.step(dt, {
      onBeep: () => audio.beep(),
      onExploded: (site) => endRound(true, `Spike detonated at Site ${site.name}`),
    });
    if (state.phase !== PHASES.LIVE) return;
    grenades.step(dt, grenadeContext());

    // Planting: the player holds E inside a site, standing still. If the player is
    // down, the first living teammate carries the spike in and plants instead.
    if (spike.state.status === 'carried') {
      let planting = false;
      if (body.alive && input.state.keys.has('KeyE')) {
        const site = world.siteAt(body.position.x, body.position.z);
        if (site && player.groundSpeed() < 0.8) {
          spike.plantTick(dt, body.position, (plantedSite) => onPlanted(plantedSite, null));
          hud.setPlant(spike.state.plantProgress / PLANT_SECONDS, 'PLANTING SPIKE…');
          planting = true;
        }
      } else if (!body.alive) {
        planter = allies.firstAlive();
        if (planter && planter.state === 'plant') {
          spike.plantTick(dt, planter.mover.position, (plantedSite) => onPlanted(plantedSite, planter));
          hud.setPlant(spike.state.plantProgress / PLANT_SECONDS, `${planter.name.toUpperCase()} PLANTING…`);
          planting = true;
        }
      }
      if (!planting) {
        spike.state.plantProgress = 0;
        hud.setPlant(0, '');
      }
    }

    // A bleeding push rotates once: two teammates down, no plant, clock well spent.
    if (!rotated && spike.state.status === 'carried' && body.alive
      && allies.aliveCount() <= 2 && state.phaseTime > 25) {
      rotated = true;
      planSite = planSite === 'A' ? 'B' : 'A';
      hud.killfeed(`Ember-1: Rotate — fall back to Site ${planSite}`, true);
    }

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

    // Win by elimination — or lose the whole team with the spike unplanted.
    if (bots.aliveCount() === 0) {
      endRound(true, 'All Rust bots eliminated');
      return;
    }
    if (!body.alive && allies.aliveCount() === 0 && spike.state.status !== 'planted') {
      endRound(false, 'Ember team eliminated');
      return;
    }

    playerHitbox.position.set(body.position.x, body.position.y + 0.86, body.position.z);
    hud.setHealth(body.health, body.maxHealth);
    hud.setAmmo(weapons.state.mag, weapons.state.reserve, weapons.def().name, weapons.state.frags, weapons.state.smokes, weapons.state.selectedGrenade);
    hud.setTimer(state.roundTimer, spike.state.status === 'planted');
    hud.setMoney(state.money);
    hud.setSpike(spike.state.status, spike.state.site ? spike.state.site.name : '', spike.state.timer);
    hud.setCrosshairSpread(3 + weapons.spread(player.groundSpeed()) * 420);
  }

  function frame(dt) {
    // Per-frame visual only: tracer and spark fades, and the yard's air.
    world.update(dt);
    for (const tracer of tracers) {
      if (!tracer.mesh.visible) continue;
      if (tracer.life > 0) {
        tracer.life -= dt;
        tracer.mesh.material.opacity = Math.max(0, tracer.life / TRACER_LIFE) * 0.9;
        if (tracer.life <= 0) tracer.mesh.visible = false;
      }
    }
    for (const spark of sparks) {
      if (!spark.mesh.visible) continue;
      spark.life -= dt;
      if (spark.life <= 0) {
        spark.mesh.visible = false;
        continue;
      }
      const t = spark.life / SPARK_LIFE;
      spark.mesh.scale.setScalar(0.14 + (1 - t) * 0.5);
      spark.mesh.material.opacity = t * 0.95;
    }
  }

  function syncCamera(cameraOut) {
    // Down but not out: ride a living teammate's shoulder until the round ends.
    if (!body.alive && state.phase === PHASES.LIVE) {
      const ally = allies.firstAlive();
      if (ally) {
        cameraOut.position.set(ally.mover.position.x, ally.mover.position.y + 1.62, ally.mover.position.z);
        cameraOut.rotation.set(-0.03, ally.yaw, 0, 'YXZ');
        return;
      }
      if (spike.state.status === 'planted') {
        // Nobody left to ride: watch the spike from where the player fell.
        const dx = spike.state.pos.x - body.position.x;
        const dz = spike.state.pos.z - body.position.z;
        cameraOut.position.set(body.position.x, body.position.y + 1.1, body.position.z);
        cameraOut.rotation.set(0, Math.atan2(-dx, -dz), 0, 'YXZ');
        return;
      }
    }
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

  // The shared prologue of the three live shots: a fresh match, round 1, rifle owned.
  function liveShot() {
    startMatch();
    state.phase = PHASES.LIVE;
    state.round = 1;
    owned.rifle = true;
    state.loadout.primary = 'rifle';
    weapons.equip(state.loadout);
  }

  function setupShot(name) {
    shotMode = name;
    hud.hideOverlay();
    if (name === 'start') {
      state.phase = PHASES.MENU;
      player.reset(world.spawns.ember);
      body.position.set(1.5, 0, 13);
      body.yaw = 0.12;
      body.pitch = 0.04;
      bots.reset();
      allies.reset('A');
      settle(30);
      // Stage a fight brewing: two bots in the mid lane, two teammates pushing the
      // edges. The menu phase never steps, so set group transforms beside the movers.
      for (const [unit, x, z, yaw] of [
        [bots.items[0], -3, 2, Math.PI], [bots.items[1], 4, -1, Math.PI],
        [allies.items[0], -5.4, 6.5, 0.3], [allies.items[1], 6.4, 6, -0.3],
      ]) {
        unit.mover.position.set(x, 0, z);
        unit.yaw = yaw;
        unit.group.position.set(x, 0, z);
        unit.group.rotation.y = yaw;
      }
      hud.showOverlay('start', {});
      return;
    }
    if (name === 'play') {
      liveShot();
      state.roundTimer = ROUND_SECONDS;
      body.position.set(0, 0, 6);
      body.yaw = 0;
      body.pitch = 0;
      bots.reset();
      // Clear of the silo so the aimed-at bot is visible in the frame.
      bots.items[0].mover.position.set(4.5, 0, -5);
      bots.items[0].state = 'engage';
      bots.items[0].lastSeen.copy(body.position);
      bots.items[0].lastSeenAt = elapsed;
      bots.items[1].mover.position.set(-4, 0, -4);
      bots.items[2].mover.position.set(5, 0, 3);
      // The squad in frame: Ember-2 trading fire from the right, Ember-3 on the left lane.
      allies.items[0].mover.position.set(2.7, 0, 0.6);
      allies.items[0].yaw = Math.atan2(-(4.5 - 2.7), -(-5 - 0.6));
      allies.items[0].state = 'engage';
      allies.items[0].target = bots.items[0];
      allies.items[1].mover.position.set(-3.6, 0, -1.2);
      allies.items[1].yaw = 0.35;
      settle(10);
      aimAt(bots.aimPoint(0));
      shoot(0);
      // Ember-2's burst lands a beat later: a second tracer and a spark on the bot.
      const ally = allies.items[0];
      _muzzle.set(
        ally.mover.position.x + Math.sin(ally.yaw) * -0.2,
        1.35,
        ally.mover.position.z + Math.cos(ally.yaw) * -0.2,
      );
      fireTracer(_muzzle, bots.aimPoint(0));
      spawnSpark(bots.aimPoint(0));
      settle(6);
      hud.hideOverlay();
      return;
    }
    if (name === 'plant') {
      liveShot();
      state.roundTimer = ROUND_SECONDS;
      body.position.set(-11, 0, -10.5);
      body.yaw = -2.3;
      body.pitch = 0;
      bots.reset();
      bots.items[0].mover.position.set(-6, 0, -6);
      bots.items[0].state = 'route';
      bots.items[1].mover.position.set(-2, 0, -12);
      bots.items[2].mover.position.set(-13, 0, -4);
      // Covering the plant: one teammate watches the lane in, one holds the east corner.
      allies.items[0].mover.position.set(-8.4, 0, -7.2);
      allies.items[0].yaw = -2.5;
      allies.items[1].mover.position.set(-13.6, 0, -6.2);
      allies.items[1].yaw = 2.75;
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
    liveShot();
    body.position.set(0, 0, 4);
    bots.reset();
    bots.items[0].mover.position.set(1, 0, -3);
    bots.items[0].alive = false;
    bots.items[0].state = 'dead';
    bots.items[0].fall = 1;
    bots.items[0].group.rotation.x = -1.45;
    bots.items[1].mover.position.set(-5, 0, -6);
    allies.items[0].mover.position.set(2.6, 0, -0.8);
    allies.items[0].yaw = 2.5;
    settle(10);
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
