import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { prepareData } from '../scripts/prepare-data.mjs';

test('catalog reflects actual files, preserves hyphens, and drops deleted/incomplete clips', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'golf-data-test-'));
  const write = (file, value = '') => {
    const target = path.join(root, file); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, value);
  };
  const options = {
    probe: () => ({ times: [0, .03, .06], width: 720, height: 1280 }),
    preview: (_, target) => fs.writeFileSync(target, 'preview'), warn: () => {},
  };
  try {
    write('data/vidoes/down-the-line/0019-1.MP4');
    write('data/vidoes/down-the-line/incomplete.mp4');
    for (const side of ['before', 'after']) write(`data/poses/${side}/down-the-line/0019-1.json`, JSON.stringify({ joints: ['nose'], pred: [[[1, 2]], [[3, 4]]] }));
    write('data/poses/snapshot.json', JSON.stringify({ '0019-1': { 1: ['nose'], 100: ['nose'] }, removed: { 0: ['nose'] } }));
    const first = prepareData(root, options);
    assert.equal(first.clips.length, 1);
    assert.equal(first.clips[0].id, '0019-1');
    assert.equal(first.clips[0].video, 'data/vidoes/down-the-line/0019-1.MP4');
    assert.equal(first.clips[0].poses.after, 'data/poses/after/down-the-line/0019-1.json');
    assert.equal(first.clips[0].frameCount, 2);
    assert.equal(first.snapshots.length, 1);
    fs.unlinkSync(path.join(root, 'data/poses/after/down-the-line/0019-1.json'));
    const second = prepareData(root, options);
    assert.deepEqual(second, { clips: [], snapshots: [] });
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root, 'data/catalog.json'))), second);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
