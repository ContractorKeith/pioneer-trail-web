# Pioneer Trail Web

Pioneer Trail Web is a static browser game rebuild. The release target is a first-person 3D wagon journey, with the Rust/WebAssembly campaign engine remaining authoritative for rules, content, seeded outcomes, and saves. The former image-scene dashboard and the first-person demo page are historical/reference material while the rebuild is completed; they are not the runtime contract.

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

The Playwright configuration includes Chromium and Firefox projects, with focused R01–R13 behavior coverage for both browser targets. A fresh full browser suite and complete campaign remain pending. CI installs both Chromium and Firefox. Preparing both browsers locally is:

```sh
npx playwright install chromium firefox
```

That command prepares browsers; it does not by itself prove the rebuild acceptance gates. `node scripts/verify-assets.mjs` is the underlying asset check used by `npm run test:assets`; it validates manifest fields and referenced local paths, compares copied package notices when `node_modules` is present, and rejects HTTP(S) URLs in runtime source. Dependency source URLs in the manifest are metadata only. The replacement matrix in [`docs/TEST-MIGRATION.md`](docs/TEST-MIGRATION.md) identifies the world movement, activity, focus/recovery, save, compatibility, trail/era/occupation, accessibility, and performance checks that still need fresh evidence.

The current cold-load artifact is a conditional local candidate, not final R15 acceptance evidence: [`docs/evidence/performance/cold-load.json`](docs/evidence/performance/cold-load.json) records 1,957,266 initial gzip bytes, 5.628 seconds to setup controls, and 7.268 seconds to playable state including automated setup clicks under a fresh-context 10 Mbps down / 2 Mbps up, 150 ms latency profile. It has no page errors, but the artifact does not establish the required full-suite, hardware-ride, or ten-minute soak results.

The [ride artifact](docs/evidence/performance/ride.json) is also a conditional candidate: a 120.0169-second low-quality 720p Chromium run on the M2 AGX path reports 7,070 frames, median 59.8802 FPS, and p95 17.9 ms. It does not close the full R15 campaign, CI, or soak requirements.
