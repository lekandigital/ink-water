# Marumari rain prototype

This experiment interprets **Marumari — “birch beer forest”** using one supplied recording. It lives on `experiment/marumari-rain-sync`, based on `main` at `223881b986da872c6bb40bafd9a48f2cddb11727`. Existing drawing, demo assets, capture tools, defaults and water shaders are preserved.

## Try it

From the existing Mac checkout:

```sh
cd /Users/lekan/Dev/ink-water
git fetch origin
git switch experiment/marumari-rain-sync
npm ci
npm run dev
```

Open `http://localhost:4173`. Press **H** to show the controls, turn **Music Sync** on, then press Play in the audio player. Native audio controls provide pause, volume and seeking. **Restart** returns to the beginning, preserving whether playback was running or paused. Playback is never automatic.

Music mode starts **Off**. Enabling it replaces ordinary rainfall scheduling, including when Gentle rain is off. The ordinary Rainfall slider retains its setting for when music mode is disabled; the score chooses density in music mode. Rain force and Ripple scale continue multiplying the physical impacts, and the existing Gentle motion, Dreamy, Subtle and Dreamy rain speed options still apply. Touches and C/X/`/` gestures continue to work.

The first eight seconds deliberately have no new rain. For a quick comparison, seek to just before **0:36.525**, **1:58.422** or **2:30.256**.

Audio Pause stops new musical impacts while existing waves continue moving. **Space**, or the existing water Pause button, freezes the simulation and pauses audio together; resuming water resumes audio only if it had been playing. **Still the water** clears physical waves and keeps every setting and playback position. Its existing 1.8-second rain hold also applies to music; events crossed during that hold are discarded. **Reset to defaults** additionally switches this experiment Off.

## Inputs and interpretation

`public/music/marumari-full-analysis.json` is the supplied primary analysis, preserved byte-for-byte. It contains 256 beats, 559 onsets and 2,278 continuous feature samples. The estimated tempo is 107.666 BPM. Decoding the supplied MP3 gives 211.487 seconds, matching the JSON; no synchronization offset has been added. The recording is also preserved byte-for-byte, under the simpler name `public/music/marumari-birch-beer-forest.mp3`.

The original supplementary passage ranking and both analysis scripts are preserved in `music/reference/`. They do not run in the browser. The MP3 and JSON SHA-256 hashes are recorded in the score and checked by the test suite.

`public/music/marumari-rain-score.json` is the **artistic interpretation**, separate from those inputs. Its 12 sections describe density, strength, scale and broad spatial bias, with notes explaining the choices. Its 14 accents use actual onset timestamps. No raindrop coordinates are authored.

| Song time | Measured structure | Rain interpretation |
| --- | --- | --- |
| 0:00–0:36.525 | Quiet opening; energy gradually gathers; tracked rhythm has not entered | Stillness, then sparse small flecks |
| 0:36.525–1:38.522 | First tracked beat introduces a bass-rich rhythmic body | Irregular showers with a restrained beat-phase pulse |
| 1:38.522–1:58.422 | Darker bass-rich pocket; strong onset at 1:58.422 follows a 1.974-second onset gap | Fewer, heavier impacts; briefly reduce rain before the selected accent |
| 1:58.422–2:38.243 | Busier, brighter late passages | More frequent fine rain, with selected heavier anchors; the low-band accent at 2:30.256 gets extra weight |
| 2:38.243–3:01.835 | Sustained higher-energy body | A fuller shower rather than a direct loudness-to-density mapping |
| 3:01.835–3:31.487 | Tracked rhythm and bass recede; energy fades | Sparse rain, then no new drops in the final tail |

These choices come from numerical inspection of the full JSON and decoded recording, including low-band spectral energy around selected onsets. They have not yet been adjusted through an audible listening session here. The older 12.5-second rankings only supported the choice of busier late sections.

## Runtime architecture

1. `MusicRainPlayer` supplies the audio element's **currentTime** and rebases on play, pause, restart and seek. No independent song clock accumulates elapsed time.
2. `MarumariRainScheduler.updateMusicRain(currentTime)` emits only events crossed since the last supplied song time. It has no DOM, audio-player, renderer or water dependency. A later YouTube adapter can supply the same time and seek notifications.
3. `main.ts` passes those events to `emitRain`, the same method used by ordinary rainfall: existing `randomPoint` → existing `rainImpulse` → existing `addDrop` route.
4. With Dreamy rain speed enabled, drops enter `RainWaveLayer` while touches stay in the primary field. Otherwise rain enters the primary field. The existing source heightfield solver updates height and velocity, derives normals and projected caustics, and supplies the existing ink renderer.

The score establishes weather across longer passages. Smoothed energy, brightness and onset activity add bounded detail; actual beat intervals softly modulate arrival probability. Only a minority of already selected arrivals are nudged toward nearby onsets. Beats and onsets do not each generate a drop.

Background arrivals are irregular and seeded in song time, giving the same temporal score across frame rates and restarts. This score produces **137 physical impacts**, including the 14 selected accents. Locations and the existing per-drop radius/force variation remain generative on every playback. Small spatial biases move a broad rain field; they do not prescribe points. Music only schedules physical impacts and never writes a surface displacement or a presentation layer.

Pausing and seeking create no catch-up burst. Explicit seeks rebase immediately; unannounced backward jumps or gaps over half a second also skip missed events. Seeking does **not** reconstruct the wave history at the destination: existing waves continue naturally. Use Still the water for a clean surface before a comparison. A severely throttled/backgrounded tab may skip impacts rather than discharge a backlog upon return.

When music is Off, no music assets are requested on fresh load. The original rain accumulator, random sampling order, force distribution and independent Dreamy rain clock are unchanged. No shader, solver or drawing mode was changed for this experiment.

## Validation

```sh
npm run check
npm test
npm run build
```

The existing checks passed before the experiment and pass afterward. The new `scripts/verify-music-rain.mjs` checks input hashes, all sections and selected accents, irregular arrivals, identical scheduling at 30/60/144 FPS, pause/resume/restart/seeking, mode Off/On/Off/On, asynchronous loading cancellation, reset behavior and restoration of normal rain. It exercises the application bridge using the actual source Water and RainWaveLayer materials and verifies that both kinds of rain invoke the original physical drop shader with the expected strength and radius. The original 63-file source preservation test still passes.

The automated media tests inject audio time and native event semantics. They are not a substitute for an audible artistic review or a real WebGL browser playback run. The production build includes the recording, source analysis and score at the same relative URLs used in development, including the existing subpath build configuration.
