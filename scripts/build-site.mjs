// Package only current data and site code, never the legacy assets directory.
import fs from 'node:fs';
import path from 'node:path';
import { prepareData, projectRoot } from './prepare-data.mjs';
import { writeFastStart } from './faststart.mjs';
import { createHash } from 'node:crypto';
import { encodeTrialVideo } from './trial-video.mjs';

const catalog = prepareData();
const destination = path.join(projectRoot, 'dist');
// Each build gets a clean output so removed sources cannot survive deployment.
fs.rmSync(destination, { recursive: true, force: true });
fs.mkdirSync(destination, { recursive: true });
const options = JSON.parse(fs.readFileSync(path.join(projectRoot, 'scripts/media-options.json'), 'utf8'));
const trial = catalog.clips.find(clip => clip.key === options.trialVideoKey);
let trialReport;
if (trial) {
  const source = path.join(projectRoot, trial.video);
  const hash = createHash('sha256').update(fs.readFileSync(source)).update(`h264-slow-crf${options.trialVideoCrf}-v1`).digest('hex').slice(0, 12);
  const relative = `data/.generated/${trial.key}-trial-${hash}.mp4`;
  const output = path.join(destination, relative);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  trialReport = encodeTrialVideo(source, output, options.trialVideoCrf);
  if (trialReport.trialBytes < trialReport.originalBytes) trial.video = relative;
  else {
    fs.unlinkSync(output);
    console.warn('Trial was not smaller; keeping the original video for the player.');
  }
}
const files = new Set(['index.html', 'styles.css', '.nojekyll', 'data/catalog.json']);
for (const filename of fs.readdirSync(projectRoot)) if (filename.endsWith('.js')) files.add(filename);
for (const filename of ['data/credits.json', 'data/poses/snapshot.json']) if (fs.existsSync(path.join(projectRoot, filename))) files.add(filename);
for (const clip of catalog.clips) for (const file of [clip.video, clip.thumbnail, ...Object.values(clip.poses)]) files.add(file);
for (const snapshot of catalog.snapshots) files.add(snapshot.image);
const videos = new Set(catalog.clips.map(clip => clip.video));
let remuxed = 0;
for (const file of files) {
  const target = path.join(destination, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  if (videos.has(file) && trialReport && trial?.video === file && file.startsWith('data/.generated/')) continue;
  if (videos.has(file)) remuxed += Number(writeFastStart(path.join(projectRoot, file), target));
  else fs.copyFileSync(path.join(projectRoot, file), target);
}
fs.cpSync(path.join(projectRoot, 'materials'), path.join(destination, 'materials'), { recursive: true });
fs.writeFileSync(path.join(destination, 'data/catalog.json'), JSON.stringify(catalog));
if (trialReport) console.log(`Video trial ${trial.key}: ${trialReport.originalBytes} → ${trialReport.trialBytes} bytes; ${trialReport.frames} aligned frames.`);
console.log(`Built dist/ from ${catalog.clips.length} actual data clips; legacy assets excluded.`);
console.log(`Fast-start metadata moved for ${remuxed} videos without re-encoding; original data untouched.`);
