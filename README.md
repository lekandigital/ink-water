# Puddle

A full-page, overhead Three.js water background with fine monochrome wave lines.

Based on https://github.com/jeantimex/threejs-water at commit `f35a700a16fe386beac997806ed4471018c93ef7`.
The upstream Water.ts, Renderer.ts, rendering modules, water modules, and original shaders are copied unchanged. The original 256×256 GPU heightfield, drop function, normals, caustics, and mesh generation remain intact. Each 60 Hz application tick invokes the source's two wave steps. An additional open-water pass absorbs outgoing waves at the edges after each step, while preserving the source update in the interior.

The original square pool option is used with width=1, length=1, depth=0.7. Its water mesh remains PlaneGeometry(2, 2, 200, 200). A camera pointed vertically down crops the square surface to fill every viewport corner. The canvas covers the full page, with floating controls above it.

Hairline ripples are enabled by default. Each source drop creates a group of four concentric circular strokes that expand from the actual impact point. Their outward motion and shared amplitude envelope are calibrated by running the unchanged upstream drop and wave shaders for nine drop sizes; `src/WaveProfile.ts` stores those measurements and shader hashes. The same impacts and simulation-step clock drive the actual water and the drawing, so pause, rain, dragging, and clearing stay synchronized. Beyond the calibration interval, a continuation uses the measured speed, cylindrical spreading, and source damping. The trailing rings appear smoothly, and the entire group fades together. There are no mirrored centers or returning strokes. Every stroke keeps a constant screen-space width and one opacity value around its entire circumference, so it does not split into fragments or shrink into small ovals.

The open-water pass uses an outgoing radiation condition at the outermost cells and a smooth 40-cell damping zone. Three distinct render targets preserve the previous and predicted states without texture feedback. This suppresses reflections in Original and the artistic contour view as well as in Hairline ripples. The boundary is an approximation to a large body of water, not an exact infinite-domain solution.

This continuous drawing is an artistic wave-front representation. It preserves circular wave groups rather than drawing every instantaneous crest of the superposed heightfield. Interference can change the topology of those exact crests; preserving them exactly cannot also guarantee that they never split. **Original** displays the actual simulated surface and interference with the new open edges. All views retain the upstream geometry and interior wave equations.

Turn **Hairline ripples** off to compare the earlier ink contours, including the comic bitmap texture in Etching with Dark paper. This drawing shader and texture treatment are preserved. **Caustics** independently enables the original focused light map. Both toggles change rendering only, and no drawing buffer is fed into the simulation. Ink wash, etching and graphite use monochrome paper and ink values; Original shows the original optical shading. Caustics start off for a clean paper background.

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

Click, touch, or drag inside the water to create ripples. Gestures draw immediately, including when animation is paused or throttled. A touch opts into motion after an automatic reduced-motion pause; a manual pause remains in effect. Space toggles pause, and H hides the controls.

`npm test` checks mouse and touch routing, pointer capture failure, drag cancellation, full viewport coverage, real Three.js coordinate projection, collisions with the shader helpers injected by the installed Three.js release, finite grayscale palette uniforms, concentric stroke expansion and whole-wave fading, and safe rotation of the boundary render targets. The palette test reproduces the invalid color call that previously made drawing modes solid red.

The optional GPU regression renders the actual instanced stroke geometry and shaders into a half-float buffer with maximum blending. It checks that each wave stays a single closed connected ring and keeps the same shape as it fades, across three line widths and two pixel ratios, including near-zero opacity. With Python's `moderngl`, `numpy`, and `scipy` installed:

```
node scripts/verify-continuous-waves.mjs --export /tmp/water-strokes.json
node scripts/verify-shader-integration.mjs --export /tmp/water-three-helpers.glsl
python scripts/verify-continuity-gpu.py /tmp/water-strokes.json /tmp/water-three-helpers.glsl
python scripts/verify-open-water-gpu.py
```

The open-water GPU check runs the actual source and boundary shaders for center, side, and corner impacts. It verifies that the interior update is unchanged and that late returning wave energy is reduced by more than 99% relative to the closed pool. Energy measures velocity and spatial height gradients, so a constant residual height offset is not mistaken for a returning ripple.

To regenerate the source drop-response calibration, run `python scripts/generate-wave-profile.py`. The generator executes the original GPU shaders; it never edits them.

## Credits

Original WebGL Water: Evan Wallace, 2011.
Three.js port: Yong Su (jeantimex), 2026.
Source and sky/tile assets reused from the upstream repository; MIT license retained in LICENSE. The original README credits tile texture to zooboing on Flickr: https://www.flickr.com/photos/zooboing/463635680/ .
