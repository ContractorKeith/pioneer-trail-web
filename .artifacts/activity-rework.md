R06/R07 independent review returned two concrete P2 defects, now fixed:

- Hunting raycasts omitted the movable wagon/ox meshes. An authored-world reproduction hit a deer 32.49m away through opaque wagon geometry at 7.01m. The corrected shot spends one round and records a miss with no pending kill. A regression was red before the fix; all 13 real-WASM director tests now pass.
- Fishing at the physical crossing bank placed its line at the camp side stream. Casts now select the approached bank, persist castX/Z when cast, and render the saved target through movement/reload. The line begins at the actual rod tip; tackle is hidden before casting. Independent authored-world probe casts from z92 to the current river at z107 and preserves that location across reload.

Fresh production Chromium checks on index-BcczGe78: actual crossing-bank fishing target + movement/reload PASS (15.6s); actual moving-wildlife hunt/miss/reload/hit/retrieval/interruption PASS (24.1s). New stronger trade test also PASS (18.1s): real counteroffer accepted, exact player/NPC inventory exchange and unchanged cash asserted.

Earlier fresh Chromium Wait and Guide/abort costs passed, and Columbia physical route/raft run reached Arrived after correcting test-driver throttle handling. Full final browser suites and complete normal-input campaign/soak remain open. No activity outcome or game timing was mocked or fast-forwarded in these browser checks.
