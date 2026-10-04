# Launch

Everything needed to post Ink Water: the media, the copy, and what is still to do. Nothing here has been posted.

Public demo: **https://demo.1001ud.me/ink-water/**

## Media

Dark paper is the primary presentation. Each Light file is the same sequence (same touches, gestures and rain positions) on light paper.

| Use | File | Format |
|---|---|---|
| Main post (native video) | `assets/ink-water-launch.mp4` | 1920×1080, 60 fps, H.264 High, 12.5 s, 12.6 MB |
| Aesthetic follow-up | `assets/ink-water-loop.mp4` | 1920×1080, 60 fps, H.264 High, 7 s seamless loop, 2.1 MB |
| README hero | `assets/ink-water.gif` | 960×540, 15 fps, 7 s loop, 4.0 MB |
| Social card / Open Graph | `public/social.jpg` | 1280×640 JPEG, 0.13 MB |
| Light alternate | `assets/ink-water-launch-light.mp4` | as the main video, 12.9 MB |
| Light alternate | `assets/ink-water-loop-light.mp4` | as the loop, 2.2 MB |
| Light alternate | `assets/ink-water-light.gif` | as the README GIF, 4.2 MB |

**The launch video:** about 0.8 s of the Original pool with ripples already moving, a hard cut to Etching on the same water, gentle rain, a touch at 4 s, the C gesture at 6 s and X at 8.5 s, then rain and interference until it ends, still in motion. No UI, text or cursor.

**Settings in every asset:** the startup settings (Etching, Fine line, projected caustics at 170° / 90° / 200%), Hide reflected sun **off**, Gentle rain **on** at Rainfall 1.6, and the faint floor lines (about 1 CSS px, 35% darkening). Re-render with `npm run social`; the timelines are in `scripts/social/sequences.mjs`. Rendering the same sequence twice gives byte-identical frames, so re-rendering won't change these files unless the code or the timelines do.

Older renders are kept outside the launch set at `~/Dev/ink-water-demo-v1/` and tag `demo-v1`. Don't use them.

## Copy

No hashtags. Links go in the replies, not the main post.

### Main post — attach `assets/ink-water-launch.mp4`

```
i wanted simulated water to look drawn instead of rendered

so i kept the water simulation underneath and started treating the surface like ink on paper

this is ink water
```

### First self-reply

```
ink water — a water study

play with it: demo.1001ud.me/ink-water
source: github.com/lekandigital/ink-water
```

The source link only works once the repository is renamed and public (see the checklist). Until then it is private at `lekandigital/puddle-water-study`.

### Lineage reply

```
one of my favorite parts is the lineage of this

Evan Wallace made the original WebGL water experiment around 2010, before Figma existed. Yong Su / jeantimex ported and extended it in Three.js this year. i started from that and tried pushing the rendering in the opposite direction from realism

16 years of people messing with the same water
```

Alternate with the verified mention:

```
one of my favorite parts is the lineage of this

Evan Wallace made the original WebGL water experiment around 2010, before Figma existed. Yong Su (@jeantimex) ported and extended it in Three.js this year. i started from that and tried pushing the rendering in the opposite direction from realism

16 years of people messing with the same water
```

Every claim checks out: Wallace's own site dates WebGL Water to 2010; Figma was founded in 2012; Yong Su's port was created in June 2026.

### Process post — optionally attach `assets/ink-water-loop.mp4`

```
the prompt/spec for ink water got completely ridiculous by the end

"keep touch waves at 100% while rain drifts in speed" was somehow one of the requirements

put the whole thing in the repo
```

Self-reply:

```
the working spec, unedited: github.com/lekandigital/ink-water/blob/main/PROMPT.md
```

The quoted line is a paraphrase. The spec's exact words are: "click/drag/touch-generated waves always propagate at 100% speed, even while Dreamy rain speed is active". Keep the quotation marks only if a paraphrase is fine; otherwise use the exact line or drop the quotes.

## X handles

