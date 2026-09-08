import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import init, { TrailEngine } from '../public/wasm/pioneer_trail_web_engine.js';

const wasm = await readFile(new URL('../public/wasm/pioneer_trail_web_engine_bg.wasm', import.meta.url));
await init({ module_or_path: wasm });
const hash = async (path) => createHash('sha256').update(await readFile(path)).digest('hex');
const manifest = JSON.parse(await readFile(new URL('./engine-source-sha256.json', import.meta.url)));
for (const [relative, expected] of Object.entries(manifest)) {
  const actual = await hash(`engine/crates/${relative}`);
  if (actual !== expected) throw new Error(`vendored source changed: ${relative}`);
}
const command = (engine, value) => JSON.parse(engine.apply(JSON.stringify(value)));
const view = (engine) => JSON.parse(engine.view());
const configure = (engine, era = '1848', occupation = 'banker') => command(engine, { Configure: { trail_id: 'oregon', era_id: era, occupation_id: occupation, party: ['Ada','James','Ruth','Thomas','Clara'], departure_month: 3 } });
const reject = (result) => result.outcomes.some((outcome) => typeof outcome === 'object' && 'Rejected' in outcome);

const large = '18446744073709551615';
const a = new TrailEngine(large); const b = new TrailEngine(large);
configure(a); configure(b);
for (const [item, quantity] of [['oxen', 3], ['food', 1500], ['clothing', 5], ['medicine', 2], ['wheel', 1], ['axle', 1], ['tongue', 1]]) { command(a, { Buy: { item_id: item, quantity } }); command(b, { Buy: { item_id: item, quantity } }); }
command(a, 'Depart'); command(b, 'Depart');
for (let day = 0; day < 5; day += 1) { const left = command(a, 'TravelDay'); const right = command(b, 'TravelDay'); if (JSON.stringify(left) !== JSON.stringify(right)) throw new Error(`seed parity failed on day ${day}`); }
const saved = a.save(); const resumed = new TrailEngine('1'); resumed.load(saved);
const nextA = command(a, 'TravelDay'); const nextB = command(resumed, 'TravelDay');
if (JSON.stringify(nextA) !== JSON.stringify(nextB)) throw new Error('opaque save future parity failed');
const before = a.save(); if (!reject(command(a, { Buy: { item_id: 'food', quantity: 1 } }))) throw new Error('expected travel buy rejection'); if (a.save() !== before) throw new Error('rejection mutated save');
let malformedRejected = false; try { resumed.load('{bad'); } catch { malformedRejected = true; } if (!malformedRejected) throw new Error('malformed save accepted');
function runJourney(seed, trail = 'oregon', era = '1848', finale = 'default') {
  const game = new TrailEngine(String(seed));
  command(game, { Configure: { trail_id: trail, era_id: era, occupation_id: 'banker', party: ['Ada','James','Ruth','Thomas','Clara'], departure_month: 3 } });
  for (const [item, quantity] of [['oxen', 3], ['food', 2000], ['clothing', 5], ['medicine', 3], ['wheel', 1], ['axle', 1], ['tongue', 1], ['ammunition', 10]]) command(game, { Buy: { item_id: item, quantity } });
  command(game, 'Depart');
  for (let step = 0; step < 1000; step += 1) {
    const state = view(game); if (state.status === 'Arrived' || state.status === 'Failed') return state.status;
    if (state.active_minigame) { game.minigame_tick(900); const result = JSON.parse(game.finish_minigame()); if (reject(result)) throw new Error('minigame result rejected'); continue; }
    let action = 'TravelDay';
    if (state.pending_event) action = { Respond: { event_id: state.pending_event.id, choice_id: state.pending_event.choices.find((choice) => choice.available)?.id } };
    else if (typeof state.status === 'object' && state.status.AwaitingRiver) action = { CrossRiver: { method: state.river.ferry_cost_cents !== null ? 'Ferry' : 'Caulk' } };
    else if (typeof state.status === 'object' && state.status.AwaitingFork) {
      const isFinale = state.routes.some((route) => route.id === 'columbia');
      const desired = isFinale ? (finale === 'columbia' || era === '1843' ? 'columbia' : finale === 'barlow' ? 'barlow' : 'barlow') : undefined;
      action = { ChooseRoute: { route_id: state.routes.find((route) => route.id === desired)?.id ?? state.routes.find((route) => route.id !== 'columbia')?.id ?? state.routes[0].id } };
    }
    else if (state.inventory.food < 120 && state.can_camp) action = 'Forage';
    else if (typeof state.status === 'object' && state.status.AtLandmark) action = 'Continue';
    const result = command(game, action); if (reject(result)) throw new Error(`journey command rejected ${JSON.stringify(action)}`);
  } throw new Error('journey step cap');
}
const matrix = [['oregon','1843'],['oregon','1848'],['oregon','1852'],['oregon','1866'],['california','1843'],['california','1848'],['california','1852'],['california','1866'],['mormon','1848'],['mormon','1852'],['mormon','1866']];
const journeys = matrix.map(([trail, era], index) => ({ trail, era, result: runJourney(11 + index * 18, trail, era) }));
if (journeys.some(({ result }) => result !== 'Arrived')) throw new Error(`matrix arrival failure ${JSON.stringify(journeys)}`);
const oregonFinales = [{ route: 'barlow', result: runJourney(311, 'oregon', '1848', 'barlow') }, { route: 'columbia', result: runJourney(329, 'oregon', '1848', 'columbia') }];
if (oregonFinales.some(({ result }) => result !== 'Arrived')) throw new Error(`Oregon finale failure ${JSON.stringify(oregonFinales)}`);
const fresh = new TrailEngine('7'); configure(fresh, '1843');
const catalog = view(fresh).content;
const valid = [];
for (const era of catalog.eras) for (const occupation of catalog.occupations) { const game = new TrailEngine('9'); const result = configure(game, era.id, occupation.id); if (!reject(result)) valid.push(`${era.id}/${occupation.id}`); }
console.log(JSON.stringify({ wasm: 'ok', maxU64: 'ok', opaqueSave: 'ok', rejection: 'ok', malformedSave: 'ok', validSetupCount: valid.length, journeys, oregonFinales, sourceHashes: { sim: await hash('engine/crates/sim/src/lib.rs'), data: await hash('engine/crates/data/content.ron') } }, null, 2));
