import { createPoseOverlay } from './pose-overlay.js';
import { snapshotItems, spotlightPoints } from './snapshot-data.js';
import { installLinkedView } from './linked-view.js';
import { overlayTransform } from './pose-geometry.js';

const make = (tag, text, className) => {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
};
const format = (text, values) => text.replace(/\{(\w+)\}/g, (_, key) => values[key]);
const svg = (tag, attributes = {}) => {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
  return node;
};

async function extractSnapshot(entry) {
  const video = document.createElement('video');
  video.muted = true; video.preload = 'auto'; video.playsInline = true;
  const wait = event => new Promise((resolve, reject) => {
    const timer = setTimeout(() => done(new Error('Snapshot video timed out')), 30000);
    const done = error => {
      clearTimeout(timer); video.removeEventListener(event, success); video.removeEventListener('error', failure);
      error ? reject(error) : resolve();
    };
    const success = () => done();
    const failure = () => done(new Error('Snapshot video could not be loaded'));
    video.addEventListener(event, success, { once: true }); video.addEventListener('error', failure, { once: true });
  });
  try {
    const loaded = wait('loadeddata'); video.src = entry.video; await loaded;
    const start = entry.times[entry.frame];
    const interval = (entry.times[entry.frame + 1] ?? (start + 1 / 30)) - start;
    // Seek inside the frame, not its rounded boundary (same rule as the video viewer).
    const time = start + Math.min(interval / 2, .01);
    if (Math.abs(video.currentTime-time) > .000001) {
      const sought = wait('seeked'); video.currentTime = time; await sought;
    }
    const canvas = document.createElement('canvas'); canvas.width = entry.width; canvas.height = entry.height;
    canvas.getContext('2d').drawImage(video, 0, 0, entry.width, entry.height);
    return canvas.toDataURL('image/jpeg', .9);
  } finally { video.removeAttribute('src'); video.load(); }
}

function addShade(viewport, entry, side, id) {
  const shade = svg('svg', { class: 'snapshot-shade', viewBox: `0 0 ${entry.width} ${entry.height}`, preserveAspectRatio: 'xMidYMid meet', 'aria-hidden': 'true' });
  const defs = svg('defs');
  const mask = svg('mask', { id, maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: entry.width, height: entry.height, 'mask-type': 'luminance' });
  mask.append(svg('rect', { width: entry.width, height: entry.height, fill: 'white' }));
  const holes = svg('g', { fill: 'black' });
  for (const [x, y] of spotlightPoints(entry[side], entry.joints)) holes.append(svg('circle', { cx: x, cy: y, r: Math.max(entry.width, entry.height)/16, 'data-spotlight': side }));
  mask.append(holes); defs.append(mask); shade.append(defs);
  const geometry = svg('g');
  geometry.append(svg('rect', { width: entry.width, height: entry.height, fill: '#000', 'fill-opacity': '.4', mask: `url(#${id})` }));
  shade.append(geometry);
  viewport.append(shade);
  return state => geometry.setAttribute('transform', overlayTransform(entry.width, entry.height, viewport.clientWidth, viewport.clientHeight, state));
}

