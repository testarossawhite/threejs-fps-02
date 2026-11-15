// The DOM HUD: crosshair, hit marker, health, ammo, money, timer, score, spike
// status, kill feed and the overlay panels. It never touches the simulation;
// game.js pushes numbers in and reads button callbacks out.
import { PRICES } from './state.js';

const BUY_ITEMS = [
  { key: '1', id: 'rifle', name: 'VK-7 Carbine', desc: 'Auto rifle · 30 rounds · headshot kills', price: PRICES.rifle },
  { key: '2', id: 'smg', name: 'Dusk-9 SMG', desc: 'Fast close-quarters spray · 32 rounds', price: PRICES.smg },
  { key: '3', id: 'pistol', name: 'P-9 Sidearm', desc: 'Free sidearm · 12 rounds', price: PRICES.pistol },
  { key: '4', id: 'frag', name: 'Spark-4 Frag', desc: 'Bounces, fuses, bursts for up to 90 damage', price: PRICES.frag },
  { key: '5', id: 'smoke', name: 'Haze-2 Smoke', desc: 'Blocks bot sight for 12 seconds', price: PRICES.smoke },
  { key: '6', id: 'armour', name: 'Plate Armour', desc: 'Takes 35% off every hit this round', price: PRICES.armour },
];

export function createHud() {
  const $ = (id) => document.getElementById(id);
  const overlay = $('overlay');
  const title = $('overlay-title');
  const copy = $('overlay-copy');
  const play = $('play');
  const buyList = $('buy-list');
  const buyMoney = $('buy-money');
  const ammoMag = $('ammo-mag');
  const ammoReserve = $('ammo-reserve');
  const weaponName = $('weapon-name');
  const grenadeInfo = $('grenade-info');
  const healthFill = $('health-fill');
  const healthValue = $('health-value');
  const moneyValue = $('money-value');
  const timerValue = $('timer-value');
  const scoreEmber = $('score-ember');
  const scoreRust = $('score-rust');
  const roundValue = $('round-value');
  const spikeStatus = $('spike-status');
  const killfeed = $('killfeed');
  const hitmarker = $('hitmarker');
  const crosshair = $('crosshair');
  const damageVignette = $('damage-vignette');
  const plantBar = $('plant-bar');
  const plantFill = $('plant-fill');
  const plantLabel = $('plant-label');

  let hitTimer = 0;
  let damageTimer = 0;
  let last = { mag: -1, reserve: -1, weapon: '', grenades: '', hp: -1, money: -1, timer: '', score: '', spike: '' };
  let playHandler = null;
  let buyHandler = null;

  play.addEventListener('click', () => { if (playHandler) playHandler(); });
  buyList.addEventListener('click', (event) => {
    const button = event.target.closest('[data-buy]');
    if (button && buyHandler) buyHandler(button.dataset.buy);
  });

  function setText(node, value, key) {
    if (last[key] === value) return;
    last[key] = value;
    node.textContent = value;
  }

  return {
    setHealth(hp, max) {
      if (hp === last.hp) return;
      last.hp = hp;
      const pct = Math.max(0, (hp / max) * 100);
      healthFill.style.width = `${pct}%`;
      healthValue.textContent = String(Math.ceil(hp));
      healthFill.classList.toggle('low', pct <= 30);
    },
    setAmmo(mag, reserve, weapon, frags, smokes, selected) {
      setText(ammoMag, String(mag), 'mag');
      setText(ammoReserve, `/ ${reserve}`, 'reserve');
      setText(weaponName, weapon, 'weapon');
      const g = `G ${selected === 'frag' ? '▸' : ''}Frag ×${frags}  ${selected === 'smoke' ? '▸' : ''}Smoke ×${smokes}`;
      setText(grenadeInfo, g, 'grenades');
    },
    setMoney(value) {
      setText(moneyValue, `$${value}`, 'money');
    },
    setTimer(seconds, planted) {
      const shown = Math.max(0, Math.ceil(seconds));
      const text = planted ? `SPIKE ${shown}` : `${Math.floor(shown / 60)}:${String(shown % 60).padStart(2, '0')}`;
      setText(timerValue, text, 'timer');
      timerValue.classList.toggle('danger', shown <= 10);
    },
    setScore(won, lost, round) {
      setText(scoreEmber, String(won), 'score');
      setText(scoreRust, String(lost), 'scoreRust');
      setText(roundValue, `ROUND ${round}`, 'round');
    },
    setSpike(status, site, timer) {
      let text = '';
      if (status === 'carried') text = 'SPIKE CARRIED — hold E at Site A or B to plant';
      else if (status === 'planted') text = `SPIKE PLANTED AT ${site} — ${Math.ceil(timer)}s to detonation`;
      else if (status === 'exploded') text = 'SPIKE DETONATED';
      else if (status === 'defused') text = 'SPIKE DEFUSED';
      setText(spikeStatus, text, 'spike');
      spikeStatus.classList.toggle('planted', status === 'planted');
    },
    setPlant(progress, label) {
      if (progress <= 0) {
        plantBar.hidden = true;
        return;
      }
      plantBar.hidden = false;
      plantFill.style.width = `${Math.min(100, progress * 100)}%`;
      plantLabel.textContent = label;
    },
    setCrosshairSpread(px) {
      crosshair.style.setProperty('--gap', `${px.toFixed(1)}px`);
    },
    hitMarker(killed, holdMs = 90) {
      hitmarker.classList.add('on');
      hitmarker.style.transform = killed ? 'translate(-50%, -50%) rotate(45deg) scale(1.25)' : '';
      clearTimeout(hitTimer);
      hitTimer = setTimeout(() => {
        hitmarker.classList.remove('on');
        hitmarker.style.transform = '';
      }, holdMs);
    },
    damageFlash() {
      damageVignette.classList.add('on');
      clearTimeout(damageTimer);
      damageTimer = setTimeout(() => damageVignette.classList.remove('on'), 220);
    },
    killfeed(text, good) {
      const entry = document.createElement('div');
      entry.className = good ? 'feed-good' : 'feed-bad';
      entry.textContent = text;
      killfeed.prepend(entry);
      while (killfeed.children.length > 4) killfeed.removeChild(killfeed.lastChild);
      setTimeout(() => entry.remove(), 5000);
    },
    showOverlay(mode, data = {}) {
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
            || (item.id === 'pistol' && data.loadout.primary === 'pistol')
            || (item.id === 'armour' && data.loadout.armour)
          );
          const button = document.createElement('button');
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
          copy.textContent = `${data.reason}.  Ember ${data.wonRounds} — ${data.lost} Rust. ${data.earned ? `You earned $${data.earned}.` : ''}`;
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
