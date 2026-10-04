# The build prompt

This is the working specification used while rebuilding Ink Water.

It accumulated over several iterations, so it is intentionally specific: part design brief, part implementation specification, and part regression test.

It began on 3 October 2026 as one line — "give me a three js water simulation what's extremely accurate and uses this repo but i want the option for it to almost look like it's drawn in black and white" — and grew through a day of back-and-forth. The version below is the consolidated spec written on 4 October, after the restoration of `0124a47`. It is reproduced as written, including the project's working name at the time, `puddle-water-study`.

Final project: [demo.1001ud.me/ink-water](https://demo.1001ud.me/ink-water/)

---

Rebuild my **Three.js monochrome top-down water study** end-to-end in this repo:

[https://github.com/lekandigital/puddle-water-study](https://github.com/lekandigital/puddle-water-study)

The original water reference is:

[https://jeantimex.github.io/threejs-water/](https://jeantimex.github.io/threejs-water/)

The goal is a beautiful, dreamy, full-screen water simulation viewed **perfectly straight down**, as though looking at the surface of a large body of water. The underlying water should remain physically derived from the original Three.js heightfield/wave simulation, while the presentation can look like graphite, ink, etching, comic printing, dithering, or monochrome illustration.

## Foundation — this is critical

First preserve the current `main` on a backup branch/tag.

Then make this commit the **actual implementation base**, not merely a visual reference:

`0124a476f6abcfc07976b1556cf27947c19f01c3`

Restore the real application tree from that commit and build forward from it.

Do **not** take the newest code and tweak it until it resembles the old version. I specifically want `0124a47` to be the foundation because I like its ripple appearance, motion, scale, interaction feel, and water behavior.

Keep the restored water solver and base implementation intact wherever possible. Newer features should sit on top as optional presentation/control layers. With all newer options disabled, the application should fundamentally still be the restored `0124a47` water.

The water fills the **entire viewport**. There should be no puddle-shaped container and no conspicuous wall-return/edge echoes that make the surface feel like a small tank. It should feel like the disturbance is occurring within a much larger body of water.

## Default visual configuration

Fresh load and “Reset to defaults” should use:

- Drawing: **Etching**
- Paper: **Light**
- fine line weight
- preferred **non-hairline** ripple appearance
- Print experiments: **all off**
- Print pattern: **Comic dots**
- projected **Caustics: on**
- Align glow to ripples: **off**
- Overhead light: **off**
- Light direction: **170°**
- Light height: **90°**
- Glow strength: **200%**
- Gentle rain: **off**
- Rainfall: **off / minimum**
- Touch size: **Medium**
- Simulation: **running**
- Hide reflected sun: **off**
- no visible light-source-circle indicator
- newer experimental effects neutral/off

The normal Etching water with Print experiments completely off is the visual foundation I like most.

## Preserve and add these controls

Keep controls for drawing style, paper, line weight, caustics/light settings, rain, touch size/force, rain force, wave speed, ripple scale, and the useful tuning controls from the later versions.

Add **Dreamy** and **Subtle** as independent toggles. They must work individually and together.

Keep standard wave speed at **100% by default**.

Add an optional **Dreamy rain speed** toggle. When enabled, rain-generated waves should gently and organically vary in speed over time—sometimes noticeably slower—to create a dreamy effect. It should not just randomly jitter every frame; use smooth, slowly varying modulation.

Crucially, **click/drag/touch-generated waves always propagate at 100% speed**, even while Dreamy rain speed is active. Rain and user disturbances therefore need sufficiently independent timing/clock handling that slow rain can coexist with a normal-speed touch ripple.

## Bitmap aesthetics — two separate systems

Do NOT conflate these.

### Print experiments

Keep the existing experimental print system available:

- Bitmap ripples
- Texture reveal
- Printed paper
- Refract the print

Include Comic dots / stipple / pixel-dither options and relevant scale, contrast, width, faintness controls.

These are experimental and default OFF.

### Bitmap experiments for normal water

Separately create bitmap treatments that operate **on the normal non-print Etching/Ink/Graphite rendering while preserving real projected caustics**.

Include:

- **Comic bitmap** — comic/dither tonal styling over the ordinary water
- **Caustic texture reveal** — a faint bitmap field becomes clearer/stronger where the actual projected caustic pattern occurs
- **Water-bent grain** — subtle bitmap/grain distorted using the actual simulated water normals/displacement
- **Soft diffusion** — gently diffuses the drawing while retaining ripple and caustic structure

These must be presentation/post-process layers only. They must not feed back into the simulation.

I want to be able to run:

**ordinary Etching water + ordinary ripples + projected Caustics + Comic bitmap**

with every Print experiment turned OFF.

Do not make normal Bitmap experiments automatically disable caustics.

Feel free to add a few especially beautiful bitmap/dither treatments if they follow this same principle.

## Caustic ripples

Keep **Caustic ripples** as a special separate ripple style.

In this mode only:

- turn off ordinary projected caustic lighting
- use the calculated caustic shapes themselves as the drawn/ink ripple pattern

It is intentionally mutually exclusive with ordinary projected Caustics.

That exclusivity must **not** apply to the ordinary Bitmap experiments.

## Interaction and comparison shortcuts

Interactions should feel smooth on mouse, touch, click and drag.

Keep:

- `Space` — pause/resume simulation
- `H` — hide/show controls
- `C` — replay a deterministic C-shaped disturbance gesture
- `X` — replay a deterministic X-shaped disturbance gesture
- `/` — replay a deterministic slash gesture

The C/X/slash path, duration, spacing, force and timing must be exactly repeatable every time so they can act as visual benchmarks when comparing styles.

Space must work even when a control currently has focus.

## State behavior

Provide two clearly different actions:

**Still the water**

- clear all current disturbances/waves
- preserve every appearance setting, toggle, slider and lighting value

**Reset to defaults**

- restore the startup configuration listed above

Toggling one feature must never silently reset unrelated controls.

Sliders should remain editable regardless of whether an effect is currently enabled where practical.

## Quality constraints

Avoid the rendering problems encountered in earlier iterations:

- no broken circular ripple fragments caused merely by stylization
- no strange little oval/bubble fragments used as a substitute for waves
- no accidental red-screen/color-overflow rendering
- no shader helper-name collision with Three.js injected GLSL functions such as `luminance`
- no interaction where touching appears to do nothing
- no visual effects modifying the underlying simulation data unless the user intentionally changes speed/force controls

The result should feel monochrome, elegant, slightly surreal and dreamy—but still unmistakably like moving water.

## Required testing

Do not merely check that event handlers exist.

For **every toggle**, test:

`off → on → off → on`

and confirm all three layers each time:

1. visible UI switch state changes
2. internal application state changes
3. rendered output actually changes appropriately

Test this for Caustics, Dreamy, Subtle, Dreamy rain speed, every normal Bitmap effect, every Print experiment, Caustic ripples, Overhead light, Align glow, rain, Hide reflected sun, and every other switch.

Verify sliders both before and after toggling effects.

Verify Dreamy + Subtle together.

Verify all keyboard shortcuts.

Verify Still vs Reset behavior.

Verify normal Bitmap effects work while:

- Print experiments are OFF
- normal caustics are ON

Verify touch waves remain 100% speed while Dreamy rain speed produces slower/variable rain waves.

Validate shaders in the actual Three.js environment so injected GLSL helpers are accounted for.

Run the production build and regression tests.

Compare the deployed assets/build with the local production build.

## Delivery

Implement the project completely, not as pseudocode.

Preserve the old `main`, restore `0124a47`, layer these features onto it, commit the work, push the finished result to `main`, and verify the Vercel deployment.

Do not claim live water rendering was visually verified if the testing browser lacks WebGL; distinguish control/state tests, GPU/shader tests, and actual browser-render tests honestly.

The final result should feel like a **monochrome water study / interactive artwork**, not a generic Three.js demo: physically grounded water underneath, dreamy printmaking/etching aesthetics above it, and enough precise controls to explore the visual space without compromising the original water behavior.
