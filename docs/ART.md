# Scene art

The three original environment backgrounds in `public/scenes/` were generated
with the built-in OpenAI image-generation tool for this project, then converted
to WebP with ImageMagick (`quality=70`, `method=6`). They are intended as
full-bleed, 16:9 game scenes.

| Asset         | Prompt summary                                                                                                           | Output                    |
| ------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------- |
| `trail.webp`  | An 1848 covered wagon travelling through rutted dust in a golden-hour valley, with a winding river and distant pines.    | 1599 × 900, 171,428 bytes |
| `camp.webp`   | First-person seated camp at blue hour: small fire, canvas wagon to the left, pine trees, mountains, and stars.           | 1599 × 900, 140,648 bytes |
| `snow.webp`   | First-person snowy mountain pass with a weathered wagon ahead, alpine pines, mist, falling snow, and a lantern.          | 1599 × 900, 162,108 bytes |
| `repair.webp` | First-person wagon repair: work-worn hands and an iron wrench at a broken wooden wheel and axle in sunlit prairie grass. | 1600 × 900, 179 KB        |
| `talk.webp`   | First-person fireside conversation with two period-plausible adult fellow travelers, covered wagon, and pines at dusk.   | 1600 × 900, 111 KB        |

All prompts required natural/cinematic realism, period-plausible 1840s trail
details, and no lettering, logos, watermarks, modern objects, or references to
existing characters or artwork. Source PNG renders are retained in
`docs/art-source/`; only the optimized WebP files in `public/scenes/` ship at runtime.

The repair and conversation scenes were generated with the built-in image tool,
then resized to 1600 × 900 and converted with ImageMagick WebP quality 72.
