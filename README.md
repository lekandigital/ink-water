# Puddle

A full-page, overhead Three.js water background with monochrome ink and graphite drawing.

The application was restored from `0124a476f6abcfc07976b1556cf27947c19f01c3` before later features were ported onto it. The restoration commit uses that commit’s exact tree. Current main before restoration is preserved on `backup/main-before-0124-restore-20261004-f1e534f`. `scripts/0124-base.json` records the Git blob hashes of 63 unchanged base files, including the solver, geometry, optics, classic drawing and Print shader.

Based on https://github.com/jeantimex/threejs-water at commit `f35a700a16fe386beac997806ed4471018c93ef7`.
The upstream Water.ts, Renderer.ts, rendering modules, water modules, and original shaders are copied unchanged. The original 256×256 GPU heightfield, drop function, normals, caustics, and mesh generation remain intact. Each 60 Hz application tick invokes the source's two wave steps. An additional open-water pass absorbs outgoing waves at the edges after each step, while preserving the source update in the interior.

The original square pool option is used with width=1, length=1, depth=0.7. Its water mesh remains PlaneGeometry(2, 2, 200, 200). A camera pointed vertically down crops the square surface to fill every viewport corner. The canvas covers the full page, with floating controls above it.

Hairline ripples are optional and start off. Each source drop creates a group of four concentric circular strokes that expand from the actual impact point. Their outward motion and shared amplitude envelope are calibrated by running the unchanged upstream drop and wave shaders for nine drop sizes; `src/WaveProfile.ts` stores those measurements and shader hashes. The same impacts and simulation-step clock drive the actual water and the drawing, so pause, rain, dragging, and clearing stay synchronized. Beyond the calibration interval, a continuation uses the measured speed, cylindrical spreading, and source damping. The trailing rings appear smoothly, and the entire group fades together. There are no mirrored centers or returning strokes. Every stroke keeps a constant screen-space width and one opacity value around its entire circumference, so it does not split into fragments or shrink into small ovals.

The open-water pass uses an outgoing radiation condition at the outermost cells and a smooth 40-cell damping zone. Three distinct render targets preserve the previous and predicted states without texture feedback. This suppresses reflections in Original and the artistic contour view as well as in Hairline ripples. The boundary is an approximation to a large body of water, not an exact infinite-domain solution.

This continuous drawing is an artistic wave-front representation. It preserves circular wave groups rather than drawing every instantaneous crest of the superposed heightfield. Interference can change the topology of those exact crests; preserving them exactly cannot also guarantee that they never split. **Original** displays the actual simulated surface and interference with the new open edges. All views retain the upstream geometry and interior wave equations.

Turn **Hairline ripples** off for the artistic ink contours, including the comic bitmap texture in Etching with Dark paper. With the new experiments off, the existing appearance is preserved. Ink wash, etching and graphite use monochrome paper and ink values; Original shows the original optical shading. Every appearance control changes rendering only; drawing buffers never feed into the simulation.

## Print experiments

All experiments start off and can be combined:

- **Bitmap ripples** replaces the drawn ripple stroke with bands of printed marks.
- **Texture reveal** keeps a faint print on the paper and makes it clearer where waves pass, without drawing the normal stroke.
- **Printed paper** adds a quiet bitmap across the full water background while keeping the existing ripples.
- **Refract the print** bends the print using the actual simulated surface normals.

Choose Comic dots, Stipple, or Pixels (ordered Bayer dithering). **Tune the print** controls print scale, wave contrast, background print opacity, wave band width, and texture bend. Scale and band width use CSS pixels so their size stays consistent on Retina displays. The print is deterministic and stationary unless refraction is enabled; there is no frame-random noise or texture flicker.

Hairline mode uses soft bands around the same continuous concentric wave geometry. With Hairline ripples off, reveal bands follow the same source height contours as the existing drawing. In both cases the effect follows the existing wave positions, and uses the same simulation clock. Original bypasses print effects. Controls remain editable in every view; selecting Original does not erase settings.

## Light and caustics

**Caustics** starts on and enables the source's focused light below the surface. Its bright regions need not coincide with the surface ripple crests: the original shader refracts light through the water and projects it onto the floor. The source light calculation is preserved. The startup preset uses direction 170°, height 90°, and strength 200%.

**Light & caustics** provides light direction, light height, an Overhead light toggle, and Glow strength. Direction and height change the actual light supplied to all source optical passes, without changing wave physics. Overhead light reduces the sideways displacement. Glow strength scales the original caustic intensity while retaining its positions and shadow channel; at 100%, this additional presentation pass is bypassed.

**Align glow to ripples** selects the restored artistic surface glow. Original retains projected caustics. Overhead light and alignment can be configured independently; toggling either does not reset the other or the light sliders. An already vertical light has no appreciable change when Overhead is switched on; lower Light height to compare its projection.

## Startup and reset

The startup preset is separate from the implementation base: Etching, Light paper, Fine line weight (0.68), non-hairline drawing, every Print experiment off, Comic dots, Caustics on, alignment and overhead off, direction 170°, height 90°, glow 200%, rain off with rainfall at minimum, Medium touch (0.038), and simulation running. All later experiments start off. Speed and ripple scale are 100%; rain and touch retain the restored distributions and force.

**Reset to defaults** restores this entire preset. **Still the water** only clears the two heightfield buffers, continuous wave marks, pending gesture and rain disturbance accumulator. It preserves every appearance, light, motion, rain, and pause setting, and temporarily holds rain so the surface can settle.

## Bitmap experiments on normal water

Keep all **Print experiments off** for the original non-print ripple style. The independent Bitmap pass layers styling onto that drawing and its ordinary projected caustics:

