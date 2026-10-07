# Authored weather

Music mode replaces **rain scheduling**. The dense score revision contains 17,294 physical impacts across 32 songs, with measured note/refrain patterns dominating the activity. Each emitted event goes through `Puddle.emitRain`, the existing `rainImpulse` distribution and either `addDrop` or the existing `RainWaveLayer.addDrop` route. Height, velocity, normals, caustics and ink rendering remain the existing water implementation. Music has no access to a shader, render target or surface-deformation API. Touch retains its independent full-speed path when Dreamy Rain Speed is enabled.

## Data and artistic intent

`data/music/source/` preserves the supplied choreography guide, choreography JSON and raw analysis verbatim. `data/music/analysis/` holds 32 independently measured reference records: decoded duration, SHA-256, half-second energy/brightness/low-frequency activity, adaptive onsets, quiet spaces and transition checks. The supplied raw analysis contains summary measurements, not continuous curves; the added curves were extracted from the actual MP3s. They support decisions and are not a live loudness-to-rain mapping.

`data/music/scores/` has one version-2 full-song score (with version-1 runtime compatibility) per track. Each records a deterministic seed, artistic direction, contiguous section envelopes, cluster and spatial parameters, selected accents, authored breaths and unchanged recommended/alternate demo windows. Density is group entrances per second; a group can have 1–4 physical impacts. Force and scale are authored musical proportions. `MusicDynamics.musicImpact` calibrates their physical weight before the existing `rainImpulse` call. Music impulses bypass Gentle motion’s additional 0.4 force multiplier so the authored marks remain visible at the default settings. The user’s numeric rain force, ripple scale, Subtle control and music Expression still apply; touch and ordinary rain retain Gentle motion’s force reduction. Wave speed still follows the selected motion settings. No solver or drawing shader changes are involved. Per-song refrain cells assign principal notes and lighter answers to selected measured attacks. A small incidental weather layer adds irregular texture; authored zero rests and final fades remain open.

The dense revision contains **16,790 cue entrances and 17,294 physical impacts**, drawing from 40,780 measured attacks. Its 16,225 new pattern entrances use exact measured onset times in explicit, uneven refrain cells for each song. Principal notes, lighter answers and selected simultaneous voices create frequent musical activity, with no BPM grid or every-hit mapping. Just 132 physical impacts come from incidental weather. Authored zero breathing spaces remain open, and measured final fades contain no new impacts. The first playlist item, **190304-05**, has 197 physical impacts over 153.3 seconds, including 88 in its first minute and 18 in its opening highlight. Its longest unintended active gap is 1.463 seconds; its final fade begins at 136.5 seconds. `docs/music-choreography-revision.md` and `docs/music-choreography-audit.json` contain the per-track before/after counts and gaps. Original supplied directions are retained as provenance; the later request for much denser choreography governs these scores.

`scripts/music/author-scores.py` contains 32 explicit creative profiles and measured refrain cells, and requires only Python’s standard library. Different songs have different densities, forces, sizes, clustering, pacing and placement languages. Logic1000's 124.55–137.05s excerpt now has 49 impacts, up from 25, while retaining the exact force, scale, position and physical seed of its proven 127.617s arrival (confirmed against a fresh 10ms MP3 envelope; the larger 128.1974s transient was late). Stable accent random indices preserve that primary mark while adding denser answers around it. Sun Tickles has asymmetric paired glints; Places has separated simultaneous showers; Bromine has repeated complete gaps; Recovery grows force as well as density. Version 2 includes just three occasional gestures across the playlist: Marumari C/X at measured phrase attacks and a later Recovery C. The canonical touch paths are compiled into timestamped physical rain impacts with a seed-derived center. They pause and seek with the score; no gesture runs on a separate wall clock. `analysis/demo-timing-review.json` records the original transcript comparison and timing/calibration decisions.

`data/music/manifest.json` separates score identity, cinematic order and playback source. The order is exactly `playlist_order_indices` from the authored choreography. Changing the order never rewrites a score or its seed. Analysis records and local audio do not ship in `dist`; only the manifest and authored scores do.

## Production identities and recording verification

