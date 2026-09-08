# Pioneer Trail Web

Immersive browser presentation of Pioneer Trail, retaining its deterministic Rust simulation.
The separate original terminal project is not modified. See docs/GOAL.md for acceptance.

## Architecture
- React + TypeScript + Vite for the interface; Three.js for interactive first-person scenery.
- engine/ contains the original simulation/content and a small WASM bridge. Game rules stay in Rust.
- src/ owns presentation, browser persistence and audio. Cosmetic randomness never enters the simulation.
- Static dist/ deploys to Cloudflare Pages. No server, accounts, API keys or paid services required.

## Rules
- Preserve original game commands, costs, seeded RNG streams and content. Do not rebalance to suit the UI.
- Original source: ContractorKeith/pioneer-trail commit c44bfea0651fc70a16d92d8c8449c6f3e6f9df38.
- Keep UI usable with keyboard/touch, reduced motion and muted sound. Disclose real action costs.
- GitHub issues are the work tracker. Close only with implementation and verification evidence.
- Agent commits use ContractorKeith only, conventional format, no coauthors or tool credits.
- Do not run automatic project-memory checkpoints; user has disabled them.

## Checks
Run npm run build, npm run lint, npm test, browser acceptance and Rust tests before completion.
Use npm run dev for localhost; npm run build:engine rebuilds the checked-in WebAssembly module.
