import {readFile, readdir, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {build} from 'esbuild';

// Inspect the compiled score, rather than inferring impact count from density.
// Recording paths are read only and no recording bytes enter the report.
const options = Object.fromEntries(process.argv.slice(2).reduce((pairs, arg, i, args) =>
  arg.startsWith('--') ? [...pairs, [arg.slice(2), args[i + 1]]] : pairs, []));
const root = process.cwd();
const {outputFiles} = await build({entryPoints: ['src/music/RainScheduler.ts'], bundle: true,
  platform: 'node', format: 'esm', write: false});
const {RainScheduler} = await import('data:text/javascript;base64,' + Buffer.from(outputFiles[0].text).toString('base64'));
const json = async path => JSON.parse(await readFile(path, 'utf8'));
const manifest = await json('data/music/manifest.json');
const baseline = options.baseline ? await json(options.baseline) : null;
const localFiles = options['audio-dir'] ? await readdir(options['audio-dir']) : [];
const rounded = value => Math.round(value * 10000) / 10000;
const average = values => values.reduce((sum, v) => sum + v, 0) / Math.max(values.length, 1);
const rows = [];
// Keep the approved structural arrival stable while allowing the surrounding
// passage to acquire additional measured note/chord/echo choreography.
const logicArrival = {time: 127.617, force: 1.08, scale: 1.18,
  position: [-0.489422087306414, 0.13335399364491024], seed: 3414604112, kind: 'accent'};
const maximumImpactsInSecond = events => {
  let maximum = 0, end = 0;
  for (let start = 0; start < events.length; start++) {
    while (end < events.length && events[end].time < events[start].time + 1) end++;
    maximum = Math.max(maximum, end - start);
  }
  return maximum;
};
for (const track of manifest.tracks) {
  const score = await json('data/music/' + track.score);
  const analysis = await json('data/music/' + track.analysis);
  const events = new RainScheduler(score).events;
  let verified = null;
  if (options['audio-dir']) {
    const filename = localFiles.find(name => name.startsWith(String(track.index).padStart(2, '0') + ' - ') && name.endsWith('.mp3'));
    if (!filename) throw new Error('Missing numbered reference recording: ' + track.id);
    const bytes = await readFile(resolve(options['audio-dir'], filename));
    const hash = createHash('sha256').update(bytes).digest('hex');
    verified = hash === track.reference_sha256 && hash === analysis.reference.sha256 &&
      hash === score.provenance.reference_sha256;
    if (!verified) throw new Error('Recording hash disagreement: ' + track.id);
  }
  const gaps = [];
  const gap = (start, end) => {
    const samples = analysis.timeline.filter(s => s.time >= start && s.time < end);
    return {start: rounded(start), end: rounded(end), seconds: rounded(end - start),
      meanReferenceEnergy: rounded(average(samples.map(s => s.energy))),
      activeReferenceSeconds: rounded(samples.filter(s => s.energy >= .22).length * .5)};
  };
  let previous = 0;
  for (const event of [...events, {time: score.duration}]) {
    gaps.push(gap(previous, event.time));
    previous = event.time;
  }
  // Deliberate negative space and the measured ending fade are not missing
  // choreography. Report both the raw gap and its unplanned active portions.
  const unintendedGaps = gaps.flatMap(g => {
    let segments = [[g.start, g.end]];
    for (const breath of score.breaths.filter(b => b.amount === 0))
      segments = segments.flatMap(([start, end]) => end <= breath.start || start >= breath.end
        ? [[start, end]] : [[start, Math.min(end, breath.start)], [Math.max(start, breath.end), end]]
          .filter(([a, b]) => b > a));
    return segments.map(([start, end]) => gap(start, end));
  });
  const anchored = events.filter(e => ['accent', 'gesture'].includes(e.kind));
  const cueOnsetErrors = score.accents.map(a => Math.min(...analysis.onsets.map(o => Math.abs(o.time - a.time))));
  const measuredPatternCues = score.accents.filter(a => a.note.startsWith('Measured pattern:'));
  const measuredOnsetTimes = new Set(analysis.onsets.map(o => o.time));
  if (measuredPatternCues.some(cue => !measuredOnsetTimes.has(cue.time)))
    throw new Error('A recurring choreographed pattern is not anchored to an exact measured attack: ' + track.id);
  const highlight = events.filter(e => e.time >= score.recommended_demo.start && e.time < score.recommended_demo.end);
  const highlightSignature = createHash('sha256').update(JSON.stringify(highlight)).digest('hex');
  if (track.id === '02-fused-dj-kicks' && !highlight.some(event => JSON.stringify(event) === JSON.stringify(logicArrival)))
    throw new Error('The approved Logic1000 primary arrival changed its physical timing, force, position or seed.');
  if (track.id === '02-fused-dj-kicks' && highlight.length < 45)
    throw new Error('The flagship highlight lost the requested frequent authored choreography.');
  const old = baseline?.tracks.find(t => t.id === track.id);
  const fade = score.breaths.find(b => b.note.startsWith('Measured final fade:'))?.start ?? null;
  rows.push({id: track.id, index: track.index, title: track.title, duration: score.duration,
    localRecordingHashVerified: verified, referenceSha256: track.reference_sha256,
    measuredOnsets: analysis.onsets.length, authoredCueEntrances: score.accents.length,
    authoredGestureEntrances: (score.gestures ?? []).length, totalImpacts: events.length,
    musicalAnchorImpacts: anchored.length, weatherImpacts: events.length - anchored.length,
    selectedPhraseAnswerEntrances: score.accents.filter(a => a.note.startsWith('Selected ') && a.note.includes(' answer near ')).length,
    measuredPatternEntrances: measuredPatternCues.length,
    selectedAttackFraction: rounded(score.accents.length / analysis.onsets.length),
    opening20SecondsImpacts: events.filter(e => e.time < 20).length,
    opening60SecondsImpacts: events.filter(e => e.time < 60).length,
    meanImpactsPerSecond: rounded(events.length / score.duration),
    maximumOneSecondImpacts: maximumImpactsInSecond(events),
    highlightImpacts: highlight.length,
    highlightMusicalAnchorImpacts: highlight.filter(e => ['accent', 'gesture'].includes(e.kind)).length,
    ...(track.id === '02-fused-dj-kicks' ? {approvedPrimaryArrivalPreserved: true, highlightSha256: highlightSignature} : {}),
    maximumCueToMeasuredOnsetSeconds: rounded(Math.max(0, ...cueOnsetErrors)),
    longestGap: gaps.toSorted((a, b) => b.seconds - a.seconds)[0],
    longestActiveGap: gaps.filter(g => g.meanReferenceEnergy >= .22 && g.activeReferenceSeconds >= 1)
      .toSorted((a, b) => b.seconds - a.seconds)[0] ?? null,
    longestUnintendedActiveGap: unintendedGaps.filter(g => g.meanReferenceEnergy >= .22 && g.activeReferenceSeconds >= 1)
      .toSorted((a, b) => b.seconds - a.seconds)[0] ?? null,
    measuredFinalFadeStart: fade,
    impactsDuringMeasuredFinalFade: fade === null ? 0 : events.filter(e => e.time >= fade).length,
    openingCues: score.accents.filter(a => a.time < 20).map(a => ({time: a.time, force: a.force, scale: a.scale})),
    ...(old ? {before: {authoredCueEntrances: old.authoredCueEntrances, totalImpacts: old.totalImpacts,
      longestActiveGapSeconds: old.longestActiveGap?.seconds ?? null}} : {}),
    mappedYouTubeValidationStatus: track.source?.validation_status ?? 'unmapped',
    direction: score.direction});
}
const report = {schemaVersion: 3, method: 'Actual RainScheduler plans; verified stored spectral-flux attacks at 23.2ms resolution. Energy is relative to each recording; activity threshold is .22. Recurring song-specific note, chord, echo and refrain cells select exact measured attacks, with authored principal/answer weights. Counts include secondary weather and existing physical gestures; maximum bursts use a rolling one-second window. This is a score audit, not listening or YouTube recording verification.',
  sourceCaveat: 'Local reference hashes establish which recording the score was measured against. They do not establish that a mapped YouTube upload contains that recording. Mismatched uploads remain held by the player; duration-only and unverified uploads still need recording-identity review.',
  allLocalRecordingHashesVerified: rows.every(row => row.localRecordingHashVerified === true),
  tracks: rows};
await writeFile(options.output ?? 'docs/music-choreography-audit.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({tracks: rows.length, localHashesVerified: report.allLocalRecordingHashesVerified,
  impacts: rows.reduce((sum, row) => sum + row.totalImpacts, 0),
  cueEntrances: rows.reduce((sum, row) => sum + row.authoredCueEntrances, 0),
  unintendedActiveGapsOver20Seconds: rows.filter(row => row.longestUnintendedActiveGap?.seconds > 20)
    .map(row => ({id: row.id, gap: row.longestUnintendedActiveGap})),
  impactsDuringMeasuredFinalFades: rows.reduce((sum, row) => sum + row.impactsDuringMeasuredFinalFade, 0)}, null, 2));