The supplied `ink-water-youtube-source-map.json` has been recovered and imported. The original is preserved byte-for-byte in `data/music/source/`. All 32 numbered tracks have explicit primary IDs. `analysis/youtube-playlist-inventory.json` records the IDs and duration metadata returned on 2026-10-06; runtime never uses that inventory to assign scores. Reviewed exact-ID adjustments live separately in `source/playlist-source-adjustments.json`. No fuzzy title matching or positional identity guessing is performed.

The supplied Rider ID `jGIKgJ9MzfE` resolves to **DEAR DRIVER — NICO, Martin Hallenslev** in the playlist. Full-recording audio comparison now establishes that the supplied `22 - Rider.mp3` is that native recording at zero offset: waveform correlation is 0.999922 and 100ms RMS correlation is 0.999995 across the complete comparison span, with opening, middle and ending checks agreeing. The supplied title is mislabeled; the audio matches. This source is now `verified` and its score can run. The original supplied filename, title and score identity remain as provenance. Evidence is in `docs/music-rider-source-verification.json`; no recording audio is published.

Sun Tickles also explicitly maps to current upload `lrAWkOGkpBw`, retaining supplied `62Zeu3jBs_I`. Continuum 3 also maps to standalone `Gx41vYzyPZo` at **0s**, while supplied album `IyvqVDAGU0s` retains **854s** and its reference-length end boundary. With those two aliases, the current playlist matches the cinematic identity order. Full native/reference audio comparisons now verify **29 current playlist recordings**, including those two current aliases, with aligned opening, middle, ending and full comparison spans. Pop 4, Recovery and Wildflower Wood could not be retrieved for that comparison because the media requests returned HTTP 403. Their recording equivalence remains outstanding, as does verification of the older primary versions retained for Sun Tickles and Continuum 3. `docs/music-source-audio-validation.json` records the scope, hashes, correlations and failures; the reviewed source overlay preserves the results through manifest regeneration. Duration-only matches permit preview rain and are distinct from full recording verification.

Import the actual explicit map:

```sh
python3 scripts/music/import-source-map.py /path/to/ink-water-youtube-source-map.json
python3 scripts/music/reconcile-playlist-sources.py
npm run music:release-check
npm run music:report
```

The importer accepts a `tracks` or `sources` array with 32 entries, identified by `track_id` or original numbered `track_index`/`index`. Sources can contain `video_id` or the supplied HTTPS `youtube_url`. It preserves the original byte-for-byte and fails atomically on unknown identities, duplicate IDs or invalid offsets. `--check` validates without writing. It never matches titles. One normalized entry is:

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

The example describes the supplied album source; the current playlist uses its separately mapped standalone upload. Mark `verified` only after checking recording/version and timing against the reference; a duration-only match stays `duration-only`. A `mismatch` source or materially different effective duration holds rain while allowing playback. Whole-second YouTube duration rounding is allowed up to 1.25s. Duration holds are recomputed for each native sample: video identity can arrive before the new duration, and a transient stale value releases automatically when correct metadata arrives. An explicit manifest identity mismatch remains held. `music:release-check` is the stricter recording-verification check: all primary and alternate versions must be verified for it to pass. Remaining `duration-only` and `unverified` sources are still outstanding even when functional playback and choreography tests pass.

## YouTube playlist integration

The default playlist is `PLTab0IXtn0Nw`. After an explicit Play click, the app loads the YouTube IFrame API, creates a visible player and calls `cuePlaylist({listType:'playlist', list: playlistId})`. It does not create a hardcoded video-array playback queue. Play, previous, next and selection use that native queue. The user can enter a new playlist URL/ID under “Choose a track or playlist.”

At readiness, `getPlaylist()` supplies actual video IDs. The app compares them to the explicit source manifest and reports missing expected tracks, unexpected IDs, duplicate IDs and exact order differences in “Playback source check” and the published state. The cinematic order stays unchanged. Reorder YouTube later without changing scores: current **video identity**, not queue position or title, chooses its score.

The left-edge vertical quick-control cluster contains Pause, Show/Hide controls, the five-color bar and drawing row, followed by **Play music**. The color/drawing bars have the same width. One Play action opens and starts the native playlist; there is no duplicate entry step or automatic palette change. The compact transport bar shows title/artist, Play/Pause, Next, time and Expand. Its image is the actual live YouTube viewport, a visible 200×200 square above the bar; duplicate artwork has been removed. A cross-origin live video cannot be copied into a tiny 52px image, and the native viewport must remain at least 200×200.

