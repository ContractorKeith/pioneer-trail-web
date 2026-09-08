# Acceptance evidence

Implemented against the goal in [GOAL.md](GOAL.md). Initial work is tracked in GitHub issues #1–#4; the localhost buying failure, simpler onboarding/presets, and geographic map are tracked in #5–#7.

## Engine

- The original simulation and content are unchanged at source baseline `c44bfea0651fc70a16d92d8c8449c6f3e6f9df38`. Every vendored sim/data file is checked against `scripts/engine-source-sha256.json`.
- 117 native Rust tests pass: 89 simulation, 17 content, 11 bridge/minigame tests. Strict workspace Clippy passes.
- `npm run test:engine` runs the actual shipped WebAssembly artifact: maximum-u64 repeatability, opaque save/load, malformed saves, rejected-command nonmutation, seeded active-minigame restart, and source integrity.
- All 11 legal trail/era pairs arrive through actual commands: Oregon and California in 1843/1848/1852/1866; Mormon in 1848/1852/1866. Both Barlow and Columbia endings arrive; the Columbia run uses Rust-owned raft tick/finish controls.
- Original hunting/rafting RNG streams, logical grids, sprite hit masks, 30 Hz ticks, ammunition, carrying limits, collision penalties, and result commands are retained. Presentation never draws simulation randomness.

## Browser acceptance

The production browser suite runs at port 4173, with desktop and mobile Chromium projects. Separate development-server checks run at port 5181. Checkpoints for crossings, breakdowns, and rafting are generated through real engine commands rather than editing save fields.

- Setup, purchases, sales/refunds, outfitting advice, and departure.
- Camp, map, journal, conversations, pace, and rations without accidental day advancement.
- Rest consumes food/time; autosave survives reload; failed imports preserve the current journey.
- Sound/reduced-motion settings persist; WebGL scenes mount; non-WebGL fallback keeps the game playable.
- Hunting uses Rust target actions and advances the game day on completion.
- Waiting at a river consumes a day; quick fishing returns a result without losing its activity panel; ferry crossing returns to travel.
- A saved wagon breakdown resumes in the repair view and a successful original spare repair clears the event.
- A command-generated Columbia session can be steered, completed, and reach the ending in the browser.
- A quiet welcome screen leads through names/trail choice, each supply preset, departure, a geographic map with zoom/reset, camp, rest, and reload. Advanced setup and manual shopping are optional disclosures.
- All three supply presets are purchased through the actual shipped Rust engine for all nine occupations (27 flows), checking exact quote/cash/load agreement, zero remainder on repeating the plan, and successful departure.
- Map data checks cover every actual content node and assert a valid clipped continental landmass (Independence on land, the Pacific outside), including historic Fort Boise and Fort Walla Walla display locations.

## Visual and interaction review

Seven original cinematic environments cover trail, camp, snow, fishing, crossing, repairs, and conversations. Three.js adds subtle parallax, falling weather, embers, and water glints. Hunting targets use original vector silhouettes over the environment. Desktop/mobile screenshots were inspected, including activity dialogs. Fonts and runtime artwork are self-hosted.

Keyboard/touch controls, focus-contained dialogs, readable errors inside dialogs, muted defaults, reduced motion, and storage failure handling are implemented. Modernization is in presentation; no balancing changes were made.

## Review fixes

The issue review loop fixed the Vite public-WASM import path, exact counteroffer acceptance, invalid setup choices, resumed repair routing, unwanted river/fork panel switching after optional actions, quick fish/forage command selection, logical coordinate mapping, keyboard hunting aim, mobile sales, and explicit raft abort/completion labels.

The first release's production-only tests missed a real development-server defect. Concurrent cold `TrailEngine.create()` calls initialized wasm-bindgen more than once; its shared module dispatch then used Rust object pointers from different WASM instances. A no-app browser fixture reproduced cross-game cash changes and rejected configurations before the fix. A shared initialization promise now prevents it; the retained development-server regression checks eight cold concurrent engines configure and buy independently. CI runs that regression and real onboarding flows in development as well as the fixed production build.

## Delivery status

- Local build, lint, 12 unit tests (storage, preset planning, shipped-WASM purchases, and map geometry), artifact verification, 117 Rust tests, 30 desktop/mobile production checks, and 5 development-server checks pass. Final push/CI evidence is recorded in issues #5–#7.
- The public repository includes a [CI workflow](../.github/workflows/ci.yml) that repeats build, lint, storage, Rust, shipped-artifact, and browser checks. Final push/CI evidence is recorded in [issue #4](https://github.com/ContractorKeith/pioneer-trail-web/issues/4).
- Cloudflare Pages configuration is documented; deployment and custom-domain setup are deferred.

An unfinished hunt or raft intentionally restarts from its seeded initial state after a browser reload, matching the original terminal game. Only the latest active journey is kept in browser storage; exported saves retain previous journeys.
