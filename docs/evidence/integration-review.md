# Independent final integration review

Reviewed on **2026-09-08** for parent issue **#8**, review/delivery issue **#14**, and draft PR **#15**.

- Fixed base: `90a8847da5a140e89ef83961fcccdd29b8f94bfd`.
- Fixed candidate: `8d048ed19387f690c292b1c25f770e83507c6be6`, branch `feat/first-person-3d-rebuild`.
- Comparison: `git diff 90a8847da5a140e89ef83961fcccdd29b8f94bfd...8d048ed19387f690c292b1c25f770e83507c6be6`, including the complete rebuild, not only the final road-clearance commit. Both commits were verified and the diff is nonempty.
- Contracts: root `AGENTS.md` and `CLAUDE.md`, the **entire** [authoritative rebuild specification](../PIONEER-TRAIL-3D-REBUILD-PROMPT.md), architecture and test-migration documents, and the code-review skill's separate Standards/Spec axes.

**Verdict: no new reproducible integration blocker found in the pinned production candidate.** This is source/integration review, not full release acceptance. The reviewer did not author or edit implementation, run a browser/dev server/GPU job, commit changes, or modify the separate CLI repository. The only authored deliverable is this review.

The full branch comparison was used to trace replacement of the old application through the new runtime, physics/input, campaign/WASM bridge, persistence, activities, overlays, world ownership, audio and replacement tests. Hero-asset appearance and current capture/performance scripts are handled by the separate visual/evidence reviewer. Existing dirty verification scripts, captures and acceptance updates are **outside this pinned review**. A direct `git diff --exit-code 8d048ed19387f690c292b1c25f770e83507c6be6 -- src engine public/wasm public/assets package.json package-lock.json vite.config.ts` check confirmed that these production files still matched the candidate during review.

## Standards

**New findings: 0. Worst unresolved source issue: none identified in this integration pass.** No new documented-standard violation or actionable design defect was established at the reviewed integration seams.

The independently authored [standards review](standards-review.md) is prior evidence against the same base; its recorded head was `422c2da830e4608f5d95028eadcfd83f3dd1dc6e` with the implementation in the worktree. Its fingerprints and scope are historical, not an automatic approval of every later commit. This pass checked the final committed integration against the following hard requirements:

- The runtime owns per-frame state. React receives snapshots and opens focused overlays; fixed-step movement and bounded catch-up remain outside React.
- Rust owns campaign supplies, health, money, days, progress and activity accounting. The JavaScript adapter keeps the Rust save string opaque and separates visual randomness from campaign RNG.
- World replacement disposes the previous Rapier world and owned scene resources. Final runtime disposal cancels animation, aborts listeners, disconnects resize observation, disposes audio/props/world/renderer and detaches campaign saving. Region teardown restores prior scene environment/fog and is idempotent.
- No original campaign source was silently replaced: an independent hash-manifest check found **84 files, 83 identical to baseline, one declared additive modification (`sim/src/state.rs`), zero unexpected mismatches**. The declared modification preserves original commands while adding factual fish/crossing result commands. Existing dashboard tests are explicitly archived and their requirements mapped to new checks.
- The checked-in browser projects include Chromium and Firefox with **zero retries**. CI retains the build/domain/contracts/browser gates and adds type and asset/license checks. Pending verification is not represented as a full release pass in the pinned acceptance document.

## Spec

**New findings: 0. Worst unresolved integration defect: none identified.** The reviewed code provides the required paths below. These observations establish implementation and contract coverage; they do not independently certify visual quality or a complete browser campaign.

