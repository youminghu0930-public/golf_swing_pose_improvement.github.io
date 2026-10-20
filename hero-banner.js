import { createPoseOverlay } from './pose-overlay.js';
import { comparisonLabels } from './model-labels.js';

export function bannerFrameAt(times, time) {
  let low=0,high=times.length-1;
  while (low<high) { const mid=Math.ceil((low+high)/2); if(times[mid]<=time+.00001) low=mid; else high=mid-1; }
  return low;
}
export function bannerClip(clips, key) {
  const matches=clips.filter(clip=>clip.key===key || clip.id===key);
  return matches.length===1?matches[0]:null;
}
const make=(tag,className)=>{const node=document.createElement(tag); if(className)node.className=className; return node;};
async function read(url) {
  const response=await fetch(url);
  if(!response.ok)throw new Error(`Banner asset ${response.status}: ${url}`);
  return response.json();
}
export async function mountBanner(root, settings, copy) {
  const catalog=await read('materials/data/catalog.json');
  const clip=bannerClip(catalog.clips,settings.video);
  if(!clip) { root.hidden=true; console.warn(`Banner clip not found or ambiguous: ${settings.video}`); return; }
  const asset=catalog.banner?.key===clip.key ? catalog.banner : null;
  copy={...copy,...comparisonLabels(copy,catalog.models)};
  const viewport=make('div','banner-viewport');
  const video=make('video','banner-video');
  video.muted=true; video.defaultMuted=true; video.setAttribute('muted','');
  video.playsInline=true; video.setAttribute('playsinline','');
  video.loop=true; video.preload='metadata'; video.poster=clip.thumbnail;
  video.setAttribute('aria-hidden','true'); video.tabIndex=-1;
  viewport.append(video);
  const overlay=createPoseOverlay(viewport,1,copy,new Set(),()=>{},{interactive:false});
  const fitOverlay=()=>{
    const contain=Math.min(viewport.clientWidth/clip.width,viewport.clientHeight/clip.height);
    const cover=Math.max(viewport.clientWidth/clip.width,viewport.clientHeight/clip.height);
    if(contain) overlay.setTransform({zoom:cover/contain,x:0,y:0});
  };
  const resize=new ResizeObserver(fitOverlay);resize.observe(viewport);
  const badge=make('p','banner-badge'); badge.textContent=settings.label;
  const credit=make('div','banner-credit');
  root.replaceChildren(viewport,badge,credit);
  let callback, visible=false, loaded=false, wanted=!matchMedia('(prefers-reduced-motion: reduce)').matches;
  const draw=time=>overlay.render(bannerFrameAt(clip.times,time));
  const cancel=()=>{
    if(callback!==undefined) {
      if(video.requestVideoFrameCallback) video.cancelVideoFrameCallback(callback);
      else cancelAnimationFrame(callback);
      callback=undefined;
    }
  };
  const tick=(now,metadata)=>{
    callback=undefined;
    draw(metadata?.mediaTime??video.currentTime);
    if(!video.paused) schedule();
  };
  const schedule=()=>{
    cancel();
    callback=video.requestVideoFrameCallback?video.requestVideoFrameCallback(tick):requestAnimationFrame(tick);
  };
  const sync=()=>{
    if(loaded&&visible&&!document.hidden&&wanted) video.play().catch(()=>{});
    else video.pause();
  };
  video.addEventListener('play',schedule);
  video.addEventListener('pause',cancel);
  video.addEventListener('seeked',()=>{if(loaded)draw(video.currentTime);});
  video.addEventListener('loadeddata',()=>{if(loaded)draw(video.currentTime);});
  video.addEventListener('error',()=>{cancel(); root.hidden=true;});
  document.addEventListener('visibilitychange',sync);
  const observer=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;sync();}); observer.observe(root);
  read('materials/data/credits.json').then(credits=>{
    const source=credits[clip.key]??credits[clip.id]??credits[clip.id.split('-')[0]];
    if(!source)return;
    try {
      const url=new URL(typeof source==='string'?source:source.url);
      if(!['http:','https:'].includes(url.protocol))return;
      const link=make('a'); link.href=url.href;link.target='_blank';link.rel='noopener noreferrer';
      link.textContent=`${copy.creditLabel} ${copy.creditLink}`; credit.append(link);
    }catch { /* Attribution must not block the banner. */ }
  }).catch(()=>{});
  // Do not download video/poses when opening directly at a lower section.
  await new Promise(resolve=>{
    const visibility=new IntersectionObserver(entries=>{
      if(entries.some(entry=>entry.isIntersecting)) { visibility.disconnect(); resolve(); }
    });
    visibility.observe(root);
  });
  const pose=await read(asset?.pose??clip.poses.after);
  overlay.setPose(pose,clip.width,clip.height);fitOverlay(); loaded=true;
  video.src=asset?.video??clip.video;video.load();draw(0);sync();
}
