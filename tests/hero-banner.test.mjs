import test from 'node:test';
import assert from 'node:assert/strict';
import { bannerFrameAt, bannerClip } from '../hero-banner.js';
test('banner frame mapping follows actual frame timestamps and handles looping',()=>{
  const times=[0,.033,.067,.1];
  assert.equal(bannerFrameAt(times,.066),1);
  assert.equal(bannerFrameAt(times,.1),3);
  assert.equal(bannerFrameAt(times,0),0);
});
test('banner resolves configurable catalog clips without guessing ambiguous or removed entries',()=>{
  const clip={key:'face-on-0000',id:'0000'};
  assert.equal(bannerClip([clip],'face-on-0000'),clip);
  assert.equal(bannerClip([clip],'0000'),clip);
  assert.equal(bannerClip([clip],'removed'),null);
  assert.equal(bannerClip([clip,{key:'down-the-line-0000',id:'0000'}],'0000'),null);
});
