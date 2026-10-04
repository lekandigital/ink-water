# Puddle

A full-page, overhead Three.js water background with fine monochrome wave lines.

Based on https://github.com/jeantimex/threejs-water at commit `f35a700a16fe386beac997806ed4471018c93ef7`.
The upstream Water.ts, Renderer.ts, rendering modules, water modules, and original shaders are copied unchanged. The original 256×256 GPU heightfield, drop function, normals, caustics, and mesh generation remain intact. Each 60 Hz application tick invokes the source's two wave steps. This makes timing consistent with the original demo at 60 fps without altering solver equations or coefficients.

The original square pool option is used with width=1, length=1, depth=0.7. Its water mesh remains PlaneGeometry(2, 2, 200, 200). A camera pointed vertically down crops the square surface to fill every viewport corner. The canvas covers the full page, with floating controls above it.

Hairline ripples are enabled by default. A small presentation-only Gaussian filter and bicubic interpolation smooth the displayed height and velocity without changing the simulation; a phase detector traces stationary wave crests with downward acceleration with an antialiased stroke measured in screen pixels. It avoids the multiple isoheight bands of the earlier drawing pass. The image can still show interacting wave fronts and reflections from the original simulation's rectangular boundaries.

Turn **Hairline ripples** off to compare the earlier ink contours. **Caustics** independently enables the original focused light map. Both toggles change rendering only, and no drawing buffer is fed into the simulation. Ink wash, etching and graphite use monochrome paper and ink values; Original shows the original optical shading. Caustics start off for a clean paper background.

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

`npm test` checks mouse and touch routing, pointer capture failure, drag cancellation, full viewport coverage, real Three.js coordinate projection, and collisions with the shader helpers injected by the installed Three.js release.

## Credits

Original WebGL Water: Evan Wallace, 2011.
Three.js port: Yong Su (jeantimex), 2026.
Source and sky/tile assets reused from the upstream repository; MIT license retained in LICENSE. The original README credits tile texture to zooboing on Flickr: https://www.flickr.com/photos/zooboing/463635680/ .
