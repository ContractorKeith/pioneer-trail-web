# Independent candidate review

Reviewed on **2026-09-08**, with the final source fingerprint captured at **12:12:21 UTC**. This is a scoped review record, not completion of R01–R16.

The comparison baseline is `90a8847da5a140e89ef83961fcccdd29b8f94bfd`. HEAD remained `422c2da830e4608f5d95028eadcfd83f3dd1dc6e`; implementation was still in the worktree. Review used the worktree diff against the baseline and explicitly included untracked game, test, script, asset and evidence files. An empty committed-only diff was not used as the review boundary.

Contracts: [CLAUDE.md](../../CLAUDE.md), the [full rebuild specification](../PIONEER-TRAIL-3D-REBUILD-PROMPT.md), and the code-review workflow. Review covered runtime coordination, input, audio, physics, persistence, campaign integration, overlays and retained content; the latest follow-up concentrated on dialogs, decision reopening, guide choices and ride evidence. No browser or GPU process was launched by this reviewer during these final checks.

## Standards

**No remaining blocking source finding in the reviewed runtime/UI corrections.** The runtime remains the spatial state owner, Rust retains campaign rules and exact save bytes, React presents snapshots, and the corrected transition guard stops a completed operation from applying a previous region's position to its replacement.

Meaningful findings and their reviewed corrections:

| Finding | Reproduction and effect | Correction and independent check |
| --- | --- | --- |
| P1: valid outer envelope concealed an unsupported inner campaign | An unsupported inner version reached the startup catch without exposing the original bytes or a validated backup; subsequent replacement could erase the rejected file. | Current persistence/App recovery preserves the exact original bytes, validates recovery through Rust, and exposes export. Focused real-WASM persistence tests passed. |
| P2: error pause left ambient audio running | After unmuted movement, a failed durable action set `paused` while the paused-render shortcut skipped the audio update. | `holdWorld()` now stops input/speed, marks rendering dirty and supplies a paused audio state; `fail()` uses it without recursively saving. CPU seam verified all these effects. Fresh browser RMS assertions are a separate gate. |
| P2: crossing completion overwrote the new frontier | A synchronous crossing transition reset wagon/frontier to 20, then the previous far-bank pose overwrote the new frontier with 156.1. About 136 metres of onward travel stopped counting. | The step captures world identity and returns after a replacement, or after travel opens a pause. Five CPU probes verified crossing reset, immediate onward progress, no duplicate transition after a campaign checkpoint, pause handling and normal chunk transitions. |
| P2: grade restriction allowed creep from rest | The minimum distance denominator understated the grade of very short acceleration/current samples; sustained input moved uphill beyond the limit. | The actual nonzero displacement is now the denominator. Focused physics/clock/world/weather tests passed, including the grade regression. |
| P2: required setup could be dismissed with Escape | Native dialog cancellation closed the dialog despite the setup callback doing nothing, leaving setup state without its interface. | Cancellation is controlled; setup is explicitly non-dismissible and has no ineffective close button. Source and server-rendered markup checked. |
| P2: replay entry was missing | Existing or completed campaigns had no normal UI path back to setup, although the baseline exposed a new journey action. | Settings and ending expose New journey and archive the current save before replacement. The replay regression now compares the exact archived bytes captured after Settings pauses. |
| P2: reopened decisions lacked keyboard/accessibility support | Dismissing a fork/event resumed canvas input; Tab opened Pause and no key reopened the decision. At small widths hidden text also removed HUD buttons' accessible names. | Explicit HUD names and an App-scoped Enter shortcut now work without intercepting native controls or open dialogs. Runtime handles decisions before its paused guard. Six CPU cases covered paused success/failure, fork/event, normal travel and active rafting. Server-rendered markup retained every HUD name. |

The initial ending shortcut test could pass through native activation of a previously clicked HUD button. It was corrected to dismiss the automatic ending and focus the canvas before pressing Enter, before any HUD click.

