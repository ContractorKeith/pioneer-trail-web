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

## Independent campaign/performance evidence review — 2026-09-08 13:22 UTC

After resumption from pushed WIP `2cfc9bae1cb34a8aa07a3c61ea29016370b20e25`, this bounded review inspected the normal-input campaign driver, soak/resource classification, observed active-time tally, continuous ride recorder and R03/R15 requirements. It also checked that R13/R14 documentation leaves fresh browser/visual evidence open. No browser/GPU was launched and no implementation file was edited by this reviewer. Root authored the two corrections below; the reviewer independently reproduced and rechecked them.

**Two P2 evidence defects were found and corrected. No remaining blocker was found in this script slice.** This is approval of the reviewed evidence logic, not a passing campaign, leak assessment, browser suite or final visual review.

| Finding | Independent reproduction | Reviewed correction and result |
| --- | --- | --- |
| **P2 — R15: renderer screening was promoted to complete soak acceptance.** `scripts/campaign-walkthrough.mjs`, `sceneGrowth()` and final soak gates. | Nine comparable regions with fixed 250 geometries/45 textures but DOM nodes growing 200→8,200, listeners 200→1,000 and heap 20→100 MB produce `suspicious: []`. With an arrived ending, at least 600 elapsed/observed-unpaused seconds and complete telemetry, the previous final gates set `soak.pass` and `report.pass` true without assessing those memory trends. This is a counterexample to the acceptance predicate, not a claim that the application has that leak. | Automated renderer/duration checks now set only `automatedChecksPass`; both acceptance flags remain false and both independent-memory review fields remain `pending`. Executing the exact current post-loop AST against the same nine-region counterexample confirmed that distinction. Region-entry observations await `HeapProfiler.collectGarbage` before collecting heap/DOM/listener counters and mark `afterCollection`; errors remain fatal to automated checks. Observations now group by actual saved spatial terrain and retain campaign terrain separately, correcting the initial physical Plains scene previously labeled RiverValley. Raw comparable retained-memory trends still require independent assessment. |
| **P2 — R15: a minute-long frame stall could satisfy `notStuck`.** `scripts/measure-ride.mjs`, `summarizeFrames()` and the `notStuck` predicate. | Generated 3,600 samples of a normal 60 Hz z24↔84 road shuttle (forward 6.4 m/s, reverse 1.8 m/s), inserting 60,000 ms into frame 180 while allowing only eight 60 Hz physics steps of movement in that frame. The resulting 120-second window had median 60 FPS, p95 16.67 ms, path 194.43 m and slowest five-second path 0.853 m. All prior duration, continuity, movement and road-shuttle checks passed despite a 60,016.67 ms frame. | `notStuck` now additionally requires `maximumFrameMs < 5000`. Executing the exact current predicate against the original counterexample rejected it; an exact 5,000 ms gap also failed. The retained real ride still satisfies the predicate (maximum frame 100.5 ms). Raw intervals and required median/p95 metrics remain unchanged. |

Additional independently verified boundaries:

- The campaign driver's inspected setup, event/fork, camp/shop/party, boarding and river paths use visible UI and keyboard controls. No new source-level driver blocker was found. Only the current actual campaign run can establish completion; the previous Big Blue attempt remains a failed run.
- The observed-unpaused tally uses stable frame-object identity through shallow observation copies. Exact-AST CPU checks passed for repeated reads without double counting, a slow interval, partial buffer rollover and explicit failure when the last observed frame has been lost. Paused runtime frames are excluded; the resume path resets the frame origin. The moving-frame aggregate remains explicitly `acceptancePass: false` and does not substitute for the continuous ride gate.
- Decompressed the retained `ride-frames.json.gz` and independently recomputed all summary fields: **7,070 unfiltered frames, 120,016.9 ms, median 59.8802 FPS, p95 17.9 ms**. Every interval matches the raw timestamp difference and their sum matches the recorded window. All seven frames over 50 ms and all 18 stopped frames remain included. This is an audit of the prior candidate, not a new measurement of the resumed source.
- `node --check scripts/campaign-walkthrough.mjs`, `node --check scripts/measure-ride.mjs` and `git diff --check` passed after the corrections. The interrupted `browserLaunch`/`build` placement is now in report metadata, outside browser-context options.
- `docs/ACCEPTANCE.md` and the existing independent review keep R13 browser verification and R14 final visual review open. The already-recorded migration-matrix overclaim about all eras/occupations through the UI remains a documentation follow-up; CPU configuration coverage must not be relabeled as browser coverage.

