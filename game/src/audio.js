// WebAudio synth SFX — no audio files.
export function createAudio() {
	let ctx = null;
	let noiseBuffer = null;
	function ensure() {
		if (ctx) return ctx;
		try {
			const AudioContext = window.AudioContext ?? window.webkitAudioContext;
			if (!AudioContext) return null;
			ctx = new AudioContext();
			noiseBuffer = ctx.createBuffer(1,ctx.sampleRate * 0.3,ctx.sampleRate);
			const data = noiseBuffer.getChannelData(0);
			for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
		} catch {
			ctx = null;
		}
		return ctx;
	}
	function resume() {
		const audio = ensure();
		if (audio && audio.state === 'suspended') audio.resume().catch(() => {});
	}
	function tone(freq,dur,type,gain,slideTo = 0) {
		const audio = ensure();
		if (!audio || audio.state !== 'running') return;
		try {
			const osc = audio.createOscillator();
			const amp = audio.createGain();
			osc.type = type;
			osc.frequency.setValueAtTime(freq,audio.currentTime);
			if (slideTo > 0) osc.frequency.exponentialRampToValueAtTime(slideTo,audio.currentTime + dur);
			amp.gain.setValueAtTime(gain,audio.currentTime);
			amp.gain.exponentialRampToValueAtTime(0.001,audio.currentTime + dur);
			osc.connect(amp).connect(audio.destination);
			osc.start();
			osc.stop(audio.currentTime + dur);
		} catch { /* sound is decoration,never a crash */ }
	}
	function noise(dur,gain,lowpass = 1200) {
		const audio = ensure();
		if (!audio || audio.state !== 'running' || !noiseBuffer) return;
		try {
			const src = audio.createBufferSource();
			src.buffer = noiseBuffer;
			const filter = audio.createBiquadFilter();
			filter.type = 'lowpass';
			filter.frequency.value = lowpass;
			const amp = audio.createGain();
			amp.gain.setValueAtTime(gain,audio.currentTime);
			amp.gain.exponentialRampToValueAtTime(0.001,audio.currentTime + dur);
			src.connect(filter).connect(amp).connect(audio.destination);
			src.start();
			src.stop(audio.currentTime + dur);
		} catch { /* sound is decoration,never a crash */ }
	}
	return {
		resume,
		shot() { noise(0.09,0.25,2400); tone(160,0.07,'square',0.08,60); },
		enemyShot() { noise(0.07,0.1,1600); },
		hit() { tone(880,0.06,'sine',0.12); },
		kill() { tone(660,0.1,'sine',0.14,990); },
		hurt() { tone(140,0.15,'sawtooth',0.12,70); },
		reload() { tone(420,0.05,'square',0.06); tone(560,0.05,'square',0.06); },
		plant() { tone(520,0.08,'sine',0.1); },
		beep() { tone(980,0.07,'sine',0.1); },
		explosion() { noise(0.7,0.5,500); tone(70,0.6,'sine',0.3,30); },
		step() { noise(0.05,0.045,480); },
		flash() { noise(0.16,0.3,5200); tone(3400,0.3,'sine',0.05,2400); },
		buy() { tone(700,0.06,'sine',0.1); tone(1050,0.08,'sine',0.1); },
		roundWin() { tone(523,0.12,'sine',0.12); tone(659,0.12,'sine',0.12); tone(784,0.2,'sine',0.12); },
		roundLose() { tone(392,0.15,'sine',0.12); tone(311,0.25,'sine',0.12); },
	};
}