# Puddle

An overhead Three.js water study with a dreamy monochrome drawing pass.

Based on https://github.com/jeantimex/threejs-water at commit `f35a700a16fe386beac997806ed4471018c93ef7`.
The upstream Water.ts, Renderer.ts, rendering modules, water modules, and original shaders are copied unchanged. The original 256×256 GPU heightfield, drop function, normals, caustics, and mesh generation remain intact. Each 60 Hz application tick invokes the source's two wave steps. This makes timing consistent with the original demo at 60 fps without altering solver equations or coefficients.

The original rounded-pool option is configured as a circle using its supported dimensions: width=1, length=1, radius=1, depth=0.7. Its water mesh remains PlaneGeometry(2, 2, 200, 200). The camera is a PerspectiveCamera pointed vertically down with up=(0,0,-1); there are no orbit controls.

Ink wash, etching, and graphite use a separate full-screen drawing pass. It reads the original scene render, heightfield and normals and uses monochrome paper and ink values. It does not feed anything back into the physics. Drawn styles substitute a subtle grayscale material texture; Original restores the repo's tile texture and unstyled render.

Source geometry is enabled by default. Turning it off clips the rendered image to an irregular puddle silhouette. It does not change the solver, meshes, or physical boundary, and should not be interpreted as physically correct reflections at that new outline. This distinction is disclosed in the interface.

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

`npm test` checks mouse and touch routing, pointer capture failure, drag cancellation, and real Three.js coordinate projection at desktop and mobile viewport sizes.

## Credits

Original WebGL Water: Evan Wallace, 2011.
Three.js port: Yong Su (jeantimex), 2026.
Source and sky/tile assets reused from the upstream repository; MIT license retained in LICENSE. The original README credits tile texture to zooboing on Flickr: https://www.flickr.com/photos/zooboing/463635680/ .
