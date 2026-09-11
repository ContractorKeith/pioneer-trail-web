# Worklog

### 2026-09-11 09:42 EDT - Four-traveler onboarding and visual evidence

- Outcome: Campaign setup accepts four or five travelers; setup defaults to four; rebuilt WASM and updated the engine hash. Added headed macOS Playwright launch guards, refreshed onboarding/night/crossing evidence, and added a headed evidence capture script.
- Decisions: Reverted the unverified startup-frame change. Kept the removed seed control out of the UI; evidence tests can pass a deterministic seed by URL. Removed the invalid pre-existing night-before image because main lacks the later force-night evidence hook.
- Checks: Headed test:dev passed 8/8. Headed test:e2e completed 77/92; its preview build was stale for the first run, and the source-specific river tests remain incompatible with the committed seat-side crossing flow. cargo test, test:engine, build, lint, test:types, test:assets, and npm test passed.
- Remaining: A matching main night-before capture needs an explicit main-compatible fixture; headed e2e source test updates remain separate follow-up work.
- Next: Resolve the remaining production browser-suite test expectations before merging.

### 2026-09-11 10:22 EDT - Seated-crossing browser-suite alignment

- Outcome: Aligned river tests with seat-side crossing interaction, moved fishing evidence to the permanent stream bank, and made a selected Columbia raft launch from the wagon seat at its river launch point.
- Checks: Headed Playwright passed 92/92 (46 Chromium, 46 Firefox); lint, test types, and 269 Vitest tests passed.
- Remaining: A matching `main` night-before evidence capture remains unavailable because that revision lacks the test-only night hook.
- Next: None.

### 2026-09-11 15:30 EDT - Pass 8 onboarding and riverbank rework

- Outcome: Restored pre-branch daylight values while retaining a night-only visibility lift; added a river-overlay dismount action, location-priority inspection logic, setup quotes using the configured four-person party, and production-safe evidence seed handling. Updated verification scripts and recaptured the six requested review images.
- Decisions: Seat-side E remains the river discovery path. The River crossing panel is the deliberate route to get down at a halted bank; water-edge inspection is retained on foot without hiding nearby world interactions.
- Checks: cargo test, test:engine, build, lint, test:types, test:assets, and 272 Vitest tests passed. Headed test:dev passed 10/10; headed test:e2e passed 100/100 (50 Chromium, 50 Firefox). Smoke, cold-load, and the normal 720p low ride completed; the walkthrough completed its first river crossing before being deliberately stopped.
- Remaining: None.
- Next: None.

### 2026-09-11 12:20 EDT - Pass 9 configured setup quotes

- Outcome: Setup supply cards now quote a throwaway engine after Configure, so route, occupation, month, party size, seasonal markups, and discounts match the supplies actually loaded. The river-panel dismount action is available only while riding; on-foot inspection retains no dead action. Removed the obsolete Mormon 1843 guard and corrected the retreat-test title.
- Checks: build, lint, test:types, and 273 Vitest tests passed. Headed test:dev passed 11/11. Headed test:e2e passed 104/104 (52 Chromium, 52 Firefox). The WebAssembly quote matrix covers 9 occupations x 5 months x 3 presets = 135 cases.
- Remaining: None.
- Next: None.

### 2026-09-11 13:00 EDT - Pass 10 scratch quote lifecycle

- Outcome: Setup quotes now have explicit pending, ready, and error states; invalid names explain the disabled action and recover without rebuilding WASM per keystroke. Scratch engines are disposed after quoting. Removed obsolete quote overrides.
- Checks: build, lint, test:types, and 272 Vitest tests passed. Headed test:dev passed 12/12; headed test:e2e passed 106/106 (53 Chromium, 53 Firefox).
- Remaining: None.
- Next: None.

### 2026-09-11 13:20 EDT - Pass 11 stable setup quotes

- Outcome: Kept ready supply quotes visible while correcting invalid names, exposed only real quote work as busy, and matched the engine's control-character validation.
- Checks: build, lint, test:types, and 272 Vitest tests passed. Headed test:dev passed 12/12; headed test:e2e passed 106/106 (53 Chromium, 53 Firefox).
- Remaining: None.
- Next: None.

### 2026-09-11 13:35 EDT - Pass 12 WASM quote test budget

- Outcome: Split the purchase and scratch-quote WASM matrices by occupation while retaining every preset and month combination.
- Checks: npm test rerun passed 288 tests in 116.54s; slowest scratch-quote occupation case took 447ms.
- Remaining: None.
- Next: None.

### 2026-09-11 14:00 EDT - Pass 13 CI trader interaction endpoint

- Outcome: Fixed the trader browser test's navigation endpoint to stop comfortably within the modeled trader's interaction radius and assert the `E · Trail trader` prompt before opening Trade.
- Evidence: CI trace from run 34628165519 ended at `(5.64, 26.75)`, 3.215 m from the trader center `(8.4, 28.4)`, narrowly outside its 3.2 m radius; no interaction prompt was rendered. This was endpoint tolerance, not river-inspection priority.
- Checks: Headed targeted Playwright passed 18/18 (9 Chromium, 9 Firefox); lint and test types passed; standalone npm test passed 288 tests in 67.28s. Local software-mode mechanics ran its trader case successfully; its independent hunting case stopped in collecting rather than aiming.
- Remaining: None.
- Next: None.

### 2026-09-11 14:30 EDT - Onboarding UX merged (PR #16)

- Outcome: PR #16 merged to `main` at `3423f67` (28 branch commits, 38 files). Readable UI scale; single-screen setup (Route, Occupation, Leave in, 4 travelers, preset cards with a scratch-engine quote, one "Take the trail" button); brighter night with unchanged daytime curve; seated `E · Inspect the crossing` at the riverbank with an overlay dismount action, location-priority on foot, blocked forward wading; Rust engine accepts 4..=5 party members with byte-identical 5-member save round-trip; macOS headed Playwright; verification scripts and evidence capture updated.
- Process: Fable orchestrated, Codex `gpt-5.6-terra` implemented across 13 passes; three independent reviewer passes (15 initial findings, all verified fixed; two targeted follow-ups). Product decisions were the owner's (year/difficulty hidden, party of four).
- Checks (orchestrator, exact head e1e4992 on macOS headed): build, lint, types, assets, 288 vitest, 130 Rust, test:engine, test:dev 12/12, test:e2e 106/106 (53 Chromium, 53 Firefox). GitHub CI run 34630-series all six jobs green on e1e4992. Merged `3423f67` rebuilt locally: build 0, headed test:dev 12/12, `npm run smoke` pass:true against a 4173 preview.
- Decisions: headless swiftshader Playwright fails on `main` on macOS (environmental); Linux CI remains the headless gate. `night-before.png` from `main` is not reproducible (no night hook there) and is documented in the capture script.
- Remaining: merged-default CI run 34631660989 was in progress at log time. `.claude/launch.json` (dev server config) is untracked, owner to decide.
- Next: owner playtest of the merged build; Safari/mobile and 1080p performance remain unverified from the R16 baseline.
