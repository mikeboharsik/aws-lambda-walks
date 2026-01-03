import { saveScreenshot } from './getMapScreenshot.js';

await saveScreenshot(process.argv[2], parseInt(process.argv[3] || '0'), process.argv[4]);