| Requirements | Integration evidence examined |
| --- | --- |
| R01–R04 | Seated and walking camera placement, stopping before dismount, Rapier clearance and wagon/ox collision shapes, boarding, terrain-height agreement, input-driven steering and speed, forward-frontier mileage, campaign checkpoints and region replacement. The crossing/world-identity guard prevents old coordinates from overwriting a replacement region. |
| R03, R11 | Encounter priority over a simultaneous fork, deferred fork after response, saved decision presentation, dismissal and Enter/HUD reopening, route selection, landmark continuation, endings and replay. Configuration exposes retained trail/era/occupation data; legal-combination breadth remains distinct from browser coverage. |
| R05–R07 | Contextual crossing approach and disclosed method costs, physical crossing/current/collision outcomes, guide eligibility, ferry/wait domain effects and Columbia launch; moving wildlife raycast/occlusion, reload and collection; fishing cast/bite/tension/escape and fixed catch identity. Inputs determine factual outcomes before domain costs/capacity apply. |
| R08–R09 | Camp approach and rest/rations/pace/forage/repair, party treatment/dismissal, modeled-person dialogue, letters and delivery, purchases/sales/barter/counteroffers/recruitment, and return to play. The current barter regression asserts actual player and partner inventory transfer and unchanged cash, addressing the earlier weak-evidence observation. |
| R10, R13 | Gesture-based audio creation, mute/volume and pause/error audio state, scene-weather mapping, keyboard/drag/pointer-look ownership, native controlled dialogs, menu input suppression, lost focus/lock recovery, accessible HUD names and resize handling. No mobile or Safari coverage is inferred from emulation or source. |
| R12 | Versioned spatial envelopes and opaque campaign bytes, archive-before-replacement, validated backups and incompatible-save export, exact-u64 preservation, durable initial activity checkpoint, event sequence checks, shot/catch/collection replay prevention, rollback on failed durable writes, and interrupted completion recovery. A committed result is not reverted solely because subsequent transition work fails. |
| R15 | Required checks and replacement assertions are present. Resource teardown and bounded diagnostics were reviewed; actual browser/frame/load/soak acceptance requires its separate evidence. |

The previously reported source defects in [independent-review.md](independent-review.md) were checked against the current integration rather than repeated as open issues: incompatible inner saves, error-pause audio, stale crossing frontier, uphill creep, setup cancellation, replay entry, decision accessibility and encounter/fork priority. No new counterexample was established for those corrections.

### Checks actually run by this reviewer

- Fixed base/head resolution, full branch change inventory/log, `git diff --check <base>...<head>`, and the production-file equality check described above: **passed**.
- `npx vitest run tests/campaign.wasm.unit.test.ts tests/activity-director.wasm.unit.test.ts src/game/physics.test.ts src/game/clock.test.ts src/game/activities/fishing.test.ts src/game/weather.test.ts`: **6 files, 53 tests passed**, zero retries. These use the actual checked-in WASM for campaign/director behavior. They cover exact-u64/replay/rollback/recovery and physical movement/time behavior; they do not mock a browser campaign into passing.
- Independent Node SHA-256 traversal of `scripts/engine-source-sha256.json` against the declared modification manifest: **84 checked; zero unexpected differences**.

The root separately reported a fresh clean install, engine rebuild, production build, lint/types/assets, 127 Rust tests, engine contracts with 11 legal trail/era arrivals and both Oregon finales, and 110 unit tests. Those are root-run results, not additional executions by this reviewer. The root also reported six new Chromium/Firefox letter/dismissal/resize cases passing; this pass inspected their source without launching browsers.

### Remaining verification and delivery gates

These are **open evidence/delivery requirements at this review's cutoff**, not asserted application bugs:

- Fresh complete required CI and Chromium/Firefox suite results for the integrated candidate, including all retained mechanics and recovery paths.
- Completion and independent assessment of the root's current normal-input setup-to-ending campaign and at least ten minutes of transition play. Memory/resource trends must be assessed; renderer counts alone do not certify absence of scene leaks.
- Final independent visual/motion inspection of the integrated production captures and recordings, including the remaining R14 anatomy/clipping/material checks.
- R15 performance/load evidence applicable to the delivered build: the explicitly identified hardware-accelerated 720p-low two-minute ride, unfiltered frame intervals and threshold results, compressed initial payload and stated cold-load network profile. An older candidate's measurements are not automatically promoted to the final source.
- R16 final reviewable source/evidence commits and push, green required CI, allowed default-branch merge, exact-merged-build rebuild/smoke, evidence linkage and safe task-branch/worktree cleanup. The local running URL/process is a final delivery check.

