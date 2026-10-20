import test from 'node:test';
import assert from 'node:assert/strict';
import { comparisonLabels } from '../model-labels.js';

const copy = { before: 'General-purpose model', after: 'Golf-specific model', modelTag: '{label} · {model}' };
test('comparison headings derive the general-purpose model name from its folder', () => {
  assert.deepEqual(comparisonLabels(copy, { before: 'yolo26x', after: 'golf_specific' }), { before: 'General-purpose model · YOLO26x', after: 'Golf-specific model' });
  assert.equal(comparisonLabels(copy, { before: 'yolo26n' }).before, 'General-purpose model · YOLO26n');
  assert.equal(comparisonLabels(copy, { before: 'other_model' }).before, 'General-purpose model · other_model');
  assert.equal(comparisonLabels(copy).before, 'General-purpose model');
});
