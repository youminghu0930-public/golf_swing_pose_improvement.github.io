// Package only current data and site code, never the legacy assets directory.
import fs from 'node:fs';
import path from 'node:path';
import { prepareData, projectRoot } from './prepare-data.mjs';
import { writeFastStart } from './faststart.mjs';

const catalog = prepareData();
const destination = path.join(projectRoot, 'dist');
// Each build gets a clean output so removed sources cannot survive deployment.
fs.rmSync(destination, { recursive: true, force: true });
fs.mkdirSync(destination, { recursive: true });
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
  if (videos.has(file)) remuxed += Number(writeFastStart(path.join(projectRoot, file), target));
  else fs.copyFileSync(path.join(projectRoot, file), target);
}
fs.cpSync(path.join(projectRoot, 'materials'), path.join(destination, 'materials'), { recursive: true });
console.log(`Built dist/ from ${catalog.clips.length} actual data clips; legacy assets excluded.`);
console.log(`Fast-start metadata moved for ${remuxed} videos without re-encoding; original data untouched.`);
