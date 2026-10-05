import sys
import os
import numpy as np
import librosa

if len(sys.argv) < 2:
    print("usage: python3 find_best_song_sections.py song.mp3")
    sys.exit(1)

path = sys.argv[1]
WINDOW = 12.5
EDGE_MARGIN = 5.0

y, sr = librosa.load(path, sr=22050, mono=True)
duration = librosa.get_duration(y=y, sr=sr)
hop = 512

rms = librosa.feature.rms(y=y, hop_length=hop)[0]
onset = librosa.onset.onset_strength(y=y, sr=sr, hop_length=hop)

S = np.abs(librosa.stft(y, hop_length=hop))
flux = np.sqrt(np.sum(np.diff(S, axis=1, prepend=S[:, :1]) ** 2, axis=0))

times = librosa.frames_to_time(
    np.arange(len(rms)),
    sr=sr,
    hop_length=hop
)

def norm(x):
    x = np.asarray(x, dtype=float)
    lo = np.percentile(x, 5)
    hi = np.percentile(x, 95)
    return np.clip((x - lo) / (hi - lo + 1e-9), 0, 1)

rms_n = norm(rms)
onset_n = norm(onset)
flux_n = norm(flux)

TARGETS = [0.8, 4.0, 6.0, 8.5]
candidates = []

starts = np.arange(
    EDGE_MARGIN,
    max(EDGE_MARGIN, duration - WINDOW - EDGE_MARGIN),
    0.25
)

for start in starts:
    end = start + WINDOW
    idx = np.where((times >= start) & (times < end))[0]

    if len(idx) < 2:
        continue

    energy = np.mean(rms_n[idx])
    rhythmic = np.mean(onset_n[idx])
    change = np.mean(flux_n[idx])

    sync_score = 0

    for target in TARGETS:
        absolute = start + target
        local = np.where(
            (times >= absolute - 0.25) &
            (times <= absolute + 0.25)
        )[0]

        if len(local):
            sync_score += np.max(onset_n[local])

    sync_score /= len(TARGETS)

    score = (
        0.25 * energy +
        0.30 * rhythmic +
        0.20 * change +
        0.25 * sync_score
    )

    candidates.append((score, start, end))

candidates.sort(reverse=True)
chosen = []

for score, start, end in candidates:
    if all(abs(start - s) > 8 for _, s, _ in chosen):
        chosen.append((score, start, end))

    if len(chosen) == 8:
        break

print()
print(os.path.basename(path))
print(f"duration: {duration:.1f}s")
print()
print("Top 12.5-second candidates:")
print()

for i, (score, start, end) in enumerate(chosen, 1):
    print(
        f"{i}. {int(start//60)}:{start%60:05.2f} → "
        f"{int(end//60)}:{end%60:05.2f}    "
        f"score={score:.3f}"
    )
