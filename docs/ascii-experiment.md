# ASCII water experiment

Branch: `experiment/ascii-water`, based on `3e2dfef99ee5b825584faf7e913bab73776547d8`.

The existing water simulation, pointer input, fixed timestep, independent rain
field, absorbing boundaries, normals and caustic generation are unchanged.
`AsciiWaterPresentation` adds a final fullscreen GPU pass that reads the displayed
heightfield and original scene. It never writes to any simulation target and does
not consume `Math.random`, so seeded rain retains its original sequence.

The visual reference is [ASCII Sharks](https://github.com/stackedlol/ascii-sharks)
by stackedlol, inspected at `c521e24`. This experiment independently implements
the same tall character-cell proportions, black grid, cool gray blocks, sparse
edge marks, `:;t%SX8#@` density ramp, cyan wake dots and occasional colored glints.
It does not include the shark/boid simulation or copy its renderer source.

ASCII is on by default. Press **A** or the **ASCII** button to compare with the
original drawing without resetting the water. `?ascii=0` starts with the original
view. The controls also provide character size and a colored-glints switch.
Click, drag, rain, Space, H and the C/X/slash gestures keep their existing behavior.

The water settings remain owned by `WaterControls`; ASCII controls belong to the
presentation and cannot modify speed, impulses or the rain clock.