- **Comic bitmap** applies ordered tonal dithering to the existing water and caustics.
- **Caustic texture reveal** makes faint dots clearer using the difference between screen-aligned renderings with and without the real projected caustic texture.
- **Water-bent grain** distorts a quiet dot and grain layer with the actual water normals.
- **Soft diffusion** blends neighboring drawing samples while preserving the ripple and caustic structure.

These can be combined without enabling Print mode or disabling Caustics. All operate on presentation buffers and never feed into the source simulation. Print retains its original shader as a separate system. At zero bitmap contrast or on completely still water, some effects may intentionally have little visible difference.

**Caustic ripples** is the intentional exception: the real projected caustic shapes become the drawn ink pattern, with projected lighting turned off. Leaving this mode restores the prior Caustics setting. Turning ordinary Caustics on leaves caustic-ink mode. No other switches reset unrelated settings.

## Optional motion

**Dreamy** slows the source clock and adds soft diffusion. **Subtle** reduces impact force and drawing contrast independently; both can be enabled together. **Gentle motion** gives a further optional slowdown and lighter rain and touch. Sliders independently set wave speed, ripple scale, rain force and touch force. Each 100% value retains the restored behavior; changes only apply when used. Slow motion interpolates previous and current states for viewing in separate buffers. The interpolation never enters the solver and is bypassed at neutral speed.

**Hide reflected sun** is a reversible optional rendering change. When off, the original optical shader is used verbatim.

The controller binds native `input` events before graphics initialization, commits validated state once and schedules rendering outside the input event. UI changes remain responsive while paused and during loading. Checkbox state is synchronized only when different. There are no silent drawing-mode, alignment, light or slider resets. Read-only `get_water_state` exposes actual application settings; the hidden `water-state` output reports controls and the last rendered pipeline for browser regression checks.

This is the upstream linear heightfield wave model, not a calibrated Navier–Stokes solver. It does not model full fluid flow, wetting, capillary dispersion, overturning surfaces, droplets or breaking waves. The repo's rounded-pool boundary is an optical boundary; its underlying simulation remains a rectangular heightfield.

## Run

Node 20+:

```
npm ci
npm run dev
```

## Build

```
npm run check
npm run build
```

The complete static application is in dist/. Serve that directory with an HTTP server. All application code and scene textures are bundled locally. A font request has a system-font fallback.

## Vercel

This repository is connected to Vercel; every push to `main` deploys the application. `vercel.json` sets `npm ci` as the install command, `npm run check && npm run build` as the build command, and `dist` as the output directory. No environment variables are required.

## Interaction

Click, touch, or drag inside the water to create ripples. Gestures draw immediately, including when animation is paused or throttled. Space toggles pause even with a slider, checkbox or button focused. H hides/shows controls. C, X and / replay fixed screen-space paths, sample spacing and timing; the application places samples on deterministic simulation ticks. Pausing freezes the sequence, pressing a gesture again restarts its path, and Still cancels it. Shortcuts leave text editing and modified key combinations alone.

`npm test` verifies the 63 exact base file hashes, the separate startup preset, every switch through off/on/off/on at the DOM/controller level, all 20 sliders, no unrelated resets, reset versus still, independent Dreamy/Subtle, the source clock and rain distribution, deterministic gesture replay, and mouse and touch routing, pointer capture failure, drag cancellation, full viewport coverage, real Three.js coordinate projection, collisions with the shader helpers injected by the installed Three.js release, finite grayscale palette uniforms, concentric stroke expansion and whole-wave fading, safe rotation of the boundary render targets, finite experiment settings, exact default light preservation, and the caustic intensity pass's default bypass. The palette test reproduces the invalid color call that previously made drawing modes solid red.

The optional GPU regression renders the actual instanced stroke geometry and shaders into a half-float buffer with maximum blending. It checks that each wave stays a single closed connected ring and keeps the same shape as it fades, across three line widths and two pixel ratios, including near-zero opacity. With Python's `moderngl`, `numpy`, and `scipy` installed:

```
node scripts/verify-continuous-waves.mjs --export /tmp/water-strokes.json
node scripts/verify-shader-integration.mjs --export /tmp/water-three-helpers.glsl
python scripts/verify-continuity-gpu.py /tmp/water-strokes.json /tmp/water-three-helpers.glsl
python scripts/verify-open-water-gpu.py
```

The open-water GPU check runs the actual source and boundary shaders for center, side, and corner impacts. It verifies that the interior update is unchanged and that late returning wave energy is reduced by more than 99% relative to the closed pool. Energy measures velocity and spatial height gradients, so a constant residual height offset is not mistaken for a returning ripple.

The independent bitmap GPU regression compiles and renders the actual restored geometry, water solver, normal drawing, Print shader and bitmap shader. It checks 63 bitmap variants, reversible effect cycles, unchanged source bytes, normal bitmap plus projected caustics with Print off, slow-motion interpolation, and the startup vertical-light preset:

```
node scripts/export-bitmap-gpu.mjs /tmp/water-bitmap-fixtures
python scripts/verify-bitmap-gpu.py /tmp/water-bitmap-fixtures
```

These EGL checks and DOM/controller tests do not substitute for a real WebGL browser visual test.

To regenerate the source drop-response calibration, run `python scripts/generate-wave-profile.py`. The generator executes the original GPU shaders; it never edits them.

## Credits

Original WebGL Water: Evan Wallace, 2011.
Three.js port: Yong Su (jeantimex), 2026.
Source and sky/tile assets reused from the upstream repository; MIT license retained in LICENSE. The original README credits tile texture to zooboing on Flickr: https://www.flickr.com/photos/zooboing/463635680/ .
