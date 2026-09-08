# First-person rebuild acceptance

Source: [full specification](PIONEER-TRAIL-3D-REBUILD-PROMPT.md). Parent [#8](https://github.com/ContractorKeith/pioneer-trail-web/issues/8). No acceptance is passed until implementation and independent fresh verification evidence are linked. Historical dashboard checks remain under archive/ and never establish these passes.

| ID | Required capability | Evidence needed to pass |
|---|---|---|
| R01 | Genuine first person | Play from the wagon seat, look forward/back/sideways, stop, dismount, walk completely around the wagon, and reboard. Viewpoint and occlusion change correctly. |
| R02 | Player-controlled travel | Acceleration/pace, stopping, steering, terrain following, and collision work. Position and campaign progress respond to actual actions, not just an animation timer. |
| R03 | Connected journey | Outfitting leads into playable travel, encounters and region transitions, and a reachable success or failure ending. Preserve existing selectable routes/eras/content rather than silently deleting them to simplify verification. Shared regional assets are allowed. |
| R04 | Terrain and scenery | Distinct plains, woodland/river-valley, and mountain-pass regions, with region-appropriate snow conditions. Ground is navigable and collision agrees with visible obstacles. |
| R05 | River crossings | Approach a river in the world, see actionable depth/current/risk information, choose among meaningful crossing options, and execute at least one player-controlled crossing. Steering/collisions affect outcomes; ferry/wait/guide options have real costs and effects where supported. |
| R06 | Hunting | Encounter moving 3D wildlife, aim, fire/reload, register actual hits/misses, spend ammunition, and collect bounded food through campaign rules. Not clicking HTML animal icons. |
| R07 | Fishing | Approach suitable water, cast, detect a bite, react and reel with a meaningful success/failure mechanic, then commit the catch and time cost once. Not an instant random-reward button. |
| R08 | Camp and survival | Stop at camp, interact with fire/supplies/companions, rest, manage rations, treat illness, gather resources, and repair damage. Time, supplies, health, and wagon condition change consistently. |
| R09 | People and commerce | Approach a modeled trader/fort or fellow traveler, open contextual dialogue, buy, sell, barter, and return to the world. Money, stock, capacity, and prices are enforced; existing conversations/letters/party features remain usable. |
| R10 | Atmosphere and audio | Day/night, rain, snow, fog, flame, smoke, and firelight appear in real scenes. Wagon, animals, water, footsteps, and camp have suitable audio; user gesture, mute, pause, and volume work correctly. |
| R11 | Meaningful management | A readable compact HUD and contextual map, journal, inventory, party, and settings interfaces expose real state without recreating the old dashboard. |
| R12 | Persistence | Autosave, resume, export/import, incompatible-save handling, and recovery from interrupted activities work without duplication, silent resets, or lost committed outcomes. |
| R13 | Accessibility and browsers | Keyboard/mouse play, drag-look, reduced camera motion, focus/pause recovery, readable overlays, and desktop resizing work. Verify Chromium and Firefox gameplay. Touch layouts/controls should be usable on supported landscape devices; do not claim mobile or Safari support without actual checks. |
| R14 | Finished visual presentation | The wagon, oxen, terrain, water, lighting, and interactions are visibly better resolved than the HTML reference. Independent visual review finds no blockout hero assets, missing materials, severe clipping, floating objects, or misleading previews. |
| R15 | Engineering and performance | Production build, type checks, lint, domain/unit/contract tests, browser E2E, license checks, and the performance/stability checks below pass. |
| R16 | Delivery | Final source and necessary assets are pushed and merged, required CI is green, documentation matches the implementation, evidence is linked, and task-owned branches/worktrees are safely cleaned up. |

## Execution ownership and dependencies

| Issue | Lane | Dependencies | Owner |
|---|---|---|---|
| #9 | Runtime, controls, architecture | baseline | Root / Astra |
| #10 | World, models, atmosphere | #9 shared contracts | World / Astra |
| #11 | Campaign and persistence | #9 shared contracts | Campaign / Astra |
| #12 | Hunting, fishing, crossing | #9, #10, #11 | Activity implementation agent |
| #13 | Shell, overlays, audio | #9, #11 | UX implementation agent |
| #14 | Independent verification and delivery | all lanes | Independent Astra reviewer + root |

## Evidence status

- Baseline: main 90a8847. Saved prompt and demo preserved in commit 422c2da. No pre-existing tracked changes.
- Reference demo: executed using system Chromium on Linux aarch64; WebGL renderer ANGLE (Mesa, AGX G13/G14, OpenGL 4.6), no page errors. Captures in evidence/reference/.
- R01–R13: implementation and focused behavior coverage exist in the current world, activity, survival, recovery, and browser specs. The Playwright configuration has Chromium and Firefox projects, but the focused evidence does not substitute for a fresh full browser suite and complete campaign matrix. See [world coverage](../tests/world.spec.ts), [activity/commerce coverage](../tests/mechanics.spec.ts), [survival/accessibility coverage](../tests/survival.spec.ts), [audio coverage](../tests/audio.spec.ts), and [recovery coverage](../tests/recovery.spec.ts).
- Candidate performance evidence: [ride.json](evidence/performance/ride.json) reports a `pass: true` 120.0169-second low-quality 720p Chromium ride on the M2 AGX path, with 7,070 frames, median 59.8802 FPS, and p95 17.9 ms. [cold-load.json](evidence/performance/cold-load.json) reports 1,957,266 initial gzip bytes, 5.6288 seconds to setup controls, and 7.2681 seconds to playable state under its fresh-context 10 Mbps down / 2 Mbps up / 150 ms profile. These are candidate artifacts, not final R15 acceptance.
- R14: pending the latest independent visual review of wildlife, water, fog, and motion. The [visual-review report](evidence/visual-review/report.json) and captures provide inspection inputs; they do not by themselves establish the required review result.
- R15: pending the full fresh suite, complete normal-input campaign, all route/config combinations, full CI result, and the required ten-minute multi-region transition soak. The two-minute candidate ride and cold-load candidate do not close this ID.
- R16: pending final source/asset push and merge, green required CI, evidence linkage on the merged default commit, and task-worktree cleanup.
- M1–M2 have focused implementation artifacts; M3–M4 and final independent delivery review remain pending.

The required final evidence remains: complete normal-input browser campaign; all route/config combinations; failures; Chromium + Firefox; viewpoints/weather screenshots; 25–30s ride and longer walkthrough; cold-load profile/payload; two-minute hardware ride; ten-minute soak; independent full diff review; green CI and exact merged default smoke. The linked ride and cold-load files cover candidate measurements only.
