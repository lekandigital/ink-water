# Water — a monochrome study

A full-page Three.js water background, viewed straight down. The heightfield solver and 40,401-vertex water mesh come from [jeantimex/threejs-water](https://github.com/jeantimex/threejs-water). Etching with Dark paper and caustics is the default. Ink wash, Graphite, Light, Silver, and Original remain available.

Hairline ripples have been removed. The existing surface drawing follows actual simulated height and slope, including interference. With appearance experiments off, its non-hairline rendering is preserved. Original bypasses the drawing effects and shows the same simulated surface and geometry. The reflected sun disc is removed in an application-level material patch; the upstream shader files remain unchanged.

## Motion

The defaults are smaller, softer, and slower: rain averages about 19% of the previous rain force; touch uses about 84% of that previous rain average. Wave speed starts at 32%. Ripple scale starts at 65%, and the camera takes in slightly more of the original surface while filling the entire viewport.

**Motion & force** independently controls wave speed, ripple scale, rain force, and touch force. Rainfall controls frequency separately. Source updates retain the original two solver steps per tick; slow motion changes the number of source ticks per real second. A separate GPU interpolation pass smooths displayed heights and normals between ticks, without feeding anything back into the solver. Rain still arrives on the real-time clock.

The open-water pass uses an outgoing radiation condition at the outermost cells and a smooth 40-cell damping zone. Three distinct solver targets preserve previous and predicted states without texture feedback. This suppresses returning waves throughout all views. It approximates a large body of water rather than an exact infinite domain.

**Dreamy** adds a further slowdown and soft ink diffusion. **Subtle** reduces rain and touch force and lowers drawing contrast. They are independent switches, can be combined, and retain the chosen drawing, bitmap layers, light settings, and simulation. Diffusion radius is adjustable.

## Bitmap experiments

These are separate from Print experiments and layer over the existing drawing, including caustics. All start off; combine any of them:

- **Comic bitmap** renders water and caustics in ordered, dithered shades.
- **Caustic texture reveal** makes faint dots clearer at the real refracted light shapes.
- **Water-bent grain** shifts a quiet bitmap using the simulated water normals.
- **Soft diffusion** gently softens the ink while retaining the original water features.

Tune bitmap scale, tonal steps, contrast, diffusion radius, and caustic ink strength. Bitmap scale and diffusion use CSS pixels. Patterns are deterministic, with no frame-random texture flicker.

## Print experiments

The existing print experiments remain available and can also be combined with the new bitmap layers:

- **Bitmap ripples** replaces ordinary ripple contours with printed marks.
- **Texture reveal** makes a faint print clearer where simulated wave contours pass.
- **Printed paper** adds bitmap texture while keeping ordinary ripples.
- **Refract the print** bends texture using the actual water normals.

Choose Comic dots, Stipple, or Pixels. Controls cover print scale, wave contrast, background opacity, band width, and texture bend. Caustic detail is retained when caustics are enabled, including in the stroke replacement experiments. Original bypasses both experiment groups.

## Caustics and light

**Caustics** uses the original focused-light calculation below the water. Highlights need not coincide with surface crests: the upstream shaders refract light and project it onto the floor. The default light is the original normalized `(2, 2, -1)` direction. Direction, height, Overhead light, and Glow strength remain adjustable. At 100% strength, the intensity presentation pass is bypassed.

**Caustic ripples** is an additional ripple style. It switches caustic lighting off and draws the same calculated caustic shapes as ink instead of ordinary height contours. The original lit and unlit optical scenes are compared at matching screen positions; there is no approximate texture offset. Light controls still adjust these shapes. This style combines with the bitmap layers, Dreamy, and Subtle.

**Align glow to ripples** remains a separate artistic surface effect based on height contours. Original retains projected caustics when enabled. **Reset experiments** turns appearance experiments off and restores the original light, preserving the drawing, paper, motion controls, rainfall, and simulated water.

This is the upstream linear heightfield wave model, not a calibrated Navier–Stokes solver. It does not model breaking waves, spray, overturning surfaces, wetting, or full fluid flow. Appearance buffers never enter a source simulation pass.

## Interaction

Click, touch, or drag to create actual solver impacts. Touches appear immediately, including when paused. A gesture resumes an automatic reduced-motion pause; a manual pause remains respected.

- **Space** pauses or resumes, including while buttons, switches, or sliders have focus.
- **H** hides or shows controls.
- **C**, **X**, and **/** replay the corresponding fixed touch paths with consistent positions and timing. Matching buttons are provided. Gestures use current touch settings and pause with the water. X lifts between strokes.

Shortcuts ignore text editing, modifier combinations, and key repeats. Starting a new gesture replaces the pending gesture. Still the water cancels pending gestures and clears source and interpolation buffers.

## Run, check, and build

Node 20+:

```
npm ci
npm run dev
npm run check
npm test
npm run build
```

The static application is in `dist/`. All code and scene textures are bundled locally. `vercel.json` sets `npm ci`, `npm run check && npm run build`, and `dist`; pushes to `main` deploy through the connected Vercel project.

Tests cover real Three.js coordinate mapping, mouse/touch routing, failed pointer capture, full viewport coverage, installed Three.js shader helper conflicts, grayscale palette regression, motion force ranges, reproducible gesture paths, independent interpolation buffers, safe open boundary buffers, finite experiment settings, original default light, caustic intensity bypass, and application-level sun disc removal. The grayscale test reproduces the invalid color call that previously caused a solid red screen.

An optional GPU regression executes the original wave and open boundary shaders for center, side, and corner impacts. It verifies unchanged interior updates and more than 99% reduction in late returning wave energy compared with the closed pool. With Python `moderngl`, `numpy`, and `scipy` installed:

```
python scripts/verify-open-water-gpu.py
```

## Credits

Original WebGL Water: Evan Wallace, 2011. Three.js port: Yong Su (jeantimex), 2026. Source and sky/tile assets reused under the MIT license retained in `LICENSE`. Upstream credits the tile texture to [zooboing on Flickr](https://www.flickr.com/photos/zooboing/463635680/).
