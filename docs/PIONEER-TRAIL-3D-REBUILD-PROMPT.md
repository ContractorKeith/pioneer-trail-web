# Pioneer Trail — Autonomous First-Person 3D Rebuild

## Mission and authority

Act as the lead game developer, technical director, orchestrator, integrator, and final reviewer for `ContractorKeith/pioneer-trail-web`.

Rebuild this repository into a genuinely playable, first-person 3D pioneer survival/adventure game for the browser. This is an implementation assignment, not a request for a plan, another demo, or a prettier management interface. Deliver the complete release defined below, tested and reviewed, committed, pushed, and merged into the repository's actual default branch.

I am using Astra 6 with my selected YOLO/Ultra settings. Use the available reasoning and delegation capabilities, but inspect the installed CLI and its documentation before configuring models, subagents, worktrees, or long-running goals. Do not invent model identifiers, command flags, tools, background execution, or successful agent reviews.

Work autonomously through the entire goal. Make ordinary implementation decisions yourself. Do not stop after planning, scaffolding, the first playable slice, or an intermediate milestone to ask permission to continue. Review milestones internally and proceed when they pass. This instruction supersedes any earlier instruction to stop after Milestone 1 for my approval.

“100% success” means every required acceptance criterion has implementation and verification evidence, with no unresolved release-blocking findings. It does not mean a claim that software is mathematically bug-free. Never manufacture a pass or lower the requirements to finish.

## 1. Establish the baseline without losing work

Work only in the web-game repository and task-owned working directories. The separate `ContractorKeith/pioneer-trail` CLI repository is a read-only source/reference; do not modify or push to it.

Inspect the current branch, default branch, remotes, worktrees, working-tree changes, untracked files, GitHub authentication, existing issues, and CI. Preserve all existing user work, especially the locally saved HTML demo. Do not assume local files have been pushed. Establish a recoverable Git baseline before replacing the old application; exclude secrets and unrelated files from commits. Do not blindly reset, clean, stash, or overwrite a dirty checkout.

Find and run the first-person HTML demo in the local `docs/` directory, expected to be named `pioneer-trail-first-person-demo.html`. Inspect its actual experience in a browser. Treat it as the reference for being seated on the wagon, looking around, moving through a world, and having a minimal HUD—not as the final art direction or production architecture. Preserve it as a reference. Search locally before reporting it missing; if absent, proceed from this specification and record the missing reference rather than inventing its contents.

Read the original game content and current implementation. Replace conflicting instructions in `AGENTS.md`, `CLAUDE.md`, `docs/GOAL.md`, acceptance documents, and architecture notes. Archive or explicitly mark old plans as superseded. Preserve unrelated repository conventions, author identity, licenses, and security rules. Do not leave an active instruction telling future agents to build illustrated scenery instead of a game world.

The old web design and architecture are disposable. Its campaign content and tested domain rules are potentially valuable. Reuse them deliberately where useful; do not keep the old architecture merely to minimize the diff. Do not rewrite working domain logic purely for novelty either.

You may edit this repository, install project dependencies, create project-scoped agent configuration, create/update GitHub issues and PRs, and commit/push/merge task work. No paid assets or new paid services, production deployment, DNS changes, force-pushing shared history, disabling branch protection, or deleting unrelated resources. Use existing authorized development tools; do not alter global CLI settings or exhaustively spawn agents without regard to capacity.

## 2. Product direction: the world is the interface

The player is physically present in an 1800s wagon journey. The 3D world occupies the browser viewport. First person is the default playing perspective, not a decorative toggle. The player rides on the wagon, looks behind into it, stops, gets down, walks around, interacts with the party and environment, and boards again.

Remove the old sidebar-dashboard composition, scenic hero cards, large marketing headlines, and “travel one day” button as the principal gameplay loop. Maps, journals, inventory, party care, outfitting, and trading may use focused overlays opened during play. Do not turn every interaction into a difficult physical manipulation: clear menus are appropriate for quantities, dialogue, and settings.

Provide mouse-look with pointer lock after an explicit user gesture, an understandable escape/pause flow, keyboard controls, and a drag-look alternative. Prevent camera movement while interacting with menus. Offer sensitivity, field-of-view, volume, graphics quality, and reduced camera-motion settings. Motion reduction must not replace the world with an illustration. Include understandable control hints and a way to recover from lost focus or pointer lock.

Build a connected journey from manageable playable regions, not a full-scale continent. Use time/distance compression and streaming transitions with a documented relationship to campaign days and miles. Transitions must preserve state. The world must not be an endlessly looping ride with no progression.

