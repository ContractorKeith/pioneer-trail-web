# Frame scheduling investigation

The observed 1 FPS periods are consistent with an environment scheduling problem. The evidence does not establish an exact compositor cause. A CPU probe found no crossing-specific slowdown; a subsequent headless hardware GPU probe maintained approximately 60 FPS at all three sampled positions. These are diagnostics, not a completed campaign or performance acceptance result.

## CPU probe

One low-quality RiverValley world, seed 14 with a river and 317 physical obstacles, was measured without WebGL. Each fixed pose received 100 warmup and 300 measured ticks at a simulated 60 Hz. Propulsion was identical; channel current was 0.8 at z120/z132 and zero at z20. Scene matrix updates were measured separately. All cases had zero collisions.

| Median CPU milliseconds   | Spawn (z20) | Channel (z120) | Failure area (z132) |
| ------------------------- | ----------: | -------------: | ------------------: |
| `MotionWorld.drive`       |    0.014417 |       0.016458 |            0.015042 |
| `world.update`            |    0.027167 |       0.024667 |            0.023876 |
| `scene.updateMatrixWorld` |    0.041042 |       0.041167 |            0.041125 |

The channel medians total about 0.082 ms, far below the roughly 954 ms frame reported during the failed browser crossing. This narrow probe excludes rendering, browser scheduling, and complete frame costs. It cannot prove GPU performance. [Raw CPU timings](../../../.artifacts/tmp/crossing-cpu-profile.json) retain means, p95 values, and maxima.

## Browser probes

The root operator ran 20-second fixed-pose windows at 1280×720, low graphics, on Mesa AGX G13/G14. Every sampled DOM state remained visible, focused, and unpaused. FPS columns below count frames in consecutive five-second windows; the total can include a final sample just beyond 20 seconds.

| Launch                  | Position z | Frames | FPS in each five-second window |
| ----------------------- | ---------: | -----: | ------------------------------ |
| Headed                  |         80 |    312 | 59, 1.2, 1, 1                  |
| Headed                  |        120 |   1200 | 60, 60, 60, 59.8               |
| Headed                  |        132 |    229 | 42.6, 1, 1, 1                  |
| Headed repeat           |         80 |    106 | 17.8, 1, 1, 1                  |
| Headless GPU with video |         80 |   1197 | 60, 60, 60, 59                 |
| Headless GPU with video |        120 |   1201 | 60, 60, 60, 60                 |
| Headless GPU with video |        132 |   1201 | 60, 60, 60, 60                 |

[Headed raw frames](../../../.artifacts/river-scheduling.json) report `ANGLE (Mesa, AGX G13/G14, OpenGL 4.6)`. [Headless GPU raw frames](../../../.artifacts/river-headless-video.json) report `ANGLE (Mesa, AGX G13/G14, OpenGL ES 3.2)`. These ignored local artifacts must be retained alongside exported evidence.

During the headed investigation, the root operator observed Chromium PID 2227957 on Hyprland workspace 7. The monitor initially displayed workspace 7, then displayed workspace 1 during later 1 Hz periods. This supports investigating an inactive Xwayland surface being throttled despite DOM visibility/focus. Workspace transitions and frame timestamps were not continuously correlated, and the two launch modes used different GL backends. The experiment therefore does not isolate a single cause. No gameplay change follows from this hypothesis alone.

## Reproducible opt-in

The campaign, continuous ride, visual capture, and cold-load scripts accept `TRAIL_HEADLESS_GPU=1`. They then launch headless Chromium with `--ozone-platform=x11 --enable-gpu`; their default remains headed. Chromium documents that [`--enable-gpu` permits hardware autodetection in headless mode](https://chromium.googlesource.com/chromium/src/+/main/docs/gpu/using-gpu-hardware-in-headless-chrome.md). The flag itself is not hardware proof: inspect each report's actual renderer, browser version, client viewport, and launch options. The continuous ride additionally records CDP GPU feature status.

All four reports retain `browserLaunch`. Campaign and ride reports also record the SHA-256 and size of every local production build file, plus an aggregate build hash and source status. The ride independently compares served response hashes with that manifest; the resumed campaign, capture and load tools now also verify actual served response bytes against that manifest before crediting their reports.

The three short static windows do not replace the full normal campaign, ten-minute soak, continuous 120-second moving ride, or browser acceptance tests. Those runs require their own reports and remain separate gates.