Fingerprints at **13:22:07 UTC**, identifying reviewed worktree source rather than final delivery:

| Path | SHA-256 |
| --- | --- |
| `scripts/campaign-walkthrough.mjs` | `753e5f40916f0a21146210e77a038390d282088f36f47dc918200027e10ee32a` |
| `scripts/measure-ride.mjs` | `0df85906341edbebde53865973b0661a03a298d58309151dda2ccfc5ace940c1` |

## Independent road-placement and visual follow-up — 2026-09-08 14:04 UTC

This bounded review covers the footprint-aware rock placement correction, served-build evidence binding, and the completed 19-still/four-clip capture. The reviewer made no implementation edits and launched no browser or GPU workload. Actual source modules, Rapier movement, retained PNG images, and CPU-decoded video samples were inspected independently of their authors.

**Road-placement correction: no remaining finding in this slice.** The original Hills/seed-19 road obstruction reproduced against the previous terrain module: starting at wagon `(x=0.15870369284219163, z=33.93221768321818, yaw=0.12208333333333499, speed=0)`, 600 ordinary forward physics ticks produced no progress and reported `rock-107`. The collision counter remained zero because each blocked attempt was below its counting threshold; the obstacle and position established the defect. The correction evaluates the union of the transformed visible rock bounds and collider bounds across the curved road after consuming the original scale/rotation random draws. It excludes the mesh instance and collider together. The longitudinal sampling interval and additional 0.1 m guard conservatively preserve the existing 4 m clearance; small nonsolid decoration and river hazards are not broadly removed.

Independent current-world drives, steering toward the sampled road every 200 ms, reached z225 from both the exact stopped pose (1,932 ticks) and ordinary spawn (2,064 ticks), with no obstacle contacts or counted collisions. An independent old/current recipe comparison found only four removals in Hills/seed-19 (`rock-17`, `rock-96`, `rock-107`, `rock-127`) and one in RiverValley/seed-18 with a river (`rock-77`); every retained collider field remained identical. The added tests preserve quality equivalence and test both actual driving and full-span physical rock clearance across 30 terrain/seed combinations. Reviewed source fingerprints: terrain `14de666bfd87fcfbe2353a747e44a7e76147319072bb2b418c61c83b7dfa0b0c`, world tests `469a5a70d9d436a8b8620c02be5e749a84967b3e9b9cd91f58d59b08ea0118c1`. The implementing agent's 54 world/physics tests and root's fresh 110 unit tests and actual GPU reproduction are separate reported checks, not executions by this reviewer.

**Evidence provenance correction: reviewed and passed.** The earlier capture/load scripts attributed the local `dist` hash without proving that the server delivered those bytes. The shared `trackServedBuild()` now attaches before navigation, hashes actual response bodies, requires matching HTML/JavaScript/WASM, and rejects unknown resources, mismatches, wrong origins, bad statuses, body failures and request failures. Capture artifacts identify their verified page; load measurements use retained actual response bodies. Independent browser-free helper cases passed the valid response set and rejected seven corresponding failure classes. Executing the exact capture module with controlled build/CDP initialization failures confirmed that failures write an unsuccessful report and that a launched browser receives cleanup. Root's analogous campaign binding was inspected before navigation, after setup, before automated acceptance and during final cleanup; mismatch prevents top-level automated acceptance. These are evidence-integrity checks, not performance or gameplay acceptance.

**Recorded visual sample: no concrete R14 defect found in the inspected views.** All 19 PNGs were viewed against the retained HTML reference's forward/rear views. The wagon has resolved wood/canvas/metal materials, visible interior/cargo, axle and wheel detail; the oxen have recognizable anatomy and articulated legs with a connected yoke/harness. Exterior, side, hoof, and mountain-contact stills showed no severe clipping, missing materials or gross floating. The companions, campfire/night lighting, region variation, fog, rain and snow were visibly present. These assets are substantially beyond the primitive reference models.

