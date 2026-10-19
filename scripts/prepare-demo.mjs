// Compatibility entry point: all media now comes directly from data/.
import { prepareData } from './prepare-data.mjs';
const catalog = prepareData();
console.log(`Indexed ${catalog.clips.length} videos and ${catalog.snapshots.length} snapshots in data/. No legacy assets generated.`);
