# Worklog

### 2026-09-11 09:42 EDT - Four-traveler onboarding and visual evidence

- Outcome: Campaign setup accepts four or five travelers; setup defaults to four; rebuilt WASM and updated the engine hash. Added headed macOS Playwright launch guards, refreshed onboarding/night/crossing evidence, and added a headed evidence capture script.
- Decisions: Reverted the unverified startup-frame change. Kept the removed seed control out of the UI; evidence tests can pass a deterministic seed by URL. Removed the invalid pre-existing night-before image because main lacks the later force-night evidence hook.
- Checks: Headed test:dev passed 8/8. Headed test:e2e completed 77/92; its preview build was stale for the first run, and the source-specific river tests remain incompatible with the committed seat-side crossing flow. cargo test, test:engine, build, lint, test:types, test:assets, and npm test passed.
- Remaining: A matching main night-before capture needs an explicit main-compatible fixture; headed e2e source test updates remain separate follow-up work.
- Next: Resolve the remaining production browser-suite test expectations before merging.
