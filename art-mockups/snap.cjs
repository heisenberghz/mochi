/**
 * Captures the mockup sheet to a PNG. CommonJS: an ESM main hangs before
 * app.whenReady() on this setup (same as today's earlier probe), and
 * capturePage can starve while CSS animations repaint, so this pauses all
 * animation at a held frame first, and races a timeout so it never hangs.
 * Run: npx electron art-mockups/snap.cjs
 */
const { app, BrowserWindow } = require('electron');
const { writeFileSync } = require('node:fs');
const { join, dirname } = require('node:path');

const HERE = __dirname;
const log = (line) => console.log(`[snap] ${line}`);

process.on('uncaughtException', (err) => {
  console.error('[snap] crashed:', err.stack);
  app.exit(1);
});

app.whenReady().then(async () => {
  log('ready, loading sheet');
  const win = new BrowserWindow({
    width: 1500,
    height: 840,
    show: true,
    useContentSize: true,
    backgroundColor: '#26221e',
  });
  await win.loadURL('file:///' + join(HERE, 'preview-final.html').replace(/\\/g, '/'));
  // Hold every animation at its current frame — the sheet is judged on
  // palette, outline and silhouette; the live view stays animated.
  await win.webContents.insertCSS('*, *::before, *::after { animation-play-state: paused !important; transition: none !important; }');
  await new Promise((r) => setTimeout(r, 1200));
  log('capturing');
  const capture = win.webContents.capturePage();
  const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('capture timeout')), 8000));
  try {
    const image = await Promise.race([capture, timeout]);
    writeFileSync(join(HERE, 'preview.png'), image.toPNG());
    log(`done, ${image.getSize().width}x${image.getSize().height}`);
    app.exit(0);
  } catch (err) {
    log(`capture failed: ${err.message}`);
    app.exit(1);
  }
});
setTimeout(() => {
  if (!require('electron').app.isReady()) { console.error('[snap] never became ready'); process.exit(1); }
}, 15000);