Use grounded, cohesive stylized realism. Aim clearly above the demo's placeholder graphics without promising AAA photorealism. Readable shapes, believable scale, convincing materials, good animation, strong lighting, and stable frame pacing matter more than excessive polygon counts.

## 3. Graphics and asset requirements

Create a real asset pipeline early, alongside movement—not as an unspecified future polish task.

Use authored or properly licensed, redistributable 3D models for the close-up wagon, oxen, wildlife, people, and equipment. Original procedural mesh generation is acceptable when its results meet the visual requirements. Blender scripting may be used when available. Primitive shapes are acceptable during blockout, not as the final recognizable anatomy of an ox or the entirety of the wagon.

The wagon needs a credible driver position, visible wood/canvas/metal surfaces, wheel and axle detail, a modeled interior, and cargo. Oxen need recognizable proportions, a yoke/harness arrangement, and animation coordinated with speed. Avoid rigid animals sliding over the ground, floating hooves, visibly disconnected harnesses, and wheels rotating independently of movement.

Use glTF/GLB assets where appropriate, physically based materials, coherent texture scale, correct color management, and a deliberate lighting setup. Include terrain variation, trail ruts, vegetation, rocks, near/middle/distant scenery, water with readable movement, atmospheric depth, and sky/time-of-day changes. Geography should match the campaign region; do not place alpine scenery everywhere.

Implement rain, snow, fog, campfire flame, embers, smoke, and firelight in the 3D environment. Use performant approximations; expensive volumetric simulation is not required. Weather should react sensibly to shelter and agree with the campaign state. Particle billboards and distant impostors are acceptable techniques. A flat picture standing in for the navigable world is not.

Create an asset manifest recording each asset's source, creator, license, redistribution requirements, modifications, and local path. Include required credits and license files. Do not scrape unlicensed commercial game assets or invent provenance. Package runtime assets locally; no hotlinked asset dependencies or runtime paid APIs. When a free asset cannot meet the target, author a suitable replacement or report the real blocker; do not silently retain placeholders and call the art finished.

## 4. Architecture: build a game runtime, not scenery components

Recommended stack: TypeScript and Vite, Three.js for rendering, Rapier for collision/physics, and React only for the UI shell and overlays. Prefer retaining useful Rust/WASM campaign logic behind a redesigned typed boundary. A different choice requires a short, evidence-based architecture decision, not a lengthy framework bake-off. Verify current stable versions against official documentation and commit reproducible dependency locks.

Use a reliable WebGL 2 baseline. Evaluate WebGPU only when it improves this implementation and its fallback is tested; “latest” is not a reason to delay the playable game. Unsupported graphics hardware needs an honest compatibility message, not a silent return to the old dashboard.

Separate rendering, input, character/wagon controllers, world/region loading, interactions, audio, campaign state, activity state, and persistence. Keep per-frame transforms out of React state. Use a fixed simulation/physics timestep with rendering interpolation, bounded catch-up, and explicit pause/tab-visibility behavior. Dispose of scene resources and event listeners when regions unload.

Prefer stable, controllable wagon handling over an elaborate physically simulated harness that is unstable. Steering, stopping, turning, slopes, collision, and boarding must remain real gameplay. Do not attach the camera to a hidden cinematic spline and pretend that the player's controls matter.

Define shared interfaces before parallel implementation. One authoritative domain layer owns supplies, health, money, progress, and committed outcomes. The real-time game owns spatial activity behavior and sends validated outcomes through a typed adapter. Preserve seeded campaign behavior where appropriate, but do not force terminal screen coordinates, sprite hit masks, or unchanged minigame algorithms into the new 3D mechanics.

Player actions must affect results: a hunt hit, fishing success, or crossing collision must not be replaced by an unrelated random result. Disclosed uncertainty is allowed; arbitrary contradictions are not. Prevent duplicate awards, ammo overspending, inventory underflow, and double-advanced days. Keep visual randomness separate from campaign randomness. Do not claim cross-platform floating-point physics determinism without testing it.

Use versioned saves that preserve campaign state, current region, player/wagon location, and committed activity progress. Keep any 64-bit RNG data exact. Pause/reload must not become a reward-duplication or reroll exploit. Migrate old saves where feasible; otherwise detect their version, preserve/export them, and explain incompatibility before starting a new run. Never silently erase saves.

Deliver a static build suitable for later Cloudflare Pages hosting. No accounts, multiplayer backend, required API keys, or recurring runtime services. Document production hosting requirements without deploying or changing domains.

