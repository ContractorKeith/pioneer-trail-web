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