Current correction locations: `src/game/persistence.ts:154` (preservation), `src/game/runtime.ts:291` and `:812` (error hold), `src/game/runtime.ts:662` and `:669` (transition guards), `src/game/physics.ts:162` and `:178` (grade), `src/components/Dialog.tsx:34` and `src/App.tsx:346` (setup dismissal), `src/App.tsx:250` (replay), `src/App.tsx:197` and `src/game/ui/Hud.tsx:122` (decision access). The guide restriction is at `src/game/ui/GameOverlay.tsx:523`.

One earlier activity finding involved a redundant save after a successful campaign commit. This reviewer implemented the bounded director correction and its real-WASM tests; that implementation requires the separate reviewer assigned by the root and is **not** presented here as independently approved authorship.

The removed legacy presentation files had no imports from the live application. Original content, old art provenance, Dialog, TrailMap and tested domain/outfitting/storage modules remained. No new architectural blocker was found in that removal.

## Spec

**No remaining source blocker in the latest R03/R05/R11/R13 dialog, decision and crossing-choice scope.** Fresh browser execution remains necessary to close those acceptance rows.

- Setup remains available after Escape; ordinary overlays remain dismissible. Pending forks/events and endings can be reopened from the HUD or the scoped Enter shortcut.
- Guide is unavailable outside Snake River and when clothing is insufficient. An independent real-WASM replay reached Snake River on day 168 with 3 clothing and a quoted cost of 3. Starting and aborting Guide consumed one day and all 3 clothing while leaving `AwaitingRiver` intact.
- The crossing tests use a command-generated Snake River campaign checkpoint. They then use actual browser movement and controls for bank inspection and activity execution. The Columbia test selects the route and physically traverses its raft region; it is isolated finale coverage, not proof of a complete normal-input campaign.
- The saved-decision tests now cover dismissal and reopening. Fork resolution is asserted there; complete event/content journey coverage remains part of the wider browser suite.

Independent final CPU checks included 22 physics/clock/weather/world tests, 39 campaign/director/fishing tests, the five runtime transition probes, the six decision probes, the real-WASM Guide replay and accessible-name markup checks. Strict test/config TypeScript and `git diff --check` passed. These results do not substitute for browser checks.

## Recorded ride evidence

Inspected [ride report](performance/ride.json), [all raw intervals](performance/ride-frames.json.gz), [delivered 30-second clip](performance/ride-30s.webm), the original local frame JSON and full video. The measured production build fingerprint is:

`b4456742ebecc96fa768096ff3f7c8e73e7a3fdd11c1031f3a333d802bde2af5`

The recorded main bundle was `assets/index-DXCHJ8xy.js`. Later source/build changes existed during review; this measurement is evidence for its recorded candidate, not an assertion about every later build.

Independent calculations and artifact checks:

| Check | Result |
| --- | --- |
| Continuous interval count / elapsed | 7,070 / 120,016.9 ms |
| Median FPS / p95 interval | 59.8802 FPS / 17.9 ms |
| Maximum interval / intervals over 50 ms | 100.5 ms / 7 |
| Paused, hidden, unfocused or non-riding intervals | 0 |
| Omitted intervals | 0; each timestamp delta matched its retained interval |
| Actual spatial path / largest single-frame displacement | 308.4316 m / 0.32 m |
| Delivered frame archive | Decompresses byte-for-byte to the original raw JSON |
| Delivered clip | Byte-for-byte copy of the extracted clip; 30.000 s, 1280×720, VP9 |
| Video sampling rate | 25 FPS; video is not the source of the runtime frame-time calculation |
| Full local recording | 139.92 s, including setup/warmup |
| Build identity | Raw-frame build ID, report manifest digest and recorded served-asset hashes agree |

The report identifies ANGLE/Mesa AGX G13/G14 hardware, low quality, 1280×720 and device scale 1. `/proc/device-tree/model` independently returned `Apple MacBook Air (13-inch, M2, 2022)`, matching the report's hardware model. This supplies positive hardware identification rather than relying solely on the absence of a software-renderer name.

