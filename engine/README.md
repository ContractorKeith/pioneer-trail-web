# Pioneer Trail browser engine

The Rust crates under `engine/` remain the authority for campaign rules, data, seeded outcomes, and exact campaign saves. The browser bridge in `engine/crates/web` exposes typed command/view/save operations and the activity transition seam used by the 3D runtime. The campaign engine keeps the original content scope: Oregon, California, and Mormon trails; the 1843, 1848, 1852, and 1866 eras; and all nine occupations.

`src/game/runtime.ts` owns the Three.js WebGL 2 world, Rapier physics, input, focus/pause handling, audio, and activity director. `src/game/contracts.ts` is the TypeScript boundary for runtime snapshots and overlays. `src/game/persistence.ts` stores a versioned spatial envelope around the opaque Rust save. `src/game/activities/director.ts` sequences the 3D hunting, fishing, and crossing interactions and sends begin, progress, and finish calls through the bridge. Rust validates the campaign result and the adapter commits a finished activity once.

The older web minigame exports remain available for legacy domain and engine-concurrency tests while the replacement world coverage lands. Their terminal/image presentation is historical; it is not a requirement for the first-person runtime. The browser engine must not introduce a second implementation of survival, commerce, letters, route events, or occupation rules.

## Building and testing

The checked-in generated files under `public/wasm` are used by normal web development. Rebuild them after a Rust or bridge change:

```sh
npm run build:engine
```

The script requires the Rust `wasm32-unknown-unknown` target and a `wasm-bindgen-cli` version matching the lockfile (currently `0.2.126`). Run the engine and Rust checks with:

```sh
npm run test:engine
cargo test --manifest-path engine/Cargo.toml --locked
```

The root README lists the complete web and browser verification commands. Browser checks must exercise the actual WebGL 2 world and its unsupported-WebGL message; a dashboard or image-scene fallback is not part of the compatibility contract. No production deployment, hosting service, DNS change, API, or server is required by this engine package.
