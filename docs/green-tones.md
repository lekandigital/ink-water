# The Solid Doctor green tones

The Paper selector now offers **Light · Silver · Dark · Green Light · Green Dark**. The original three palettes and the startup Dark tone are unchanged. Green is an additional choice, not a new drawing mode.

## Reference and palette

The attached label was inspected at its original 1534 × 1304 resolution. Sampling excluded the black surround, spindle hole and label edges. The unprinted paper varies from mint to sage because of lighting and printing: its median is `#9FC3A5`, its lighter left-hand patch is `#AACDB2`, and a right-hand patch is `#93BA9C`. The median dark green printed ink is `#144A32`. These measured colors, rather than the earlier approximate list, establish the themes.

Reference image SHA-256: `cdc53e22465f70d268bbf392992f451d7f2a211ca34755ed4bbe104a016ce9b3`.

| Role | Green Light | Green Dark |
| --- | --- | --- |
| Paper / water background | `#AACDB2` | `#144A32` |
| Ink / principal text | `#144A32` | `#AACDB2` |
| Secondary text | `#2B583F` | `#93BA9C` |
| Borders / slider tracks / off switches | `#51735B` | `#70957D` |
| Switch interior | `#ABCEB4` | `#1C543C` |
| Selected control background | `#144A32` | `#AACDB2` |
| Selected control text | `#AACDB2` | `#144A32` |

Green Light uses the label's lighter mint so subtle water marks have room to show. Green Dark reverses the same paper/ink pair, keeping forest green as the dominant background. The intermediate UI shades are restrained derivatives, with the sampled right-hand sage used for dark secondary text. No new texture was added: the existing etching, grain, comic bitmap and print treatments supply the printed character.

Measured contrast is 5.88:1 for both paper/ink pairs, at least 4.70:1 for secondary text against its paper, and 3.06:1 for the control tracks and borders. The controls retain their existing translucent paper background. The five choices wrap into two rows at current panel widths; the original three remain together on the first row.

## Implementation

- `DrawingPalette.ts` extends the existing tone registry and `Tone` type. It retains the existing Three.js uniform objects and direct display-RGB upload path. The same paper and ink uniforms reach ordinary drawing, bitmap treatments, Print experiments and the submerged reference marks.
- `WaterControls.ts` validates against that registry instead of a three-name list. Palette clicks use the existing state transition and preserve all other controls. Reset still restores the existing Dark startup preset.
- `ToneChrome.ts` applies the green paper/ink pair to the existing concentric favicon design and sets the browser theme color. Returning to Light, Silver or Dark restores the exact original metadata. Repeated slider changes do not recreate the favicon.
- CSS supplies the added green UI tokens for the header, controls, focus outlines, switches, sliders, loading and error states. Existing theme rules are unchanged.

No water solver, geometry, animation loop, camera, rain path, renderer or GLSL shader was changed. Original mode keeps its existing photographic optical rendering; the new colors apply wherever paper tones already apply.

## Validation

`npm run check`, `npm test` and `npm run build` pass. The palette test freezes all three legacy values, checks finite green RGB uploads and UI/render consistency, and retains the earlier red-screen regression. The controls test cycles through all five tones, checks selection and published state, verifies browser chrome restoration, and ensures tone changes preserve other settings and slider behavior.

The original 0124 hash manifest is unchanged. The base-preservation check continues to hash all 62 other source files exactly; for the palette file it removes only the explicit green declarations and comment changes before checking the retained original code against its original hash. Thus the existing palette entries and uniform upload implementation remain protected as well.

The EGL regression compiles the real source geometry, physical water solver, drawing, Print and bitmap shaders. All 105 bitmap variants pass, including both greens across Ink wash, Etching and Graphite. Grayscale equality remains required for legacy tones; green pixels must stay near the selected paper-to-ink ramp, allowing the existing grain and byte quantization. Presentation effects leave the simulated source bytes unchanged. All 23 existing saved GPU frames match the pre-change baseline byte for byte.

To reproduce the GPU check with Python's `moderngl`, `numpy`, `scipy` and Pillow installed:

```sh
node scripts/export-bitmap-gpu.mjs /tmp/ink-water-green-fixtures
python scripts/verify-bitmap-gpu.py /tmp/ink-water-green-fixtures
```

This palette extension was developed on `theme/solid-doctor-green`, from main at `223881b986da872c6bb40bafd9a48f2cddb11727`. The existing grayscale themes and startup defaults remain unchanged.
