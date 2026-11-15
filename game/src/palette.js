// The look plan, in one place: a salvage yard at dusk, lit warm and readable — not
// a brown cave. Amber is Ember and Site A (Foundry); teal is Site B (Depot), so the
// two ends of the yard read apart at a glance; rust red belongs to the Rust bots
// alone. The same names are the CSS custom properties in index.html.
export const PALETTE = {
  canvas: '#3a2b1c',
  surface: '#5a4630',
  hairline: '#77603f',
  ink: '#f4ead2',
  muted: '#b3a189',
  accent: '#f0a63e',
  siteB: '#3fbfae',
  foe: '#d2543f',
  steel: '#71828c',
  horizon: '#8a5a30',
  skyTop: '#232c47',
};

export function shade(name) {
  return PALETTE[name];
}
