# Pioneer Trail Web — first-person 3D game

The authoritative release specification is [docs/PIONEER-TRAIL-3D-REBUILD-PROMPT.md](docs/PIONEER-TRAIL-3D-REBUILD-PROMPT.md), read in full. The active GitHub goal is #8; acceptance R01–R16 and internal milestones M1–M4 are mandatory. Earlier dashboard/scenery plans and acceptance claims are historical, superseded by this rebuild.

## Architecture and ownership
- TypeScript/Vite/Three.js WebGL2 game runtime; Rapier collision; React only for shell/overlays. First person is the default, the navigable world is the interface.
- src/game/contracts.ts defines shared runtime seams. Per-frame state stays out of React. Fixed 60 Hz simulation, interpolation and bounded catch-up; pause/focus/menu input must be explicit.
- engine/ retains useful deterministic Rust campaign logic/content behind a redesigned typed adapter. Spatial activities commit factual validated outcomes exactly once; do not retain terminal minigames to replace 3D mechanics.
- Campaign owns supplies/health/money/progress; runtime owns space/activity input. Keep opaque Rust saves exact (u64), version spatial saves, preserve/export incompatible saves. Never silently erase saves.
- Original CLI ContractorKeith/pioneer-trail is read-only and must not be modified or pushed. Source baseline c44bfea0651fc70a16d92d8c8449c6f3e6f9df38 remains recorded.
- Original local demo docs/pioneer-trail-first-person-demo.html is preserved, a perspective/experience reference, not final assets or architecture.
- Runtime assets must be local, licensed/original with truthful manifest/credits. No paid services/assets, production deployment, DNS changes or required runtime APIs.

## Work and delivery
- Use GitHub issues with ownership, dependencies, acceptance and actual evidence. Only root integrates/merges. Independent review, concrete rework, fresh retests; do not close partial issues.
- No approvals needed for ordinary authorized work. Continue through all milestones. No fabricated passes, skipped gates, reduced tests or uninspected visual claims.
- Preserve user work, unrelated conventions/licenses and saves. Task-only commits use ContractorKeith, conventional format, no coauthors or tool attribution.
- No automatic project-memory checkpoints; user disabled them. Durable resumable handoffs go to GitHub goal #8.
- Full branch diff review, green required CI, merge through allowed workflow, rebuild/smoke exact default commit, delete only clean task-created branches/worktrees with preserved work. Leave canonical local server when feasible.

## Verification
npm run build; npm run lint; npm run test:types; npm run test:assets; npm test; cargo test --manifest-path engine/Cargo.toml --locked; npm run test:engine; npm run test:dev; npm run test:e2e. Build WASM after bridge changes: npm run build:engine.

Production browser tests must exercise movement, collisions, boarding and each real activity, focus/save failures and all retained content. Verify Chromium and Firefox. Capture and inspect gameplay screenshots/recordings. R15 also requires measured compressed load, a hardware-accelerated 720p low two-minute ride (median >=30 FPS, p95 <=50ms) and ten-minute transition soak. Unverified gates remain open.
