# Seed-14 patrol recapture

The targeted production capture completed on 2026-09-08 with no reported application or capture errors. A normal walking route moved the eye beyond the oxen to `(-12.5467, 1.5100, 89.8753)`. The fixed view exposes deer-3's full body and the preserved `tree-1-62` trunk at `(-4.00490, 93.80418)`. The original four-case activity report remains unchanged.

Run:

```sh
TRAIL_HEADLESS_GPU=1 node scripts/capture-activities.mjs \
  --case seed14-bank-wildlife --output docs/evidence/seed14-patrol-review
```

The existing command-generated daylight-river fixture supplies campaign seed 11. The disclosed saved spatial recipe selects RiverValley and region index 3, yielding world seed 14. The wagon starts at its normal spawn and is driven to the bank; `walkPlanned` then uses keyboard controls against the actual physical recipe. No actor, camera, terrain, or simulation-time setter is used. This is an isolated recipe reproduction, not a played Big Blue arrival or the exact original animation timestamp.

- [Report and served-response verification](report.json): application build SHA-256 `ff1960aff3e1933b74200f0fb7d21c37ea34f13148af6275b66460e7de5f8b50`, source commit `5ec9d8951dbd39317a1db5668797e6eb0197c8a6`. Every captured response passed its local manifest comparison.
- Actual renderer: `ANGLE (Mesa, AGX G13/G14, OpenGL ES 3.2)`, headless Chromium 151, low graphics, 1280×720, device scale 1. This capture is not a performance benchmark.
- Walking-view stills: [start](seed14-trunk-and-dry-patrol.png), [6-second observation](seed14-full-body-patrol-6.png), [12-second observation](seed14-full-body-patrol-12.png), [18-second observation](seed14-full-body-patrol-18.png). These labels describe the observation loop; actual timestamps are retained in the report.
- [Gameplay excerpt](../../../.artifacts/videos/seed14-patrol-review-2026-09-08T14-36-31-014Z-seed14-bank-wildlife.webm) includes the walk followed by roughly 22 seconds at the fixed viewpoint. Video offsets are approximate, with the original retained. Excerpt SHA-256: `58637311b9d2fe2970641afc142d2095ed2ae0c75155af4e3381891fa8301132`.
- [Original recording](../../../.artifacts/videos/page@aae5329efdd6e37a8f37dabdc8cbba35.webm), SHA-256 `bbb2015405c91be558d159cff56c4b6053d961323f91fcea592144951fcdac9b`.

The capture author inspected the four walking-view stills and confirmed that the oxen no longer hide deer-3's body. The two deer pass close together during this sequence; independent video review should assess that contact and gait. No overall R14 approval is asserted here.

Script syntax, scoped lint, formatting, selector checks, and `git diff --check` passed. Selecting one case without an output option uses a separate report directory; the default invocation still selects all four cases. Unique excerpt filenames preserve earlier clips. The pre-existing `activity-review/report.json` retained SHA-256 `b8ce391e652ffe3521f7604c0c10a5b752e56900964d2e56f9aba91d45212199` before and after this run.
