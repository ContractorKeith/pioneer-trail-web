# Independent standards review — first-person rebuild

Reviewed on 2026-09-08 against fixed baseline `90a8847da5a140e89ef83961fcccdd29b8f94bfd`, with `HEAD` at preserved-reference commit `422c2da830e4608f5d95028eadcfd83f3dd1dc6e` on `feat/first-person-3d-rebuild`. The implementation was still uncommitted: the review used `git diff 90a8847` and explicitly enumerated untracked files, rather than the empty implementation diff between committed refs.

## Standards

**No unresolved concrete findings in the reviewed source. One P2 defect was found, returned to its owner, fixed, and independently reproduced again.** This is a source/standards review, not release acceptance or a visual/performance certification. Concurrent fishing-prop and hunting-occlusion rework requires its own scoped review after it lands.

The contract was root `AGENTS.md`/`CLAUDE.md`, the authoritative rebuild prompt, architecture/asset/test-migration documents, and the code-review/codebase-design skills. Scope included the complete changed App/CSS/dialog/engine/configuration/CI code; all new runtime, input, physics, audio, campaign, persistence, activity, world, and UI modules; Rust additions and generated WASM bindings; replacement browser/contract/unit tests; evidence/verification scripts; and source/license/preservation records. Binary gameplay captures were not visually certified by this pass.

### Resolved P2 — graphics settings changed saved collision geography

- **Classification:** documented standard: `CLAUDE.md:9` requires preserved spatial saves; `docs/ARCHITECTURE.md` and `docs/ASSETS.md` require deterministic regional recipes and preserved world location. Allowing a rendering preference to change physical geography also breaks the documented separation between presentation and spatial state.
- **Location:** `src/game/world/terrain.ts:368` and `:421`, together with `GameRuntime.makeWorld()` using the current quality setting.
- **Reproduction before rework:** create seed 18, RiverValley, river=true under low and balanced; initialize `MotionWorld`. At x=12.368190390989184, z=83.18313720519654, `canStand` was true in low and false in balanced. Balanced added `tree-1-187` at this exact point. The region contained 318 versus 551 solids. Thus changing Low to Balanced while in a region, then reloading, could place an otherwise unchanged saved player inside a new solid. Wildlife clearings also changed.
- **Cause and correction:** quality-dependent tree and rock loop counts consumed a shared seeded stream differently. The owner made the existing low physical recipe canonical for all quality presets; grass, particles, and shadow quality remain presentation choices.
- **Independent retest:** the exact point is now walkable under low, balanced, and high; each has 318 solids. A separate Node/Three/Rapier check compared every obstacle record and wildlife positions at time 151 and found them deeply equal across all three presets. The new `src/game/world/world.test.ts:237` regression additionally compares visible solid instance transforms and locations. No collision assertion was removed to obtain the pass.

### Checks actually run by this reviewer

- `git diff --check 90a8847`: passed.
- `npm run test:assets`: passed; 17 authored/data entries, seven dependency notices, no runtime hotlinks.
- `npm run test:types`: passed.
- `node scripts/verify-engine.mjs`: passed, including maximum-u64 save/future parity, rejected and malformed inputs, 33 setup combinations, all 11 legal trail/era arrivals, and both Oregon finales.
- Source/reference preservation: the separate CLI checkout was clean at `c44bfea0651fc70a16d92d8c8449c6f3e6f9df38`. The HTML demo matches the bytes in `422c2da`. All four archived browser specs contain their complete `90a8847` source, with only a 124-byte historical header prefixed.

The runtime keeps per-frame transforms outside React, the campaign adapter preserves opaque Rust JSON, and the activity ledger/save rollback checks cover committed outcomes without JS u64 coercion. Current documentation explicitly leaves unverified browser, visual, complete-campaign, soak, CI, and final-delivery gates open.

## Spec

Not scored in this pass; the separate spec reviewer/root owns acceptance. One test-coverage observation was handed back: the barter section in `tests/mechanics.spec.ts` accepted any notice and conditionally handled a counteroffer, so a rejected barter without a counteroffer could satisfy that section without proving inventory exchange. This is not presented here as a confirmed domain defect.
