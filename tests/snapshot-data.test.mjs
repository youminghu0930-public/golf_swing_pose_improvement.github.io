import test from 'node:test';
import assert from 'node:assert/strict';
import { snapshotItems, spotlightPoints } from '../snapshot-data.js';

const clips = [{ id: '0000', key: 'face-on-0000', frameCount: 100 }, { id: '0001', key: 'face-on-0001', frameCount: 50 }];
test('curated videos expand into ordered, zero-based frame entries', () => {
  const result = snapshotItems({ '0000': { '10': ['right_elbow', 'left_ankle'], '20': ['left_elbow'] }, '0001': { '15': ['left_ankle'], '25': ['left_elbow'] } }, clips);
  assert.deepEqual(result.map(item => [item.clip.id, item.frame]), [['0000', 10], ['0000', 20], ['0001', 15], ['0001', 25]]);
  assert.equal(snapshotItems({ '0000': { '0': ['nose'] } }, clips)[0].frame, 0);
});
test('spotlights use each model’s own locations and omit missing joints independently', () => {
  const before = { joints: ['nose'], pred: [[[10, 20, .5]]] };
  const after = { joints: ['nose', 'atlas'], pred: [[[30, 40], [35, 42]]] };
  assert.deepEqual(spotlightPoints(before, ['nose', 'atlas']), [[10, 20]]);
  assert.deepEqual(spotlightPoints(after, ['nose', 'atlas']), [[30, 40], [35, 42]]);
  assert.deepEqual(spotlightPoints(before, ['atlas']), []);
});
test('invalid selections fail early instead of generating misleading snapshots', () => {
  assert.throws(() => snapshotItems({ missing: { 0: ['nose'] } }, clips));
  assert.throws(() => snapshotItems({ '0000': { 100: ['nose'] } }, clips));
  assert.throws(() => snapshotItems({ '0000': { 0: [] } }, clips));
  assert.throws(() => snapshotItems({ '0000': { 0: ['nose'] } }, [...clips, { id: '0000', key: 'down-the-line-0000', frameCount: 100 }]));
});
test('runtime tolerates removed clips and invalid frames without losing valid selections', () => {
  const warnings = [];
  const items = snapshotItems({ removed: { 0: ['nose'] }, '0000': { 0: ['nose'], 100: ['nose'], 2: [] } }, clips, { onWarning: message => warnings.push(message) });
  assert.deepEqual(items.map(item => item.frame), [0]);
  assert.equal(warnings.length, 3);
});