Using CPU decoding, the reviewer independently extracted and inspected video frames at 0, 10, 20 and 29 seconds. The road, trees and ground change position consistently while the seated camera and modeled wagon/oxen remain coherent. The excerpt shows real rearward road movement, consistent with the recorded forward/reverse shuttle procedure. No missing hero material, severe wagon/ox clipping or gross floating was visible in those samples.

These stills cannot establish animation smoothness at every instant, all gait/anatomy angles, audio quality, every terrain/weather/activity, or the final wildlife-placement correction. The independent interval audit supports the measured two-minute ride result; the ten-minute transition soak, complete normal-input campaign, final browser suites, CI, exact merged-build smoke and overall R14/R15/R16 remain separate gates. **R14 is not closed by this review.**

## Reviewed source and artifact fingerprints

SHA-256 values captured at the review time above. Subsequent changes need their own bounded recheck; these are not an assertion that HEAD already contains the implementation.

| Path | SHA-256 |
| --- | --- |
| `src/App.tsx` | `65665192a993466c88ef75a1e673648aea5ff661d83f7bb57e6b5cb76f4a1d16` |
| `src/components/Dialog.tsx` | `4f2cbb1fb946b0fea05135bd909359829025fc7d6d9c2b0bc354ab7499f36a5d` |
| `src/game/runtime.ts` | `2110272c71b30194d6f98648fdfe2f0b8c65f30eb59cacebbc9473f5d037d377` |
| `src/game/input.ts` | `41d48782c732a80396552ab8315f2a7355e95140ab7546e7bc05db7945f9b008` |
| `src/game/ui/Hud.tsx` | `02eb64b64a10b48e8f96d51c8423d8aa3929dfbf3f9de4a82eb28ee02d1d38cb` |
| `src/game/ui/GameOverlay.tsx` | `502e40d09035586ee71d3548c16513a5db68a7ea211638bf30468de9c9edb896` |
| `src/game/physics.ts` | `bf90085cf95b6a47b5efa461b5ea8768c9a4c1c25fb51c1fa26b156d4f8ec45e` |
| `src/game/persistence.ts` | `8221704e368e4ae06ddf7fdc42c22e4dd248e0c743e7b95ae2e3e123366e51d4` |
| `tests/world.spec.ts` | `7212224558977b3eb5128c0d1cd3082f4466c56ea6b4722d202dac6e85dc3e2b` |
| `tests/crossing-options.spec.ts` | `3fc34a3675441a1fa7202d757a747be0b23ebea1d7b71759e514806f700cf6a2` |
| `tests/replay.spec.ts` | `0c718a412a32909eabc902f78656e0ac71d13b738e086fcce045f7c0ff1b965d` |
| `scripts/measure-ride.mjs` | `a091ea77f0cbd9b9754d390c3318f303573f15c170fb64e7a121fe20c4095195` |
| `docs/evidence/performance/ride.json` | `33402923dadf591d610411d447346a76b2c0417ac67fe3e61e12411468140567` |
| `docs/evidence/performance/ride-frames.json.gz` | `c5bed8c0b81cf995999e4f9222534c0c9f8a6e230fb6273f7b606ef5e5372d7f` |
| `docs/evidence/performance/ride-30s.webm` | `377df0aec5d7ce76f7e8b18e8c892c4f6f210e27365aaaa486f23d4112f9395c` |

## Full Spec pass — 2026-09-08, 12:34 UTC

This follow-up compared the **entire dirty candidate plus untracked task files** with the same verified `90a8847` baseline, using all R01–R16 and GitHub goal #8. It included application/runtime, world, spatial activities, Rust adapter, persistence, retained content, tests and evidence scripts. The separate final Standards reviewer owns the parallel Standards verdict; the findings below are exclusively against the product specification. This reviewer made no production changes during this pass and launched no browser/GPU process.

