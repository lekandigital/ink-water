# Authored weather

Music mode replaces **rain scheduling**. Each emitted event goes through `Puddle.emitRain`, the existing `rainImpulse` distribution and either `addDrop` or the existing `RainWaveLayer.addDrop` route. Height, velocity, normals, caustics and ink rendering remain the existing water implementation. Music has no access to a shader, render target or surface-deformation API. Touch retains its independent full-speed path when Dreamy Rain Speed is enabled.

## Data and artistic intent

`data/music/source/` preserves the supplied choreography guide, choreography JSON and raw analysis verbatim. `data/music/analysis/` holds 32 independently measured reference records: decoded duration, SHA-256, half-second energy/brightness/low-frequency activity, adaptive onsets, quiet spaces and transition checks. The supplied raw analysis contains summary measurements, not continuous curves; the added curves were extracted from the actual MP3s. They support decisions and are not a live loudness-to-rain mapping.

`data/music/scores/` has one version-1 full-song score per track. Each records a deterministic seed, artistic direction, contiguous section envelopes, cluster and spatial parameters, selected accents, authored breaths and unchanged recommended/alternate demo windows. Density is group entrances per second; a group can have 1–4 physical impacts. Force and scale multiply the existing rain controls, without changing the solver. Probability decides irregular entrances, not a beat detector. Accents and anticipation provide a few legible phrase arrivals.

`scripts/music/author-scores.py` contains 32 explicit creative profiles. Different songs have different densities, forces, sizes, clustering, pacing and placement languages. Logic1000's 124.55–137.05s excerpt is uniquely restrained before its measured 128.1974s arrival. It is not the template for the other tracks. Sun Tickles has tiny paired glints; Places has separated simultaneous showers; Bromine has repeated complete gaps; Recovery grows force as well as density.

`data/music/manifest.json` separates score identity, cinematic order and playback source. The order is exactly `playlist_order_indices` from the authored choreography. Changing the order never rewrites a score or its seed. Analysis records and local audio do not ship in `dist`; only the manifest and authored scores do.

## Production source verification — currently blocked

The attachment named `ink-water-youtube-source-map.json` was not available. Every production `source` is therefore deliberately `null`. A playlist inventory in `analysis/youtube-playlist-inventory.json` records the 32 IDs YouTube returned on 2026-10-06; **it is not a song mapping**, and runtime playback does not use it to assign scores. No title matching or positional identity guessing is performed.

The current playlist's position 30 is **DEAR DRIVER — NICO**, while the authored order expects **Rider**. Its duration is similar, which cannot establish recording identity. Position 3 is a standalone **Continuum 3**, whereas the earlier source description used an album video at 854 seconds. Do not copy that old offset to a different video. YouTube metadata was available, but media retrieval was blocked; recording equivalence remains unverified for all 32 sources. Full local reference analysis is complete.

Import the actual explicit map:

```sh
python3 scripts/music/import-source-map.py /path/to/ink-water-youtube-source-map.json
npm run music:release-check
npm run music:report
```

The importer accepts a `tracks` or `sources` array with 32 entries, identified by `track_id` or original numbered `track_index`/`index`. It preserves the original input byte-for-byte and fails atomically on unknown identities, duplicate IDs or invalid offsets. It never matches titles. One normalized entry is:

```json
{
  "track_id": "21-continuum-3",
  "artist": "Nala Sinephro",
  "expected_version": "The supplied reference recording",
  "source": {
    "video_id": "ACTUAL_ID_11",
    "source_start_seconds": 854,
    "source_end_seconds": 1101.538866,
    "validation_status": "unverified"
  }
}
```

The example describes the **older album-offset architecture**, not a claim about the current upload. Use its actual mapping and measured offset. Mark `verified` only after checking recording/version and timing against the reference; a duration-only match stays `duration-only`. A source marked `mismatch`, or with a materially different effective duration, holds musical rain while allowing playback. `music:release-check` requires all 32 mappings and verified versions; it currently fails and must pass before release/merge.

## YouTube playlist integration

The default playlist is `PLTab0IXtn0Nw`. After an explicit Play click, the app loads the YouTube IFrame API, creates a visible player and calls `cuePlaylist({listType:'playlist', list: playlistId})`. It does not create a hardcoded video-array playback queue. Play, previous, next and selection use that native queue. The user can enter a new playlist URL/ID under “Choose a track or playlist.”

At readiness, `getPlaylist()` supplies actual video IDs. The app compares them to the explicit source manifest and reports missing expected tracks, unexpected IDs, duplicate IDs and exact order differences in “Playback source check” and the published state. The cinematic order stays unchanged. Reorder YouTube later without changing scores: current **video identity**, not queue position or title, chooses its score.

The player remains visible with a viewport of at least 200×200; custom controls sit adjacent to it. Closing Music destroys the embed. `H` hides the water controls without hiding a playing YouTube player. Capture URLs disallow YouTube playback. Autoplay blocking asks the user to press the actual player's Play control. Errors 100/101/150 mark the actual rejected video unavailable and advance through the native playlist; omitted private items appear as missing expected IDs. Other errors are shown without fabricating rain. At the last item the playlist ends cleanly; Play returns to its first item. The native End event is allowed to settle before any manual advance to avoid double skipping.

Official API and embed requirements: https://developers.google.com/youtube/iframe_api_reference

