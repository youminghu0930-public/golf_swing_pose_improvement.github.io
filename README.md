# Golf swing pose estimation

A light, single-page project showcase, built with plain HTML, CSS, and JavaScript for GitHub Pages. No runtime backend is required. Preview and deployment generate a small catalog from the actual files in `data/`.

## Editing content

All project copy lives in **`materials/content.json`**: the browser title, description, hero, navigation labels, section headings, paragraphs, accomplishments, statistics, and result placeholder. Navigation labels are derived from section titles. Edit this file to change the displayed text; no HTML or JavaScript changes are needed.

`sections` controls the order of the page. Each section has a stable `id` for navigation and a `title`. It can include `paragraphs`, `items` (an ordered list), `metrics` (`value` and `label`), and `demo` (viewer labels).

- `index.html`: page shell.
- `main.js`: loads the content and renders it using textContent.
- `styles.css`: responsive layout, typography, and colors.
- `viewer.js`: shared video decoder, Before/After skeleton rendering, frame controls, and video list.
- `pose-overlay.js`: interactive joint and bone overlays, hover labels, and persistent selections.
- `frame-keys.js`: global horizontal-arrow stepping and continuous stepping while held.
- `linked-view.js`: shared pan/zoom state, mouse/touch gestures, and framing limits.
- `data/`: the source of truth: original videos, frame-indexed pose predictions, snapshot selections, and credits. Include the files you want published in Git.
- `data/catalog.json` and `data/.generated/`: automatically generated metadata and small preview images, ignored by Git. No duplicate videos or pose JSON are generated.
- `assets/`: legacy output, no longer read by the page or included in deployment. It can be removed separately.

The videos directory is currently spelled `data/vidoes/`. Preserve that spelling when referencing existing assets unless the directory is deliberately renamed.

## Local preview

Serve this directory over HTTP, rather than opening `index.html` directly, so the browser can fetch the JSON:

```sh
node scripts/serve.mjs
```

Open http://127.0.0.1:8001. Install FFmpeg (including ffprobe) first. The server generates the catalog/previews on the first viewer request and refreshes them after data changes when the page is reloaded. Initial generation can take a moment. It supports byte-range requests for efficient MP4 seeking. With a generic server, first run `node scripts/prepare-data.mjs` after changing files. If a server does not support seeking, the viewer downloads the selected clip into a local Blob as a compatibility fallback. Pass a port as an argument if needed: `node scripts/serve.mjs 8002`.

## GitHub Pages

In repository Settings → Pages, choose **GitHub Actions** as the build/deployment source. The included `.github/workflows/pages.yml` tests and builds the page on pushes to `master` or `main`, then deploys `dist/`. URLs are relative so the page also works under a repository subpath. This workflow has been added locally; configuring the repository or pushing is a separate step.

`data/` is no longer ignored. Only the data files actually committed and pushed are visible to the deployment build. Keep/remove whichever source clips you want before committing; the build scans that checkout, skips clips missing Before or After poses, and creates a fresh catalog. It does not use local ignored previews or the old `assets/` directory. Missing/invalid snapshot selections are skipped, so one removed clip does not break the others. Generated metadata/previews and `dist/` remain ignored.

To check the same deployment build locally, run `node scripts/build-site.mjs`. It creates a clean `dist/` with the site, catalog, preview images, and the original video/pose files for valid pairs. No video re-encoding or duplication into `assets/` occurs. Keep browser-compatible MP4 codecs in the original videos; originals are not automatically remuxed. Large videos/pose JSON may load slower than the former optimized copies.

## Preparing the demo

### Curated snapshot highlights

Result contains an upper snapshot carousel and the existing video comparison below it. Edit `data/poses/snapshot.json` using `{ "video-id": { "zero-based-frame": ["joint_name"] } }`. A view-specific video key such as `face-on-0000` can resolve ambiguous IDs. Entries appear in video order, with frames in numeric order.

The page reads `snapshot.json` directly on load; selected frames and joints are not hardcoded. A missing snapshot file produces an empty section, not a broken video viewer. Preview/build preparation extracts small images into `data/.generated/` for faster loading. Newly selected uncached frames can also be extracted from the original video in the browser. Data indices stay zero-based; all displayed frame numbers are index + 1, matching Video comparison.

Snapshots reuse prepared still images where available; uncached frames use a temporary video decoder sequentially, released after extraction. Each Before/After panel has a transparent black SVG shade with hard-edged clear spotlight areas at that model’s specified joint positions. Missing or invalid joint coordinates produce no spotlight in that panel; positions are never borrowed from the other model. Club points remain hidden. The horizontal 3D wheel has wrapping Previous/Next buttons and indicator dots, while reduced-motion preferences disable animated travel. Swipe navigation is disabled. Both views have linked zoom/pan, hover inspection, and fixed curated highlights that cannot be deselected. All headings and labels live under `demo.snapshots` in `materials/content.json`.