Later source changes require a bounded review of their effect on this verdict. Later evidence can close these gates only after the applicable results are inspected and recorded.

## Follow-up: CI matrix and evidence-script integration

Reviewed on **2026-09-08** against `HEAD` **`8d048ed19387f690c292b1c25f770e83507c6be6`**, including the current staged/unstaged CI change and new/untracked evidence helpers before their scoped commit. The earlier full-branch production review remains pinned as recorded above. This follow-up made no implementation or script edits and launched no browser, server or GPU workload.

### Standards

**New findings: 0. Worst unresolved issue in this slice: none identified.** The CI matrix retains all previous commands, runs both browser lanes independently with `fail-fast: false`, keeps zero browser retries, and gives each lane a distinct failure-artifact name. `npm run test:dev` runs once on the Chromium lane, matching the Chromium-only development configuration. Lint, type checks, unit tests, production build, locked Rust tests, engine contracts and asset checks remain in both lanes.

The matrix changes the visible job contexts from `validate` to browser-specific names. A read-only GitHub check returned **“Branch not protected”** for `main`, and its applicable branch-rules endpoint returned **`[]`**. No existing required legacy context was found that would be stranded by this change. This observation describes repository policy at review time; it is not permission to bypass later protection.

### Spec

**New findings: 0. Worst new integration blocker: none established.** The browser split preserves the exact production collection. CPU-only Playwright JSON collection with `CI=1` produced:

| Collection | Cases |
| --- | --- |
| Full production configuration | 86 |
| Chromium project | 43 |
| Firefox project | 43 |
| Development configuration | 7 |

The sorted union of the two project collections equals the full collection by file, test title and project. Browser specs and both Playwright configurations still match `HEAD`; no assertion was removed for this split. The seven development cases include cold concurrent engine creation and all six onboarding/setup cases. These were **collected, not executed** by this reviewer.

The new walking helper generates waypoints from the actual authored scene, seed/region and parked-train collision model, while `walkPlanned()` executes normal browser key holds and checks live mode, region identity, collision count and waypoint arrival. The temporary TypeScript loader is scoped to project modules, caches its loaded toolset and deregisters its hooks. Region and failure checkpoints export the raw opaque world save with a SHA-256 rather than changing player/campaign state. The separate reviewer's exact-route CPU reproductions remain documented in [independent-review.md](independent-review.md); they do not establish a completed campaign.

`trackServedBuild()` is attached before navigation in the campaign, scene/activity capture and cold-load paths. It compares actual response bodies, length and origin to the recorded local build manifest, rejects failures/missing core resources, and is rechecked before final reporting. Cold-load gzip totals now use these verified response bodies. Independently executed five CPU probes passed: matching bytes with retained bodies and listener teardown, changed bytes after an initial pass, foreign-origin bytes, a failed request, and an unexpected response appended while an earlier body was still pending. Concurrent calls to `loadWorldTools()` returned the same toolset; importing the campaign module did not launch a browser. Syntax checks for all six relevant `.mjs` entry/helpers and scoped `git diff --check` passed.

At this follow-up cutoff, the root reports that the latest campaign attempt still failed at a crossing with displayed activity progress 1 and is investigating it. **The normal-input campaign gate remains failed/open.** This review does not attribute that failure to the application or driver without a reproduction, does not approve a complete campaign, and does not remove the failure assertions. Fresh matrix CI execution, campaign recovery/retest, independent soak assessment and the other release gates above remain required.