## Master clock, seeks and source offsets

`RainScheduler.updateMusicRain(currentTime)` is independent of any player. The scheduler plans reproducible generative events from the song seed, using event-local randomness rather than a global RNG. It uses a cursor/binary search for seeks. Forward seeks discard missed events; backward seeks make future events eligible again. Discontinuous clock jumps never emit a backlog. Existing waves are preserved across seek or track change.

`MusicRainEngine` owns the current score. A track change clears only pending scheduling, not water. Async score loading is revision guarded; late samples from the previous native item cannot resurrect that score. Pause/buffering stops new events and rebases the cursor. Music pause lets existing waves decay normally; the existing Space/water pause freezes the simulation and pauses/resumes the music transport as well.

YouTube `currentTime` is the master clock. `PlaybackClock` anchors each 80ms sample and interpolates for at most 120ms; an unchanged/stalled sample stops extrapolation. It never accumulates a separate song timer. Playback-rate changes, native seeks, buffering and visibility changes reconcile to the player.

For source offsets:

```text
score time = player currentTime − source_start_seconds
seek target = score time + source_start_seconds
track end = min(source_end_seconds, source_start_seconds + reference duration)
```

The runtime seeks to the source start on native item changes and advances manually at a segment's intended end inside a longer album video. An explicit source end remains effective after seeks; this does not rely on YouTube's `endSeconds` parameter. A longer source is accepted for an explicit offset segment, while a mismatched single-song duration is flagged.

## Normal water and tones

Music starts Off. Opening the panel does not change the water. Play prefers Green Light only if the user has not deliberately chosen another tone in that session. All five tones remain available; leaving an automatic Green Light music session restores the prior tone. The existing default remains Dark/comic bitmap. Music does not reset switches, lighting, motion controls, rain force, touch force, camera, render modes or geometry. Rain Sync Off resumes normal rain scheduling while audio can continue. Closing Music leaves ordinary Ink Water behavior intact. Still the water clears waves only; it does not restart the song or reset settings.

## Local reference playback

Start `npm run dev` and open `?music-dev=1`. Open Music, choose the numbered reference MP3s in “Reference recordings,” and press Play. File hashes must match the 32 analyzed references. Blob URLs stay in the browser; no upload, public-folder copy or production audio request occurs. The audio element's `currentTime` directly supplies score time; native audio controls provide seek, pause and resume. Next/previous follow the cinematic data order in this local transport.

Local audio is ignored by Git. The build rejects MP3/WAV/FLAC/M4A/OGG/AAC files in `public` or build output. Never add recordings to `public`, `data`, `dist` or commits. The older experiment branch is not merged; its historical audio assets are absent from this branch's tree.

## Deterministic social capture

`?capture=1&fps=60` exposes `window.inkWaterMusicCapture` alongside the existing `inkWaterCapture`. Select a track and score time; use the existing capture clock to step frames. Capture uses the same score and physical rain route, with no YouTube/network clock. The controller supports `select`, `seek`, `pause`, `play`, `off` and read-only diagnostics. It is only exposed on explicit capture URLs.

```sh
npm run music:capture -- --track 02-fused-dj-kicks
# Optional locally muxed reference audio, never served or published:
npm run music:capture -- --track 02-fused-dj-kicks --audio '/local/02 - fused (DJ-Kicks).mp3'
```

Default: approved 12.5s highlight, Green Light, 1080×1080, 60fps. Override `--start`, `--duration` or `--fps` (30/60/120). Outputs and frame digests stay in ignored `.capture/`. Requires Chrome with WebGL 2 and ffmpeg. Audio is optional and SHA-256 checked before local muxing. Identical score time/seed/settings and capture cadence reproduce physical inputs; 30/60/120Hz score tests confirm the same scheduled events. Pixel-level browser capture still requires a working WebGL environment.

## Adding/refining a song

This release is deliberately a fixed 32-track system, not arbitrary-song analysis. To add a song later, version the manifest/schema, update the explicit 32-track validation, supply a separately authored direction and score, analyze the exact reference, and add its explicit YouTube identity/offset/version. Do not substitute a generic beat detector.

For the existing 32, edit the per-song creative profiles or a score's section envelopes, accents and breaths. Keep measured analysis separate. Rebuild with `author-scores.py` only when profile edits are intended; it preserves existing source mappings. Change playlist order by editing `manifest.order` and explicitly updating the authored source order when desired. Reordering alone never changes event positions/seeds or playback identities.

```sh
python3 scripts/music/validate-audio.py --audio-dir /local/numbered-mp3s
python3 scripts/music/author-scores.py
npm run check
npm test
npm run build
npm run music:release-check
npm run music:report
```

`npm test` includes existing water/palette/input regressions plus 32-score determinism, master-clock/seek/source-offset tests, native playlist adapter tests, actual `Puddle` physical-path tests and audio privacy checks. Player tests use explicit fixtures, **not invented production mappings**. Real GPU checks can run with NumPy/ModernGL and EGL:

```sh
node scripts/verify-music-physical.mjs /tmp/music-impulses.json
python3 scripts/verify-music-gpu.py /tmp/music-impulses.json
```

See `docs/music-validation.md` and `.json` for every track's durations, sections, accents, generative parameters, event counts, demo windows and outstanding source discrepancies.