Expanded mode keeps the same iframe, widens its viewport to the cluster, and reveals one playlist selector, a seek bar, Previous, ±15 seconds and Restart. Additional controls sit behind **More**: Highlight, Rain Sync, an independent music **Expression** slider (50–175%), clock/physical-impact diagnostics, source checks and playlist entry. The close icon minimizes without interrupting playback. **Stop and close music** destroys the embed before hiding it.

The entire quick-control/music cluster rests beneath the displayed physical water, including the color/drawing bars and Show/Hide button. Mostly transparent paper and a 65% resting video image let the water show through. Hover or keyboard focus removes refraction and brings the controls into focus. Gaps in the cluster pass pointer input through to the water. The original native iframe remains interactive; its pixels are never copied or covered by custom controls.

`MusicWaterPresentation` reconstructs displayed water normals, performs air-to-water refraction toward the floor, and projects the difference from still water into a bounded displacement map. An asynchronous 80×80 GPU read (at most 20Hz, one in flight) supplies an SVG displacement filter for the original DOM/iframe. The field includes independently clocked Dreamy rain and full-speed touch. This read-only presentation never changes waves or feeds back into either solver. Hover/focus, reduced motion and capture bypass it. Because the quick controls are now submerged too, the presentation can run with Music Off; the ordinary water behavior remains identical. Failed readback falls back to usable undistorted controls.

The compact rain-status line distinguishes synchronization from pause, buffering, missing score and recording mismatch. Play does not invent an impact during an authored breathing space.

While the music transport is playing or buffering, the Gentle/background rain checkbox is unchecked and disabled, and ordinary rain is physically suppressed. This follows audible transport state rather than score readiness, so it also applies with Rain Sync Off, a held or unmapped source, and pending native track changes. Music pause or Stop restores the saved background-rain preference and its physical scheduling; a water pause still freezes the whole simulation. Changing the rain preference through the validated controls while music plays updates the saved preference without adding drops over the music.

The bar’s Expand button expands/minimizes without recreating the player. The close icon also minimizes; only the separate Stop command destroys playback. `H` hides the water controls without hiding a playing YouTube player. YouTube does not permit invisible/background-only playback; the compact card is the smallest visible alternative. Capture URLs disallow YouTube playback. Autoplay blocking asks the user to press the actual player's Play control. Errors 100/101/150 mark the actual rejected video unavailable and advance through the native playlist; omitted private items appear as missing expected IDs. Other errors are shown without fabricating rain. At the last item the playlist ends cleanly; Play returns to its first item. The native End event is allowed to settle before any manual advance to avoid double skipping.

Official API and embed requirements: https://developers.google.com/youtube/iframe_api_reference
Player visibility/background-playback policy: https://developers.google.com/youtube/terms/developer-policies

## Master clock, seeks and source offsets

`RainScheduler.updateMusicRain(currentTime)` is independent of any player. The scheduler plans reproducible generative events from the song seed, using event-local randomness rather than a global RNG. It uses a cursor/binary search for seeks. Forward seeks discard missed events; backward seeks make future events eligible again. Discontinuous clock jumps never emit a backlog. Existing waves are preserved across seek or track change.

`MusicRainEngine` owns the current score. A track change clears only pending scheduling, not water. Async score loading is revision guarded; late samples from the previous native item cannot resurrect that score. Pause/buffering stops new events and rebases the cursor. Music pause lets existing waves decay normally; the existing Space/water pause freezes the simulation and pauses/resumes the music transport as well. Space is captured before focused controls on both key-down and key-up, so it cannot activate a selected button; held Space toggles only once. Text-entry spaces remain available. Pause changes notify playback immediately, independently of GPU initialization or the next animation frame.

Natural track endings preserve the final live scheduling interval even if the native ended callback arrives before the next render frame. `PlaylistMusic` drains that bounded interval into a terminal queue, then delivers it once through the normal physical route. The same protection applies when the first new sample already identifies the next video: the old projected master clock must have reached its source end before any tail is drained. Earlier native Next actions cannot invent future impacts. Explicit seek, pause, selection, next/previous, Sync Off and Stop cancel queued terminal drops. The scheduler’s 0.5-second discontinuity guard still rejects disconnected jumps and skipped backlogs. Native queue index and video ID must also agree before the adapter accepts a sample; a newly advanced index with cached old identity/time cannot cause a second manual advance and skip the next song.