**Four P2 implementation defects were found, returned for rework and independently rechecked after correction. No remaining implementation blocker was found in this source/CPU pass.** That conclusion does not close the visual or release evidence gates. The latest wildlife placement still needs final visual review; the full normal-input campaign, ten-minute transition soak, complete fresh suites, CI and exact merged-build smoke remain open.

### Findings and rework

| Spec finding | Original reproduction and actual behavior | Expected behavior and reviewed correction |
| --- | --- | --- |
| **P2 — R07: fishing targeted a different bank**. `src/game/runtime.ts` frame update; correction at `src/game/activities/director.ts:280` and `:170`. | Begin fishing after approaching the main crossing bank around z92. The renderer selected the first water location, the side stream at z34, putting the bobber roughly 61 m away behind the player. | The cast belongs to the approached water and remains there after movement/reload. `fishingTarget()` selects the nearby bank and the first cast saves `castX`/`castZ`. In the actual authored RiverValley world, bank `[4.08628, 0.09113, 92]` now casts at `[4.08628, 0.02285, 107]`, inside the main river. Saved coordinates remain fixed after player movement/recovery. Tackle stays hidden before casting. `props.ts:91` now anchors the line to the actual transformed rod tip; three camera poses independently matched the rendered endpoint. **Source/CPU recheck passed; browser bank regression remains separately required.** |
| **P2 — R06: shots passed through wagon/oxen**. `src/game/activities/director.ts:119`. | Authored Plains world, seed 1848, wagon at `(0,20)`, player at `(-4,12)`, aim at naturally placed deer-0 torso `[8.23489,1.43079,42.38184]`. The ray hit opaque hero geometry at 7.01457 m before wildlife at 32.48931 m, but the old director recorded a kill because it checked only terrain/static obstacles. | Visible hero geometry must block the shot while ammunition still gets spent. The director now checks the rendered wagon hierarchy, including oxen. Repeating the same authored-world reproduction produced one shot, no pending kills and the Miss notice. Existing unobstructed-hit and collection tests remain green. **Source/CPU recheck passed; this does not establish every visual aiming angle.** |
| **P2 — R10/R11: HUD claimed fog absent from the scene**. `src/game/runtime.ts:805`, `src/game/ui/Hud.tsx:60`. | A normal Oregon departure retains the initial Plains region while campaign terrain becomes RiverValley. With seed 4, day 1 / 15 mi is Cold. The old HUD derived fog from campaign terrain while rendering derived clear weather from spatial terrain. | HUD and scene must describe the same presentation. The frame and runtime snapshot now use one `currentSceneWeather()` result; HUD reads `snapshot.sceneWeather`. A real-WASM seed-4 reproduction plus actual runtime method and server-rendered HUD agreed for both the initial clear Plains and foggy RiverValley cases. **Source/CPU recheck passed; actual browser weather checks remain a separate gate.** |
| **P2 — R03/R11: rejected setup was mounted as successful**. `src/App.tsx:227`. | Submit a traveler containing only spaces. HTML `required` accepts the field; trimming produced an empty name and Rust returned `Rejected: InvalidSetup`. The old handler nevertheless persisted/mounted the empty Setup campaign, opened provisions and announced that the party was ready. | Reject invalid input in the existing setup, preserving choices and saves. The handler now rejects blank trimmed names before storage reads/archive or campaign creation, and checks Configure rejection before mount/open. Executing the actual extracted App handler verified zero reads/archive/mount/open for whitespace, no mount/open for a real-WASM invalid occupation configuration, and exactly one mount/open for valid setup. **Source/CPU recheck passed.** The initial browser regression had an incorrect `Traveler 1 name` selector; this was returned to root for correction to the actual `Traveler 1` accessible name. |

Fresh focused checks in this follow-up: **16/16 director/fishing tests**, **26/26 campaign/weather tests**, the authored-world hunting and fishing probes above, and the App/weather presentation probes passed. The original defect reproducer intentionally asserted the old incorrect hunting hit and failed after correction; rerunning it with the expected miss assertion passed. No failing run is represented as a passing run.

