// The look plan, in one place: a salvage yard at dusk. Warm dark ground, amber accent
// for the player's side and the A site, rust red for the enemy bots and the B site.
// The same names are the CSS custom properties in index.html.
export const PALETTE = {
  canvas: '#211a13',
  surface: '#322920',
  hairline: '#4d4030',
  ink: '#f0e7d6',
  muted: '#a89a83',
  accent: '#e8a33d',
  foe: '#c8503c',
  steel: '#5d6b73',
};

export function shade(name) {
  return PALETTE[name];
}