Custom seeks, including the seek bar and ±15-second buttons, hold new rain until a master-clock sample acknowledges the newest target. Late old samples and acknowledgements from superseded seeks cannot emit old drops. Seeking while paused stays paused. A rejected seek eventually rebases to the actual player time rather than replaying a backlog. Native short forward/backward jumps also rebase; existing waves are not cleared.

YouTube `currentTime` is the master clock. `PlaybackClock` polls every 80ms and anchors advancing measurements. Repeated cached values while playing retain that anchor, with interpolation bounded to 900ms since the last advance. Pause and buffering stop interpolation immediately. An unannounced stall cannot continue rain beyond that grace window. Seek detection compares source-time progress with wall time since the last actual advance, using the same bounded window. This preserves smooth scheduling through cached delivery up to 800ms, including 2× playback, while genuine jumps and long reconnects discard their backlog. It never accumulates a separate song timer. Playback-rate changes, native seeks, buffering and visibility changes reconcile to the player.

For source offsets:

```text
score time = player currentTime − source_start_seconds
seek target = score time + source_start_seconds
track end = min(source_end_seconds, source_start_seconds + reference duration)
```

The runtime seeks to the source start on native item changes and advances manually at a segment's intended end inside a longer album video. An explicit source end remains effective after seeks; this does not rely on YouTube's `endSeconds` parameter. A longer source is accepted for an explicit offset segment, while a mismatched single-song duration is flagged.

## Normal water and tones

Music starts Off. Opening, playing, expanding, collapsing or closing Music never changes the current palette. The existing default remains Dark/comic bitmap. A five-swatch Color picker and an Ink / Etched / Graphite / Real row beneath it are available outside the technical panel; they share `WaterControls` state with the Paper/Drawing rows and stay synchronized. All five palettes work in and out of music mode. The manifest's preferred tone is an artistic recommendation, not an automatic override. Music preserves switches, lighting, motion controls, force, camera and geometry, while temporarily masking the background-rain preference during playback. Rain Sync Off disables musical impacts while continuing to suppress background rain over playing audio. Pausing or closing Music restores the saved ordinary-rain preference. Still the water clears waves only, without restarting the song or resetting settings.

## Reference recordings and development

YouTube remains the default transport. A real native Chrome playlist pass reported embed error **150** for several uploads, including recordings whose audio matched the references. Public metadata and recording equivalence do not establish that the iframe will play every upload on this computer. `docs/music-native-initial-pass.json` records that initial pass and its failures; it is not an all-32 native success report.

The optional **Use downloaded songs** button under Music → Expand → More opens a browser file chooser. The user selects all 32 supplied MP3s together; `LocalReferencePlayback` checks every file’s complete SHA-256 against the manifest and requires each reference exactly once. Filenames and folder order never choose score identities. Wrong files, duplicate references and incomplete selections are rejected before replacing an existing valid set. The feature has no automatic filesystem access and no dependency on an old `?music-dev=1` URL; that generic development transport remains disabled.

Private playback uses one lazily created, detached `HTMLAudioElement` and a blob URL for the chosen file. Files are not uploaded, served by the app, fetched from a local path, or sent to YouTube. The audio element’s `currentTime` is the exact local master clock, read directly by the animation adapter; no separate wall-clock song timer or YouTube interpolation runs for this transport. Native media metadata, playing, waiting, seeking, pause, rate and ended events reconcile the score. Selection tokens prevent old metadata or a superseded play request from starting the wrong track, and pause during metadata loading cancels autoplay. Replacing a track revokes its old blob URL; Stop and close music stops audio, releases the selected files and revokes private URLs. Reloading requires the user to choose the files again.

The private transport regression exercises all 32 complete timelines at 80, 500 and 800ms media-event cadences through both physical water routes (192 timelines, 103,764 impacts). Its audio and GPU ports are explicitly mocked, while the full-file SHA-256 checks use real WebCrypto. Separate live Chrome evidence in `docs/music-local-browser-validation.json` covers the actual downloaded recordings, every recommended highlight, the first song’s first minute, real media clocks and GPU readback. The browser extension could not operate its file chooser; a temporary localhost test fixture supplied File objects to the same production hash/selection flow. That developer test fixture is not part of the app or build.