The reviewer decoded overview samples across all four retained clips, plus 5 Hz windows of forward/reverse ox gait and deer gait. Ox and wildlife poses change while the bodies remain coherent; stopped/reverse/forward wagon observations agree with the recorded motion samples. River surface highlights change across the stationary daylight clip. No concrete severe motion or placement defect was visible in these sampled frames. This was frame sampling, not continuous inspection of every frame, and the 25 FPS recording is not a performance benchmark.

Artifact verification found all four clip SHA-256 values match the report, all original videos remain available, and all clips are 1280×720 VP9 at 25 FPS. Their actual padded durations are 21.48 s (wagon), 18.12 s (rabbit), 18.44 s (deer), and 10.24 s (water). All 19 stills exist and all nine served-page verification reports pass for the same build: `92122085670dbe9fe9537d0c00908d9e04c89d3475ed24446332b9976b7655ec`, recorded source `fce3b5180b8f1495d2858d3350e72d1b096c676b`. The report fingerprint is `c2550a5addd2388de2d5a9459e4ae907d9bbf204ddec17648e3f59c615c599a7`. CPU review grids are retained under `.artifacts/tmp/independent-visual-review/`; original evidence was not edited by this reviewer.

**R14 acceptance remains bounded by the recorded build and open activity evidence.** The capture precedes the road-placement correction; it does not itself certify final build applicability. Hunt/retrieval, line/bobber/reeling, and shelter-transition activity images are being captured separately. A completed capture procedure and a source review do not supply their visual verdict. R15 campaign, retained-memory, fresh performance/load and delivery gates remain separate.

### Activity capture source review — initial finding and recheck

**P2 — fishing capture driver walks into an existing trunk.** In `scripts/capture-activities.mjs:98`, `rightBankCorridor()` walks directly backward from the ordinary left dismount before crossing behind the wagon. In the actual seed-11 RiverValley river world at wagon z80, this first leg remains at x−3 and hits `tree-1-90`, centered at `(−2.9036549991, 78.5151983774)` with half-width/depth 0.2583342475 m. Executing the imported current `walkTo()` helper against actual `MotionWorld` movement at 60 Hz exhausted all 150 observations at z79.1090644714. This prevents the fishing capture from reaching its activity; it is a script route defect, not a request to remove the tree. An inward step to x−2 before walking behind the wagon passed the complete bank route at wagon z80, z80.5034 and z81.5 with zero contacts. A correction must also preserve the normal right-side dismount when the left side is blocked.

The other tested walking routes passed without contacts: the seed-11 hunt approach, seed-14 bank corridor, and rain approach→under-awning→outside. The exact current helper drove the CPU simulation; only page observation and held-key timing were adapted, so these are geometry/controller checks rather than browser results. The awning waypoint at approximately `(8.4667, 31.2)` independently returned `shelteredAt: true` and its outside samples returned false.

No additional concrete defect was found in the activity script's disclosed fixture setup, actual hunt hit/carcass/retrieval checks, fishing bite/reel/day/net-food checks, quality/buffer assertions, served-response binding, raw/clip retention, or failure handling. Executing its exact main function with controlled failures confirmed that a build failure writes an unsuccessful report without launching a browser, and CDP initialization failure writes an unsuccessful report and closes the launched browser. These checks do not certify successful browser interactions or visual quality. Reviewed script fingerprint before the pending route correction: `06f1ee392a2555a23c67e8ee8cc76a61d39954f85c7a68b453f7c398aed6bceb`.

At **14:15 UTC**, root's fishing-only `retreatX = -2` call was independently rechecked against the CPU-clear route above; the seed-14 case retains its earlier route. This resolves the reported path for the disclosed fishing fixture's clear left dismount. It is not a general right-dismount route planner. Root's first actual activity attempt additionally exposed settings initialization accessing opaque-origin storage during `about:blank` restoration. The added origin guard was independently executed from the exact callback AST: opaque and foreign origins never touched a storage proxy that throws on any access, and the intended preview origin wrote the expected preferences exactly once. The reviewed corrected activity script fingerprint is `23ac2f46f6c8557f5ca89cc103ee5e4108c3c7dfa66b38cc8ad9108550454fd9`. The actual capture rerun and resulting visual evidence remain separate.

