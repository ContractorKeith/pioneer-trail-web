# Pioneer Trail Web

Pioneer Trail Web is a first-person 3D wagon journey. Drive, walk, hunt, fish, cross rivers and manage your party in a navigable world. The Rust/WebAssembly campaign engine owns the rules, content, seeded outcomes and saves. The former dashboard is archived; the preserved HTML demo records the original perspective reference.

The campaign content remains the original scope: **three trails** (Oregon, California, and Mormon), **four eras** (1843, 1848, 1852, and 1866), and **nine occupations** (Banker, Merchant, Doctor, Blacksmith, Carpenter, Hunter/Trapper, Preacher, Farmer, and Soldier). Survival, commerce, letters, route events, and the fishing, hunting, and crossing activities remain part of that campaign.

## Play locally

```sh
npm ci
npm run dev
```

Open **http://localhost:5173**. The repository uses Node 24 in CI. Rust is only needed when rebuilding the checked-in browser engine; the shipped `public/wasm` files let the web app start without a Rust toolchain.

Build and serve the static output locally with:

```sh
npm run build
npm run preview -- --host 0.0.0.0 --port 4173
```

## 3D runtime and controls

The rebuild runtime creates a WebGL 2 Three.js world and Rapier 3D physics scene. The fixed simulation owns movement, terrain and obstacle collision, wagon state, region interactions, and spatial activities. React renders menus and snapshots of that state; it does not move the player object. The runtime starts in the first-person wagon view, with walking and riding states represented by the same world.

The current input seam is in [`src/game/input.ts`](src/game/input.ts). It uses `WASD` for movement/steering, `Space` for brake or the current primary action, and `E` for interaction such as boarding, dismounting, or using a nearby object. Look uses the configured drag or pointer-lock mode; the arrow keys also provide look input. `Escape` and `Tab` pause or close the active overlay. Activity controls are `H` for hunt, `F` for fish, `R` to reload, and `X` to finish or retreat. `M`, `J`, `I`, `P`, `C`, and `O` open map, journal, inventory, party, camp, and settings overlays. The settings contract includes look sensitivity, field of view, volume, mute, quality, and reduced motion.

The runtime pauses and clears input when the page loses focus, visibility, pointer lock, or its WebGL context. Audio starts only after a user gesture and is silenced while paused or unfocused.

If WebGL 2 is unavailable, the app shows its compatibility message and preserves the saved journey: `Pioneer Trail needs WebGL 2. Enable hardware acceleration or use a compatible desktop browser. Your saved journey is preserved.` There is no dashboard, image-scene, or non-WebGL fallback. A browser verification run must record this failure path separately from a successful hardware-accelerated run.

## Saves

The spatial save envelope in [`src/game/persistence.ts`](src/game/persistence.ts) wraps the Rust campaign save as opaque JSON so exact 64-bit values survive the browser boundary. It also stores the spatial player/wagon/region state and activity checkpoint in a versioned envelope. Writes keep the last good save and incompatible or failed imports available for recovery; an invalid import cannot replace the active journey. Legacy campaign bytes require an explicit migration choice.

The Rust engine remains the authority for campaign commands and content. Activity begin, progress, and finish calls cross the typed bridge, and a completed activity is committed once by the campaign adapter. The browser save is therefore a checkpoint of the campaign plus the 3D position, rather than a second rules engine.

## Static hosting

The build produces a static `dist` directory. Deployment, DNS, accounts, API keys, and hosting configuration are outside this task; there is no deployment step in the repository workflow. A future static host only needs Node 24 and the build command **`npm run build`**, with **`dist`** as its output directory.

## Engine and architecture

Read [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the rebuild seams and [`docs/ASSETS.md`](docs/ASSETS.md) for art provenance. [`docs/ACCEPTANCE.md`](docs/ACCEPTANCE.md) records the current verification contract, and [`docs/TEST-MIGRATION.md`](docs/TEST-MIGRATION.md) maps the retired dashboard tests to required world coverage.

The original source repository is [ContractorKeith/pioneer-trail](https://github.com/ContractorKeith/pioneer-trail). The checked-in engine keeps its deterministic campaign data and rules. The old image-scene UI, optional atmospheric overlay, and terminal-style activity presentation are historical architecture; the rebuild uses a required WebGL 2 world and actual 3D activity controls.

## Verification commands

Run the checks that apply to the change:

```sh
npm run lint
npm test
npm run test:types       # strict test/config TypeScript project
npm run test:assets      # manifest, licenses, local paths, hotlink check
npm run test:engine
npm run build
npm run build:engine       # after Rust/WASM bridge or engine changes
node scripts/verify-assets.mjs
npm run test:dev
npm run test:e2e
cargo test --manifest-path engine/Cargo.toml --locked
```

The Playwright configuration includes Chromium and Firefox projects, with focused R01–R13 behavior coverage for both browser targets. The complete normal-input Oregon campaign, independent memory review and all 88 production browser cases passed. Final CI and merged-default delivery records are linked from [goal #8](https://github.com/ContractorKeith/pioneer-trail-web/issues/8). CI installs both Chromium and Firefox. Preparing both browsers locally is:

```sh
npx playwright install chromium firefox
```

That command prepares browsers; it does not by itself prove the rebuild acceptance gates. `node scripts/verify-assets.mjs` is the underlying asset check used by `npm run test:assets`; it validates manifest fields and referenced local paths, compares copied package notices when `node_modules` is present, and rejects HTTP(S) URLs in runtime source. Dependency source URLs in the manifest are metadata only. The replacement matrix in [`docs/TEST-MIGRATION.md`](docs/TEST-MIGRATION.md) maps the archived dashboard assertions to the verified world movement, activities, focus/recovery, saves, compatibility, setup and accessibility coverage.

The [cold-load measurement](docs/evidence/performance/cold-load.json) records 1,958,846 initial gzip bytes, 5.921 seconds to setup controls, and 7.435 seconds to playable state including automated setup clicks under a fresh-context 10 Mbps down / 2 Mbps up, 150 ms latency profile.

The [two-minute ride](docs/evidence/performance/ride.json) on the M2/Asahi Linux AGX desktop at 720p low quality records 7,201 frames, median 59.8802 FPS and p95 16.8 ms, with zero collisions or application errors. Both measurements verify production build `b6c57bbe797aaa90dd398f9f2f109bbc5e001ebc7f3cdc3ec5b71325bb00c08a`. They do not establish performance on untested devices or the 1080p balanced target.

The [normal-input campaign](docs/evidence/campaign-attempt-8/walkthrough.json) reached Oregon on day 168 with all six party members alive, after 1,282.816 seconds of play and 1,199.956 observed unpaused seconds. [Independent review](docs/evidence/independent-review.md) found a retained-memory plateau across six comparable late regions. The raw report preserves its pending-review field; the separate review binds its verdict to the report hash and discloses one overwritten earlier checkpoint file. The refreshed 19-view/four-clip visual review and hardware interval audit also passed. The [acceptance record](docs/ACCEPTANCE.md) links the implementation evidence and final Git delivery ledger.