The original full-song analyses remain intact as timing evidence. Deterministic development/social playback uses the synthetic score clock below; it does not implicitly access or play a recording.

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

For the existing 32, edit the per-song creative profiles or a score's section envelopes, accents, occasional gestures and breaths. Keep measured analysis separate. Rebuild with `author-scores.py` only when profile edits are intended; it preserves existing source mappings. Change playlist order by editing `manifest.order` and explicitly updating the authored source order when desired. Reordering alone never changes event positions/seeds or playback identities.

```sh
python3 scripts/music/validate-audio.py --audio-dir /local/numbered-mp3s
python3 scripts/music/author-scores.py
npm run check
npm test
npm run build
npm run music:release-check
npm run music:report
```

`npm test` includes existing water/palette/input regressions plus 32-score determinism, master-clock/seek/source-offset tests, native playlist adapter tests, actual `Puddle` physical-path tests and audio privacy checks. `verify-music-handoff.mjs` connects the production playlist adapter to the actual animation loop and drop methods, using the current playlist's IDs and uneven 80/400/500/640/800ms source-time delivery at 1× and 2× playback. It checks both physical rain routes, physical arrivals within 100ms of playback, stale-duration recovery, the complete Logic1000 entrance, reproducible backward seeks, pause/resume, forward-seek storm prevention, track changes and physical ordinary-rain restoration.

`verify-music-all-tracks.mjs`, included in `npm test` and available as `npm run music:test-all`, exercises full song timelines for every track through both physical routes with 80/500/800ms cached timestamps. It checks opening/middle/ending seeks, deterministic physical repeats, pause/resume, source holds, natural playlist advancement and completion, final callbacks before rendering, direct next-ID handoffs, ID/index metadata lag, and cancellation of terminal queues by explicit transport actions. `docs/music-all-tracks-validation.json` states the exact substituted boundaries: the external YouTube API port and GPU drop targets are mocked, while the production adapter, clock, scheduler and `Puddle` methods execute. These checks establish full-timeline event delivery, not listening, recording equivalence or visible GPU output. `npm run music:audit` reports each score’s selected attacks, active gaps, ending fades and the approved Logic1000 cut signature.

`scripts/verify-local-reference.mjs` uses real WebCrypto SHA-256 over 32 explicitly synthetic File fixtures and substitutes only audio hardware. It checks content-based identity, incomplete/wrong/duplicate rejection, atomic replacement, cancellation during hashing and metadata loading, stale blob events, pause before metadata, direct media time, seeking/rate/end handling, autoplay retry, a single lazy audio element, URL revocation and zero network requests. Its synthetic recordings do not establish real browser playback of the user’s files.

Separate EGL tests cover solver/rendering behavior. Player tests use explicit fixtures, **not invented production mappings**. The earlier native Chrome test with the live YouTube iframe and WebGL water on 2026-10-06 delivered all 25 Logic1000 highlight impacts, with a maximum 9.30ms difference from the player clock. Global pause stopped YouTube and physical emission; Space resumed without activating the focused Expand control. That earlier evidence in `docs/music-live-validation.json` covers its recorded test scope and code revision; it does not establish live playback for every track after subsequent changes. Real GPU checks can run with NumPy/ModernGL and EGL:

```sh
node scripts/export-bitmap-gpu.mjs /tmp/music-gpu-fixtures
node scripts/verify-music-physical.mjs /tmp/music-impulses.json /tmp/music-gpu-fixtures
python3 scripts/verify-music-render-gpu.py /tmp/music-gpu-fixtures
python3 scripts/verify-music-gpu.py /tmp/music-impulses.json
python3 scripts/verify-music-refraction.py
```

See `docs/music-validation.md` and `.json` for every track's durations, sections, accents, generative parameters, event counts, demo windows and outstanding source discrepancies.

The earlier GPU visibility pass in `docs/music-gpu-validation.json` applies actual `Puddle.emitRain` impulses to the unchanged solver and renders 128 first-mark/accent samples across all 32 songs in Dark and Green Light. It also runs complete default-slowed Logic1000, Marumari and quiet piano excerpts. It records the previous sparse score revision. Current dense browser/GPU evidence is in `docs/music-local-browser-validation.json`. EGL rendering checks establish physical/ink visibility and remain separate from listening and native YouTube/browser playback verification.
