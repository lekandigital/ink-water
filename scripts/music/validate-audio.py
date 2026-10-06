#!/usr/bin/env python3
"""Inspect reference MP3s. Writes measurements only; never creates choreography.

Requires ffmpeg, ffprobe, numpy, scipy. No reference audio is copied into the repo.
"""
import argparse
import hashlib
import json
import re
import subprocess
import unicodedata
from pathlib import Path
import numpy as np
from scipy import signal, ndimage

ROOT = Path(__file__).resolve().parents[2]


def track_id(track):
    title = re.sub(r'\(1\)$', '', track['title']).strip()
    ascii_title = unicodedata.normalize('NFKD', title).encode('ascii', 'ignore').decode()
    slug = re.sub(r'[^a-z0-9]+', '-', ascii_title.lower()).strip('-')
    return f"{track['index']:02d}-{slug}"


def write(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')


def rounded(values):
    return [round(float(v), 5) for v in values]


def inspect(path, supplied, authored):
    probe = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-show_format', '-of', 'json', str(path)]))
    sr = 11025
    samples = np.frombuffer(subprocess.check_output(['ffmpeg', '-v', 'error', '-i', str(path), '-ac', '1', '-ar', str(sr), '-f', 'f32le', '-']), dtype='<f4')
    duration = len(samples) / sr
    hop = 256
    frequencies, times, spec = signal.stft(samples, fs=sr, nperseg=1024, noverlap=1024-hop, boundary=None, padded=False)
    magnitude = np.abs(spec)
    power = np.sum(magnitude ** 2, axis=0)
    rms = np.sqrt(power)
    flux = np.maximum(0, np.diff(magnitude, axis=1, prepend=magnitude[:, :1])).sum(axis=0)
    # Adaptive attack prominence, not a beat grid. Saturated supplied strengths
    # remain preserved as evidence; selected score accents can use these timings.
    local = ndimage.median_filter(flux, size=43)
    attack = np.maximum(flux - local, 0)
    peaks, _ = signal.find_peaks(attack, distance=5, prominence=max(float(np.quantile(attack, .74)), 1e-8))
    peak_scale = max(float(np.quantile(attack[peaks], .95)) if len(peaks) else 1, 1e-8)
    low_power = np.sum(magnitude[frequencies < 220] ** 2, axis=0)
    low_share = low_power / np.maximum(power, 1e-12)
    centroid = (magnitude * frequencies[:, None]).sum(axis=0) / np.maximum(magnitude.sum(axis=0), 1e-10)
    energy_scale = max(float(np.quantile(rms, .95)), 1e-8)
    centroid_scale = max(float(np.quantile(centroid, .95)), 1)
    flux_scale = max(float(np.quantile(flux, .95)), 1e-8)
    timeline = []
    for time in np.arange(0, duration, .5):
        mask = (times >= time) & (times < time + .5)
        if not mask.any():
            mask[np.argmin(abs(times-time))] = True
        timeline.append({'time': round(float(time), 3), 'energy': round(min(1, float(np.mean(rms[mask]))/energy_scale), 5),
                         'brightness': round(min(1, float(np.mean(centroid[mask]))/centroid_scale), 5),
                         'onset': round(min(1, float(np.mean(flux[mask]))/flux_scale), 5),
                         'low_share': round(float(np.mean(low_share[mask])), 5)})
    onsets = [{'time': round(float(times[i]), 4), 'strength': round(min(1, float(attack[i])/peak_scale), 5),
               'low_share': round(float(low_share[i]), 5)} for i in peaks]
    quiet = []
    start = None
    for row in timeline + [{'time': duration, 'energy': 1}]:
        if row['energy'] < .22 and start is None:
            start = row['time']
        elif row['energy'] >= .22 and start is not None:
            if row['time'] - start >= 1:
                quiet.append({'start': start, 'end': round(row['time'], 4)})
            start = None
    transition_checks = []
    for boundary in authored['detected_section_boundaries_seconds']:
        before = [r['energy'] for r in timeline if boundary-3 <= r['time'] < boundary]
        after = [r['energy'] for r in timeline if boundary <= r['time'] < boundary+3]
        near = [o for o in onsets if abs(o['time']-boundary) < 2]
        transition_checks.append({'candidate': boundary, 'energy_before': round(float(np.mean(before)), 4),
                                  'energy_after': round(float(np.mean(after)), 4),
                                  'strongest_nearby_attack': max(near, key=lambda o:o['strength']) if near else None,
                                  'status': 'signal candidate; musical interpretation retained'})
    highlight = authored['recommended_highlight']
    if highlight['end'] > duration + .1:
        raise ValueError(f"Highlight exceeds recording: {path}")
    rows = [r for r in timeline if highlight['start'] <= r['time'] <= highlight['end']]
    # Tempo is supporting evidence only. List plausible metrical interpretations
    # explicitly rather than declaring a proxy reliable for ambient/polyrhythm.
    tempo = supplied['tempo_estimate']
    return {'schema_version': 1, 'track_id': track_id(authored), 'index': authored['index'], 'title': authored['title'],
            'supplied_analysis': supplied,
            'reference': {'file': path.name, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
                          'duration_seconds': round(duration, 6), 'container_duration_seconds': float(probe['format']['duration']),
                          'supplied_duration_delta': round(duration-supplied['duration'], 6), 'validated': abs(duration-supplied['duration']) < .15},
            'method': {'sample_rate': sr, 'stft_window': 1024, 'hop': hop, 'timeline_step_seconds': .5,
                       'timing_resolution_seconds': round(hop/sr, 6), 'energy': 'RMS / per-track 95th percentile',
                       'onsets': 'positive spectral flux with adaptive median baseline and peak prominence',
                       'tempo_used_for_scheduling': False},
            'tempo_review': {'supplied_proxy_bpm': tempo, 'possible_half_double': rounded([tempo/2, tempo, tempo*2]),
                             'conclusion': 'Proxy only; no beat grid drives rainfall.'},
            'timeline': timeline, 'onsets': onsets, 'quiet_spaces': quiet, 'transition_checks': transition_checks,
            'highlight_validation': {'window': highlight, 'within_recording': True,
                                     'mean_energy': round(float(np.mean([r['energy'] for r in rows])), 4),
                                     'onset_count': sum(highlight['start'] <= o['time'] <= highlight['end'] for o in onsets)},
            'youtube_validation': {'status': 'awaiting supplied source map; recording identity not verified'}}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--audio-dir', type=Path, required=True)
    parser.add_argument('--choreography', type=Path, default=ROOT/'data/music/source/ink-water-32-track-choreography.json')
    parser.add_argument('--analysis', type=Path, default=ROOT/'data/music/source/ink_water_audio_analysis.json')
    args = parser.parse_args()
    choreography = json.loads(args.choreography.read_text())
    raw = {t['index']: t for t in json.loads(args.analysis.read_text())['tracks']}
    files = {int(m.group(1)): p for p in args.audio_dir.glob('*.mp3') if (m := re.match(r'^(\d{2}) - ', p.name))}
    if set(files) != set(range(1, 33)):
        raise ValueError('Need all 32 numbered reference files; nothing is guessed.')
    for track in choreography['tracks']:
        record = inspect(files[track['index']], raw[track['index']], track)
        if not record['reference']['validated']:
            raise ValueError(f"Reference duration mismatch for {track['title']}")
        write(ROOT / 'data/music/analysis' / (track_id(track)+'.json'), record)
        print(f"{track['index']:02d} {track['title']}: {record['reference']['duration_seconds']:.3f}s, {len(record['onsets'])} attacks, {len(record['quiet_spaces'])} breathing spaces", flush=True)


if __name__ == '__main__':
    main()