### Green River campaign driver reproduction — 2026-09-08 14:15 UTC

Root's third full campaign failure is preserved in `docs/evidence/campaign-attempt-3/`. Independently recreating seed-26 RiverValley with a river and the exact recorded wagon pose reproduced the walking failure coordinate bit-for-bit: the current `walkTo(-3, 94)` stops at `(−1.2654302219447242, 91.64821075925461)` against `rock-108`. Its center is `(−2.3982259948, 93.0955377640)` and half-width/depth are approximately 1.2331/1.1118 m. The actual bank lies at x4.0863, z92; the hard-coded left lane leads into a legitimate roadside rock. This is a driver route defect, not evidence that the new footprint filter should remove that rock.

The proposed earlier-crossing route `(-3,90) → (bank.x,90) → (bank.x,94)` passed with zero contacts both from the original dismount and the exact stuck pose. The exact imported-helper reproductions are retained in `.artifacts/tmp/green-river-walk-review.mjs` and `.artifacts/tmp/green-river-walk-exact90.mjs`.

Broader screening shows this absolute lane is still fragile. The same earlier-crossing strategy passed seeds 12, 14 and 26 with three paired stopping-position/heading variations each, then failed seed 11 at wagon `(−0.3,79.8,yaw=−0.15)`: its valid left dismount walks into `tree-0-2`, stopping at `(−3.1956547335,89.5909390862)`. Screening stopped at that first failure after ten cases, as requested; it did **not** establish passage for all seeds 11–45. The reproduction is `.artifacts/tmp/green-river-walk-matrix.mjs`. Root was advised to replace the fragile fixed lane with a route that accounts for actual visible geometry, rather than adding seed-specific waypoints. No runtime or driver implementation file was edited by this reviewer.

## Walking planner and activity evidence recheck — 2026-09-08 14:27 UTC

**Planner correction: no remaining concrete finding in the reviewed slice.** `scripts/walking-route.ts` searches a bounded 0.8 m grid aligned with the player's heading. It tests movement edges using the actual `MotionWorld`, includes the parked wagon/team, adds clearance around sampled standing positions, and disposes its physics world. `load-world-tools.mjs` temporarily loads the actual source modules with project-scoped TypeScript hooks and deregisters those hooks. The campaign driver generates only waypoints locally; its browser actions remain normal held keys. Every waypoint checks live play, unchanged region, unchanged collision count and actual arrival. The region/failure checkpoints retain the raw opaque save and its SHA-256; they do not modify campaign state or fabricate successful travel.

The reviewer extracted the exact current exported `walkPlanned()` function. Only its page observation and held-key endpoints were adapted to a CPU simulation; the real source loader, planner, world recipe and physics all executed. With alternating one-frame key-release jitter, the exact Green River contact, original Green River dismount and seed-11 tree counterexample all reached the actual bank within 0.14 m with **zero contacts**. They used 9, 23 and 28 waypoints and 2.55, 5.90 and 7.47 simulated seconds respectively. The retained probe is `.artifacts/tmp/walking-planner-independent.mjs`. The new 105-case world/driver test matrix and separate exact-contact test were source-reviewed; their full execution belongs to root's reported checks, not this independent run. Scoped syntax and diff checks passed. This does not establish successful browser scheduling or a completed campaign.

Reviewed source fingerprints:

| Path | SHA-256 |
| --- | --- |
| `scripts/walking-route.ts` | `aeff3b79a42a314de8249bd11c857d0e78130bf0c4d99f28dbea226187cc25df` |
| `scripts/load-world-tools.mjs` | `826d46c67da95de708ea3f23a813016f4a37ba7e4c15af37caeb2a63ba96b5e1` |
| `scripts/campaign-walkthrough.mjs` | `446c3b791c179b43c601615f5d9dfe8326f0151ce60cc30febdf41d59a2f429e` |
| `tests/walking-route.unit.test.ts` | `325b9ed45656d4877f801452ca2fdec24502729d3400f586a9e31727efa49c45` |

