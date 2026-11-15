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
	const H = hud,W = weapons,B = bots,A = allies,K = spike,I = input,U = audio,M = Math;
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
		allies: A.items.map(() => ({ x: 0,z: 0,alive: false })),
		foes: B.items.map(() => ({ x: 0,z: 0,seen: false })),
	};
	function syncAmmo() {
		H.setAmmo(W.state.mag,W.state.reserve,W.def().name,W.state.frags,W.state.smokes,W.state.flashes,W.state.selectedGrenade);
	}
	function resetTally() {
		tally = {
			you: { k: 0,d: 0 },
			allies: A.items.map(() => ({ k: 0,d: 0 })),
			bots: B.items.map(() => ({ k: 0,d: 0 })),
		};
	}
	resetTally();
	const raycaster = new T.Raycaster();
	raycaster.far = 90;
	let pS = 'A';
	let rotated = false;
	let planter = null;
	const eVw = [
		{ pos: player.state.position,alive: true,speed: 0,crouching: false,isPlayer: true,ref: null },
		...allies.items.map((ally) => ({
			pos: ally.mover.position,alive: true,speed: 0,crouching: false,isPlayer: false,ref: ally,
		})),
	];
	const rVw = B.items.map((bot) => ({ pos: bot.mover.position,alive: true,ref: bot }));
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
	for (let i = 0; i < TRACER_POOL; i++) {
		const mesh = new T.Mesh(tracerGeometry,tracerMaterial.clone());
		mesh.visible = false;
		scene.add(mesh);
		tracers.push({ mesh,life: 0 });
	}
	let tracerIndex = 0;
	const sparks = [];
	const sparkTexture = glowTexture();
	for (let i = 0; i < SPARK_POOL; i++) {
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
		_muzzle.x += M.cos(body.yaw) * 0.18;
		_muzzle.z -= M.sin(body.yaw) * 0.18;
		_muzzle.y -= 0.14;
		return _muzzle;
	}
	function shoot(spread) {
		if (!W.takeRound()) return;
		const def = W.def();
		const pellets = def.pellets ?? 1;
		const effSpread = spread * (1 - W.adsAmount() * 0.5);
		let botHit = false;
		let killedAny = false;
		scene.updateMatrixWorld(true);
		for (let p = 0; p < pellets; p++) {
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
				const died = B.damage(hit.object,head ? def.headDamage : def.damage);
				if (died) {
					killedAny = true;
					S.kills++;
					S.money += REWARDS.kill;
					tally.you.k++;
					tally.bots[bot.id].d++;
					H.kill('You',def.short,`Rust-${bot.id + 1}`,true);
					H.kf(`You eliminated Rust-${bot.id + 1}${head ? ' (headshot)' : ''}`,true);
					U.kill();
				}
			}
		}
		if (botHit) {
			H.hitMarker(killedAny,killedAny ? 4000 : 90);
			U.hit();
		}
		W.pullTrigger();
		player.recoil(W.def().kick * (0.8 + random() * 0.4),(random() * 2 - 1) * 0.003);
		U.shot();
		_noisePos.copy(body.position);
		noise = { pos: _noisePos,time: elapsed };
		syncAmmo();
	}
	function dmgP(amount,fromPos,headshot = false,killer = null) {
		if (!body.alive || S.phase !== PHASES.LIVE) return;
		let final = headshot && body.helmet ? M.round(amount * 0.45) : amount;
		final = body.armour ? M.round(final * 0.65) : final;
		body.health -= final;
		H.damageFlash();
		if (fromPos) {
			const rel = M.atan2(-(fromPos.x - body.position.x),-(fromPos.z - body.position.z)) - body.yaw;
			H.damageFrom(M.atan2(M.sin(rel),M.cos(rel)));
		}
		U.hurt();
		if (body.health <= 0) {
			body.health = 0;
			body.alive = false;
			S.deaths++;
			if (killer) {
				tally.bots[killer.id].k++;
				tally.you.d++;
				H.kill(`Rust-${killer.id + 1}`,killer.gun.short,'You',false);
			}
			if (K.state.status !== 'planted' && A.aliveCount() === 0) {
				endRound(false,'Ember team eliminated');
			} else if (K.state.status !== 'planted') {
				H.kf('You are down — your squad fights on',false);
			}
		}
	}
	function onPlanted(pSite,byAlly) {
		S.plants++;
		S.money += REWARDS.plant;
		if (byAlly) H.kf(`${byAlly.name}: Spike planted — holding Site ${pSite.name}`,true);
		else H.kf(`Spike planted at Site ${pSite.name}`,true);
		U.plant();
	}
	function dmgA(ally,amount,killer = null) {
		const died = A.damage(ally,amount);
		if (!died) return;
		tally.allies[ally.id].d++;
		if (killer && killer.mover) {
			tally.bots[killer.id].k++;
			H.kill(`Rust-${killer.id + 1}`,killer.gun.short,ally.name,false);
		}
		H.kf(`${ally.name} is down`,false);
		if (planter === ally) {
			planter = null;
			K.state.plantProgress = 0;
		}
	}
	function dmgB(bot,amount) {
		const died = B.damage(bot.torso,amount);
		if (died) {
			S.kills++;
			S.money += REWARDS.kill;
			tally.you.k++;
			tally.bots[bot.id].d++;
			H.kill('You','Spark-4',`Rust-${bot.id + 1}`,true);
			H.kf(`Frag eliminated Rust-${bot.id + 1}`,true);
			U.kill();
		}
	}
	function refreshViews() {
		eVw[0].alive = body.alive;
		eVw[0].speed = player.groundSpeed();
		eVw[0].crouching = body.crouching;
		for (let i = 0; i < A.items.length; i++) {
			const ally = A.items[i];
			eVw[i + 1].alive = ally.alive;
			eVw[i + 1].speed = M.hypot(ally.mover.velocity.x,ally.mover.velocity.z);
		}
		for (let i = 0; i < B.items.length; i++) rVw[i].alive = B.items[i].alive;
	}
	function botContext() {
		return {
			time: elapsed,
			spikePlanted: K.state.status === 'planted',
			spikeSite: K.state.site ? K.state.site.name : '',
			sP: K.state.pos,
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
				U.enemyShot();
				if (damage > 0) dmgP(damage,from,headshot,bot);
			},
			onBotShotAlly(bot,from,to,ally,damage,headshot) {
				fireTracer(from,to);
				U.enemyShot();
				spawnSpark(to);
				dmgA(ally,damage,bot);
			},
			onDefused() {
				K.defused();
				endRound(false,'Rust defused the spike');
			},
		};
	}
	function allyContext() {
		return {
			time: elapsed,
			enemyViews: rVw,
			pS,
			spikePlanted: K.state.status === 'planted',
			spikeSite: K.state.site ? K.state.site.name : '',
			planter,
			smokeBlocks: (a,b) => grenades.smokeBlocks(a,b),
			raycastTargets: emberRaycastTargets,
			onAllyShot(ally,from,to,hitMesh,damage,headshot) {
				fireTracer(from,to);
				U.enemyShot();
				_noisePos.copy(ally.mover.position);
				noise = { pos: _noisePos,time: elapsed };
				if (hitMesh) {
					spawnSpark(to);
					const died = B.damage(hitMesh,damage);
					if (died) {
						const bot = hitMesh.userData.bot;
						tally.allies[ally.id].k++;
						tally.bots[bot.id].d++;
						H.kill(ally.name,ally.gunShort,`Rust-${bot.id + 1}`,true);
						H.kf(`${ally.name} eliminated Rust-${bot.id + 1}${headshot ? ' (headshot)' : ''}`,true);
						U.kill();
					}
				}
			},
			onEvent(kind,ally) {
				if (kind === 'contact') {
					const site = world.siteAt(ally.mover.position.x,ally.mover.position.z);
					const where = site ? `Site ${site.name}` : ally.mover.position.z < -6 ? 'the north yard' : 'the lanes';
					H.kf(`${ally.name}: Contact — ${where}`,true);
				}
			},
		};
	}
	function grenadeContext() {
		return {
			playerPos: body.position,
			bots: B.items,
			allies: A.items,
			damagePlayer: (dmg,pos) => dmgP(dmg,pos),
			damageBot: (bot,dmg) => dmgB(bot,dmg),
			damageAlly: (ally,dmg) => dmgA(ally,dmg),
			onExplosion(pos,radius) {
				U.explosion();
				_noisePos.copy(pos);
				noise = { pos: _noisePos,time: elapsed };
			},
			onFlash(pos) {
				U.flash();
				const blindFor = (unitPos,yaw) => {
					const dx = pos.x - unitPos.x;
					const dz = pos.z - unitPos.z;
					const dist = M.hypot(dx,dz);
					if (dist > 10) return 0;
					_flashEye.set(unitPos.x,unitPos.y + 1.5,unitPos.z);
					if (world.blockedBetween(_flashEye,pos)) return 0;
					const dot = ((-M.sin(yaw)) * dx + (-M.cos(yaw)) * dz) / (dist || 1);
					return dot < 0.05 ? 0 : (0.4 + dot * 0.6) * (1 - dist / 12);
				};
				if (body.alive) {
					camera.getWorldDirection(_dir);
					const dx = pos.x - body.position.x;
					const dz = pos.z - body.position.z;
					const dist = M.hypot(dx,dz);
					if (dist <= 10) {
						_flashEye.set(body.position.x,body.position.y + 1.5,body.position.z);
						if (!world.blockedBetween(_flashEye,pos)) {
							const dot = (_dir.x * dx + _dir.z * dz) / (dist || 1);
							if (dot > 0.05) blindV = M.max(blindV,M.min(1,(0.35 + dot * 0.65) * (1 - dist / 13)));
						}
					}
				}
				for (const bot of B.items) {
					if (!bot.alive) continue;
					const s = blindFor(bot.mover.position,bot.yaw);
					if (s > 0.25) bot.blindUntil = M.max(bot.blindUntil,elapsed + 0.6 + s * 2);
				}
				for (const ally of A.items) {
					if (!ally.alive) continue;
					const s = blindFor(ally.mover.position,ally.yaw);
					if (s > 0.25) ally.blindUntil = M.max(ally.blindUntil,elapsed + 0.6 + s * 2);
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
		A.items.forEach((a,i) => consider(a.name,tally.allies[i]));
		B.items.forEach((b,i) => consider(`Rust-${b.id + 1}`,tally.bots[i]));
		return best && best.k > 0 ? `${best.name} (${best.k}K / ${best.d}D)` : '';
	}
	function boardData() {
		const rows = [
			{ name: 'You',team: 'ember',k: tally.you.k,d: tally.you.d,alive: body.alive,you: true },
			...allies.items.map((a,i) => ({ name: a.name,team: 'ember',k: tally.allies[i].k,d: tally.allies[i].d,alive: a.alive })),
			...bots.items.map((b,i) => ({ name: `Rust-${b.id + 1}`,team: 'rust',k: tally.bots[i].k,d: tally.bots[i].d,alive: b.alive })),
		];
		return { won: S.rW,lost: S.rL,history: S.roundHistory,rows };
	}
	function endRound(won,reason) {
		if (S.phase !== PHASES.LIVE) return;
		S.phase = PHASES.ROUND_END;
		S.pT = 0;
		S.roundReason = reason;
		S.roundHistory.push(won ? 'W' : 'L');
		let earned = 0;
		if (won) {
			S.rW++;
			earned = REWARDS.roundWin + (K.state.status === 'planted' || K.state.status === 'exploded' ? REWARDS.plant : 0);
			U.roundWin();
		} else {
			S.rL++;
			earned = REWARDS.roundLoss;
			U.roundLose();
		}
		S.money += earned;
		S.earned = earned;
		if (document.pointerLockElement) document.exitPointerLock();
		H.showOverlay('roundEnd',{ won,reason,wonRounds: S.rW,lost: S.rL,earned,mvp: mvpName() });
		H.setScore(S.rW,S.rL,S.round);
	}
	function startBuy() {
		S.phase = PHASES.BUY;
		S.pT = 0;
		pS = random() < 0.5 ? 'A' : 'B';
		rotated = false;
		planter = null;
		player.reset(world.spawns.ember);
		B.reset();
		A.reset(pS);
		K.reset();
		grenades.reset();
		W.equip(S.lo);
		body.armour = S.lo.armour;
		S.lo.armour = false;
		body.helmet = S.lo.helmet;
		S.lo.helmet = false;
		_prevPos.copy(body.position);
		stepAcc = 0;
		H.setHealth(body.health,body.maxHealth);
		syncAmmo();
		H.setMoney(S.money);
		H.setSpike('carried','',0);
		H.setPlant(0,'');
		H.setScore(S.rW,S.rL,S.round);
		H.showOverlay('buy',{ round: S.round,money: S.money,lo: S.lo });
	}
	function startRound() {
		if (S.rW >= MATCH_TARGET || S.rL >= MATCH_TARGET || S.round > MAX_ROUNDS) {
			endMatch();
			return;
		}
		S.phase = PHASES.LIVE;
		S.pT = 0;
		S.roundTimer = ROUND_SECONDS;
		K.reset();
		H.kf(`Ember-1: All units — hit Site ${pS}`,true);
		H.hideOverlay();
		H.setTimer(S.roundTimer,false);
		H.setSpike('carried','',0);
		H.setScore(S.rW,S.rL,S.round);
		I.requestLock();
		U.resume();
	}
	function endMatch() {
		S.phase = PHASES.MATCH_END;
		S.pT = 0;
		const won = S.rW > S.rL;
		S.matchWinner = won ? 'Ember' : 'Rust';
		if (document.pointerLockElement) document.exitPointerLock();
		H.showOverlay('matchEnd',{ won,wonRounds: S.rW,lost: S.rL,kills: S.kills,plants: S.plants });
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
			S.lo.primary = id;
		} else if (id === 'frag') {
			if (S.lo.frags >= 2) return;
			S.lo.frags++;
		} else if (id === 'smoke') {
			if (S.lo.smokes >= 2) return;
			S.lo.smokes++;
		} else if (id === 'flash') {
			if (S.lo.flashes >= 2) return;
			S.lo.flashes++;
		} else if (id === 'armour') {
			if (S.lo.armour) return;
			S.lo.armour = true;
		} else if (id === 'helmet') {
			if (S.lo.helmet) return;
			S.lo.helmet = true;
		}
		S.money -= price;
		U.buy();
		H.setMoney(S.money);
		H.showOverlay('buy',{ round: S.round,money: S.money,lo: S.lo });
	}
	function onPlayButton() {
		if (S.phase === PHASES.MENU) startMatch();
		else if (S.phase === PHASES.BUY) startRound();
		else if (S.phase === PHASES.ROUND_END) startBuy();
		else if (S.phase === PHASES.MATCH_END) startMatch();
		else if (S.phase === PHASES.LIVE) I.requestLock();
	}
	function step(dt) {
		elapsed += dt;
		const boardWanted = I.state.keys.has('Tab')
			|| S.phase === PHASES.ROUND_END || S.phase === PHASES.MATCH_END;
		boardTimer += dt;
		if (boardWanted && (!boardShown || boardTimer > 0.5)) {
			H.showScoreboard(boardData());
			boardShown = true;
			boardTimer = 0;
		} else if (!boardWanted && boardShown) {
			H.hideScoreboard();
			boardShown = false;
		}
		if (S.phase === PHASES.ROUND_END) {
			S.pT += dt;
			if (S.pT >= ROUND_END_SECONDS) {
				if (S.rW >= MATCH_TARGET || S.rL >= MATCH_TARGET || S.round >= MAX_ROUNDS) {
					endMatch();
				} else {
					S.round++;
					startBuy();
				}
			}
			return;
		}
		if (S.phase === PHASES.BUY) {
			S.pT += dt;
			H.setTimer(M.max(0,BUY_SECONDS - S.pT),false);
			if (I.tp('Enter')) startRound();
			else if (I.tp('KeyB')) startRound();
			else if (I.tp('Digit1')) buyItem('rifle');
			else if (I.tp('Digit2')) buyItem('smg');
			else if (I.tp('Digit3')) buyItem('pistol');
			else if (I.tp('Digit4')) buyItem('frag');
			else if (I.tp('Digit5')) buyItem('smoke');
			else if (I.tp('Digit6')) buyItem('armour');
			else if (I.tp('Digit7')) buyItem('smg2');
			else if (I.tp('Digit8')) buyItem('shotgun');
			else if (I.tp('Digit9')) buyItem('helmet');
			else if (I.tp('Digit0')) buyItem('flash');
			return;
		}
		if (S.phase !== PHASES.LIVE) return;
		S.pT += dt;
		gCd = M.max(0,gCd - dt);
		if (K.state.status === 'planted') {
			S.roundTimer = K.state.timer;
		} else {
			S.roundTimer -= dt;
			if (S.roundTimer <= 0) {
				endRound(false,'Time expired — Rust holds the yard');
				return;
			}
		}
		if (body.alive) player.step(dt,I.state.keys);
		stepAcc += M.hypot(body.position.x - _prevPos.x,body.position.z - _prevPos.z);
		_prevPos.copy(body.position);
		if (stepAcc > 2.3 && body.onGround && body.alive) {
			stepAcc = 0;
			U.step();
		}
		W.step(dt,player.groundSpeed(),I.state.aiming && body.alive);
		refreshViews();
		A.step(dt,allyContext());
		if (S.phase !== PHASES.LIVE) return;
		B.step(dt,botContext());
		if (S.phase !== PHASES.LIVE) return;
		K.step(dt,{
			onBeep: () => U.beep(),
			onExploded: (site) => endRound(true,`Spike detonated at Site ${site.name}`),
		});
		if (S.phase !== PHASES.LIVE) return;
		grenades.step(dt,grenadeContext());
		if (K.state.status === 'carried') {
			let planting = false;
			if (body.alive && I.state.keys.has('KeyE')) {
				const site = world.siteAt(body.position.x,body.position.z);
				if (site && player.groundSpeed() < 0.8) {
					K.plantTick(dt,body.position,(pSite) => onPlanted(pSite,null));
					H.setPlant(K.state.plantProgress / PLANT_SECONDS,'PLANTING SPIKE…');
					planting = true;
				}
			} else if (!body.alive) {
				planter = A.firstAlive();
				if (planter && planter.state === 'plant') {
					K.plantTick(dt,planter.mover.position,(pSite) => onPlanted(pSite,planter));
					H.setPlant(K.state.plantProgress / PLANT_SECONDS,`${planter.name.toUpperCase()} PLANTING…`);
					planting = true;
				}
			}
			if (!planting) {
				K.state.plantProgress = 0;
				H.setPlant(0,'');
			}
		}
		if (!rotated && K.state.status === 'carried' && body.alive
			&& A.aliveCount() <= 2 && S.pT > 25) {
			rotated = true;
			pS = pS === 'A' ? 'B' : 'A';
			H.kf(`Ember-1: Rotate — fall back to Site ${pS}`,true);
		}
		if (body.alive) {
			if (I.state.firing && W.ready()) {
				if (W.def().auto || I.tp('MouseDown')) {
					shoot(shotMode ? 0 : W.spread(player.groundSpeed()));
				}
			}
			if (I.tp('KeyR')) {
				W.reload();
				U.reload();
			}
			if (I.tp('KeyF')) {
				W.inspect();
				U.reload();
			}
			if (I.tp('Digit1') && owned.pistol) W.select('pistol');
			if (I.tp('Digit2') && owned.smg) W.select('smg');
			if (I.tp('Digit3') && owned.rifle) W.select('rifle');
			if (I.tp('Digit4') && owned.smg2) W.select('smg2');
			if (I.tp('Digit5') && owned.shotgun) W.select('shotgun');
			if (I.tp('KeyQ')) {
				const kinds = ['frag','smoke','flash'];
				const next = kinds[(kinds.indexOf(W.state.selectedGrenade) + 1) % kinds.length];
				W.state.selectedGrenade = next;
				syncAmmo();
			}
			if (I.tp('KeyG') && gCd <= 0) {
				const kind = W.state.selectedGrenade;
				const count = kind === 'frag' ? W.state.frags : kind === 'smoke' ? W.state.smokes : W.state.flashes;
				if (count > 0) {
					camera.getWorldDirection(_dir);
					const from = camera.position.clone().addScaledVector(_dir,0.6);
					grenades.throwGrenade(kind,from,_dir);
					if (kind === 'frag') W.state.frags--;
					else if (kind === 'smoke') W.state.smokes--;
					else W.state.flashes--;
					gCd = 0.5;
					syncAmmo();
				}
			}
		}
		if (B.aliveCount() === 0) {
			endRound(true,'All Rust bots eliminated');
			return;
		}
		if (!body.alive && A.aliveCount() === 0 && K.state.status !== 'planted') {
			endRound(false,'Ember team eliminated');
			return;
		}
		playerHitbox.position.set(body.position.x,body.position.y + 0.86,body.position.z);
		H.setAds(W.adsAmount() > 0.6);
		H.setHealth(body.health,body.maxHealth);
		syncAmmo();
		H.setTimer(S.roundTimer,K.state.status === 'planted');
		H.setMoney(S.money);
		H.setSpike(K.state.status,K.state.site ? K.state.site.name : '',K.state.timer);
		H.setCrosshairSpread(3 + W.spread(player.groundSpeed()) * 420);
	}
	function frame(dt) {
		world.update(dt);
		blindV = M.max(0,blindV - dt * 0.45);
		H.setBlind(blindV * 0.94);
		mapData.px = body.position.x;
		mapData.pz = body.position.z;
		mapData.yaw = body.yaw;
		mapData.spike = K.state.status === 'planted' ? K.state.pos : null;
		for (let i = 0; i < A.items.length; i++) {
			mapData.allies[i].x = A.items[i].mover.position.x;
			mapData.allies[i].z = A.items[i].mover.position.z;
			mapData.allies[i].alive = A.items[i].alive;
		}
		for (let i = 0; i < B.items.length; i++) {
			const bot = B.items[i];
			mapData.foes[i].x = bot.mover.position.x;
			mapData.foes[i].z = bot.mover.position.z;
			mapData.foes[i].seen = bot.alive && (bot.state === 'engage'
				|| A.items.some((a) => a.alive && a.target === bot));
		}
		H.setMinimap(mapData);
		for (const tracer of tracers) {
			if (!tracer.mesh.visible) continue;
			if (tracer.life > 0) {
				tracer.life -= dt;
				tracer.mesh.material.opacity = M.max(0,tracer.life / TRACER_LIFE) * 0.9;
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
			const ally = A.firstAlive();
			if (ally) {
				cameraOut.position.set(ally.mover.position.x,ally.mover.position.y + 1.62,ally.mover.position.z);
				cameraOut.rotation.set(-0.03,ally.yaw,0,'YXZ');
				return;
			}
			if (K.state.status === 'planted') {
				const dx = K.state.pos.x - body.position.x;
				const dz = K.state.pos.z - body.position.z;
				cameraOut.position.set(body.position.x,body.position.y + 1.1,body.position.z);
				cameraOut.rotation.set(0,M.atan2(-dx,-dz),0,'YXZ');
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
		const len = M.hypot(dx,dy,dz) || 1;
		body.yaw = M.atan2(-dx,-dz);
		body.pitch = M.asin(M.max(-1,M.min(1,dy / len)));
	}
	function settle(steps) {
		for (let i = 0; i < steps; i++) step(1 / 60);
	}
	function liveShot() {
		startMatch();
		S.phase = PHASES.LIVE;
		S.round = 1;
		owned.rifle = true;
		S.lo.primary = 'rifle';
		W.equip(S.lo);
	}
	function setupShot(name) {
		shotMode = name;
		H.hideOverlay();
		if (name === 'start') {
			S.phase = PHASES.MENU;
			player.reset(world.spawns.ember);
			body.position.set(1.5,0,13);
			body.yaw = 0.12;
			body.pitch = 0.04;
			B.reset();
			A.reset('A');
			settle(30);
			for (const [unit,x,z,yaw] of [
				[B.items[0],-3,2,M.PI],[B.items[1],4,-1,M.PI],
				[A.items[0],-5.4,6.5,0.3],[A.items[1],6.4,6,-0.3],
			]) {
				unit.mover.position.set(x,0,z);
				unit.yaw = yaw;
				unit.group.position.set(x,0,z);
				unit.group.rotation.y = yaw;
			}
			H.showOverlay('start',{});
			frame(0);
			return;
		}
		if (name === 'play') {
			liveShot();
			S.roundTimer = ROUND_SECONDS;
			body.position.set(0,0,6);
			body.yaw = 0;
			body.pitch = 0;
			B.reset();
			B.items[0].mover.position.set(4.5,0,-5);
			B.items[0].state = 'engage';
			B.items[0].lS.copy(body.position);
			B.items[0].lastSeenAt = elapsed;
			B.items[1].mover.position.set(-4,0,-4);
			B.items[2].mover.position.set(5,0,3);
			A.items[0].mover.position.set(2.7,0,0.6);
			A.items[0].yaw = M.atan2(-(4.5 - 2.7),-(-5 - 0.6));
			A.items[0].state = 'engage';
			A.items[0].target = B.items[0];
			A.items[1].mover.position.set(-3.6,0,-1.2);
			A.items[1].yaw = 0.35;
			settle(10);
			aimAt(B.aimPoint(0));
			shoot(0);
			const ally = A.items[0];
			_muzzle.set(
				ally.mover.position.x + M.sin(ally.yaw) * -0.2,
				1.35,
				ally.mover.position.z + M.cos(ally.yaw) * -0.2,
			);
			fireTracer(_muzzle,B.aimPoint(0));
			spawnSpark(B.aimPoint(0));
			settle(6);
			H.hideOverlay();
			tally.you.k = 1;
			tally.bots[0].d = 1;
			H.kill('You','VK-7','Rust-1',true);
			H.damageFrom(-0.39);
			frame(0);
			return;
		}
		if (name === 'plant') {
			liveShot();
			S.roundTimer = ROUND_SECONDS;
			body.position.set(-11,0,-10.5);
			body.yaw = -2.3;
			body.pitch = 0;
			B.reset();
			B.items[0].mover.position.set(-6,0,-6);
			B.items[0].state = 'route';
			B.items[1].mover.position.set(-2,0,-12);
			B.items[2].mover.position.set(-13,0,-4);
			A.items[0].mover.position.set(-8.4,0,-7.2);
			A.items[0].yaw = -2.5;
			A.items[1].mover.position.set(-13.6,0,-6.2);
			A.items[1].yaw = 2.75;
			K.state.plantProgress = PLANT_SECONDS * 0.6;
			H.setSpike('carried','',0);
			settle(8);
			K.state.plantProgress = PLANT_SECONDS * 0.6;
			H.setPlant(0.6,'PLANTING SPIKE…');
			H.hideOverlay();
			frame(0);
			return;
		}
		liveShot();
		body.position.set(0,0,4);
		B.reset();
		B.items[0].mover.position.set(1,0,-3);
		B.items[0].alive = false;
		B.items[0].state = 'dead';
		B.items[0].fall = 1;
		B.items[0].group.rotation.x = -1.45;
		B.items[1].mover.position.set(-5,0,-6);
		A.items[0].mover.position.set(2.6,0,-0.8);
		A.items[0].yaw = 2.5;
		settle(10);
		aimAt(B.aimPoint(0));
		S.phase = PHASES.ROUND_END;
		S.rW = 1;
		H.setScore(1,0,1);
		tally.you.k = 2;
		tally.allies[0].k = 1;
		tally.allies[1].k = 1;
		tally.allies[2].k = 1;
		for (const t of tally.bots) t.d = 1;
		S.roundHistory = ['W'];
		H.showOverlay('roundEnd',{ won: true,reason: 'All Rust bots eliminated',wonRounds: 1,lost: 0,earned: 600,mvp: 'You (2K / 0D)' });
		H.showScoreboard(boardData());
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