export async function mountSnapshots(root, copy) {
  const labels = copy.snapshots;
  const json = async (url, cache = 'default') => {
    const response = await fetch(url, { cache });
    if (!response.ok) throw new Error(`${url}: ${response.status}`);
    return response.json();
  };
  const [config, manifest, credits] = await Promise.all([
    json('data/poses/snapshot.json', 'no-cache').catch(() => ({})), json('data/catalog.json', 'no-cache'),
    json('data/credits.json', 'no-cache').catch(() => ({})),
  ]);
  const poses = new Map();
  const snapshots = snapshotItems(config, manifest.clips, { onWarning: message => console.warn(message) }).map(({ clip, frame, joints }) => {
    const cached = manifest.snapshots?.find(entry => entry.key === `${clip.key}-${frame}`);
    return { ...clip, videoId: clip.id, frame, joints, image: cached?.image, before: cached?.before, after: cached?.after,
      credit: credits[clip.key] ?? credits[clip.id] ?? credits[clip.id.split('-')[0]] ?? null };
  });
  if (!snapshots.length) { root.replaceChildren(make('p', labels.empty)); return; }
  root.setAttribute('role', 'region');
  root.setAttribute('aria-label', labels.title);
  root.setAttribute('aria-roledescription', labels.carousel);
  const shell = make('div', undefined, 'snapshot-shell');
  const stage = make('div', undefined, 'snapshot-wheel');
  const previous = make('button', '‹', 'snapshot-arrow snapshot-previous');
  const next = make('button', '›', 'snapshot-arrow snapshot-next');
  for (const [button, label] of [[previous, labels.previous], [next, labels.next]]) {
    button.type = 'button'; button.title = label; button.setAttribute('aria-label', label);
    button.disabled = snapshots.length < 2;
  }
  const loaders = [];
  const cards = snapshots.map((entry, index) => {
    const displayFrame = entry.frame + 1;
    const card = make('article', undefined, 'snapshot-card');
    card.setAttribute('aria-label', format(labels.itemLabel, { video: entry.videoId, frame: displayFrame }));
    const header = make('div', undefined, 'snapshot-card-header');
    header.append(make('strong', format(copy.clipLabel, { id: entry.videoId })), make('span', format(labels.frame, { frame: displayFrame })));
    const comparison = make('div', undefined, 'snapshot-comparison');
    const viewports = [], scenes = [], overlays = [], shades = [];
    const images = [], errors = [];
    let viewState = { zoom: 1, x: 0, y: 0 }, loading;
    for (const [side, viewIndex] of [['before', 0], ['after', 1]]) {
      const panel = make('div', undefined, 'comparison-panel');
      const heading = make('div', undefined, 'panel-heading');
      heading.append(make('strong', copy[side]), make('span', side === 'before' ? copy.beforeModel : copy.afterModel));
      const viewport = make('div', undefined, 'pose-viewport snapshot-image-window');
      const image = make('img');
      image.width = entry.width; image.height = entry.height;
      image.alt = `${copy[side]} · ${format(labels.itemLabel, { video: entry.videoId, frame: displayFrame })}`;
      image.draggable = false; image.decoding = 'async';
      const imageError = make('span', labels.imageError, 'snapshot-image-error'); imageError.hidden = true;
      image.addEventListener('error', () => { imageError.hidden = false; });
      const scene = make('div', undefined, 'pose-scene'); scene.append(image);
      viewport.append(scene, imageError);
      viewports.push(viewport); scenes.push(scene); images.push(image); errors.push(imageError);
      panel.append(heading, viewport); comparison.append(panel);
    }
    installLinkedView(viewports, scenes, state => {
      viewState = state;
      overlays.forEach(overlay => overlay.setTransform(state));
      shades.forEach(update => update(state));
    });
    loaders.push(active => {
      images.forEach(image => { image.fetchPriority = active ? 'high' : 'low'; });
      if (loading) return loading;
      loading = (async () => {
        if (entry.image) images.forEach(image => { image.src = entry.image; });
        // Stale catalogs/new manual selections only: load full poses for this card on demand.
        await Promise.all(['before', 'after'].map(async side => {
          if (entry[side]) return;
          const file = entry.poses[side];
          if (!poses.has(file)) poses.set(file, json(file));
          const pose = await poses.get(file);
          entry[side] = { joints: pose.joints, pred: [pose.pred[entry.frame]] };
        }));
        for (const [viewIndex, side] of ['before', 'after'].entries()) {
          const overlay = createPoseOverlay(viewports[viewIndex], viewIndex, copy, new Set(entry.joints.map(name => `joint:${name}`)), () => {});
          overlay.setPose(entry[side], entry.width, entry.height); overlay.render(0); overlay.setTransform(viewState);
          overlays.push(overlay);
          const updateShade = addShade(viewports[viewIndex], entry, side, `snapshot-mask-${index}-${side}`);
          updateShade(viewState); shades.push(updateShade);
        }
        if (!entry.image) {
          const image = await extractSnapshot(entry);
          images.forEach(node => { node.src = image; });
        }
      })().catch(error => {
        console.warn(`Snapshot ${entry.key}/${entry.frame}:`, error);
        errors.forEach(node => { node.hidden = false; });
      });
      return loading;
    });
    card.append(header, comparison); stage.append(card);
    return card;
  });
  shell.append(stage, previous, next);
  const dots = make('div', undefined, 'snapshot-dots');
  dots.setAttribute('role', 'group'); dots.setAttribute('aria-label', labels.navigation);
  const dotButtons = snapshots.map((entry, index) => {
    const button = make('button'); button.type = 'button';
    button.setAttribute('aria-label', format(labels.show, { video: entry.videoId, frame: entry.frame + 1 }));
    button.append(make('span')); button.disabled = true; dots.append(button); return button;
  });
  const details = make('div', undefined, 'snapshot-details');
  const credit = make('p', undefined, 'snapshot-source');
  details.append(credit, make('p', copy.panZoomHint, 'keyboard-hint'), make('p', labels.inspectionHint, 'keyboard-hint'));
  root.replaceChildren(shell, dots, details);

  const count = cards.length, step = Math.PI*2/count;
  let position = 0, target = 0, animation;
  const modulo = value => (value % count + count) % count;
  function layout() {
    const radius = count > 1 ? Math.max(220, stage.clientWidth*.62) : 0;
    cards.forEach((card, index) => {
      const angle = (index-position)*step;
      card.style.transform = `translateX(-50%) translate3d(${Math.sin(angle)*radius}px, 0, ${(Math.cos(angle)-1)*radius}px)`;
      card.style.opacity = String(.35 + .65*(Math.cos(angle)+1)/2);
    });
    stage.style.height = `${cards[0].offsetHeight+24}px`;
  }
  function updateSelection() {
    const index = modulo(target), entry = snapshots[index];
    loaders[index](true);
    // Give the active card first priority; warm up only its two immediate neighbors.
    requestAnimationFrame(() => {
      if (modulo(target) !== index || count < 2) return;
      loaders[modulo(index-1)](false); loaders[modulo(index+1)](false);
    });
    cards.forEach((card, i) => {
      card.setAttribute('aria-hidden', String(i !== index));
      card.inert = i !== index;
      card.classList.toggle('is-current', i === index);
    });
    dotButtons.forEach((button, i) => button.setAttribute('aria-current', String(i === index)));
    credit.replaceChildren();
    try {
      const url = new URL(typeof entry.credit === 'string' ? entry.credit : entry.credit?.url);
      if (['https:', 'http:'].includes(url.protocol)) {
        const link = make('a', copy.creditLink); link.href = url.href; link.target = '_blank'; link.rel = 'noopener noreferrer';
        credit.append(make('span', `${copy.creditLabel} `), link);
      }
    } catch { /* Credits are optional and must not block snapshot navigation. */ }
    root.dataset.snapshotIndex = String(index);
  }
  function animate(nextTarget) {
    cancelAnimationFrame(animation);
    const from = position, started = performance.now(); target = nextTarget; updateSelection();
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { position = target; layout(); return; }
    const tick = now => {
      const progress = Math.min(1, (now-started)/300);
      // Reach cruising speed slightly earlier, leaving more time to settle.
      const phase = progress ** .9;
      const eased = phase * phase * (3 - 2 * phase);
      position = from + (target-from)*eased;
      layout();
      if (progress < 1) animation = requestAnimationFrame(tick);
    };
    animation = requestAnimationFrame(tick);
  }
  previous.onclick = () => animate(target-1);
  next.onclick = () => animate(target+1);
  const resize = new ResizeObserver(layout); resize.observe(stage); resize.observe(cards[0]);
  updateSelection(); layout();
}
