import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { siteFiles } from '../scripts/site-files.mjs';

test('deployment includes referenced materials/data files without recursively publishing source/cache files', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'golf-site-files-'));
  const write = file => { const target = path.join(root, file); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, 'fixture'); };
  try {
    for (const file of ['main.js', 'materials/content.json', 'materials/data/credits.json', 'materials/data/poses/snapshot.json',
      'materials/data/vidoes/view/unused.mp4', 'materials/data/.generated/old.jpg', 'materials/data/.generated/probe-cache.json']) write(file);
    const clip = { video: 'materials/data/.generated/videos/used.mp4', thumbnail: 'materials/data/.generated/used.jpg',
      poses: { before: 'materials/data/poses/yolo26x/view/used.json', after: 'materials/data/poses/golf_specific/view/used.json' } };
    const snapshot = { image: 'materials/data/.generated/used.webp' };
    const banner = { video: 'materials/data/.generated/banner.mp4', pose: 'materials/data/.generated/banner.json', poster: 'materials/data/.generated/banner-first.webp' };
    const files = siteFiles(root, { clips: [clip], snapshots: [snapshot], banner });
    assert.ok(files.has(banner.video));
    assert.ok(files.has(banner.pose));
    assert.ok(files.has(banner.poster));
    for (const file of ['main.js', 'materials/content.json', 'materials/data/catalog.json', clip.video, clip.thumbnail,
      ...Object.values(clip.poses), snapshot.image, 'materials/data/credits.json', 'materials/data/poses/snapshot.json']) assert.ok(files.has(file), file);
    for (const file of ['materials/data/vidoes/view/unused.mp4', 'materials/data/.generated/old.jpg', 'materials/data/.generated/probe-cache.json']) assert.equal(files.has(file), false, file);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