Reviewed worktree fingerprints:

| File | SHA-256 |
| --- | --- |
| `.github/workflows/ci.yml` | `efc7ceed44d89410bce021ea630172ff868759e7d63ef45e04d530a5f2ccfac4` |
| `scripts/walking-route.ts` | `aeff3b79a42a314de8249bd11c857d0e78130bf0c4d99f28dbea226187cc25df` |
| `scripts/load-world-tools.mjs` | `826d46c67da95de708ea3f23a813016f4a37ba7e4c15af37caeb2a63ba96b5e1` |
| `scripts/served-build.mjs` | `f2e87671803410fb9ca5b7d629349458243285f1ff438fdafd904c8801bca01e` |
| `scripts/campaign-walkthrough.mjs` | `446c3b791c179b43c601615f5d9dfe8326f0151ce60cc30febdf41d59a2f429e` |
| `scripts/measure-load.mjs` | `112f789374602af8fe1ff93ece960fe5fc5e26dbc1aca3942b3d36e49222ae56` |
| `scripts/capture-world.mjs` | `eeb9f799d8e65d158b8d8d16a8f38c57c9f68377b4f632458e4287e03089f39c` |
| `scripts/capture-activities.mjs` | `23ac2f46f6c8557f5ca89cc103ee5e4108c3c7dfa66b38cc8ad9108550454fd9` |
| `tests/walking-route.unit.test.ts` | `325b9ed45656d4877f801452ca2fdec24502729d3400f586a9e31727efa49c45` |

## Follow-up: two shards per browser

Reviewed on **2026-09-08** against fixed `HEAD` **`5ec9d8951dbd39317a1db5668797e6eb0197c8a6`**, using the current worktree diff of `.github/workflows/ci.yml`. This bounded review covers only the additional shard matrix, development-suite condition and failure-artifact naming. It does not extend the earlier production review to the concurrently edited wildlife source or certify browser execution. The reviewer made no workflow, test or production edits and launched no browser/server/GPU workload.

### Standards

**New findings: 0. Worst unresolved issue in this slice: none identified.** A programmatic comparison of the ordered `run` and `uses` steps against the fixed head found every prior step preserved; the only command addition is `--shard=${{ matrix.shard }}/2`. Lint, types, unit tests, production build, locked Rust tests, engine contracts, asset checks and browser installation remain in every matrix job. `fail-fast: false`, one Playwright worker and zero retries remain unchanged. The four browser/shard combinations have distinct failure-artifact names.

### Spec

**New findings: 0. Worst new integration blocker: none established.** CPU-only execution of the real Playwright collector with `CI=1`, `--list` and `--reporter=json` verified the complete identity set rather than only comparing counts:

| Collection | Cases |
| --- | --- |
| Full production configuration | 86 |
| Chromium, shard 1/2 | 22 |
| Chromium, shard 2/2 | 21 |
| Firefox, shard 1/2 | 22 |
| Firefox, shard 2/2 | 21 |
| Development configuration | 7 |

The four production shard lists are pairwise disjoint, and their sorted union equals the full list by project, file, line, column and complete suite/test title. The development configuration resolves to Chromium and collects the cold concurrent-engine case plus all six onboarding/setup cases. The workflow condition selects exactly one of the four jobs for that suite: Chromium shard 1. Production browser specs, both Playwright configurations and `package.json` match the fixed head; this split removes no assertion. `git diff --check -- .github/workflows/ci.yml` passed.

The reviewed workflow SHA-256 is **`e3fd6721b15ae84c62846ca6316177e80378245cd8ce83706b2e012c3e0e89bc`**. The SHA-256 of the serialized sorted full identity array used in the equality assertion is **`658cb59bcde47e9d23e3c7e8dd6b9a8d006f027a0eb6993780e3dce9a37260d8`**. These are collection and gate-preservation results; fresh successful execution of all four production jobs and the development suite remains required.