### R01–R16 coverage and remaining proof

“Present” below means source implementation was found and checked at its relevant seams; it is not a substitute for the specified production-browser evidence.

| ID | Implementation assessment | Evidence boundary |
| --- | --- | --- |
| R01 | Present: default wagon-seat camera, independent look, braking, safe dismount, walking collision and proximity boarding. | Earlier actual viewpoint samples were inspected. Final normal-input walk-around/occlusion/browser execution remains part of the final suite. |
| R02 | Present: fixed-step acceleration, pace, reverse, steering, braking, terrain grade and solid-object sweeps; campaign days count only new forward distance. The crossing/frontier and grade regressions are recorded above. | CPU movement/clock probes support the source result; final production input tests and campaign traversal still required. |
| R03 | Present: three trails, four eras, nine occupations, difficulty, departure month, named party, provisions, events, forks and both success/failure UI. Invalid setup defect corrected above. | Independent real-WASM matrix accepted all **91** legal combinations and rejected the same **17** invalid combinations. This is setup coverage, not 91 played campaigns. Complete normal-input journey and declared route/finale runs remain required. |
| R04 | Present: distinct Plains, woodland/RiverValley, mountain and desert recipes; shared piecewise-linear ground sampling aligns physics with rendered terrain; authored vegetation/rocks and weather snow. | CPU/source and previous screenshot samples checked. Final wildlife placement and all required scene viewpoints remain subject to final independent visual review. |
| R05 | Present: physical riverbank interaction, domain depth/risk and physical current disclosure, Ford/Caulk/Guide/Raft control, collision cargo losses, Ferry/Wait costs and Snake River guide restrictions. | Guide cost/abort and frontier CPU checks are recorded above. Actual crossing/Columbia and onward-play regressions are root's separate browser gate. |
| R06 | Present: moving 3D targets, ray aiming, limited shots, timed reload, carcass retrieval and bounded food/day commit. Hero occlusion corrected above. | Actual authored-world ray reproduction and real-WASM director tests pass. Final normal-input hunt and animation/visual quality remain browser/visual evidence. |
| R07 | Present: proximity-gated water, cast, bite reaction, reel/tension success or escape, exactly-once catch/day, interruption recovery. Cast target/line correction verified above. | CPU success/failure/recovery tests pass; new main-bank browser regression and final gameplay remain separate. |
| R08 | Present: camp/fire/supplies/companion interactions expose rest, pace/rations, treatment, forage and repair through authoritative domain commands. | Existing survival tests exercise these flows; complete fresh Chromium/Firefox run is required before acceptance. |
| R09 | Present: contextual modeled trader/traveler access, buy/sell, selectable barter partner/items/quantities and counteroffers, conversations, offered/active/delivered letters, recruitment and NPC dismissal. Stock/prices/capacity and party rules remain in Rust. | Original domain/content preservation was independently checked. Source availability of every letter/party path is not a claim that the full delivery/dismissal lifecycle has been exercised in the final browser suite. |
| R10 | Present: day/night, rain/snow/fog, animated water, flame/embers/smoke/firelight, physical roof queries, local procedural sound and gesture/mute/volume/pause controls. Weather disagreement corrected above. | Existing actual weather images and recorded audio tests are candidate evidence. Source review cannot certify all animation or sound quality; fresh browser/visual checks remain required. |
| R11 | Present: compact HUD, focused map/journal/inventory/party/settings, real costs and status, and recoverable mandatory decisions. | Accessible-name/decision probes and actual HUD render check passed. Final production layout and decision regressions remain part of the suite. |
| R12 | Present: versioned spatial/opaque campaign save, autosave/backup, preserved replacement archives, export/import, incompatible inner-save detection, legacy migration and durable activity sequence recovery. | Focused real-WASM tests pass, including maximum u64, failed saves, duplicate events, recovery and legacy activity handling. Existing browser quota/import/replay regressions still require the full fresh run. |
| R13 | Present: keyboard/mouse look and play, pointer-lock/drag alternatives, sensitivity/FOV/motion settings, focus pause, responsive overlays and coarse-pointer controls. | Chromium and Firefox are declared with zero retries. Emulated coarse-pointer layout is limited evidence; no actual mobile/Safari support is asserted. Full desktop browser verification remains open. |
| R14 | Authored models/materials, local provenance and real production evidence are present; previous independent static/video samples show substantial detail beyond the reference. | **Open.** Final wildlife placement, remaining clipping/anatomy/material review and final integrated scene samples cannot be certified by source checks or the older ride clip. |
| R15 | Tests/checks/performance tooling are present. Asset manifest check passes: **17 asset/data entries, 7 runtime dependencies, no runtime hotlinks**. Recorded ride interval integrity was independently audited above. | **Open.** Complete fresh build/types/lint/unit/domain/contract/browser suite, normal-input campaign, hardware candidate applicability, cold-load candidate applicability and ten-minute transition soak are not replaced by this scoped review. |
| R16 | Delivery instructions and CI workflow preserve the required merge/smoke/cleanup gates. | **Open.** Current implementation is dirty/untracked; no commit, push, CI success, merge, exact-default smoke or cleanup completion is claimed here. |