**Activity evidence: hunt, fishing and shelter samples are usable; the seed-14 patrol view needs a clearer capture.** The reviewer inspected all 12 PNGs and CPU-decoded overview samples spanning all four clips. The hunt shows the actual aimed shot, a body lying on the terrain, disappearance after collection, and the bag/day/food result. The shelter clip shows the approach, modeled roof overhead with foreground precipitation suppressed, and rain again after leaving. No concrete severe clipping, missing material or gross floating defect was found in those views.

The fishing stills are initially obscured by a nearby deer. In the sampled motion this is foreground occlusion, not demonstrated severe mesh clipping. The deer moves away by approximately 11 seconds. The exact **12.00-second** frame clearly shows the complete rod tip, line and bobber over the main water with active reeling/tension UI; the clip then shows landing and the day increment. Thus the video supplies usable fishing evidence despite the weak initial stills.

**Remaining evidence gap:** in `activity-seed14-bank-wildlife.webm`, approximately 15–30 seconds of the intended stationary patrol hold are largely blocked by the oxen. At exactly **22.00 seconds**, the trunk is visible but only a deer's head appears beyond the ox; its full body, gait and ground contact cannot be assessed. The earlier approach shows animals briefly, but does not replace the intended unobstructed patrol observation. Root was asked for a normal-control recapture from beyond the ox nose with both the trunk and moving deer visible. These frames do not establish a runtime clipping defect, and the existing capture's `captureRunComplete` flag is not an independent visual pass.

All four clip hashes and four original-video hashes match the activity report, all 12 stills exist, and all four actual served-build checks pass for `ff1960aff3e1933b74200f0fb7d21c37ea34f13148af6275b66460e7de5f8b50` (the road-fix build). The 1280×720, 25 FPS clips have actual durations 31.24, 9.24, 16.52 and 16.24 seconds. Report fingerprint: `b8ce391e652ffe3521f7604c0c10a5b752e56900964d2e56f9aba91d45212199`. CPU review grids and the exact 12/22-second frames are retained in `.artifacts/tmp/independent-activity-review/`. The reviewer did not alter original media or run a browser/GPU. Overall R14 acceptance remains open for the specified recapture; R15 campaign/performance/retained-memory and R16 delivery remain separate.

## Big Blue far-bank failure — independent diagnosis

**P2 — the campaign driver continues pressing forward against a far-bank rock.** In the fourth full campaign attempt, `scripts/campaign-walkthrough.mjs:609–612` stops steering after `driveTo(-9, river.endZ + 4)` and repeats W for at most 60 short holds. The saved wagon is at `(x=−9.33869910447421, z=139.37939811015195, yaw=0.4861111111111138, speed=0)`, facing `rock-94`. Its center is `(−4.6873708814,145.7325339084)` and half-width/depth are 0.9532/0.8594 m; the leading team reaches it before the wagon reaches the completion boundary. The run, screenshot, raw frames and opaque save remain preserved in `docs/evidence/campaign-attempt-4/`. The failure-save SHA-256 is `9cf6896c8a8c4cc2c12947524306e607083fb7a36c666a052790fe7b8d055b66`, matching the recorded checkpoint hash.

Independent actual-world physics reproduction: 600 forward ticks from that exact saved pose produced no displacement and repeatedly reported `rock-94`. No new collisions were counted because every attempt from rest was below the counter's displacement threshold. A no-progress check therefore must not depend solely on increasing `collisionCount`.

**No runtime completion defect was reproduced.** The crossing readout measures progress through the channel and reaches 1 at z136; `ActivityDirector.crossing()` intentionally waits until the team reaches beyond z144 (river end plus 8 m). The saved z139.3794 has not met that condition. Loading the exact opaque failure save into the real WASM engine and using the actual director confirmed that z144 leaves the activity active, z144.001 finishes it, day14 becomes day15, the status becomes `Travelling`, and repeating completion leaves the save unchanged. The domain recorded exactly one successful crossing commit.