Per-video attribution loads directly from `data/credits.json` and appears beneath the player. Each value can be a source URL or an object with `url` and optional `creator`. Exact clip/view keys take priority; split clips such as `0026-4` fall back to `0026`. Links open in a new tab. Attribution loads independently of video and pose data, and updates when the selected clip changes. Credit labels live in `materials/content.json`.

After adding or updating source data, install FFmpeg (including ffprobe), then run:

```sh
node scripts/prepare-data.mjs
```

The video list is data-driven: this command discovers camera-view folders and MP4 files under `data/vidoes/` and generates `data/catalog.json`. There is no video-ID list to maintain in JavaScript or content.json. Clips missing a required model's matching pose JSON are skipped with a warning. Camera filters are derived from the catalog; optional friendly view labels live in content.json. The GitHub workflow regenerates it automatically from the pushed data. Older `prepare-demo.mjs` and `prepare-snapshots.mjs` commands are compatibility aliases for this preparation step.

The text page paints before demo initialization. Result shows its own loading message, and the player shows a separate loading overlay while a clip loads. The other sections and video list remain usable independently.

The script probes actual decoded frame timestamps and creates small preview images. Original videos and pose files remain untouched and are used directly by the browser. Source pose folders are `data/poses/before/` and `data/poses/after/`, each containing camera-view subfolders. There is one fixed Before/After comparison. When exports contain extra unnamed points, the viewer uses only named points.

For the After skeleton, head edges are nose–left ear, nose–right ear, nose–atlas, and nose–top head. The head has no connection to the shoulders or other body joints.

Club points and bones are hidden. Joints use a double-circle design: a solid left-blue/right-red inner dot (center joints use the skeleton color) and a skeleton-colored outer ring. Outer radius is max(source width, source height)/190; inner radius is 65% of that. Hover shows only the joint name or bone connection; there are no confidence pies or confidence labels. Brighter/thicker hover and white selection rings follow multiview_tool. Bones stop at outer ring boundaries. Click selects one item; Shift-click adds/removes selections. Clicking empty video space or non-interactive page space clears selection; panning does not. Selection remains synchronized across Before/After and follows frames. Tab and Enter also work. Space is reserved globally for playback. Display names and instructions live in `materials/content.json`.

Skeleton SVGs sit outside the CSS-scaled video scenes. Zoom and pan transform SVG geometry inside fixed viewport-sized SVG roots, so skeletons are freshly rendered as vectors instead of enlarging a cached raster texture. Rings and bones use non-scaling strokes. Panes use overflow clipping rather than scroll containers to prevent keyboard focus from shifting one pane independently.

Pan and zoom are linked in both directions: scrolling/pinching or dragging in either panel updates both video and skeleton layers. Zoom ranges from 100% to 600%, stays anchored under the pointer, and supports touch pinch gestures. Drag to pan while zoomed; a drag does not select joints or bones. The controls zoom around the center or reset the view. Framing persists across playback and frame stepping and resets when selecting another clip. Run geometry checks with `node --test tests/linked-view.test.mjs`.

The slider uses zero-based frame indices internally and displays one-based frame numbers. Prediction entry N overlays video frame N. The catalog records frame presentation times only to seek the browser's video decoder; poses remain frame-indexed. Clips are limited to the frame range available in the actual video and both model results. File header frame counts are not used.

The page initializes the viewer near the viewport, fetches only the selected video and two pose sets, caches a small number of parsed pose results, and uses one video decoder for both comparison canvases. Thumbnails load lazily. Switching clips cancels obsolete pose requests, and scrubbing coalesces outstanding seeks. The video list moves below the player on narrow screens.

Frame stepping retains the requested index through asynchronous seeks, coalesces rapid input, and waits for both seek completion and video-frame presentation before drawing. Completed intermediate frames remain visible while a held key keeps requesting new frames. Left/Right are reserved across the page, even while a button, slider, or camera selector has focus. Like multiview_tool, a key-down steps once and only native OS key-repeat events advance a held key, preserving the normal initial repeat delay. Release, window blur, and page hiding clear held-key state. Modified browser shortcuts are preserved. Playback waits for pending seeks. Run regression checks with `node --test tests/frame-seeker.test.mjs tests/frame-keys.test.mjs`.

Space always toggles play/stop, including when a video-list button, skeleton feature, or dropdown has focus. Holding Space does not repeatedly toggle, and its default scrolling/button activation is prevented. The video list reserves padding around rows so selection borders and keyboard focus outlines are not clipped by scrolling.

Influence supports `subsections` in content.json, each with a `title`, `paragraphs`, and `items`. The Production subsection uses this to keep its copy centralized.

All views lists the available camera views together in clip-ID order. Counts and filters adapt to the catalog. Selecting a specific view also switches the player if the current clip belongs to the other view. Returning to All views preserves the current clip.
