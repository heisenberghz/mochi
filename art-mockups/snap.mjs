/**
 * Captures the mockup sheet to a PNG so the comparison can be reviewed
 * anywhere (and so I can look at it myself). Run after build-preview.mjs:
 *   npx electron art-mockups/snap.mjs
 */
import { app, BrowserWindow } from 'electron';
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const log = (line) => console.log(`[snap] ${line}`);

process.on('uncaughtException', (err) => {
  console.error('[snap] crashed:', err.stack);
  app.exit(1);
});

await app.whenReady();
const win = new BrowserWindow({
  width: 1520,
  height: 1330,
  show: true, // hidden windows do not paint, so hidden capture never finishes
  useContentSize: true,
});
log('loading sheet');
await win.loadURL('file:///' + join(HERE, 'preview-final.html').replace(/\\/g, '/'));
await new Promise((r) => setTimeout(r, 1500));
log('capturing');
const image = await win.webContents.capturePage();
writeFileSync(join(HERE, 'preview.png'), image.toPNG());
log(`done, ${image.getSize().width}x${image.getSize().height}`);
app.exit(0);
