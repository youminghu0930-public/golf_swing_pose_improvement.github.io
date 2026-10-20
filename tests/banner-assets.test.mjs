import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareBanner } from '../scripts/banner-assets.mjs';

test('banner preparation skips disabled, removed, and ambiguous configured videos', () => {
  const clips = [{key:'face-on-1',id:'1'}, {key:'down-the-line-1',id:'1'}];
  assert.equal(prepareBanner('/unused', clips, {enabled:false,video:'face-on-1'}),null);
  assert.equal(prepareBanner('/unused', clips, {video:'removed'}),null);
  assert.equal(prepareBanner('/unused', clips, {video:'1'}),null);
});
