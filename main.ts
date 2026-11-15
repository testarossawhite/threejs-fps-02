// Dustworks Yard — a 5v5 three.js tactical FPS for make.fun (Node 22, standard
// library only): round-based Counter-Strike-style play in a bright sunlit
// salvage yard, with a buy economy, a spike to plant and defuse, and
// team-tactics bots with radio callouts on both sides. v4 is the realism and
// features pass: photographic midday light over procedural brick, asphalt and
// city facades, a live round minimap, a kill feed, a TAB scoreboard with round
// history and an MVP banner, directional damage indicators, aim-down-sights,
// five weapons plus armour and helmet in the buy menu, frag/smoke/flashbang
// grenades, bots that throw utility, first-person arms and gloved hands on
// textured guns with staged reloads, and rounded humanoid soldiers — capsule
// limbs, a lathe-turned torso and a sphere head under a curved helmet — that
// walk, flinch and fall. v6 finishes the soldiers' heads (glossy goggles over
// the visor, a balaclava, a headset with ear cups, a helmet strap and rear
// pouch), weathers the container, crate and gun-metal textures with streaks,
// stencils and panel seams, gives the walk a forward lean and a lateral sway,
// and restores the yard's last details: rain puddles with a wet sheen, steel
// rims on the barrels, gantry cross-braces and a sagging lamp cable. v7 is
// the hands and habitat pass: the first-person grip is rebuilt with
// segmented two-segment fingers, so the support hand wraps the handguard,
// foregrip or pump of every gun and the trigger hand closes on the pistol
// grip, through idle, sights, reload, inspect and the pump cycle. The yard
// stops being one brick box: the perimeter mixes corrugated steel, raw
// formwork concrete, faded painted bands, plank hoarding and a chain-link
// stretch on posts, the backdrop buildings gain seeded facade variants
// with boarded and cracked panes, a glass tower, stepped setbacks, roof
// ducting and a scaffold on the hero block, and the zones fill with a
// workbench and tools, uneven pallet stacks, a painted walkway with a worn
// crossing, a break corner with table, chairs, cooler and barrel stove,
// tarp-covered piles, fresh posters and a windsock. The game is this
// directory's
// game/ folder, plain static files the browser loads as ES modules with
// three.js 0.187.0 from an import map, and this program hands it in: it copies
// game/ and screenshots/ from beside this file to /output and writes
// /output/dossier.json, the summary the judge reads, with the vendored
// make.fun library.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-threejs.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Fail loudly instead of handing in a broken entry: the gate refuses more than 4
// screenshots, any screenshot over 256 KiB, or a missing screenshots/ folder.
const shotsDir = join(here, 'screenshots');
if (!existsSync(shotsDir)) throw new Error('screenshots/ is missing — the gate needs 3 or 4');
const shotNames = readdirSync(shotsDir).filter((name) => !name.startsWith('.'));
if (shotNames.length < 3 || shotNames.length > 4) {
  throw new Error(`expected 3 or 4 screenshots, found ${shotNames.length}`);
}
for (const name of shotNames) {
  const bytes = statSync(join(shotsDir, name)).size;
  if (bytes > 262144) throw new Error(`screenshot ${name} is ${bytes} bytes, over the 256 KiB cap`);
}

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
cpSync(shotsDir, join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of game
// files, in all: game/ counts beside /output's own 1000-entry cap, its screenshots/ and dossier.json).
const dossier = buildDossier(out, { text_max_bytes: 163840, screenshots: { max: 4, max_bytes: 262144 }, game_max_files: 993, game_max_bytes: 50331648 });
writeFileSync(join(out, 'dossier.json'), dossier);
const shotBytes = shotNames.map((name) => `${name} ${statSync(join(shotsDir, name)).size}B`).join(', ');
console.log(`dustworks-yard v7: ${shotNames.length} screenshots (${shotBytes}), dossier ${dossier.length} bytes -> ${out}`);
