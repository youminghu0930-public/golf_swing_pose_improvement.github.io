import test from 'node:test';
import assert from 'node:assert/strict';
import { zoomView, constrainView } from '../linked-view.js';

test('zoom preserves the source point under the cursor', () => {
  const state = { zoom: 2, x: .1, y: -.15 }, anchor = { x: .3, y: -.2 };
  const result = zoomView(state, 3, anchor);
  assert.ok(Math.abs((anchor.x - state.x) / state.zoom - (anchor.x - result.x) / result.zoom) < 1e-10);
  assert.ok(Math.abs((anchor.y - state.y) / state.zoom - (anchor.y - result.y) / result.zoom) < 1e-10);
});
test('pan bounds keep the frame covering its viewport', () => {
  assert.deepEqual(constrainView({ zoom: 2, x: 5, y: -5 }), { zoom: 2, x: .5, y: -.5 });
  assert.deepEqual(constrainView({ zoom: 1, x: .2, y: -.3 }), { zoom: 1, x: 0, y: 0 });
});
test('zoom limits and zooming back to full frame reset panning', () => {
  assert.deepEqual(zoomView({ zoom: 3, x: .7, y: -.4 }, .5), { zoom: 1, x: 0, y: 0 });
  assert.equal(zoomView({ zoom: 1, x: 0, y: 0 }, 10).zoom, 6);
});