## 5. Required release acceptance matrix

Before implementation, turn these requirements into stable acceptance IDs and issue checklists. Add necessary edge cases, but do not remove requirements or redefine them as optional after encountering difficulty.

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

All core mechanics must work through the normal playing interface. Developer shortcuts may set up test fixtures, but cannot substitute for exercising the feature under test.

## 6. Orchestrate a real team with GitHub issues

Create one parent goal issue and bounded implementation issues with acceptance IDs, dependencies, owned files/modules, expected artifacts, and verification commands. Reuse relevant existing issues without confusing historical completion with this rebuild. GitHub issues are the durable task ledger, including review findings, blocked work, and restart instructions.

Use actual subagents when supported. Keep the strongest available model/reasoning level for architecture, physics/controllers, campaign integration, difficult debugging, performance, and final review. Use capable mid-tier agents for bounded implementation and lighter models for repository exploration, asset inventories, documentation, and straightforward test scaffolding. Verify available model names and compatible effort settings. Escalate work when a lighter model struggles. Do not let a cheap review rubber-stamp a difficult change.

Organize lanes around world/rendering/assets, controls/physics, campaign/persistence, activities/NPCs, and UX/audio. Use an independent reviewer/tester who did not author the change. Start with a sensible concurrency cap, such as four workers, and adjust to actual machine/tool capacity. Serialize GPU-heavy tests and dependency/lockfile changes. Avoid multiple workers editing the same shared contract or integration file simultaneously.

Assign each worker a specific issue, baseline, scope, interface contract, acceptance criteria, and required evidence. Use task-owned branches/worktrees when useful. Workers return changed-file summaries, commands actually run, results, artifacts, and known gaps. You inspect their changes and run independent checks; their “done” message is not approval.

Only the orchestrator integrates into the release branch and performs the final default-branch merge. If the CLI cannot spawn agents or route models, document that limitation and execute the same implementation/review stages sequentially. Do not simulate a fictitious team.

## 7. Build in gated milestones, continue automatically

**M1 — Establish the real experience.** Complete a walkable campsite and a short drive: spawn, look around, board, drive, stop, dismount, interact, save, reload. Use this to prove the runtime and establish the wagon/oxen/terrain visual direction. Integrate and review before expanding.

**M2 — Make a connected campaign.** Add outfitting, campaign integration, region transitions, map/journal/party overlays, commerce, camp survival, and endings. Verify state and save contracts throughout.

**M3 — Complete the activities and atmosphere.** Finish hunting, fishing, river crossings, NPC interactions, weather, sound, and region-specific content. Every activity must have real inputs and consequences.

**M4 — Finish the product.** Replace remaining placeholders, tune controls and camera comfort, optimize, complete browser and gameplay testing, perform adversarial review, capture evidence, and deliver the verified merge.

These are internal gates, not stopping points. Fix failures at each gate and continue without requesting routine approval. Do not expand into unrelated features such as multiplayer, crafting trees, monetization, or an AI chatbot.

## 8. Review, rework, and verification loop

For every issue: implement → run focused checks → inspect the actual result → independent review → record defects → return concrete rework → retest → integrate → run affected regressions. Repeat until its acceptance criteria pass. Close an issue only after its changes are integrated and its evidence is recorded; the parent goal remains open until final delivery.

Review correctness, UX, visual quality, performance, and maintainability—not only whether it compiles. Review findings need reproduction steps, expected/actual behavior, relevant files, and severity. Verify each fix against the original reproduction. After repeated failure, investigate the root cause or change approach rather than repeating an ineffective patch.

Implement automated domain and contract tests for state transitions, activity outcomes, costs, saves, invalid inputs, and exactly-once commits. Test equivalent simulation/input sequences at different render rates and after pause/focus changes. Retire obsolete dashboard tests only with replacement coverage for the underlying requirements.

Run Playwright or equivalent real-browser E2E against the production build. Exercise actual input and visible flows. Assert world/player movement, blocking collisions, boarding state, interactions, and persistent consequences—not just button labels or a canvas existing. Test clean install/build, cold startup, reload, resource failures, window resizing, pause, pointer-lock loss, and save import/export. Use deterministic fixtures to reach rare cases without hiding ordinary gameplay bugs.

Require at least one complete normal-input browser campaign walkthrough from setup to ending, plus automated coverage of declared route/configuration combinations. Test representative failure outcomes too. A headless simulation finishing is not evidence that the interactive campaign is playable.

