# Technical notes

The [README](../README.md) is the short version. This is the long one: where the code came from, what was restored and verified, how each layer works, and how it is tested.

## Upstream base

Ink Water is based on [jeantimex/threejs-water](https://github.com/jeantimex/threejs-water) at commit `f35a700a16fe386beac997806ed4471018c93ef7`, Yong Su's Three.js port of Evan Wallace's [WebGL Water](https://madebyevan.com/webgl-water/).

The upstream `Water.ts`, `Renderer.ts`, rendering modules, water modules and original shaders are copied unchanged. The original 256×256 GPU heightfield, drop function, normals, caustics and mesh generation remain intact. Each 60 Hz application tick invokes the source's two wave steps. An additional open-water pass absorbs outgoing waves at the edges after each step, while preserving the source update in the interior.

## Restoration from `0124a47`

The application was restored from `0124a476f6abcfc07976b1556cf27947c19f01c3` before later features were ported onto it. The restoration commit uses that commit's exact tree. The `main` branch from before the restoration is preserved on `backup/main-before-0124-restore-20261004-f1e534f`.

`scripts/0124-base.json` records the Git blob hashes of 63 unchanged base files, including the solver, geometry, optics, classic drawing and Print shader. `npm test` fails if any of them changes by a single byte, so every later feature in this repository is a layer on top of that base rather than an edit to it.

## Geometry and camera

The original square pool option is used with width=1, length=1, depth=0.7. Its water mesh remains `PlaneGeometry(2, 2, 200, 200)`. A camera pointed vertically down crops the square surface to fill every viewport corner. The canvas covers the full page, with floating controls above it.

## Open-water boundary

The open-water pass uses an outgoing radiation condition at the outermost cells and a smooth 40-cell damping zone. Three distinct render targets preserve the previous and predicted states without texture feedback. This suppresses reflections in Original and the artistic contour view as well as in Hairline ripples. The boundary is an approximation to a large body of water, not an exact infinite-domain solution.

The open-water GPU check (below) runs the actual source and boundary shaders for center, side and corner impacts. It verifies that the interior update is unchanged and that late returning wave energy is reduced by more than 99% relative to the closed pool. Energy measures velocity and spatial height gradients, so a constant residual height offset is not mistaken for a returning ripple.

## Hairline ripples

Hairline ripples are optional and start off. Each source drop creates a group of four concentric circular strokes that expand from the actual impact point. Their outward motion and shared amplitude envelope are calibrated by running the unchanged upstream drop and wave shaders for nine drop sizes; `src/WaveProfile.ts` stores those measurements and shader hashes. The same impacts and simulation-step clock drive the actual water and the drawing, so pause, rain, dragging and clearing stay synchronized. Beyond the calibration interval, a continuation uses the measured speed, cylindrical spreading and source damping. The trailing rings appear smoothly, and the entire group fades together. There are no mirrored centers or returning strokes. Every stroke keeps a constant screen-space width and one opacity value around its entire circumference, so it does not split into fragments or shrink into small ovals.

This continuous drawing is an artistic wave-front representation. It preserves circular wave groups rather than drawing every instantaneous crest of the superposed heightfield. Interference can change the topology of those exact crests; preserving them exactly cannot also guarantee that they never split. **Original** displays the actual simulated surface and interference with the open edges. All views retain the upstream geometry and interior wave equations.

To regenerate the source drop-response calibration, run `python scripts/generate-wave-profile.py`. The generator executes the original GPU shaders; it never edits them.

## Drawing modes

Turn **Hairline ripples** off for the artistic ink contours, including the comic bitmap texture in Etching with Dark paper. With the newer experiments off, the existing appearance is preserved. Ink wash, Etching and Graphite use monochrome paper and ink values; Original shows the original optical shading. Every appearance control changes rendering only; drawing buffers never feed into the simulation.

## Print experiments

All experiments start off and can be combined:

- **Bitmap ripples** replaces the drawn ripple stroke with bands of printed marks.
- **Texture reveal** keeps a faint print on the paper and makes it clearer where waves pass, without drawing the normal stroke.
- **Printed paper** adds a quiet bitmap across the full water background while keeping the existing ripples.
- **Refract the print** bends the print using the actual simulated surface normals.

Choose Comic dots, Stipple or Pixels (ordered Bayer dithering). **Tune the print** controls print scale, wave contrast, background print opacity, wave band width and texture bend. Scale and band width use CSS pixels so their size stays consistent on Retina displays. The print is deterministic and stationary unless refraction is enabled; there is no frame-random noise or texture flicker.

Hairline mode uses soft bands around the same continuous concentric wave geometry. With Hairline ripples off, reveal bands follow the same source height contours as the existing drawing. In both cases the effect follows the existing wave positions and uses the same simulation clock. Original bypasses print effects. Controls remain editable in every view; selecting Original does not erase settings.

## Light and caustics

**Caustics** starts on and enables the source's focused light below the surface. Its bright regions need not coincide with the surface ripple crests: the original shader refracts light through the water and projects it onto the floor. The source light calculation is preserved. The startup preset uses direction 170°, height 90° and strength 200%.

**Light & caustics** provides light direction, light height, an Overhead light toggle and Glow strength. Direction and height change the actual light supplied to all source optical passes, without changing wave physics. Overhead light reduces the sideways displacement. Glow strength scales the original caustic intensity while retaining its positions and shadow channel; at 100%, this additional presentation pass is bypassed.

**Align glow to ripples** selects the restored artistic surface glow. Original retains projected caustics. Overhead light and alignment can be configured independently; toggling either does not reset the other or the light sliders. An already vertical light has no appreciable change when Overhead is switched on; lower Light height to compare its projection.

## Floor lines

With caustics on, the drawing modes used to outline a rectangle: the projected caustic map covers only the source pool floor, and the walls beyond it stayed unlit. In Ink wash, Etching and Graphite (`src/FloorLinePresentation.ts`):

- refracted view rays continue to an open floor that keeps the source tile, light and caustic shading, with the caustic lookup continued past the source floor's edge;
- reflected rays reach the sky instead of the pool rim;
- two short, faint lines lie on that floor near the top and bottom of the view, on the former pool edge when it is visible. Each is about one CSS pixel thick, darkens the floor by 35%, and stays under a third of the screen width at any aspect ratio. Because they are seen through the moving surface, ripples visibly bend them.

The change is applied when the shader compiles, like **Hide reflected sun**, and each replaced fragment must match exactly once, so a changed upstream shader fails loudly instead of silently. Original keeps the source shader verbatim, and the 63 restored base files are unchanged.

## Bitmap experiments on normal water

Keep all **Print experiments** off for the original non-print ripple style. The independent Bitmap pass layers styling onto that drawing and its ordinary projected caustics:

- **Comic bitmap** applies ordered tonal dithering to the existing water and caustics.
- **Caustic texture reveal** makes faint dots clearer using the difference between screen-aligned renderings with and without the real projected caustic texture.
- **Water-bent grain** distorts a quiet dot and grain layer with the actual water normals.
- **Soft diffusion** blends neighboring drawing samples while preserving the ripple and caustic structure.

These can be combined without enabling Print mode or disabling Caustics. All operate on presentation buffers and never feed into the source simulation. Print retains its original shader as a separate system. At zero bitmap contrast or on completely still water, some effects may intentionally have little visible difference.

**Caustic ripples** is the intentional exception: the real projected caustic shapes become the drawn ink pattern, with projected lighting turned off. Leaving this mode restores the prior Caustics setting. Turning ordinary Caustics on leaves caustic-ink mode. No other switches reset unrelated settings.

## Motion and the independent rain field

**Dreamy** slows the source clock and adds soft diffusion. **Subtle** reduces impact force and drawing contrast independently; both can be enabled together. **Gentle motion** gives a further optional slowdown and lighter rain and touch. Sliders independently set wave speed, ripple scale, rain force and touch force. Each 100% value retains the restored behavior; changes only apply when used. Slow motion interpolates previous and current states for viewing in separate buffers. The interpolation never enters the solver and is bypassed at neutral speed.

**Dreamy rain speed** starts off. Enable it in Motion & force for a smooth, slowly varying rain pace, about 42–86% at neutral speed. Rain uses another instance of the unchanged source solver and boundary, with its own simulation clock. Touch, drag and deterministic gestures always advance at 100% while this option is on; the existing speed, Dreamy and Gentle motion settings then set the rain pace. Forces, sizes, drawing, bitmap and lighting preferences remain independent. The view adds the two heightfields and recomputes normals from the sum for ordinary drawing and projected caustics. Neither presentation buffer feeds back into the running solvers. Disabling the option merges existing rain waves into the ordinary solver without clearing them. Pause and Still apply to both fields. The neutral/off path retains the original single solver.

**Hide reflected sun** is a reversible optional rendering change. The published startup preset turns it on (the original specification had it off). When off, the original optical shader is used verbatim.

## Startup preset, Still and Reset

The startup preset is separate from the implementation base: Etching, Dark paper, Comic bitmap on, Hide reflected sun on, Fine line weight (0.68), non-hairline drawing, every Print experiment off, Comic dots, Caustics on, alignment and overhead off, direction 170°, height 90°, glow 200%, rain off with rainfall at minimum, Medium touch (0.038), and simulation running. The other later experiments start off. (The original specification in PROMPT.md started on Light paper with the sun visible and Comic bitmap off.) Speed and ripple scale are 100%; rain and touch retain the restored distributions and force.

**Reset to defaults** restores this entire preset. **Still the water** only clears the heightfields (including the optional independent rain field), continuous wave marks, pending gesture and rain disturbance accumulator. It preserves every appearance, light, motion, rain and pause setting, and temporarily holds rain so the surface can settle.

## Controls and interaction

Click, touch or drag inside the water to create ripples. Gestures draw immediately, including when animation is paused or throttled. Space toggles pause even with a slider, checkbox or button focused. H hides/shows controls. C, X and / replay fixed screen-space paths, sample spacing and timing; the application places samples on deterministic simulation ticks. Pausing freezes the sequence, pressing a gesture again restarts its path, and Still cancels it. Shortcuts leave text editing and modified key combinations alone.

The controller binds native `input` events before graphics initialization, commits validated state once and schedules rendering outside the input event. UI changes remain responsive while paused and during loading. Checkbox state is synchronized only when different. There are no silent drawing-mode, alignment, light or slider resets. Read-only `get_water_state` exposes actual application settings; the hidden `water-state` output reports controls and the last rendered pipeline for browser regression checks.

## Capture mode and social assets

`?capture=1` is a deterministic recording harness (`src/CaptureMode.ts`). Before the water starts it replaces the page clock, animation frames and random source, hides the interface and exposes a small API for settings, touches, gestures and Still. The simulation code is unchanged, and normal startup never enters this path.

`npm run social` builds the app, drives headless Chrome one exact 60 Hz frame at a time and encodes the launch video, the loop, the README GIFs and the social preview with ffmpeg. Timelines live in `scripts/social/sequences.mjs`. Per-frame hashes are written to `.capture/`; two runs of the same sequence produce byte-identical frames. It needs Google Chrome (or `INK_WATER_CHROME` pointing at another Chromium) and ffmpeg with libx264.

The published assets use Etching with Comic bitmap, the reflected sun visible and Gentle rain on at Rainfall 1.6. Dark paper is the main version; each asset has a Light twin with the same touches and rain positions.

## Tests

`npm test` verifies the 63 exact base file hashes, the separate startup preset, every switch through off/on/off/on at the DOM/controller level, all 20 sliders, no unrelated resets, Still versus Reset, independent Dreamy/Subtle, the source clock and rain distribution, deterministic gesture replay, and mouse and touch routing, pointer capture failure, drag cancellation, full viewport coverage, real Three.js coordinate projection, collisions with the shader helpers injected by the installed Three.js release, finite grayscale palette uniforms, concentric stroke expansion and whole-wave fading, safe rotation of the boundary render targets, finite experiment settings, exact default light preservation, and the caustic intensity pass's default bypass. The palette test reproduces the invalid color call that previously made drawing modes solid red. It also checks that the floor-line patch applies to the real water shader and leaves Original verbatim, and that capture mode stays off unless requested.

The optional GPU regression renders the actual instanced stroke geometry and shaders into a half-float buffer with maximum blending. It checks that each wave stays a single closed connected ring and keeps the same shape as it fades, across three line widths and two pixel ratios, including near-zero opacity. With Python's `moderngl`, `numpy` and `scipy` installed (the checks use an EGL context, so they run on Linux):

```
node scripts/verify-continuous-waves.mjs --export /tmp/water-strokes.json
node scripts/verify-shader-integration.mjs --export /tmp/water-three-helpers.glsl
python scripts/verify-continuity-gpu.py /tmp/water-strokes.json /tmp/water-three-helpers.glsl
python scripts/verify-open-water-gpu.py
```

The independent bitmap GPU regression compiles and renders the actual restored geometry, water solver, normal drawing, Print shader and bitmap shader. It checks 63 bitmap variants, reversible effect cycles, unchanged source bytes, normal bitmap plus projected caustics with Print off, slow-motion interpolation, and the startup vertical-light preset:

```
node scripts/export-bitmap-gpu.mjs /tmp/water-bitmap-fixtures
python scripts/verify-bitmap-gpu.py /tmp/water-bitmap-fixtures
```

The independent rain GPU check compiles the composition shader with the actual fullscreen vertex shader, runs the untouched source solver and boundary for full-speed touch and slower rain, and verifies height/velocity addition, recalculated normals and stroke-mask composition:

```
python scripts/verify-rain-gpu.py
```

These EGL checks and DOM/controller tests do not substitute for a real WebGL browser visual test. The capture pipeline is one: it renders the real app in Chrome on the GPU.

## Build and deployment

```
npm ci
npm run check
npm run build
```

The complete static application is in `dist/`. Serve that directory with an HTTP server. All application code and scene textures are bundled locally. A font request has a system-font fallback.

`vercel.json` sets `npm ci` as the install command, `npm run check && npm run build` as the build command, and `dist` as the output directory. No environment variables are required.

The built page loads its script, styles and textures by relative path, so it can live under a subpath. For the public site it is built with `INK_WATER_BASE=/ink-water/ npm run build`, which adds `<base href="/ink-water/">` to the page so every relative URL, including the textures the script loads, resolves under `/ink-water/` however the page is reached. Without the variable the build is unchanged and works from `/`.

The public copy lives at https://demo.1001ud.me/ink-water/, served as static files by the 1001ud demo site (`lekandigital/1001ud-demo-me`). That repository's `npm run sync:ink-water` builds this repository with the base above and copies `dist/` into its `public/ink-water/`, recording the source commit in `SOURCE.txt`. Its request proxy redirects `/ink-water` to `/ink-water/`, so the address keeps its trailing slash.

## Limitations

This is the upstream linear heightfield wave model, not a calibrated Navier–Stokes solver. It does not model full fluid flow, wetting, capillary dispersion, overturning surfaces, droplets or breaking waves. Evan Wallace says the same of the original: "The focus was on the rendering aspect, not on the simulation, so the behavior of the water isn't that realistic." The repo's rounded-pool boundary is an optical boundary; its underlying simulation remains a rectangular heightfield.

## Assets and credits

Source and sky/tile assets are reused from the upstream repository, with the MIT license retained in [LICENSE](../LICENSE). `public/assets/tiles.jpg` is byte-identical to the texture in Evan Wallace's original repository; both upstream projects credit it to [zooboing on Flickr](https://www.flickr.com/photos/zooboing/3682834083/). It appears in Original mode.
