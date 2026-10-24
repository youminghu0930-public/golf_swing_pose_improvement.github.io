import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { prepareData, discoverPoseModels } from '../scripts/prepare-data.mjs';

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
    write('materials/data/vidoes/down-the-line/0019-1.MP4');
    write('materials/data/vidoes/down-the-line/incomplete.mp4');
    for (const side of ['yolo26x', 'golf_specific']) write(`materials/data/poses/${side}/down-the-line/0019-1.json`, JSON.stringify({ joints: ['nose'], pred: [[[1, 2]], [[3, 4]]] }));
    write('materials/data/snapshot.json', JSON.stringify({ '0019-1': { 1: ['nose'], 100: ['nose'] }, removed: { 0: ['nose'] } }));
    const first = prepareData(root, options);
    assert.equal(first.clips.length, 1);
    assert.equal(first.clips[0].id, '0019-1');
    assert.equal(first.clips[0].video, 'materials/data/vidoes/down-the-line/0019-1.MP4');
    assert.deepEqual(first.models, { before: 'yolo26x', after: 'golf_specific' });
    assert.equal(first.clips[0].poses.after, 'materials/data/poses/golf_specific/down-the-line/0019-1.json');
    assert.equal(first.clips[0].frameCount, 2);
    assert.equal(first.snapshots.length, 1);
    assert.match(first.snapshots[0].image, /0019-1-frame-1-[a-f0-9]{12}-[a-f0-9]{12}-q82\.webp$/);
    assert.ok(fs.existsSync(path.join(root,'materials/data/snapshot/down-the-line/0019-1/1.jpg')));
    write('materials/data/snapshot/down-the-line/0019-1/1.jpg','updated manually extracted image');
    assert.notEqual(prepareData(root,options).snapshots[0].image,first.snapshots[0].image);
    assert.deepEqual(first.snapshots[0].before, { joints: ['nose'], pred: [[[3, 4]]] });
    assert.deepEqual(first.snapshots[0].after, { joints: ['nose'], pred: [[[3, 4]]] });
    assert.equal(JSON.parse(fs.readFileSync(path.join(root, first.clips[0].poses.before))).pred.length, 2);
    write('materials/data/poses/yolo26x/down-the-line/0019-1.json', JSON.stringify({ joints: ['nose'], pred: [[[1, 2]], [[30, 40]]] }));
    assert.deepEqual(prepareData(root, options).snapshots[0].before.pred, [[[30, 40]]]);
    write('materials/data/vidoes/down-the-line/0019-1.MP4', 'new video content');
    assert.notEqual(prepareData(root, options).snapshots[0].image, first.snapshots[0].image);
    fs.unlinkSync(path.join(root, 'materials/data/poses/golf_specific/down-the-line/0019-1.json'));
    const second = prepareData(root, options);
    assert.deepEqual(second, { models: first.models, clips: [], snapshots: [] });
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root, 'materials/data/catalog.json'))), second);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('model discovery follows a renamed general-purpose folder and rejects ambiguous comparisons', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'golf-model-test-'));
  try {
    fs.mkdirSync(path.join(root, 'materials/data/poses/yolo26n'), { recursive: true });
    fs.mkdirSync(path.join(root, 'materials/data/poses/golf_specific'));
    assert.deepEqual(discoverPoseModels(root), { before: 'yolo26n', after: 'golf_specific' });
    fs.mkdirSync(path.join(root, 'materials/data/poses/yolo26x'));
    assert.throws(() => discoverPoseModels(root), /Keep one/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
