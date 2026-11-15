import * as THREE from 'three';
const T = THREE;
import {
	PHASES,MATCH_TARGET,MAX_ROUNDS,ROUND_SECONDS,BUY_SECONDS,PLANT_SECONDS,
	SPIKE_SECONDS,PRICES,REWARDS,createState,resetMatch,
} from './state.js';
import { glowTexture } from './textures.js';
const ROUND_END_SECONDS = 3.5;
const TRACER_POOL = 8;
const TRACER_LIFE = 0.09;
const SPARK_POOL = 12;
const SPARK_LIFE = 0.16;
const _dir = new T.Vector3();
const _muzzle = new T.Vector3();
const _noisePos = new T.Vector3();
const _end = new T.Vector3();
const _utilFrom = new T.Vector3();
const _flashEye = new T.Vector3();
const _prevPos = new T.Vector3();
export function createGame(deps) {
	const { scene,camera,world,player,weapons,bots,allies,spike,grenades,audio,hud,input,random } = deps;
	const state = createState();
	const S = state;
	const owned = { pistol: true,smg: false,smg2: false,shotgun: false,rifle: false };
	let tally = null;
	let blindV = 0;
	let stepAcc = 0;
	let boardShown = false;
	let boardTimer = 0;
	const mapData = {
		px: 0,pz: 0,yaw: 0,spike: null,
		allies: allies.items.map(() => ({ x: 0,z: 0,alive: false })),
		foes: bots.items.map(() => ({ x: 0,z: 0,seen: false })),
	};
	function syncAmmo() {
		hud.setAmmo(weapons.state.mag,weapons.state.reserve,weapons.def().name,weapons.state.frags,weapons.state.smokes,weapons.state.flashes,weapons.state.selectedGrenade);
	}
	function resetTally() {
		tally = {
			you: { k: 0,d: 0 },
			allies: allies.items.map(() => ({ k: 0,d: 0 })),
			bots: bots.items.map(() => ({ k: 0,d: 0 })),
		};
	}
	resetTally();
	const raycaster = new T.Raycaster();
	raycaster.far = 90;
	let planSite = 'A';
	let rotated = false;
	let planter = null;
	const eVw = [
		{ pos: player.state.position,alive: true,speed: 0,crouching: false,isPlayer: true,ref: null },
		...allies.items.map((ally) => ({
			pos: ally.mover.position,alive: true,speed: 0,crouching: false,isPlayer: false,ref: ally,
		})),
	];
	const rVw = bots.items.map((bot) => ({ pos: bot.mover.position,alive: true,ref: bot }));
	const rustRaycastTargets = [null,...allies.hitMeshes,...world.shootables];
	const emberRaycastTargets = [...world.shootables,...bots.hitMeshes];
	const playerHitbox = new T.Mesh(
		new T.BoxGeometry(0.68,1.72,0.68),
		new T.MeshBasicMaterial({ transparent: true,opacity: 0,depthWrite: false,colorWrite: false }),
	);
	scene.add(playerHitbox);
	rustRaycastTargets[0] = playerHitbox;
	const tracers = [];
	const tracerGeometry = new T.BoxGeometry(0.008,0.008,1);
	const tracerMaterial = new T.MeshBasicMaterial({ color: 0xffc46b,transparent: true,opacity: 0.55 });
	for (let i = 0; i < TRACER_POOL; i += 1) {
		const mesh = new T.Mesh(tracerGeometry,tracerMaterial.clone());
		mesh.visible = false;
		scene.add(mesh);
		tracers.push({ mesh,life: 0 });
	}
	let tracerIndex = 0;
	const sparks = [];
	const sparkTexture = glowTexture();
	for (let i = 0; i < SPARK_POOL; i += 1) {
		const material = new T.SpriteMaterial({
			map: sparkTexture,color: new T.Color('#ffd9a0'),transparent: true,
			opacity: 0,blending: T.AdditiveBlending,depthWrite: false,
		});
		const mesh = new T.Sprite(material);
		mesh.visible = false;
		scene.add(mesh);
		sparks.push({ mesh,life: 0 });
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
	let gCd = 0;
	let shotMode = null;
	const body = player.state;
	function fireTracer(from,to) {
		const tracer = tracers[tracerIndex];
		tracerIndex = (tracerIndex + 1) % TRACER_POOL;
		_dir.subVectors(to,from);
		const len = _dir.length();
		if (len < 0.1) return;
		tracer.mesh.position.copy(from).addScaledVector(_dir,len / 2);
		tracer.mesh.lookAt(to);
		tracer.mesh.scale.set(1,1,len);
		tracer.mesh.material.opacity = 0.55;
		tracer.mesh.visible = true;
		tracer.life = TRACER_LIFE;
	}
	function muzzlePoint() {
		camera.getWorldDirection(_dir);
		_muzzle.copy(camera.position).addScaledVector(_dir,1.0);
		_muzzle.x += Math.cos(body.yaw) * 0.18;
		_muzzle.z -= Math.sin(body.yaw) * 0.18;
		_muzzle.y -= 0.14;
		return _muzzle;
	}
	function shoot(spread) {
		if (!weapons.takeRound()) return;
		const def = weapons.def();
		const pellets = def.pellets ?? 1;
		const effSpread = spread * (1 - weapons.adsAmount() * 0.5);
		let botHit = false;
		let killedAny = false;
		scene.updateMatrixWorld(true);
		for (let p = 0; p < pellets; p += 1) {
			camera.getWorldDirection(_dir);
			_dir.x += (random() * 2 - 1) * effSpread;
			_dir.y += (random() * 2 - 1) * effSpread;
			_dir.z += (random() * 2 - 1) * effSpread;
			_dir.normalize();
			raycaster.set(camera.position,_dir);
			const hit = raycaster.intersectObjects(emberRaycastTargets,false)[0];
			const end = hit ? hit.point : _end.copy(camera.position).addScaledVector(_dir,60);
			fireTracer(muzzlePoint(),end);
			if (hit) spawnSpark(hit.point);
			if (hit && hit.object.userData.bot) {
				botHit = true;
				const bot = hit.object.userData.bot;
				const head = hit.object.userData.part === 'head';
				const died = bots.damage(hit.object,head ? def.headDamage : def.damage);
				if (died) {
					killedAny = true;
					S.kills += 1;
					S.money += REWARDS.kill;
					tally.you.k += 1;
					tally.bots[bot.id].d += 1;
					hud.kill('You',def.short,`Rust-${bot.id + 1}`,true);
					hud.killfeed(`You eliminated Rust-${bot.id + 1}${head ? ' (headshot)' : ''}`,true);
					audio.kill();
				}
			}
		}
		if (botHit) {
			hud.hitMarker(killedAny,killedAny ? 4000 : 90);
			audio.hit();
		}
		weapons.pullTrigger();
		player.recoil(weapons.def().kick * (0.8 + random() * 0.4),(random() * 2 - 1) * 0.003);
		audio.shot();
		_noisePos.copy(body.position);
		noise = { pos: _noisePos,time: elapsed };
		syncAmmo();
	}
	function dmgP(amount,fromPos,headshot = false,killer = null) {
		if (!body.alive || S.phase !== PHASES.LIVE) return;
		let final = headshot && body.helmet ? Math.round(amount * 0.45) : amount;
		final = body.armour ? Math.round(final * 0.65) : final;
		body.health -= final;
		hud.damageFlash();
		if (fromPos) {
			const rel = Math.atan2(-(fromPos.x - body.position.x),-(fromPos.z - body.position.z)) - body.yaw;
			hud.damageFrom(Math.atan2(Math.sin(rel),Math.cos(rel)));
		}
		audio.hurt();
		if (body.health <= 0) {
			body.health = 0;
			body.alive = false;
			S.deaths += 1;
			if (killer) {
				tally.bots[killer.id].k += 1;
				tally.you.d += 1;
				hud.kill(`Rust-${killer.id + 1}`,killer.gun.short,'You',false);
			}
			if (spike.state.status !== 'planted' && allies.aliveCount() === 0) {
				endRound(false,'Ember team eliminated');
			} else if (spike.state.status !== 'planted') {
				hud.killfeed('You are down — your squad fights on',false);
			}
		}
	}
	function onPlanted(pSite,byAlly) {
		S.plants += 1;
		S.money += REWARDS.plant;
		if (byAlly) hud.killfeed(`${byAlly.name}: Spike planted — holding Site ${pSite.name}`,true);
		else hud.killfeed(`Spike planted at Site ${pSite.name}`,true);
		audio.plant();
	}
	function dmgA(ally,amount,killer = null) {
		const died = allies.damage(ally,amount);
		if (!died) return;
		tally.allies[ally.id].d += 1;
		if (killer && killer.mover) {
			tally.bots[killer.id].k += 1;
			hud.kill(`Rust-${killer.id + 1}`,killer.gun.short,ally.name,false);
		}
		hud.killfeed(`${ally.name} is down`,false);
		if (planter === ally) {
			planter = null;
			spike.state.plantProgress = 0;
		}
	}
	function dmgB(bot,amount) {
		const died = bots.damage(bot.torso,amount);
		if (died) {
			S.kills += 1;
			S.money += REWARDS.kill;
			tally.you.k += 1;
			tally.bots[bot.id].d += 1;
			hud.kill('You','Spark-4',`Rust-${bot.id + 1}`,true);
			hud.killfeed(`Frag eliminated Rust-${bot.id + 1}`,true);
			audio.kill();
		}
	}
	function refreshViews() {
		eVw[0].alive = body.alive;
		eVw[0].speed = player.groundSpeed();
		eVw[0].crouching = body.crouching;
		for (let i = 0; i < allies.items.length; i += 1) {
			const ally = allies.items[i];
			eVw[i + 1].alive = ally.alive;
			eVw[i + 1].speed = Math.hypot(ally.mover.velocity.x,ally.mover.velocity.z);
		}
		for (let i = 0; i < bots.items.length; i += 1) rVw[i].alive = bots.items[i].alive;
	}
	function botContext() {
		return {
			time: elapsed,
			spikePlanted: spike.state.status === 'planted',
			spikeSite: spike.state.site ? spike.state.site.name : '',
			spikePos: spike.state.pos,
			noise,
			smokeBlocks: (a,b) => grenades.smokeBlocks(a,b),
			targets: eVw,
			raycastTargets: rustRaycastTargets,
			playerHitbox,
			throwUtil(bot,kind,atPos) {
				const target = atPos ?? (bot.target ? bot.target.pos : null);
				if (!target) return;
				_utilFrom.set(bot.mover.position.x,1.45,bot.mover.position.z);
				_dir.set(target.x - _utilFrom.x,1.15 - _utilFrom.y,target.z - _utilFrom.z).normalize();
				grenades.throwGrenade(kind,_utilFrom,_dir,{ name: `Rust-${bot.id + 1}`,gun: bot.gun.short,bot });
			},
			onBotShot(bot,from,to,damage,headshot) {
				fireTracer(from,to);
				audio.enemyShot();
				if (damage > 0) dmgP(damage,from,headshot,bot);
			},
			onBotShotAlly(bot,from,to,ally,damage,headshot) {
				fireTracer(from,to);
				audio.enemyShot();
				spawnSpark(to);
				dmgA(ally,damage,bot);
			},
			onDefused() {
				spike.defused();
				endRound(false,'Rust defused the spike');
			},
		};
	}
	function allyContext() {
		return {
			time: elapsed,
			enemyViews: rVw,
			planSite,
			spikePlanted: spike.state.status === 'planted',
			spikeSite: spike.state.site ? spike.state.site.name : '',
			planter,
			smokeBlocks: (a,b) => grenades.smokeBlocks(a,b),
			raycastTargets: emberRaycastTargets,
			onAllyShot(ally,from,to,hitMesh,damage,headshot) {
				fireTracer(from,to);
				audio.enemyShot();
				_noisePos.copy(ally.mover.position);
				noise = { pos: _noisePos,time: elapsed };
				if (hitMesh) {
					spawnSpark(to);
					const died = bots.damage(hitMesh,damage);
					if (died) {
						const bot = hitMesh.userData.bot;
						tally.allies[ally.id].k += 1;
						tally.bots[bot.id].d += 1;
						hud.kill(ally.name,ally.gunShort,`Rust-${bot.id + 1}`,true);
						hud.killfeed(`${ally.name} eliminated Rust-${bot.id + 1}${headshot ? ' (headshot)' : ''}`,true);
						audio.kill();
					}
				}
			},
			onEvent(kind,ally) {
				if (kind === 'contact') {
					const site = world.siteAt(ally.mover.position.x,ally.mover.position.z);
					const where = site ? `Site ${site.name}` : ally.mover.position.z < -6 ? 'the north yard' : 'the lanes';
					hud.killfeed(`${ally.name}: Contact — ${where}`,true);
				}
			},
		};
	}
	function grenadeContext() {
		return {
			playerPos: body.position,
			bots: bots.items,
			allies: allies.items,
			damagePlayer: (dmg,pos) => dmgP(dmg,pos),
			damageBot: (bot,dmg) => dmgB(bot,dmg),
			damageAlly: (ally,dmg) => dmgA(ally,dmg),
			onExplosion(pos,radius) {
				audio.explosion();
				_noisePos.copy(pos);
				noise = { pos: _noisePos,time: elapsed };
			},
			onFlash(pos) {
				audio.flash();
				const blindFor = (unitPos,yaw) => {
					const dx = pos.x - unitPos.x;
					const dz = pos.z - unitPos.z;
					const dist = Math.hypot(dx,dz);
					if (dist > 10) return 0;
					_flashEye.set(unitPos.x,unitPos.y + 1.5,unitPos.z);
					if (world.blockedBetween(_flashEye,pos)) return 0;
					const dot = ((-Math.sin(yaw)) * dx + (-Math.cos(yaw)) * dz) / (dist || 1);
					return dot < 0.05 ? 0 : (0.4 + dot * 0.6) * (1 - dist / 12);
				};
				if (body.alive) {
					camera.getWorldDirection(_dir);
					const dx = pos.x - body.position.x;
					const dz = pos.z - body.position.z;
					const dist = Math.hypot(dx,dz);
					if (dist <= 10) {
						_flashEye.set(body.position.x,body.position.y + 1.5,body.position.z);
						if (!world.blockedBetween(_flashEye,pos)) {
							const dot = (_dir.x * dx + _dir.z * dz) / (dist || 1);
							if (dot > 0.05) blindV = Math.max(blindV,Math.min(1,(0.35 + dot * 0.65) * (1 - dist / 13)));
						}
					}
				}
				for (const bot of bots.items) {
					if (!bot.alive) continue;
					const s = blindFor(bot.mover.position,bot.yaw);
					if (s > 0.25) bot.blindUntil = Math.max(bot.blindUntil,elapsed + 0.6 + s * 2);
				}
				for (const ally of allies.items) {
					if (!ally.alive) continue;
					const s = blindFor(ally.mover.position,ally.yaw);
					if (s > 0.25) ally.blindUntil = Math.max(ally.blindUntil,elapsed + 0.6 + s * 2);
				}
			},
		};
	}
	function mvpName() {
		let best = null;
		const consider = (name,t) => {
			if (!best || t.k > best.k || (t.k === best.k && t.d < best.d)) best = { name,k: t.k,d: t.d };
		};
		consider('You',tally.you);
		allies.items.forEach((a,i) => consider(a.name,tally.allies[i]));
		bots.items.forEach((b,i) => consider(`Rust-${b.id + 1}`,tally.bots[i]));
		return best && best.k > 0 ? `${best.name} (${best.k}K / ${best.d}D)` : '';
	}
	function boardData() {
		const rows = [
			{ name: 'You',team: 'ember',k: tally.you.k,d: tally.you.d,alive: body.alive,you: true },
			...allies.items.map((a,i) => ({ name: a.name,team: 'ember',k: tally.allies[i].k,d: tally.allies[i].d,alive: a.alive })),
			...bots.items.map((b,i) => ({ name: `Rust-${b.id + 1}`,team: 'rust',k: tally.bots[i].k,d: tally.bots[i].d,alive: b.alive })),
		];
		return { won: S.roundsWon,lost: S.roundsLost,history: S.roundHistory,rows };
	}
	function endRound(won,reason) {
		if (S.phase !== PHASES.LIVE) return;
		S.phase = PHASES.ROUND_END;
		S.phaseTime = 0;
		S.roundReason = reason;
		S.roundHistory.push(won ? 'W' : 'L');
		let earned = 0;
		if (won) {
			S.roundsWon += 1;
			earned = REWARDS.roundWin + (spike.state.status === 'planted' || spike.state.status === 'exploded' ? REWARDS.plant : 0);
			audio.roundWin();
		} else {
			S.roundsLost += 1;
			earned = REWARDS.roundLoss;
			audio.roundLose();
		}
		S.money += earned;
		S.earned = earned;
		if (document.pointerLockElement) document.exitPointerLock();
		hud.showOverlay('roundEnd',{ won,reason,wonRounds: S.roundsWon,lost: S.roundsLost,earned,mvp: mvpName() });
		hud.setScore(S.roundsWon,S.roundsLost,S.round);
	}
	function startBuy() {
		S.phase = PHASES.BUY;
		S.phaseTime = 0;
		planSite = random() < 0.5 ? 'A' : 'B';
		rotated = false;
		planter = null;
		player.reset(world.spawns.ember);
		bots.reset();
		allies.reset(planSite);
		spike.reset();
		grenades.reset();
		weapons.equip(S.loadout);
		body.armour = S.loadout.armour;
		S.loadout.armour = false;
		body.helmet = S.loadout.helmet;
		S.loadout.helmet = false;
		_prevPos.copy(body.position);
		stepAcc = 0;
		hud.setHealth(body.health,body.maxHealth);
		syncAmmo();
		hud.setMoney(S.money);
		hud.setSpike('carried','',0);
		hud.setPlant(0,'');
		hud.setScore(S.roundsWon,S.roundsLost,S.round);
		hud.showOverlay('buy',{ round: S.round,money: S.money,loadout: S.loadout });
	}
	function startRound() {
		if (S.roundsWon >= MATCH_TARGET || S.roundsLost >= MATCH_TARGET || S.round > MAX_ROUNDS) {
			endMatch();
			return;
		}
		S.phase = PHASES.LIVE;
		S.phaseTime = 0;
		S.roundTimer = ROUND_SECONDS;
		spike.reset();
		hud.killfeed(`Ember-1: All units — hit Site ${planSite}`,true);
		hud.hideOverlay();
		hud.setTimer(S.roundTimer,false);
		hud.setSpike('carried','',0);
		hud.setScore(S.roundsWon,S.roundsLost,S.round);
		input.requestLock();
		audio.resume();
	}
	function endMatch() {
		S.phase = PHASES.MATCH_END;
		S.phaseTime = 0;
		const won = S.roundsWon > S.roundsLost;
		S.matchWinner = won ? 'Ember' : 'Rust';
		if (document.pointerLockElement) document.exitPointerLock();
		hud.showOverlay('matchEnd',{ won,wonRounds: S.roundsWon,lost: S.roundsLost,kills: S.kills,plants: S.plants });
	}
	function startMatch() {
		resetMatch(state);
		resetTally();
		owned.pistol = true;
		owned.smg = false;
		owned.smg2 = false;
		owned.shotgun = false;
		owned.rifle = false;
		S.round = 1;
		startBuy();
	}
	function buyItem(id) {
		if (S.phase !== PHASES.BUY) return;
		const price = PRICES[id];
		if (price === undefined || S.money < price) return;
		if (id === 'rifle' || id === 'smg' || id === 'smg2' || id === 'shotgun' || id === 'pistol') {
			if (owned[id]) return;
			owned[id] = true;
			S.loadout.primary = id;
		} else if (id === 'frag') {
			if (S.loadout.frags >= 2) return;
			S.loadout.frags += 1;
		} else if (id === 'smoke') {
			if (S.loadout.smokes >= 2) return;
			S.loadout.smokes += 1;
		} else if (id === 'flash') {
			if (S.loadout.flashes >= 2) return;
			S.loadout.flashes += 1;
		} else if (id === 'armour') {
			if (S.loadout.armour) return;
			S.loadout.armour = true;
		} else if (id === 'helmet') {
			if (S.loadout.helmet) return;
			S.loadout.helmet = true;
		}
		S.money -= price;
		audio.buy();
		hud.setMoney(S.money);
		hud.showOverlay('buy',{ round: S.round,money: S.money,loadout: S.loadout });
	}
	function onPlayButton() {
		if (S.phase === PHASES.MENU) startMatch();
		else if (S.phase === PHASES.BUY) startRound();
		else if (S.phase === PHASES.ROUND_END) startBuy();
		else if (S.phase === PHASES.MATCH_END) startMatch();
		else if (S.phase === PHASES.LIVE) input.requestLock();
	}
	function step(dt) {
		elapsed += dt;
		const boardWanted = input.state.keys.has('Tab')
			|| S.phase === PHASES.ROUND_END || S.phase === PHASES.MATCH_END;
		boardTimer += dt;
		if (boardWanted && (!boardShown || boardTimer > 0.5)) {
			hud.showScoreboard(boardData());
			boardShown = true;
			boardTimer = 0;
		} else if (!boardWanted && boardShown) {
			hud.hideScoreboard();
			boardShown = false;
		}
		if (S.phase === PHASES.ROUND_END) {
			S.phaseTime += dt;
			if (S.phaseTime >= ROUND_END_SECONDS) {
				if (S.roundsWon >= MATCH_TARGET || S.roundsLost >= MATCH_TARGET || S.round >= MAX_ROUNDS) {
					endMatch();
				} else {
					S.round += 1;
					startBuy();
				}
			}
			return;
		}
		if (S.phase === PHASES.BUY) {
			S.phaseTime += dt;
			hud.setTimer(Math.max(0,BUY_SECONDS - S.phaseTime),false);
			if (input.takePressed('Enter')) startRound();
			else if (input.takePressed('KeyB')) startRound();
			else if (input.takePressed('Digit1')) buyItem('rifle');
			else if (input.takePressed('Digit2')) buyItem('smg');
			else if (input.takePressed('Digit3')) buyItem('pistol');
			else if (input.takePressed('Digit4')) buyItem('frag');
			else if (input.takePressed('Digit5')) buyItem('smoke');
			else if (input.takePressed('Digit6')) buyItem('armour');
			else if (input.takePressed('Digit7')) buyItem('smg2');
			else if (input.takePressed('Digit8')) buyItem('shotgun');
			else if (input.takePressed('Digit9')) buyItem('helmet');
			else if (input.takePressed('Digit0')) buyItem('flash');
			return;
		}
		if (S.phase !== PHASES.LIVE) return;
		S.phaseTime += dt;
		gCd = Math.max(0,gCd - dt);
		if (spike.state.status === 'planted') {
			S.roundTimer = spike.state.timer;
		} else {
			S.roundTimer -= dt;
			if (S.roundTimer <= 0) {
				endRound(false,'Time expired — Rust holds the yard');
				return;
			}
		}
		if (body.alive) player.step(dt,input.state.keys);
		stepAcc += Math.hypot(body.position.x - _prevPos.x,body.position.z - _prevPos.z);
		_prevPos.copy(body.position);
		if (stepAcc > 2.3 && body.onGround && body.alive) {
			stepAcc = 0;
			audio.step();
		}
		weapons.step(dt,player.groundSpeed(),input.state.aiming && body.alive);
		refreshViews();
		allies.step(dt,allyContext());
		if (S.phase !== PHASES.LIVE) return;
		bots.step(dt,botContext());
		if (S.phase !== PHASES.LIVE) return;
		spike.step(dt,{
			onBeep: () => audio.beep(),
			onExploded: (site) => endRound(true,`Spike detonated at Site ${site.name}`),
		});
		if (S.phase !== PHASES.LIVE) return;
		grenades.step(dt,grenadeContext());
		if (spike.state.status === 'carried') {
			let planting = false;
			if (body.alive && input.state.keys.has('KeyE')) {
				const site = world.siteAt(body.position.x,body.position.z);
				if (site && player.groundSpeed() < 0.8) {
					spike.plantTick(dt,body.position,(pSite) => onPlanted(pSite,null));
					hud.setPlant(spike.state.plantProgress / PLANT_SECONDS,'PLANTING SPIKE…');
					planting = true;
				}
			} else if (!body.alive) {
				planter = allies.firstAlive();
				if (planter && planter.state === 'plant') {
					spike.plantTick(dt,planter.mover.position,(pSite) => onPlanted(pSite,planter));
					hud.setPlant(spike.state.plantProgress / PLANT_SECONDS,`${planter.name.toUpperCase()} PLANTING…`);
					planting = true;
				}
			}
			if (!planting) {
				spike.state.plantProgress = 0;
				hud.setPlant(0,'');
			}
		}
		if (!rotated && spike.state.status === 'carried' && body.alive
			&& allies.aliveCount() <= 2 && S.phaseTime > 25) {
			rotated = true;
			planSite = planSite === 'A' ? 'B' : 'A';
			hud.killfeed(`Ember-1: Rotate — fall back to Site ${planSite}`,true);
		}
		if (body.alive) {
			if (input.state.firing && weapons.ready()) {
				if (weapons.def().auto || input.takePressed('MouseDown')) {
					shoot(shotMode ? 0 : weapons.spread(player.groundSpeed()));
				}
			}
			if (input.takePressed('KeyR')) {
				weapons.reload();
				audio.reload();
			}
			if (input.takePressed('KeyF')) {
				weapons.inspect();
				audio.reload();
			}
			if (input.takePressed('Digit1') && owned.pistol) weapons.select('pistol');
			if (input.takePressed('Digit2') && owned.smg) weapons.select('smg');
			if (input.takePressed('Digit3') && owned.rifle) weapons.select('rifle');
			if (input.takePressed('Digit4') && owned.smg2) weapons.select('smg2');
			if (input.takePressed('Digit5') && owned.shotgun) weapons.select('shotgun');
			if (input.takePressed('KeyQ')) {
				const kinds = ['frag','smoke','flash'];
				const next = kinds[(kinds.indexOf(weapons.state.selectedGrenade) + 1) % kinds.length];
				weapons.state.selectedGrenade = next;
				syncAmmo();
			}
			if (input.takePressed('KeyG') && gCd <= 0) {
				const kind = weapons.state.selectedGrenade;
				const count = kind === 'frag' ? weapons.state.frags : kind === 'smoke' ? weapons.state.smokes : weapons.state.flashes;
				if (count > 0) {
					camera.getWorldDirection(_dir);
					const from = camera.position.clone().addScaledVector(_dir,0.6);
					grenades.throwGrenade(kind,from,_dir);
					if (kind === 'frag') weapons.state.frags -= 1;
					else if (kind === 'smoke') weapons.state.smokes -= 1;
					else weapons.state.flashes -= 1;
					gCd = 0.5;
					syncAmmo();
				}
			}
		}
		if (bots.aliveCount() === 0) {
			endRound(true,'All Rust bots eliminated');
			return;
		}
		if (!body.alive && allies.aliveCount() === 0 && spike.state.status !== 'planted') {
			endRound(false,'Ember team eliminated');
			return;
		}
		playerHitbox.position.set(body.position.x,body.position.y + 0.86,body.position.z);
		hud.setAds(weapons.adsAmount() > 0.6);
		hud.setHealth(body.health,body.maxHealth);
		syncAmmo();
		hud.setTimer(S.roundTimer,spike.state.status === 'planted');
		hud.setMoney(S.money);
		hud.setSpike(spike.state.status,spike.state.site ? spike.state.site.name : '',spike.state.timer);
		hud.setCrosshairSpread(3 + weapons.spread(player.groundSpeed()) * 420);
	}
	function frame(dt) {
		world.update(dt);
		blindV = Math.max(0,blindV - dt * 0.45);
		hud.setBlind(blindV * 0.94);
		mapData.px = body.position.x;
		mapData.pz = body.position.z;
		mapData.yaw = body.yaw;
		mapData.spike = spike.state.status === 'planted' ? spike.state.pos : null;
		for (let i = 0; i < allies.items.length; i += 1) {
			mapData.allies[i].x = allies.items[i].mover.position.x;
			mapData.allies[i].z = allies.items[i].mover.position.z;
			mapData.allies[i].alive = allies.items[i].alive;
		}
		for (let i = 0; i < bots.items.length; i += 1) {
			const bot = bots.items[i];
			mapData.foes[i].x = bot.mover.position.x;
			mapData.foes[i].z = bot.mover.position.z;
			mapData.foes[i].seen = bot.alive && (bot.state === 'engage'
				|| allies.items.some((a) => a.alive && a.target === bot));
		}
		hud.setMinimap(mapData);
		for (const tracer of tracers) {
			if (!tracer.mesh.visible) continue;
			if (tracer.life > 0) {
				tracer.life -= dt;
				tracer.mesh.material.opacity = Math.max(0,tracer.life / TRACER_LIFE) * 0.9;
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
		if (!body.alive && S.phase === PHASES.LIVE) {
			const ally = allies.firstAlive();
			if (ally) {
				cameraOut.position.set(ally.mover.position.x,ally.mover.position.y + 1.62,ally.mover.position.z);
				cameraOut.rotation.set(-0.03,ally.yaw,0,'YXZ');
				return;
			}
			if (spike.state.status === 'planted') {
				const dx = spike.state.pos.x - body.position.x;
				const dz = spike.state.pos.z - body.position.z;
				cameraOut.position.set(body.position.x,body.position.y + 1.1,body.position.z);
				cameraOut.rotation.set(0,Math.atan2(-dx,-dz),0,'YXZ');
				return;
			}
		}
		cameraOut.position.set(body.position.x,body.position.y + body.eye,body.position.z);
		cameraOut.rotation.set(body.pitch,body.yaw,0,'YXZ');
	}
	function aimAt(point) {
		const dx = point.x - body.position.x;
		const dy = point.y - (body.position.y + body.eye);
		const dz = point.z - body.position.z;
		const len = Math.hypot(dx,dy,dz) || 1;
		body.yaw = Math.atan2(-dx,-dz);
		body.pitch = Math.asin(Math.max(-1,Math.min(1,dy / len)));
	}
	function settle(steps) {
		for (let i = 0; i < steps; i += 1) step(1 / 60);
	}
	function liveShot() {
		startMatch();
		S.phase = PHASES.LIVE;
		S.round = 1;
		owned.rifle = true;
		S.loadout.primary = 'rifle';
		weapons.equip(S.loadout);
	}
	function setupShot(name) {
		shotMode = name;
		hud.hideOverlay();
		if (name === 'start') {
			S.phase = PHASES.MENU;
			player.reset(world.spawns.ember);
			body.position.set(1.5,0,13);
			body.yaw = 0.12;
			body.pitch = 0.04;
			bots.reset();
			allies.reset('A');
			settle(30);
			for (const [unit,x,z,yaw] of [
				[bots.items[0],-3,2,Math.PI],[bots.items[1],4,-1,Math.PI],
				[allies.items[0],-5.4,6.5,0.3],[allies.items[1],6.4,6,-0.3],
			]) {
				unit.mover.position.set(x,0,z);
				unit.yaw = yaw;
				unit.group.position.set(x,0,z);
				unit.group.rotation.y = yaw;
			}
			hud.showOverlay('start',{});
			frame(0);
			return;
		}
		if (name === 'play') {
			liveShot();
			S.roundTimer = ROUND_SECONDS;
			body.position.set(0,0,6);
			body.yaw = 0;
			body.pitch = 0;
			bots.reset();
			bots.items[0].mover.position.set(4.5,0,-5);
			bots.items[0].state = 'engage';
			bots.items[0].lastSeen.copy(body.position);
			bots.items[0].lastSeenAt = elapsed;
			bots.items[1].mover.position.set(-4,0,-4);
			bots.items[2].mover.position.set(5,0,3);
			allies.items[0].mover.position.set(2.7,0,0.6);
			allies.items[0].yaw = Math.atan2(-(4.5 - 2.7),-(-5 - 0.6));
			allies.items[0].state = 'engage';
			allies.items[0].target = bots.items[0];
			allies.items[1].mover.position.set(-3.6,0,-1.2);
			allies.items[1].yaw = 0.35;
			settle(10);
			aimAt(bots.aimPoint(0));
			shoot(0);
			const ally = allies.items[0];
			_muzzle.set(
				ally.mover.position.x + Math.sin(ally.yaw) * -0.2,
				1.35,
				ally.mover.position.z + Math.cos(ally.yaw) * -0.2,
			);
			fireTracer(_muzzle,bots.aimPoint(0));
			spawnSpark(bots.aimPoint(0));
			settle(6);
			hud.hideOverlay();
			tally.you.k = 1;
			tally.bots[0].d = 1;
			hud.kill('You','VK-7','Rust-1',true);
			hud.damageFrom(-0.39);
			frame(0);
			return;
		}
		if (name === 'plant') {
			liveShot();
			S.roundTimer = ROUND_SECONDS;
			body.position.set(-11,0,-10.5);
			body.yaw = -2.3;
			body.pitch = 0;
			bots.reset();
			bots.items[0].mover.position.set(-6,0,-6);
			bots.items[0].state = 'route';
			bots.items[1].mover.position.set(-2,0,-12);
			bots.items[2].mover.position.set(-13,0,-4);
			allies.items[0].mover.position.set(-8.4,0,-7.2);
			allies.items[0].yaw = -2.5;
			allies.items[1].mover.position.set(-13.6,0,-6.2);
			allies.items[1].yaw = 2.75;
			spike.state.plantProgress = PLANT_SECONDS * 0.6;
			hud.setSpike('carried','',0);
			settle(8);
			spike.state.plantProgress = PLANT_SECONDS * 0.6;
			hud.setPlant(0.6,'PLANTING SPIKE…');
			hud.hideOverlay();
			frame(0);
			return;
		}
		liveShot();
		body.position.set(0,0,4);
		bots.reset();
		bots.items[0].mover.position.set(1,0,-3);
		bots.items[0].alive = false;
		bots.items[0].state = 'dead';
		bots.items[0].fall = 1;
		bots.items[0].group.rotation.x = -1.45;
		bots.items[1].mover.position.set(-5,0,-6);
		allies.items[0].mover.position.set(2.6,0,-0.8);
		allies.items[0].yaw = 2.5;
		settle(10);
		aimAt(bots.aimPoint(0));
		S.phase = PHASES.ROUND_END;
		S.roundsWon = 1;
		hud.setScore(1,0,1);
		tally.you.k = 2;
		tally.allies[0].k = 1;
		tally.allies[1].k = 1;
		tally.allies[2].k = 1;
		for (const t of tally.bots) t.d = 1;
		S.roundHistory = ['W'];
		hud.showOverlay('roundEnd',{ won: true,reason: 'All Rust bots eliminated',wonRounds: 1,lost: 0,earned: 600,mvp: 'You (2K / 0D)' });
		hud.showScoreboard(boardData());
		frame(0);
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