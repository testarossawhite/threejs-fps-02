// Match state, phases, prices, rewards.
export const PHASES = {
	MENU: 'menu',
	BUY: 'buy',
	LIVE: 'live',
	ROUND_END: 'roundEnd',
	MATCH_END: 'matchEnd',
};
export const MATCH_TARGET = 4;
export const MAX_ROUNDS = 7;
export const ROUND_SECONDS = 100;
export const BUY_SECONDS = 15;
export const PLANT_SECONDS = 3;
export const DEFUSE_SECONDS = 5;
export const SPIKE_SECONDS = 35;
export const PRICES = {
	rifle: 950,
	smg: 650,
	smg2: 800,
	shotgun: 900,
	pistol: 0,
	frag: 300,
	smoke: 250,
	flash: 200,
	armour: 400,
	helmet: 350,
};
export const REWARDS = {
	kill: 300,
	roundWin: 600,
	roundLoss: 400,
	plant: 300,
	spikeWin: 600,
};
export function createState() {
	return {
		phase: PHASES.MENU,
		phaseTime: 0,
		round: 1,
		roundsWon: 0,
		roundsLost: 0,
		money: 800,
		kills: 0,
		deaths: 0,
		plants: 0,
		defusesStopped: 0,
		roundTimer: ROUND_SECONDS,
		roundReason: '',
		matchWinner: '',
		roundHistory: [],
		loadout: { primary: 'pistol',frags: 0,smokes: 0,flashes: 0,armour: false,helmet: false },
		spike: 'carried',
		spikeSite: '',
		spikeTimer: SPIKE_SECONDS,
		plantProgress: 0,
		defuseProgress: 0,
	};
}
export function resetMatch(state) {
	state.round = 1;
	state.roundsWon = 0;
	state.roundsLost = 0;
	state.money = 800;
	state.kills = 0;
	state.deaths = 0;
	state.plants = 0;
	state.defusesStopped = 0;
	state.roundHistory = [];
	state.loadout = { primary: 'pistol',frags: 0,smokes: 0,flashes: 0,armour: false,helmet: false };
	state.spike = 'carried';
	state.spikeSite = '';
}