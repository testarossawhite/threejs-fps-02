// Seeded RNG so staged shots stay deterministic.
export function mulberry32(initial) {
	let a = initial | 0;
	return function random() {
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15),1 | a);
		t = (t + Math.imul(t ^ (t >>> 7),61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}
export function range(random,min,max) {
	return min + random() * (max - min);
}
