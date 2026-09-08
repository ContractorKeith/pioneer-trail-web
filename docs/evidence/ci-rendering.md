# Hosted browser verification — 2026-09-08

This records a failed run and its verification-harness correction. A passing source review or local probe does not establish a green hosted suite.

## Observed failure

GitHub Actions run `34231524512`, candidate `2cfc9bae1cb34a8aa07a3c61ea29016370b20e25`, finished with **58 failed / 26 passed** browser cases. Its preceding build, lint, types, unit, Rust, engine, asset and seven development-browser checks passed for that candidate.

- **Firefox: 40 failed / 2 passed.** All 40 failed traces show `AllowWebgl2:false restricts context creation on this system`, followed by the application's preserved-save compatibility screen. The two passing error-path cases do not establish gameplay support.
- **Chromium: 18 failed / 24 passed.** Four assertions ran out of simulation progress during fixed wall-clock windows (look, departure and two fishing cases); fourteen cases exhausted their overall deadline, mostly during normal navigation. Recorded SwiftShader observations were roughly 1.4–6.9 FPS, with snapshot/readiness RPC medians of 0.84–2.07 seconds. These are failed functional-test observations, not hardware performance measurements.
- A repeated fixture restore also attempted session storage access on `about:blank`. The harness now excludes non-HTTP documents before writing its fixture.

Original logs, all 58 failure identities, traces, decoded snapshots and analysis remain in `.artifacts/ci-2cfc/`. Superseded runs `34235045991`, `34239047544`, `34241291430` and `34242331017` were cancelled after their candidates were superseded; cancellation is not a passing result. The last run's isolated Chromium touch smoke did pass (42.596 seconds), but that case already passed in the older full run.

## Correction and limits

Firefox's software-test configuration sets only `webgl.force-enabled`. This uses Playwright's [documented Firefox preferences](https://playwright.dev/docs/api/class-browsertype#browser-type-launch-option-firefox-user-prefs) and the [browser's WebGL capability gate](https://github.com/mozilla-firefox/firefox/blob/main/dom/canvas/WebGLContext.cpp). Local Firefox 155 created WebGL2 and returned the expected clear/readback pixel both with and without the preference; the existing touch case passed in 7.2 seconds. The local host therefore did not reproduce the hosted refusal, and a fresh hosted result remains necessary.

Chromium probes at device scale factors 1, 0.5 and 0.25 all retained a 640×360 drawing buffer and SwiftShader. Low quality fixes renderer pixel ratio at 1, so changing the test context's scale alone did not improve rendering. No production renderer, simulation clock or campaign rule was changed for CI.

The input harness now holds ordinary keys continuously until the same observed gameplay condition is met. Walking and driving retain 0.45 m and 2.5 m arrival tolerances. Look, collision, distance, cargo-loss, crossing, fishing, food and exactly-once day assertions remain. The snapshot helper avoids a redundant readiness RPC on every observation, and keys are released after success or failure.

Only simulation-progress deadlines receive a 10× allowance in software mode. The unchanged simulation caps frame catch-up at 100 ms: at the observed 1.4 FPS, one simulated second needs about 7.1 wall-clock seconds. The allowance remains finite; ordinary readiness and static actions are capped at 30 seconds. Hardware test deadlines and the separate two-minute hardware performance thresholds remain unchanged. Real-time pause/focus test holds retain their original durations.

Independent execution of the exact navigation helpers with the real physics and simulation clock passed a complete five-leg walking circuit and 60 m drive at 60 FPS and 1.4 FPS, including one- and two-second observation latency. Arrival tolerances, zero contacts and key release on injected observation failure were verified. This is CPU evidence, not a browser result.

## Fresh verification required

Collection retains **88 cases, 44 per browser**, with an exact disjoint 23+21 split for each browser. The four full validation jobs retain their checks; seven development cases run once. An additional six-case smoke job for each browser covers touch, river waiting, look/circuit/collision/boarding/driving, fog, successful fishing and missed fishing. There are no retries or skipped requirements.

Types, lint, formatting and source review pass for the harness correction. Full hosted Chromium/Firefox results and final integrated release acceptance remain pending. Collection evidence is `.artifacts/ci-2cfc/final-helper-collection.json`; the independent review is [recorded separately](independent-review.md).

## Candidate de1b4f8 follow-up

Hosted run `34246445939`, Firefox smoke job `102129546975`, failed all six cases before gameplay. The preference bypassed the former capability gate, but the actual browser now reports `FEATURE_FAILURE_WEBGL_EXHAUSTED_DRIVERS`. The 30-second startup deadlines work as intended; this is still an unverified hosted Firefox environment. Raw reports, traces and completed-job logs are retained in `.artifacts/ci-de1b4f8-firefox-smoke/`.

The separate local six-case run in both browsers produced 11 passes and one Firefox circuit failure. Key-release latency placed the player behind the solid companion before the return leg. An explicit waypoint across the clear north side retains the complete circuit and every collision/boarding/distance assertion. Actual physics reproduced five old-path failures and passed five corrected timing profiles. The fresh corrected case passed in both browsers (two expected, zero unexpected/skipped/flaky); reports and the preserved failure trace are `.artifacts/circuit-route-green.json` and `.artifacts/observed-input-local-1/`. This does not replace a fresh complete hosted suite.

The hosted Chromium smoke passed four cases: river waiting (87.5 s), fog (61.6 s), touch (32.2 s) and missed fishing bite (46.6 s). It failed the first walking waypoint and the caught-food assertion. Those failures differ from the local final-return obstruction; the added waypoint is not claimed to resolve them. Their traces are preserved in `.artifacts/ci-de1b4f8-chromium-smoke/` for separate rework.

The next Firefox candidate uses [Playwright's supported headed Linux CI setup](https://playwright.dev/docs/ci#running-headed): Xvfb supplies a display, and explicit Mesa GLX/DRI packages provide the software driver prerequisites. `LIBGL_ALWAYS_SOFTWARE=true` follows [Mesa's documented environment setting](https://docs.mesa3d.org/envvars.html#libgl-environment-variables). `glxinfo -B` records the actual renderer on the same display before the unchanged test command. The install is idempotent; prior package absence was not established. Only software-mode Firefox becomes headed. Independent command-boundary checks retain exact test arguments and failure exit codes; the complete 88 cases and all preceding gates remain. Actual hosted gameplay confirmation is still required.
