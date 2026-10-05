import sys, json, os
import numpy as np
import librosa

path = sys.argv[1]
out = sys.argv[2]

y, sr = librosa.load(path, sr=22050, mono=True)
hop = 512

duration = librosa.get_duration(y=y, sr=sr)

# Rhythm
tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr, hop_length=hop)
tempo = float(np.asarray(tempo).reshape(-1)[0])
beats = librosa.frames_to_time(beat_frames, sr=sr, hop_length=hop)

onset_env = librosa.onset.onset_strength(y=y, sr=sr, hop_length=hop)
onset_frames = librosa.onset.onset_detect(
    onset_envelope=onset_env,
    sr=sr,
    hop_length=hop,
    backtrack=False
)
onsets = librosa.frames_to_time(onset_frames, sr=sr, hop_length=hop)

# Continuous musical state
rms = librosa.feature.rms(y=y, hop_length=hop)[0]
centroid = librosa.feature.spectral_centroid(
    y=y, sr=sr, hop_length=hop
)[0]

times = librosa.frames_to_time(
    np.arange(len(rms)), sr=sr, hop_length=hop
)

def normalize(x):
    x = np.asarray(x, dtype=float)
    lo, hi = np.percentile(x, [5, 95])
    return np.clip((x - lo) / (hi - lo + 1e-9), 0, 1)

energy = normalize(rms)
brightness = normalize(centroid)
onset_strength = normalize(onset_env)

# Save state at roughly 10 Hz so the browser can interpolate it.
step = max(1, round((sr / hop) / 10))

state = []
for i in range(0, len(times), step):
    state.append({
        "t": round(float(times[i]), 3),
        "energy": round(float(energy[i]), 4),
        "brightness": round(float(brightness[i]), 4),
        "onsetStrength": round(float(onset_strength[i]), 4),
    })

data = {
    "source": os.path.basename(path),
    "duration": round(float(duration), 3),
    "tempo": round(tempo, 3),
    "beats": [round(float(x), 3) for x in beats],
    "onsets": [round(float(x), 3) for x in onsets],
    "state": state
}

with open(out, "w") as f:
    json.dump(data, f, indent=2)

print(f"Wrote {out}")
print(f"duration: {duration:.2f}s")
print(f"tempo: {tempo:.2f} BPM")
print(f"beats: {len(beats)}")
print(f"onsets: {len(onsets)}")
print(f"state samples: {len(state)}")