Retained-content audit: the original source manifest contains **84** files; **83** remain byte-identical. Its sole changed entry is the declared additive `sim/src/state.rs` extension, matching the reviewed modification hash. `engine/crates/data/content.ron` remains byte-identical (`c45344d15b6a932aff5f7fa63b11f9e082d9794913bfa1274c97c5ba57eb9f6a`). Original routes, eras, events, conversations, letters, relationships and party rules were not deleted with the retired dashboard components. The redesigned spatial minigames deliberately replace terminal coordinates/algorithms as the specification permits.

### Follow-up source fingerprints

Captured at **12:30:34 UTC** for this recheck; subsequent changes require a bounded recheck. These identify worktree files, not a delivered commit or a new performance measurement.

| Path | SHA-256 |
| --- | --- |
| `src/App.tsx` | `8082dda1c52772e94798ffa6370ab5e2b0d111ca430835685684cf929600331b` |
| `src/game/runtime.ts` | `09b3933f43d1bd5b8a1983105e4eb255e0deb0bb0d1ea802c45d099c11e2f733` |
| `src/game/contracts.ts` | `da79ef59582a1b165feea7a352c30f133ece114b99a5879e62885decf289d0c9` |
| `src/game/ui/Hud.tsx` | `1f00538c9bf1b3842b650b2c28f2e4a4bcb995937b3e0d9f6c1ae51f0c34925a` |
| `src/game/activities/director.ts` | `6a3a8f8270ca892e1d550e2a55bc75c7d711261715c296d669d0ed5921a73d72` |
| `src/game/activities/props.ts` | `e0e4d4530cacdea8bd246889e39b7ca328fefe3bbc3f11b8fd8a5e235e7b161b` |
| `src/game/world/index.ts` | `89b498b01d1c4c295f042100057071f5b85fca560d550868e830da271d1d06b3` |
| `src/game/world/terrain.ts` | `39af681389c760e3830a40283e42eed3f5ee5075d5dc96e0ff81af0243392e09` |
| `engine/crates/web/src/activities.rs` | `360dd602f90b704ca7ddd1dd3d9a8d6cb3cd8b2ecec1d94e3f1699c4b455283b` |
| `engine/crates/web/src/lib.rs` | `a8b2325f1b73114f6b1b7500a39fcc318164207d6c9a1d2d105f1bd4896ce7b3` |
| `tests/activity-director.wasm.unit.test.ts` | `cc2a0afdfba0fe7947a57e9dcebffb4f4d89323b839c380fc070b6cec35db68b` |
| `public/assets/manifest.json` | `ffacfa51562e9f622e65b040d4ba64763b8c68369128f649ebbcd2c5866905f3` |