A physical recovery also passed: one second of reverse, ten braking ticks, then ordinary forward movement while steering yaw toward zero crossed the boundary in 3.53 simulated seconds with no contacts or additional cargo loss. Two seconds of reverse also passed, in 4.88 seconds. Forward steering alone remained blocked. These are CPU reproductions using the actual world, physics, director and WASM state, not browser executions. Probe: `.artifacts/tmp/big-blue-completion-review.mjs`.

Recommended correction: replace the unsteered final W loop with an exit controller that maintains an appropriate heading, detects negligible displacement, reverses and realigns when physically blocked, and stops immediately when activity/region changes. Preserve the completion threshold and exactly-one-day assertions. The original saved-pose stall, successful collision-free recovery, completion boundary and duplicate-finish behavior supply the regression cases. Root assigned a bounded driver correction; no implementation file was edited by this reviewer.

### Crossing exit correction — independently rechecked

The new `CrossingExitDriver` and the final `finishCrossing()` wrapper passed the bounded independent source/CPU review. Candidate exits use complete actual train sweeps, terrain grade, current and pace. The controller validates scope and finite observations, detects stalls from displacement, bounds reverse recovery and search, and disposes idempotently. The browser wrapper applies normal keys, observes activity/region changes, bounds its loop and releases all keys in cleanup. Its 800 ms real brake occurs before CPU scene reconstruction; the following observation returns before planning if the activity has cleared or the region changed. The existing success/day assertions remain in the campaign loop.

The reviewer executed the exact final wrapper body with the real source loader/controller/physics and the preserved trapped pose, adapting only browser observation/key endpoints. All three schedules passed with zero contacts and every key released: alternating held-frame jitter plus 0, 1 or 3 neutral frames between observations required 4.17, 4.65 or 5.38 simulated seconds, including the initial brake. The observation adapter marks completion at the independently verified runtime boundary; it does not replace the earlier real-WASM boundary/duplicate-finish test. Exact-AST checks also confirmed that both post-brake activity completion and region change return before constructing any planner. Probe: `.artifacts/tmp/crossing-controller-independent.mjs`.

The 52-case helper suite was source-reviewed; root's actual GPU evidence is separately retained in `docs/evidence/crossing-exit.json` (saved-contact recovery and normal region-entry approach/crossing). No browser was run by this reviewer. No remaining concrete defect was found in this correction. Reviewed fingerprints: controller `0e083485182a26a8cc5446e677939948d0df17576e463b02d57feca1ae06e4b3`, tests `31bcf0e4f68977ae41b1d227fb1d3c0cb6a22e68c8f03adde1952640a0718266`, wrapper file `97b7d129599d258b0f040e949dec72a3f6780ebc9661e63b16300edbe49f2444`, loader `efbe4ba838cae878201013554cb03cc6d5f6fe76befb4c813a533722ebb668da`.

## Seed-14 wildlife recapture — clipping finding and source correction

The unobstructed recapture in `docs/evidence/seed14-patrol-review/` resolves the previous camera-placement gap but exposes a **P2 R14 runtime clipping defect**. The two nearby deer pass through one another. At the retained `Preserved trunk and live deer, second 10` observation (34.546 seconds after action start), deer-2 and deer-3 both have x−3.4, with z87.7209455682 and z87.5115230520: their horizontal centers are only 0.2094 m apart at nearly identical ground height. Samples across approximately 30–38 seconds show the bodies merge and swap sides. This is not foreground occlusion. The exact 35-second frame and denser contact sheet are retained as `.artifacts/tmp/independent-activity-review/seed14-overlap-35s.png` and `seed14-close-patrol.png`.

The source cause is the independent `avoidTrain()` projection: it can collapse different patrols into the same western x coordinate while their longitudinal envelopes overlap. Both video/original hashes, all five stills and the served-build binding were verified for build `ff1960aff3e1933b74200f0fb7d21c37ea34f13148af6275b66460e7de5f8b50`; the report fingerprint is `c729a2ca24af048d115b562dfa9c371a02f536e988edbdfe41851dc085e745cc`. This failed visual evidence is preserved.