Capture and review screenshots from different viewpoints and lighting/weather conditions, a 25–30 second real in-game wagon ride, and a longer walkthrough showing the main interactions. These must come from the actual integrated production build; no generated concept images or offline renders presented as gameplay. Store modest evidence in the repository and larger recordings as appropriate task artifacts, with commit/seed/environment information. No external upload service without authorization.

Performance target: approximately 60 FPS at 1080p balanced quality on a suitable GPU. Minimum release gate: median at least 30 FPS and 95th-percentile frame time at most 50 ms during a two-minute representative ride on one explicitly identified hardware-accelerated desktop baseline at 720p low quality. Record hardware, OS, browser, renderer/backend, resolution, quality, warm-up, and results. Do not treat software-rendered CI numbers as hardware evidence or claim untested device coverage.

Target an initial playable compressed payload no larger than 30 MB; lazy-load later regions/assets. Measure and report cold-load time under a stated network profile. Use instancing, level of detail, culling, limited shadows, texture/geometry compression, and dynamic resolution where justified. Run a ten-minute play/region-transition soak with no crashes, recurring app errors, stuck controls, or continuing resource growth from scene leaks.

Tests must pass on a fresh verification run without masking failures through retries. Do not skip failing requirements, reduce assertions, accept broken screenshot baselines, mock away essential mechanics, or disable CI to turn checks green. A rendered frame or successful build alone never establishes visual or gameplay completion.

If hardware/browser/tool access prevents a required check, mark that criterion unverified and pursue available verification routes. Continue other unblocked work, but do not report the full goal complete with an unverified release gate.

## 9. Finish Git delivery and clean up safely

Keep reviewable commits and PRs linked to issues. Before final merge, inspect the full diff, assets/licenses, secrets exposure, instruction consistency, tests, and recorded findings. Run the complete verification suite on the integrated release candidate, wait for required remote CI, and address failures.

Merge through the repository's allowed workflow without bypassing protection or fabricating approvals. After merge, update the canonical checkout safely to the final default-branch commit, rebuild, and smoke-test the exact merged application. Verify the remote contains it and required checks are green. Fix any post-merge regression before declaring completion.

Delete only task-created local/remote feature branches and temporary worktrees after confirming their work is merged or otherwise preserved, their working directories are clean, and evidence has been retained. Account for squash merges when checking preservation. Never delete the default branch, canonical checkout, user-owned branches/worktrees, the reference demo, saves, or uncommitted files. Stop only task-owned processes and agent sessions.

Leave the app running from the canonical checkout on an available local port when the execution environment permits. Verify the URL responds and identify the serving process. Do not claim a server will persist after the host session ends unless that persistence is actually supported.

## 10. Persistence, blockers, and final report

Keep moving until the goal is complete or an actual external blocker prevents further progress. An intermediate milestone or a long task is not a completion condition. Use a native durable-goal/continuation facility only if it exists and can actually be activated in this environment.

Before a context/runtime limit, preserve task work and update the parent GitHub issue with the exact commit/branch/worktree, completed acceptance IDs, outstanding defects, commands/results, and the next executable step. Use these project records rather than changing unrelated global memory behavior. Distinguish “paused/blocked with a resumable handoff” from “complete.” Never claim to continue running after execution has stopped.

Request user input only for a genuinely non-resolvable blocker, missing authority, or a material change to these requirements. Do not make unauthorized purchases or silently cut scope to avoid a blocker.

At completion, provide the playable local URL and controls; final commit and merged PR; parent goal issue; acceptance and test results; measured performance and asset/load figures; screenshots and gameplay recordings; and confirmation of task-branch/worktree cleanup. Disclose any remaining limitations accurately. No invented tests, human approvals, model usage, or completion claims.

Start now: inspect the local repository and reference demo, correct the project instructions, establish the GitHub goal and acceptance matrix, delegate bounded work, and build through final verification and delivery.

---

## Official technical references to verify during implementation

Use documentation matching the installed versions; the following are starting points, not permission to assume API compatibility:

- Three.js models/animation: `https://threejs.org/docs/pages/GLTFLoader.html`
- Three.js materials: `https://threejs.org/docs/pages/MeshStandardMaterial.html`
- Three.js renderer/backends: `https://threejs.org/docs/pages/WebGPURenderer.html`
- Rapier character movement: `https://rapier.rs/docs/user_guides/javascript/character_controller/`
- Playwright screenshots/video/traces: `https://playwright.dev/docs/test-use-options`
- Codex subagents and model configuration, when this is the installed CLI: `https://developers.openai.com/codex/multi-agent`
