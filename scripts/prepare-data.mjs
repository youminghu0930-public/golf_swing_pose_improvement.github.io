// Generate metadata and small previews from data, never duplicate videos or poses.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { snapshotItems } from '../snapshot-data.js';

export const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const directories = directory => fs.existsSync(directory) ? fs.readdirSync(directory, { withFileTypes: true }).filter(e => e.isDirectory() && !e.name.startsWith('.')).map(e => e.name).sort() : [];

export function prepareData(root = projectRoot, { probe = probeVideo, preview = makePreview, warn = console.warn } = {}) {
  for (const command of [probe === probeVideo && 'ffprobe', preview === makePreview && 'ffmpeg'].filter(Boolean)) {
    try { execFileSync(command, ['-version'], { stdio: 'ignore' }); }
    catch { throw new Error(`Install FFmpeg (including ${command}) before preparing data.`); }
  }
  const generated = path.join(root, 'data/.generated');
  fs.mkdirSync(generated, { recursive: true });
  const cacheFile = path.join(generated, 'probe-cache.json');
  let oldCache = {};
  try { oldCache = read(cacheFile); } catch { /* Fresh checkout or invalid disposable cache. */ }
  const cache = {};
  const ensurePreview = (source, destination, frame) => {
    if (!fs.existsSync(destination) || fs.statSync(destination).mtimeMs < fs.statSync(source).mtimeMs) preview(source, destination, frame);
  };
  const clips = [];
  for (const view of directories(path.join(root, 'data/vidoes'))) {
    const folder = path.join(root, 'data/vidoes', view);
    for (const filename of fs.readdirSync(folder).filter(name => /\.mp4$/i.test(name)).sort()) {
      const id = path.parse(filename).name, key = `${view}-${id}`;
      const video = `data/vidoes/${view}/${filename}`;
      const poses = Object.fromEntries(['before', 'after'].map(side => [side, `data/poses/${side}/${view}/${id}.json`]));
      if (Object.values(poses).some(file => !fs.existsSync(path.join(root, file)))) {
        warn(`Skipping ${key}: missing Before or After poses.`); continue;
      }
      try {
        const counts = Object.values(poses).map(file => {
          const pose = read(path.join(root, file));
          if (!Array.isArray(pose.joints) || !Array.isArray(pose.pred)) throw new Error(`Invalid pose file: ${file}`);
          return pose.pred.length;
        });
        const source = path.join(root, video), stat = fs.statSync(source);
        const signature = `${stat.size}:${stat.mtimeMs}`;
        const metadata = oldCache[video]?.signature === signature ? oldCache[video].metadata : probe(source);
        cache[video] = { signature, metadata };
        const frameCount = Math.min(metadata.times.length, ...counts);
        if (!frameCount) throw new Error('No shared frames');
        const thumbnail = `data/.generated/${key}-thumbnail.jpg`;
        ensurePreview(source, path.join(root, thumbnail), null);
        clips.push({ id, key, view, video, poses, thumbnail, frameCount, videoFrameCount: metadata.times.length,
          poseFrameCounts: counts, width: metadata.width, height: metadata.height, times: metadata.times.slice(0, frameCount) });
      } catch (error) { warn(`Skipping ${key}: ${error.message}`); }
    }
  }
  const snapshots = [];
  const snapshotPoses = new Map();
  const configFile = path.join(root, 'data/poses/snapshot.json');
  if (fs.existsSync(configFile)) {
    try {
      for (const { clip, frame } of snapshotItems(read(configFile), clips, { onWarning: warn })) {
        const image = `data/.generated/${clip.key}-frame-${frame}.jpg`;
        try {
          ensurePreview(path.join(root, clip.video), path.join(root, image), frame);
          const snapshot = { key: `${clip.key}-${frame}`, image };
          for (const side of ['before', 'after']) {
            const file = clip.poses[side];
            if (!snapshotPoses.has(file)) snapshotPoses.set(file, read(path.join(root, file)));
            const pose = snapshotPoses.get(file);
            // Only the displayed frame is sent to snapshot visitors, not the entire video prediction.
            snapshot[side] = { joints: pose.joints, pred: [pose.pred[frame].slice(0, pose.joints.length)] };
          }
          snapshots.push(snapshot);
        } catch (error) { warn(`Snapshot preview ${clip.key}/${frame}: ${error.message}`); }
      }
    } catch (error) { warn(`Snapshot configuration: ${error.message}`); }
  }
  const catalog = { clips, snapshots };
  fs.writeFileSync(path.join(root, 'data/catalog.json'), JSON.stringify(catalog));
  fs.writeFileSync(cacheFile, JSON.stringify(cache));
  return catalog;
}

function probeVideo(file) {
  const result = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_frames', '-show_streams', '-show_entries', 'stream=width,height:frame=best_effort_timestamp_time', '-of', 'json', file], { maxBuffer: 32 * 1024 * 1024 }));
  const origin = Number(result.frames[0]?.best_effort_timestamp_time);
  const times = result.frames.map(frame => Number((Number(frame.best_effort_timestamp_time) - origin).toFixed(6)));
  if (!times.length || !times.every(Number.isFinite)) throw new Error('Invalid video frame times');
  return { times, width: result.streams[0].width, height: result.streams[0].height };
}

function makePreview(source, destination, frame) {
  const filter = frame === null ? 'scale=192:192:force_original_aspect_ratio=decrease' : `select=eq(n\\,${frame})`;
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', source, '-vf', filter, '-frames:v', '1', '-q:v', frame === null ? '5' : '3', destination]);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const catalog = prepareData();
  console.log(`Indexed ${catalog.clips.length} videos and ${catalog.snapshots.length} snapshots directly from data/.`);
}
