# Game architecture (rebuild)

The active runtime is a first-person 3D world; the preserved HTML demo is a seated-perspective reference only. Shared contracts live in `src/game/contracts.ts`; world and campaign modules export their own compact interfaces.

- Root runtime coordinates Three.js WebGL2 rendering, fixed 60 Hz movement, region loading and interactions. React receives snapshots at 10 Hz; it never drives transforms.
- Rapier 0.20.0 performs solid-object sweeps. Terrain comes from the exact same heightAt function used to create its visible mesh, with slope limits. Controllers favor stable kinematic movement over coupled harness rigid bodies.
- World owns original authored meshes, materials, environmental animation, terrain and obstacle/location metadata. Wagon wheel angle uses actual distance; animals stop with speed. A region is created when the campaign enters it; transition disposes its physics/world resources before creating the next region, and world teardown is idempotent.
- Rust retains campaign rules/content. Additive factual 3D fishing/crossing result commands reuse costs/capacity helpers; old commands remain tested. The WebAssembly session validates sequenced activity events and exactly-once finish before committing outcomes. Visual random values never enter campaign RNG.
- Campaign weather remains the Rust value. `src/game/weather.ts` derives scene fog from cold `RiverValley` or `Forest` terrain, while snow/rain continue to derive from campaign weather; this presentation mapping does not change campaign rules or consume campaign RNG.
- Two world meters represent one campaign mile. Only newly traversed forward distance commits TravelDay after reaching its forecast mileage; turning/stopping/reversing cannot advance a clock-only journey. Playable region chunks compress geography, preserve saves and transition at campaign checkpoints.
- Saves wrap opaque Rust JSON (including exact u64 RNG) in a versioned spatial envelope. Legacy bytes and last good backups remain available; failed imports cannot replace the active session. Activities checkpoint their progress and committed sequence.
- Local synthesized Web Audio is unlocked by gesture and silenced during pause/menus/focus loss. No runtime network services.
- The retired image-scene presentation files are historical. The rebuild removed `src/audio.ts`, `src/components/GamePanels.tsx`, `Minigame.tsx`, `SceneCanvas.tsx`, `Setup.tsx`, `Store.tsx`, `TrailScene.tsx`, `scenes.css`, and `store.css`. The useful `Dialog.tsx`, `TrailMap.tsx`, and campaign/domain seams remain; the world runtime owns presentation and spatial interaction, with local runtime assets and no hotlinks.

## Version evidence

Checked official docs and npm registry on 2026-09-08: Three 0.185.1, Vite 8.2.2, React 19.2.8, Playwright 1.63.0; Rapier compat 0.20.0 added for robust collision queries. package-lock.json records exact installations. Keep WebGL2 baseline; a WebGPU renderer would add unneeded fallback validation without resolving this game's current requirements.

References: [Three loader](https://threejs.org/docs/pages/GLTFLoader.html), [Rapier controller](https://rapier.rs/docs/user_guides/javascript/character_controller/), and [Playwright evidence](https://playwright.dev/docs/test-use-options).

## Verification separation

System Chromium uses ANGLE Mesa AGX G13/G14 on this Linux aarch64 desktop. The reference capture was headed; the latest candidate measurements use headless Chromium with GPU rendering enabled and record the actual renderer and full environment. CI software-rendering functional tests do not count as hardware performance. Chromium and Firefox functionality are separate required checks. GPU-heavy tests are serialized.

Current [cold-load](evidence/performance/cold-load.json) and [ride](evidence/performance/ride.json) measurements verify production build `b6c57bbe797aaa90dd398f9f2f109bbc5e001ebc7f3cdc3ec5b71325bb00c08a`: 1,958,846 initial gzip bytes; 5.921 s setup / 7.435 s playable under 10 Mbps down, 2 Mbps up and 150 ms latency; median 59.8802 FPS / p95 16.8 ms over 120.0118 seconds at 720p low. The complete normal-input campaign and retained-memory plateau have separate [independent review](evidence/independent-review.md). Full CI and merged-default acceptance are tracked in [ACCEPTANCE.md](ACCEPTANCE.md).
