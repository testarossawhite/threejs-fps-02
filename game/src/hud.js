import { PRICES } from './state.js';
	const P = Math.PI;
	const CE = (tag) => document.createElement(tag);
const BUY_ITEMS = [
	{ key: '1',id: 'rifle',name: 'VK-7 Carbine',desc: 'Auto rifle · 30 rounds · headshot kills',price: PRICES.rifle },
	{ key: '2',id: 'smg',name: 'Dusk-9 SMG',desc: 'Fast close-quarters spray · 32 rounds',price: PRICES.smg },
	{ key: '3',id: 'pistol',name: 'P-9 Sidearm',desc: 'Free sidearm · 12 rounds',price: PRICES.pistol },
	{ key: '4',id: 'frag',name: 'Spark-4 Frag',desc: 'Bounces, fuses, bursts for up to 90 damage',price: PRICES.frag },
	{ key: '5',id: 'smoke',name: 'Haze-2 Smoke',desc: 'Blocks bot sight for 12 seconds',price: PRICES.smoke },
	{ key: '6',id: 'armour',name: 'Plate Armour',desc: 'Takes 35% off every hit this round',price: PRICES.armour },
	{ key: '7',id: 'smg2',name: 'KR-9 Kestrel',desc: 'Bullpup SMG · 40 rounds · fastest spray',price: PRICES.smg2 },
	{ key: '8',id: 'shotgun',name: 'BR-12 Breacher',desc: 'Pump shotgun · 8 pellets · point-blank deletes',price: PRICES.shotgun },
	{ key: '9',id: 'helmet',name: 'Ballistic Helmet',desc: 'Headshots against you lose 55% of their bite',price: PRICES.helmet },
	{ key: '0',id: 'flash',name: 'Glare-1 Flashbang',desc: 'Blinds whoever looks at the burst for ~2 seconds',price: PRICES.flash },
];
export function createHud() {
	const $ = (id) => document.getElementById(id);
	const [overlay,title,copy,play,buyList,buyMoney,ammoMag,ammoReserve,weaponName,grenadeInfo,healthFill,healthValue,moneyValue,timerValue,scoreEmber,scoreRust,roundValue,spikeStatus,killfeed,hitmarker,crosshair,damageVignette,plantBar,plantFill,plantLabel,kills,dmgdir,flashblind,scoreboard] = [
		'overlay','overlay-title','overlay-copy','play','buy-list','buy-money','ammo-mag','ammo-reserve','weapon-name','grenade-info','health-fill','health-value','money-value','timer-value','score-ember','score-rust','round-value','spike-status','killfeed','hitmarker','crosshair','damage-vignette','plant-bar','plant-fill','plant-label','kills','dmgdir','flashblind','scoreboard',
	].map($);
	const mapCtx = $('minimap').getContext('2d');
	let hitTimer = 0;
	let damageTimer = 0;
	let dirTimer = 0;
	let last = { mag: -1,reserve: -1,weapon: '',grenades: '',hp: -1,money: -1,timer: '',score: '',spike: '' };
	let playHandler = null;
	let buyHandler = null;
	play.addEventListener('click',() => { if (playHandler) playHandler(); });
	buyList.addEventListener('click',(event) => {
		const button = event.target.closest('[data-buy]');
		if (button && buyHandler) buyHandler(button.dataset.buy);
	});
	function sT(node,value,key) {
		if (last[key] === value) return;
		last[key] = value;
		node.textContent = value;
	}
	return {
		setHealth(hp,max) {
			if (hp === last.hp) return;
			last.hp = hp;
			const pct = Math.max(0,(hp / max) * 100);
			healthFill.style.width = `${pct}%`;
			healthValue.textContent = String(Math.ceil(hp));
			healthFill.classList.toggle('low',pct <= 30);
		},
		setAmmo(mag,reserve,weapon,frags,smokes,flashes,selected) {
			sT(ammoMag,String(mag),'mag');
			sT(ammoReserve,`/ ${reserve}`,'reserve');
			sT(weaponName,weapon,'weapon');
			const g = `G ${selected === 'frag' ? '▸' : ''}Frag ×${frags}  ${selected === 'smoke' ? '▸' : ''}Smoke ×${smokes}  ${selected === 'flash' ? '▸' : ''}Flash ×${flashes}`;
			sT(grenadeInfo,g,'grenades');
		},
		setMoney(value) {
			sT(moneyValue,`$${value}`,'money');
		},
		setTimer(seconds,planted) {
			const shown = Math.max(0,Math.ceil(seconds));
			const text = planted ? `SPIKE ${shown}` : `${Math.floor(shown / 60)}:${String(shown % 60).padStart(2, '0')}`;
			sT(timerValue,text,'timer');
			timerValue.classList.toggle('danger',shown <= 10);
		},
		setScore(won,lost,round) {
			sT(scoreEmber,String(won),'score');
			sT(scoreRust,String(lost),'scoreRust');
			sT(roundValue,`ROUND ${round}`,'round');
		},
		setSpike(status,site,timer) {
			let text = '';
			if (status === 'carried') text = 'SPIKE CARRIED — hold E at Site A or B to plant';
			else if (status === 'planted') text = `SPIKE PLANTED AT ${site} — ${Math.ceil(timer)}s to detonation`;
			else if (status === 'exploded') text = 'SPIKE DETONATED';
			else if (status === 'defused') text = 'SPIKE DEFUSED';
			sT(spikeStatus,text,'spike');
			spikeStatus.classList.toggle('planted',status === 'planted');
		},
		setPlant(progress,label) {
			if (progress <= 0) {
				plantBar.hidden = true;
				return;
			}
			plantBar.hidden = false;
			plantFill.style.width = `${Math.min(100, progress * 100)}%`;
			plantLabel.textContent = label;
		},
		setCrosshairSpread(px) {
			crosshair.style.setProperty('--gap',`${px.toFixed(1)}px`);
		},
		hitMarker(killed,holdMs = 90) {
			hitmarker.classList.add('on');
			hitmarker.style.transform = killed ? 'translate(-50%, -50%) rotate(45deg) scale(1.25)' : '';
			clearTimeout(hitTimer);
			hitTimer = setTimeout(() => {
				hitmarker.classList.remove('on');
				hitmarker.style.transform = '';
			},holdMs);
		},
		damageFlash() {
			damageVignette.classList.add('on');
			clearTimeout(damageTimer);
			damageTimer = setTimeout(() => damageVignette.classList.remove('on'),220);
		},
		killfeed(text,good) {
			const entry = CE('div');
			entry.className = good ? 'feed-good' : 'feed-bad';
			entry.textContent = text;
			killfeed.prepend(entry);
			while (killfeed.children.length > 4) killfeed.removeChild(killfeed.lastChild);
			setTimeout(() => entry.remove(),5000);
		},
		kill(killer,weapon,victim,good) {
			const entry = CE('div');
			const kb = CE('b');
			kb.className = good ? 'ally' : 'foe';
			kb.textContent = killer;
			const wp = CE('span');
			wp.className = 'wpn';
			wp.textContent = ` [${weapon}] `;
			const vb = CE('b');
			vb.className = good ? 'foe' : 'ally';
			vb.textContent = victim;
			entry.append(kb,wp,vb);
			kills.prepend(entry);
			while (kills.children.length > 5) kills.removeChild(kills.lastChild);
			setTimeout(() => entry.remove(),5200);
		},
		damageFrom(rel) {
			dmgdir.style.transform = `translate(-50%, -50%) rotate(${(-rel * 57.2958).toFixed(1)}deg)`;
			dmgdir.style.opacity = '1';
			clearTimeout(dirTimer);
			dirTimer = setTimeout(() => { dmgdir.style.opacity = '0'; },700);
		},
		setBlind(v) {
			flashblind.style.opacity = v > 0.01 ? v.toFixed(2) : '0';
		},
		setAds(on) {
			crosshair.style.opacity = on ? '0.1' : '';
		},
		setMinimap(d) {
			const c = mapCtx;
			const mx = (x) => 84 + x * 3.4;
			const my = (z) => 84 + z * 3.4;
			c.clearRect(0,0,168,168);
			c.save();
			c.beginPath();
			c.arc(84,84,82,0,P * 2);
			c.clip();
			c.fillStyle = '#232820';
			c.fillRect(0,0,168,168);
			c.fillStyle = '#3d4438';
			c.fillRect(mx(-20),my(-18),136,122.4);
			c.strokeStyle = '#79826e';
			c.lineWidth = 2;
			c.strokeRect(mx(-20),my(-18),136,122.4);
			c.font = 'bold 11px system-ui, sans-serif';
			c.textAlign = 'center';
			for (const [label,sx,sz,col] of [['A',-12,-12,'rgba(240,166,62,0.4)'],['B',12,-11,'rgba(47,174,157,0.4)']]) {
				c.fillStyle = col;
				c.beginPath();
				c.arc(mx(sx),my(sz),14,0,P * 2);
				c.fill();
				c.fillStyle = '#f4ead2';
				c.fillText(label,mx(sx),my(sz) + 4);
			}
			c.fillStyle = '#5c6355';
			c.beginPath();
			c.arc(mx(0),my(-2),7.5,0,P * 2);
			c.fill();
			if (d.spike) {
				c.fillStyle = '#ffffff';
				c.save();
				c.translate(mx(d.spike.x),my(d.spike.z));
				c.rotate(P / 4);
				c.fillRect(-3.4,-3.4,6.8,6.8);
				c.restore();
			}
			const dot = (x,z,r,color) => {
				c.fillStyle = color;
				c.beginPath();
				c.arc(mx(x),my(z),r,0,P * 2);
				c.fill();
			};
			for (const a of d.allies) if (a.alive) dot(a.x,a.z,3,'#f0a63e');
			for (const f of d.foes) if (f.seen) dot(f.x,f.z,3.4,'#e5482e');
			c.fillStyle = '#ffffff';
			c.beginPath();
			c.arc(mx(d.px),my(d.pz),3.6,0,P * 2);
			c.fill();
			c.strokeStyle = '#ffffff';
			c.lineWidth = 2;
			c.beginPath();
			c.moveTo(mx(d.px),my(d.pz));
			c.lineTo(mx(d.px) - Math.sin(d.yaw) * 10,my(d.pz) - Math.cos(d.yaw) * 10);
			c.stroke();
			c.restore();
		},
		showScoreboard(d) {
			scoreboard.hidden = false;
			const pips = d.history.map((h) => `<span class="${h === 'W' ? 'pip-w' : 'pip-l'}">●</span>`).join('');
			let html = `<h2><span>EMBER ${d.won} — ${d.lost} RUST</span><span class="pips">${pips}</span></h2>`;
			html += '<table><tr><th>PLAYER</th><th>K</th><th>D</th></tr>';
			for (const r of d.rows) {
				html += `<tr class="${r.team}${r.you ? ' you' : ''}${r.alive ? '' : ' dead'}"><td>${r.name}</td><td>${r.k}</td><td>${r.d}</td></tr>`;
			}
			scoreboard.innerHTML = `${html}</table>`;
		},
		hideScoreboard() {
			scoreboard.hidden = true;
		},
		showOverlay(mode,data = {}) {
			overlay.hidden = false;
			if (mode === 'buy') {
				title.textContent = `Buy phase — Round ${data.round}`;
				copy.textContent = 'Spend your round money. Click an item or press its number key, then start the round.';
				play.textContent = 'Start round  [Enter]';
				buyList.hidden = false;
				buyMoney.hidden = false;
				buyMoney.textContent = `Money: $${data.money}`;
				buyList.innerHTML = '';
				for (const item of BUY_ITEMS) {
					const owned = data.loadout && (
						(item.id === 'rifle' && data.loadout.primary === 'rifle')
						|| (item.id === 'smg' && data.loadout.primary === 'smg')
						|| (item.id === 'smg2' && data.loadout.primary === 'smg2')
						|| (item.id === 'shotgun' && data.loadout.primary === 'shotgun')
						|| (item.id === 'pistol' && data.loadout.primary === 'pistol')
						|| (item.id === 'armour' && data.loadout.armour)
						|| (item.id === 'helmet' && data.loadout.helmet)
					);
					const button = CE('button');
					button.type = 'button';
					button.className = 'buy-item';
					button.dataset.buy = item.id;
					button.disabled = data.money < item.price || owned;
					button.innerHTML = `<b>[${item.key}] ${item.name}</b><span>${item.desc}</span><em>${owned ? 'OWNED' : item.price === 0 ? 'FREE' : '$' + item.price}</em>`;
					buyList.appendChild(button);
				}
			} else {
				buyList.hidden = true;
				buyMoney.hidden = true;
				if (mode === 'start') {
					title.textContent = 'Dustworks Yard';
					copy.textContent = 'Your Ember squad attacks — five against five. Follow the radio call, plant the spike at Site A (Foundry) or Site B (Depot), or eliminate all five Rust bots. First to 4 rounds takes the yard.';
					play.textContent = 'Click to play';
				} else if (mode === 'paused') {
					title.textContent = 'Dustworks Yard';
					copy.textContent = 'Paused. Click to resume.';
					play.textContent = 'Click to resume';
				} else if (mode === 'roundEnd') {
					title.textContent = data.won ? 'Round won' : 'Round lost';
					copy.textContent = `${data.reason}.  Ember ${data.wonRounds} — ${data.lost} Rust. ${data.earned ? `You earned $${data.earned}.` : ''}${data.mvp ? `  MVP: ${data.mvp}.` : ''}`;
					play.textContent = 'Continue to buy phase';
				} else if (mode === 'matchEnd') {
					title.textContent = data.won ? 'The yard is yours' : 'Rust keeps the yard';
					copy.textContent = `Final: Ember ${data.wonRounds} — ${data.lost} Rust. ${data.kills} eliminations, ${data.plants} plants.`;
					play.textContent = 'Play again';
				}
			}
			play.focus();
		},
		hideOverlay() {
			overlay.hidden = true;
		},
		onPlay(handler) {
			playHandler = handler;
		},
		onBuy(handler) {
			buyHandler = handler;
		},
	};
}