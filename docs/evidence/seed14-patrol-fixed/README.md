# Seed-14 wildlife separation retest

The targeted production recapture completed on 2026-09-08 with no reported application or capture errors. A normal keyboard walking route reached `(-19.9600, 1.5772, 80.0086)`, west of the stopped wagon. The camera then remained fixed for approximately 21 seconds while both deer continued their patrols. The earlier [failed capture](../seed14-patrol-review/README.md) remains preserved.

```sh
TRAIL_HEADLESS_GPU=1 node scripts/capture-activities.mjs \
  --case seed14-bank-wildlife --output docs/evidence/seed14-patrol-fixed
```

The existing command-generated daylight-river fixture supplies campaign seed 11; the disclosed saved spatial recipe selects RiverValley and region index 3, yielding world seed 14. The wagon is driven from ordinary spawn20 to the bank, then `walkPlanned` uses real keyboard movement against the physical world. No camera, actor, obstacle, or simulation-time setter is used. This is an isolated recipe reproduction, not a played Big Blue arrival or the exact original animation timestamp.

- [Report](report.json): served-response verification passed for build SHA-256 `b1ee3cee7ffda1698c8fdfa718613bd06c1773dd37ec4b47d10c6cb6d31d4a57`. The report includes the local file manifest and source identity; its base commit is `5ec9d8951dbd39317a1db5668797e6eb0197c8a6` with the working-tree wildlife correction included in the verified build.
- Actual environment: Chromium `151.0.7922.137`, hardware renderer `ANGLE (Mesa, AGX G13/G14, OpenGL ES 3.2)`, 1280×720, low graphics, device scale 1. The supported headless GPU path is recorded in the report. This capture is not a performance benchmark.
- Walking-view stills: [start](seed14-trunk-and-dry-patrol.png), [6-second observation](seed14-full-body-patrol-6.png), [12-second observation](seed14-full-body-patrol-12.png), [18-second observation](seed14-full-body-patrol-18.png). The observation labels are loop intervals; the report retains actual timestamps.
- [Gameplay excerpt](../../../.artifacts/videos/seed14-patrol-fixed-2026-09-08T14-50-45-840Z-seed14-bank-wildlife.webm): 45.536 seconds requested, including the walk followed by the fixed view. Video offsets are approximate. SHA-256 `5b64a800fb2b3e1d55685c9eb314467a1ea9a86bf99169bc404f2316aa923192`.
- [Original recording](../../../.artifacts/videos/page@8565c6fe9f83ccaa5e4f6850417e4127.webm): SHA-256 `18ba07417e80f578af54a2880792598525f0c6476418e3737d972f045d8de50e`.

The capture author inspected all four walking-view stills. Deer-3 is partially cropped by the left frame edge in the first still; the later three show its full body, with deer-2 and the preserved trunk across the clearing. The camera adjustment changes only the evidence view. Independent video review supplies the targeted visual verdict; this report does not declare overall R14 completion.

Script syntax, scoped lint, and `git diff --check` passed. The prior failed capture's report retained SHA-256 `c729a2ca24af048d115b562dfa9c371a02f536e988edbdfe41851dc085e745cc` before and after this retest.