The world agent's correction reserves disjoint longitudinal patrol/full-body envelopes while choosing existing dry clearings. The same actor radius is retained for train avoidance. It introduces no extra visual random draws, stateful steering or per-frame pairwise work; all eight actor IDs, obstacles and existing corpse-restoration behavior remain. Independent old/current source loading against the exact parked wagon, with full rendered object bounds sampled at 4 Hz for 120 seconds, found **110 overlapping pairs before and zero afterward**. The minimum deer-2/deer-3 center separation increased from 0.04108 m to 10.63636 m. The complete 316 obstacle records remained deeply identical, including the exact retained trunk. Probe: `.artifacts/tmp/wildlife-separation-independent.mjs`.

**Source/CPU correction: passed.** The added exact scene regression, longer phase samples and moving-train pair checks are meaningful and retain the existing quality/static-clearance tests. Reviewed fingerprints: `src/game/world/index.ts` `6ce0c0570e606dd3a5b557aa7e40e53f2594271f4d5992edf92c8cb47c0edecc`; world tests `1fa36b63c4862cc378d4cded995d3023206c9828a7c2bd232aa7a5a77b811df9`. **R14 visual recheck remains pending** for the corrected build's actual recapture; the CPU result alone does not close the visual finding.

### Corrected seed-14 capture — independent visual recheck

**The reproduced deer/deer clipping finding is closed for the corrected build.** The reviewer viewed all five corrected stills, overview frames spanning approximately 23–45 seconds of the retained clip, and a 5 Hz gait window beginning at 31 seconds. The normal-control walking view shows the two deer separately, with the preserved trunk, wagon and team visible. The nearer deer turns and moves through its patrol with coherent articulated limbs; no severe interpenetration, missing material or gross floating was found in these samples. The first walking still partially crops the nearer deer at the left edge; the 6/12/18-second stills supply full-body views. This is a framing limitation, not mesh clipping. The review sampled decoded frames rather than inspecting every video frame continuously.

Both the extracted clip and retained original SHA-256 values match the report, all five stills exist and identify the same build, and the actual served-response verification passes with no missing resources. The corrected clip is 1280×720 VP9 at 25 FPS with an actual duration of 45.56 seconds; its padded wall-clock estimate in the report is 45.536 seconds. Renderer evidence identifies hardware ANGLE/Mesa AGX G13/G14, low quality. Build: `b1ee3cee7ffda1698c8fdfa718613bd06c1773dd37ec4b47d10c6cb6d31d4a57`; corrected report SHA-256: `3663138a113ba304d32fcce866636b436d94208f12286166b4a95cf132722375`. Evidence is retained in `docs/evidence/seed14-patrol-fixed/` and `.artifacts/videos/seed14-patrol-fixed-2026-09-08T14-50-45-840Z-seed14-bank-wildlife.webm`; decoded review grids are under `.artifacts/tmp/independent-activity-review/seed14-fixed-*.png`. The failed earlier capture remains preserved.

Together with the independent old/current full-geometry reproduction above, the corrected actual view resolves this targeted R14 defect and the earlier obstructed patrol evidence gap. It does not substitute for the separate final campaign, retained-memory, performance or delivery gates. No browser/GPU or implementation edits were performed by this reviewer.

## Chimney Rock campaign return — independent reproduction

The sixth campaign failed after approximately 424 seconds at day49, mile554, region9. Its raw save remains in `docs/evidence/campaign-attempt-6/failure-save.json`; SHA-256 `41025ef48d80bcf2939ae9d93b611966a26fcbda861d87f1fc61c49402123595` matches the report. This incomplete run does not satisfy campaign or soak acceptance.

**P2 — the remaining direct boarding walk crosses the companion.** Recreating the actual Hills/seed20 world and exact wagon/player poses, the original imported `walkTo()` exhausts 150 observations at precisely the recorded `(−5.4450128478744375,24.872404626102387)`. The obstacle is `companion-person`, centered at `(−4.9,25)` with half-width/depth 0.21/0.18 m. This is an ordinary blocked straight-line driver route. The existing `walkPlanned()` reaches the unchanged boarding target through eight waypoints in 2.23/2.30 simulated seconds, with no contacts under zero/alternating held-frame jitter. Both final positions select the actual board interaction. Probe: `.artifacts/tmp/chimney-board-independent.mjs`.

