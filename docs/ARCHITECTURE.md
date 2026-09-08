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
- The retired image-scene presentation files are historical. The root rebuild is retiring `src/audio.ts`, `src/components/GamePanels.tsx`, `Minigame.tsx`, `SceneCanvas.tsx`, `Setup.tsx`, `Store.tsx`, `TrailScene.tsx`, `scenes.css`, and `store.css`. The useful `Dialog.tsx`, `TrailMap.tsx`, and campaign/domain seams remain; the world runtime owns presentation and spatial interaction, with local runtime assets and no hotlinks.

## Version evidence

Checked official docs and npm registry on 2026-09-08: Three 0.185.1, Vite 8.2.2, React 19.2.8, Playwright 1.63.0; Rapier compat 0.20.0 added for robust collision queries. package-lock.json records exact installations. Keep WebGL2 baseline; a WebGPU renderer would add unneeded fallback validation without resolving this game's current requirements.

References: [Three loader](https://threejs.org/docs/pages/GLTFLoader.html), [Rapier controller](https://rapier.rs/docs/user_guides/javascript/character_controller/), and [Playwright evidence](https://playwright.dev/docs/test-use-options).

## Verification separation

System headed Chromium can use ANGLE Mesa AGX G13/G14 on this Linux aarch64 desktop; reference run confirmed it. Hardware performance uses that path and records full environment. CI software-rendering functional tests do not count as hardware performance. Chromium and Firefox functionality are separate required checks. GPU-heavy tests are serialized.

The current cold-load artifact is a conditional candidate only: [`docs/evidence/performance/cold-load.json`](evidence/performance/cold-load.json) reports 1,957,266 initial gzip bytes, 5.628 s to setup controls, and 7.268 s to playable state including automated setup clicks under a fresh-context 10 Mbps down / 2 Mbps up, 150 ms latency profile. The artifact is local production-preview evidence; it does not claim final acceptance, a complete suite, a hardware ride, or the ten-minute soak.
