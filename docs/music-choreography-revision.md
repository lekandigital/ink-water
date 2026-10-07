# Dense choreography — 32 supplied recordings

The current scores follow the user's request for much more frequent, discernible choreographed ripples. They contain 16,790 note/anchor entrances, three gesture entrances and 17,294 physical impacts across the playlist. 17,162 impacts follow authored notes, phrase anchors or gestures; only 132 are incidental weather. The 16,225 new measured marks use exact recording attacks, uneven refrain cells, paired notes, quieter answers and selected simultaneous chord voices. Each track has its own spacing, force and phrase behavior. Authored zero rests and measured ending fades remain open.

The first playlist song, **190304-05**, now has **88 impacts in its first minute and 197 in the full song**. Its opening highlight has 18, compared with two in the previous sparse revision. Active gaps now peak around two seconds, and the busiest one-second interval has four marks. Its original sparse direction remains source provenance; the current dense score follows the user's newer instruction.

Logic1000's 124.55–137.05s highlight now contains **49 measured impacts**, up from 25. The primary arrival at 127.617s preserves its exact force, radius, physical position and seed. Its complete current highlight SHA-256 is `5ce88d1269b35c2d503450b3a43f6f08d48636b798732b4c8dc507b5aaf4f9ab`. The previous whole-cut hash is superseded by the deliberate density change.

Frequent secondary notes use lower weights than primary arrivals. Incidental chance-weather density is 12% of the old section envelopes and background weather is 8%, keeping authored patterns clear. Every new measured pattern entrance is checked against a stored attack and every physical event is checked against zero rests and final fades. The source audio, hashes, durations, cinematic order and highlight windows remain unchanged.

All 32 downloaded references match their analysis and score hashes. Full-recording comparisons verify 29 current native uploads; Pop 4, Recovery and Wildflower Wood retrieval returned HTTP403, and the older retained primary variants of Sun Tickles and Continuum3 remain unverified. Rider's supplied170-second recording matches DEAR DRIVER by NICO, Martin Hallenslev at zero offset; its supplied label is retained as provenance. Native iframe availability is separate: several uploads returned error150 in the real Chrome pass. Private downloaded playback verifies complete file hashes and uses the HTML audio clock without publishing recordings. See the source-audio, Rider, native initial-pass and private-browser validation reports in this directory.

| Track | Measured-pattern entrances | Full-song impacts | First-minute impacts | Highlight impacts | Busiest second |
| --- | ---: | ---: | ---: | ---: | ---: |
| inhale the Mist | 591 | 626 | 151 | 43 | 7 |
| fused (DJ-Kicks) | 386 | 416 | 92 | 49 | 7 |
| Sun Tickles | 446 | 474 | 109 | 28 | 5 |
| by the rain | 562 | 600 | 142 | 40 | 7 |
| Time to Find Me (AFX Fast Mix) | 1011 | 1071 | 110 | 30 | 6 |
| Pop 4 | 896 | 932 | 89 | 21 | 5 |
| Lusine - Without a Plan | 494 | 527 | 97 | 24 | 6 |
| memory of a memory | 451 | 484 | 79 | 31 | 6 |
| Places Remember Events | 621 | 651 | 141 | 35 | 7 |
| Sun Arcs (Laraaji Remix) | 416 | 438 | 102 | 24 | 5 |
| Remember | 172 | 193 | 71 | 19 | 6 |
| Wilson Tanner - Blush | 256 | 282 | 62 | 18 | 4 |
| Argento - Sabbia Su Sabbia | 513 | 540 | 154 | 29 | 7 |
| Slipping Fingers Through Curls | 280 | 300 | 85 | 17 | 4 |
| 190304-05 | 181 | 197 | 88 | 18 | 4 |
| Gagánbadibá | 561 | 586 | 113 | 32 | 6 |
| I | 1182 | 1233 | 127 | 46 | 6 |
| birch beer forest | 354 | 453 | 146 | 104 | 33 |
| An Unopened Letter | 184 | 203 | 73 | 14 | 4 |
| Recovery | 635 | 700 | 98 | 33 | 33 |
| Continuum 3 | 331 | 356 | 71 | 25 | 4 |
| Rider | 380 | 403 | 145 | 33 | 6 |
| Lights On the Vibe | 776 | 818 | 107 | 26 | 5 |
| Heal | 632 | 669 | 88 | 23 | 4 |
| The Dance No. 2 | 725 | 764 | 72 | 16 | 3 |
| A Future Untold | 328 | 351 | 104 | 18 | 5 |
| K-Notes | 389 | 412 | 123 | 31 | 6 |
| Wildflower Wood | 327 | 351 | 86 | 24 | 4 |
| Bromine (Yamaneko's Irusu Mix) | 791 | 828 | 79 | 23 | 5 |
| In Memory | 387 | 414 | 69 | 40 | 7 |
| Unknown | 511 | 543 | 53 | 18 | 4 |
| Da Du Dah (Onome Remix) [feat. Nyron Higor] | 456 | 479 | 132 | 27 | 5 |

Reproduce the score and recording audit:

```sh
python3 scripts/music/author-scores.py
node scripts/music/audit-choreography.mjs --audio-dir /Users/lekan/Downloads/ink-water-music --baseline docs/music-choreography-audit-before.json --output docs/music-choreography-audit.json
npm run music:test-all
node scripts/verify-music-dense-planning.mjs
```

The compiler requires Python's standard library. Dense planning uses a binary search over neighboring attack windows; its entire event output is checked against the former full accent scan, including floating-point boundaries. This scheduling optimization changes no force, position, event time or seed. No recording audio enters Git or the build.