## Independent decision-transition review — 2026-09-08 12:56 UTC

Scope: the latest `GameRuntime.syncCampaign()` change, the two new `tests/runtime-decisions.spec.ts` regressions, command-generated fork/encounter fixtures in `tests/world.helpers.ts`, and the observation-refresh/encounter-close changes in `scripts/campaign-walkthrough.mjs`. This is a bounded follow-up to the fixed-baseline review above, covering current dirty/untracked source. The reviewer did not author these changes and made no implementation edits. The full release prompt and prior review context were used; relevant requirements are R03, R11, R12, R13 and R15.

**Standards: no findings in this slice. Spec/correctness: no remaining concrete defect found in this slice.** The encounter has priority over the route when both arrive in one campaign update. Clearing that encounter presents the deferred fork without another region transition. An unchanged state does not force a manually dismissed route back open. The existing saved-decision path initializes `lastEvent`, allowing the same deferred-route behavior after recovery.

Independent CPU evidence:

- Called the actual fixture helper and loaded both opaque saves into the checked-in WASM engine. The preceding fixture is day 346, with one mile remaining. One real `TravelDay` reaches day 347 / The Dalles / `AwaitingFork`, with the `water` event. The complete resulting view equals the independently generated `fork-event` fixture view; the fixture does not fabricate campaign fields.
- Extracted the current `syncCampaign()`, `open()` and `phase()` directly from the TypeScript AST and executed them with real-WASM views. Only rendering/transition endpoints were replaced with recording callbacks; no browser or GPU was instantiated. Fresh arrival recorded exactly `transition:true`, `open:encounter`, then `open:route` after the available response. Region index increased once. A rejected response preserved the encounter, repeated sync did not reopen panels, and choosing the available Barlow route committed its target/distance without changing region index. Loading the saved encounter and responding recorded only `open:route`, with no region reset.
- Executed the actual walkthrough loop prefix and encounter branch extracted from its AST with controlled asynchronous observation/visibility stubs. A state change during each observation was reread before the decision branch: three state reads for the initial read plus two observations. After responding, a newly visible route remained open; a lingering resolved encounter closed once; a new pending encounter remained open. This establishes the scheduling and close predicates, not actual DOM timing.
- `npm run test:types`, `node --check scripts/campaign-walkthrough.mjs`, and `git diff --check 90a8847` passed. `playwright test tests/runtime-decisions.spec.ts --list` collected both tests for Chromium and Firefox (four cases total). Browser tests were **listed, not executed by this reviewer**.

The new browser tests use real movement/visible choices and assert campaign status, event resolution, route target/distance, pause state, and region counts. The saved case additionally covers manual close, another panel, and reload. Their actual browser results, visual correctness, whole-campaign completion and all existing R14–R16 release gates remain separate requirements; this CPU review does not close them. Concurrent performance changes outside `syncCampaign()` are outside this slice.

Source fingerprints at 12:56:47 UTC (worktree files, not a delivered commit):

| Scope | SHA-256 |
| --- | --- |
| Exact `syncCampaign()` method text extracted from the TypeScript AST | `c0652de856a7134f70c6601a8d9729d4acb5660d2c33eff44222d753cb52fd99` |
| `src/game/runtime.ts` | `34a373d1c33ee65cbe11991d16be1b0427addc55327cc69614b3ac533c9ee40c` |
| `tests/runtime-decisions.spec.ts` | `d4dee87bddff1d1a019ea473a7e684f2485189283159ba81ee3e3c3a58e95dc1` |
| `tests/world.helpers.ts` | `83e5f197a4e39e9e571053e4695dea4006c2960d4971dd0fea673fabf3c53315` |
| `scripts/campaign-walkthrough.mjs` | `b48972753b585bdc7599a45e84b730a7d30a38c3be6018bc03584719a348e76e` |
