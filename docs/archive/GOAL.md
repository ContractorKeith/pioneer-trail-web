> Historical document: superseded by the first-person 3D rebuild specification. These are earlier-release claims, not evidence for R01–R16.

# Build goal

Ship a beautiful, complete localhost-playable Pioneer Trail webapp in the public
ContractorKeith/pioneer-trail-web repository. Preserve the original Rust simulation and
historical setting while modernizing graphics, sound and interaction. Produce a static
Cloudflare Pages build suitable for trail.contractorkeith.com later; deployment is deferred.

## Acceptance

- The original sim/data source runs in WebAssembly, preserving seeded command outcomes.
- Setup, outfitting, travel, pace/rations, inventory, health/treatment, encounters, forks,
  rivers, hunting, gathering/fishing, repairs, conversations, letters, journal and endings work.
- Cinematic trail scenery and first-person activities cover camp, hunt, fish, river, snow,
  conversation and wagon repair with contextual sound and accessible controls.
- Browser autosave/resume and save export/import preserve a journey including pending decisions.
- Responsive desktop/mobile interface, keyboard operation, sound toggle, reduced motion,
  and a non-WebGL fallback. No interaction depends solely on pointer accuracy.
- Production build, lint, sim tests, deterministic bridge checks, complete journey checks,
  browser interaction tests and visual review pass. Fix review findings before closing issues.
- Commit and push all scoped work; repo public; localhost left running with URL documented.

## Design

An editorial field journal meets a cinematic landscape: warm ivory paper, dark pine green,
burnished brass accents, large restrained serif type, panoramic scenery and compact trail HUD.
The trail remains in the 1800s. Modernization concerns presentation and usability.
Three.js supplies interactive depth and atmospheric effects; original landscape art supplies
visual richness. No enormous open world or multiplayer backend.

## Work loop

1. Research the original interfaces and record an exact source baseline.
2. Open bounded GitHub issues with acceptance checks and independent team ownership.
3. Implement lanes, integrate, test and visually inspect real browser flows.
4. Open/rework issues for failures; rerun the relevant checks until acceptance is met.
5. Review the full project, push, verify CI/public visibility and close completed issues.

## Technical evidence

- [Cloudflare Pages Vite build](https://developers.cloudflare.com/pages/framework-guides/deploy-a-vite3-project/): npm run build, output dist.
- [wasm-pack web target](https://wasm-bindgen.github.io/wasm-pack/book/commands/build.html): native ES module with explicit WASM initialization.
- [Three.js documentation](https://threejs.org/docs/): browser 3D renderer and scene primitives.