| Person | X | How it was checked |
|---|---|---|
| Yong Su | **@jeantimex** — verified | His GitHub profile ([jeantimex](https://github.com/jeantimex)) declares X handle `jeantimex`, and that X account's website field links back to github.com/jeantimex. Profile: "Maps JavaScript engineer @google", Santa Clara. |
| Evan Wallace | **none verified — don't @mention** | His site ([madebyevan.com](https://madebyevan.com/)) links only Mastodon ([@evanw@hachyderm.io](https://hachyderm.io/@evanw)) and GitHub ([evanw](https://github.com/evanw)); his GitHub profile lists no X account. `@evanwallace` on X is suspended and isn't linked from anything of his. |

## Sources for the lineage

- Evan Wallace, [madebyevan.com](https://madebyevan.com/): "WebGL Water (2010) — This project was an experiment in realtime water rendering with WebGL. The focus was on the rendering aspect, not on the simulation, so the behavior of the water isn't that realistic."
- The demo source and LICENSE carry "Copyright 2011 Evan Wallace", MIT. Both dates are correct: the project dates from 2010, and the published source carries a 2011 copyright.
- Figma, [Figma rendering: Powered by WebGPU](https://www.figma.com/blog/figma-rendering-powered-by-webgpu/), under the heading "The WebGL water demo": "Prior to co-founding Figma, Evan Wallace experimented with WebGL in order to build confidence in the technology." Nothing says the demo itself became Figma, so don't claim it.
- Yong Su, [jeantimex/threejs-water](https://github.com/jeantimex/threejs-water) README: "a complete port of Evan Wallace's WebGL Water demo to Three.js, with significant enhancements including support for Three.js geometries, customizable pool shapes, and GLTF model loading." Credits: "Three.js port by Yong Su (jeantimex)". Repository created 2026-06-22.

## GitHub

Prepared, not applied. Renaming, editing settings and changing visibility all need your go-ahead.

- Name: `lekandigital/ink-water`
- Description: `A water study rendered in ink — interactive Three.js waves, caustics and bitmap drawing.`
- Website: `https://demo.1001ud.me/ink-water/`
- Topics: `threejs`, `webgl`, `creative-coding`, `graphics`, `shaders`, `water`, `simulation`, `generative-art`

```
gh repo rename ink-water --repo lekandigital/puddle-water-study
gh repo edit lekandigital/ink-water \
  --description "A water study rendered in ink — interactive Three.js waves, caustics and bitmap drawing." \
  --homepage "https://demo.1001ud.me/ink-water/" \
  --add-topic threejs,webgl,creative-coding,graphics,shaders,water,simulation,generative-art
```

After a rename, run `git remote set-url origin https://github.com/lekandigital/ink-water.git` in each clone. GitHub redirects the old name, and the Vercel project `puddle-water-study` follows the repository by ID, but check that its next deploy still comes from `main`.

The social preview image has no API or CLI. Upload it by hand: repository **Settings → General → Social preview → Edit → Upload an image…**, choose `public/social.jpg` (1280×640, well under the 1 MB limit).

## Hosting at demo.1001ud.me/ink-water/

Live since 2026-10-04. `demo.1001ud.me` stays with its existing Vercel project, `1001ud-demo-me` (the 1001ud portfolio, repository `lekandigital/1001ud-demo-me`). Ink Water is mounted inside it as static files:

- `npm run sync:ink-water` in that repository builds this one with `INK_WATER_BASE=/ink-water/` and copies `dist/` to its `public/ink-water/`, writing the source commit to `public/ink-water/SOURCE.txt`.
- Its `src/proxy.ts` redirects `/ink-water` to `/ink-water/`. Its `next.config.ts` serves `/ink-water/` from `index.html` and keeps the usual trailing-slash redirect on every other path.
- Pushing that repository's `main` deploys it.

To publish a change to Ink Water: commit it here, run `npm run sync:ink-water` in `~/Dev/1001ud.me/demo`, then commit and push there.

The separate Vercel project `puddle-water-study` is not involved; it still serves the older `d2e99d3` build at its own `vercel.app` address.

## Checklist

1. Push this branch (`ink-water-launch`) to `main`. The live build at `/ink-water/` comes from local commit `83afd8a`, which isn't on GitHub yet.
2. Rename the repository and apply the description, website and topics above.
3. Upload `public/social.jpg` as the GitHub social preview.
4. Check the card with X's post composer or any Open Graph preview tool. The live page, its WebGL rendering, the interactions and `https://demo.1001ud.me/ink-water/social.jpg` are already verified.
5. Make the repository public, with explicit approval at that moment.
6. Post: main video, first self-reply, then the lineage and process replies.