Root replaced all remaining campaign direct `walkTo` uses with the previously reviewed physical planner for boarding, camp and shop approaches/returns. Source inspection confirms preserved interaction targets, UI actions and final assertions. The reviewer also executed camp→seat and full shop→return paths at five representative wagon stopping depths (20,22,23.5,24,27.6971) in the actual failed world. Every planned path was physically clear. The subsequent hint/action distinction below was separately checked.

**Withdrawn reviewer claim — no boarding-target blocker.** The reviewer initially inferred that a companion hint at wagon `(0,23.5,yaw0)` and player `(−3,23.5)` would cause E to open dialogue. Root correctly identified that `interact()` gives boarding priority at distances below 4.5 m before consulting `findInteraction()`. The earlier claimed P2 driver blocker and recommendation to change the three-metre target are withdrawn. The target is valid for actual boarding; interpreting the hint selector alone was insufficient evidence of the action. A separate exact-method action/hint check is retained below.

Executing the exact `interact()` and `findInteraction()` methods together confirmed that E boards at all five tested three-metre targets and opens no panel. The retained probe is `.artifacts/tmp/chimney-interact-action-independent.mjs`. **Separate P3 hint mismatch:** at wagon z23.5/24, `findInteraction()` advertises “E · Talk with your party” while the action boards. Aligning hint priority with the existing boarding action would correct the misleading instruction; changing the campaign's seat target is unnecessary. This hint mismatch is distinct from the corrected physical driver failure.

**Campaign walking replacement: source/CPU passed.** All nine former direct `walkTo()` calls now use the reviewed physical planner without weakening the UI actions, targets or assertions. The exact failed-save recovery and ten complete camp/shop-return physical sequences passed. Root's actual GPU failure-save→planned walk→E boarding→W replay is separate evidence, not executed by this reviewer. Reviewed driver SHA-256: `31b583fc899e7aacd670d64f119c77e1082ff77038c7972779ee3a98b8f2c937`; syntax and diff checks passed. The fresh full campaign and final retained-memory verdict remain required.

### Boarding hint and retained clip paths — correction review

**P3 hint mismatch corrected; no remaining finding in this slice.** `findInteraction()` now retains a valid boarding candidate before searching other nearby locations, matching the unchanged E-action priority. Executing both exact current methods confirmed matching board hints/actions at all five tested three-metre targets. Boundary cases at 4.499, 4.5 and 4.501 m preserve the strict boarding cutoff; at and beyond 4.5 m the nearby companion still receives its hint and opens dialogue. The new browser fixture's outside point `(−6.5,25)` also passed this exact-method check. Probes: `.artifacts/tmp/interaction-hint-fixed-independent.mjs` and `interaction-hint-boundary-independent.mjs`.

The added R01/R11 browser regression preserves the opaque command-generated campaign and discloses only spatial fixture setup. It asserts the visible board hint plus normal E→riding, then reloads outside boarding range and asserts companion hint plus prompt-click→Conversation while remaining on foot. The actual Chromium red reproduction and forthcoming fresh browser green runs belong to root's evidence; they were not executed by this reviewer. Existing decision tests and production `interact()` behavior are unchanged.

The two-line capture change creates one UTC timestamp per run and includes it in each extracted clip filename. The same resulting path is passed to ffmpeg, retained in the report and hashed, so later ordinary capture runs no longer overwrite the earlier fixed-name clips. Original recordings, served-build verification and timing classification remain intact. All nine campaign walk aliases were rechecked against the previously passed physical-planner change. Scoped syntax and diff checks passed. Reviewed SHA-256 values: runtime `648c717658ab34366f8f987fe3443fa74e8974a7425bbbdc5c48d411a52a2be8`; runtime-decision tests `28715b7a8e3191c73822404c9fe9f33bb8b3531770142694f1e9bbe36f2431f4`; capture script `7c11be34269db3e074bfb7781fe11b52e564e8ae9698e350b8110641bce1e25c`. These scoped checks do not convert failed campaign six into a passed campaign or memory soak.
