import test from 'node:test';
import assert from 'node:assert/strict';
import { snapshotItems, spotlightPoints, snapshotFocus } from '../snapshot-data.js';

test('snapshot joint arrays support shared per-model message boxes', () => {
  const [item] = snapshotItems({ swing: { 0: { title:'Occluded hands', joints:['left_wrist','right_wrist'],
    message_box:{general:'Incorrect wrists',specialized:'Reasonable wrists'} } } },
    [{id:'swing',key:'face-on-swing',frameCount:10}]);
  assert.equal(item.title,'Occluded hands');
  assert.deepEqual(item.joints,['left_wrist','right_wrist']);
  assert.deepEqual(item.explanations.left_wrist,item.explanations.right_wrist);
  assert.equal(item.explanations.left_wrist.general,'Incorrect wrists');
  assert.equal(item.explanations.right_wrist.specialized,'Reasonable wrists');
});

test('rich snapshots retain titles, joint selection, and per-model explanations', () => {
  const [item] = snapshotItems({ swing: { 0: { title: 'Arm occlusion', joints: {
    left_wrist: { general: 'Uncertain wrist', specialized: 'Correct wrist' },
    right_elbow: { specialized: 'Visible elbow' },
  } } } }, [{ id:'swing', key:'face-on-swing', frameCount:10 }]);
  assert.equal(item.title,'Arm occlusion');
  assert.deepEqual(item.joints,['left_wrist','right_elbow']);
  assert.equal(item.explanations.left_wrist.general,'Uncertain wrist');
  assert.equal(item.explanations.right_elbow.general,'');
});

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

test('snapshot focus averages each view first so different visible joint counts have equal weight', () => {
  const entry = { joints: ['a', 'b', 'c'], before: { joints: ['a', 'b', 'c'], pred: [[[10, 20], [30, 40], [50, 60]]] }, after: { joints: ['a'], pred: [[[90, 100]]] } };
  assert.deepEqual(snapshotFocus(entry), { x: 60, y: 70 });
});

test('snapshot focus ignores unavailable points and falls back to the available view or image center', () => {
  const entry = { joints: ['nose'], before: { joints: ['nose'], pred: [[[0, 0]]] }, after: { joints: ['nose'], pred: [[[30, 40]]] } };
  assert.deepEqual(snapshotFocus(entry), { x: 30, y: 40 });
  entry.after.pred = [[[30, 40, -1]]];
  assert.equal(snapshotFocus(entry), null);
});
