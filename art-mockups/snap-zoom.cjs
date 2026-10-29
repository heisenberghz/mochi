/**
 * Captures the 2x zoom sheet in two passes (the page is taller than the
 * screen, so we scroll): zoom-white.png and zoom-dark.png.
 * Run: npx electron art-mockups/snap-zoom.cjs
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
process.on('unhandledRejection', (err) => {
  console.error('[snap] async failure:', err && err.stack);
  app.exit(1);
});

const shot = async (win, file, scrollTop = null) => {
  if (scrollTop !== null) {
    await win.webContents.executeJavaScript(`window.scrollTo(0, ${scrollTop}); scrollY`);
  }
  await new Promise((r) => setTimeout(r, 600));
  // capturePage can flake with UnknownVizError when the compositor isn't
  // ready for a frame — force a repaint and retry a few times.
  for (let attempt = 1; attempt <= 5; attempt++) {
    log(`capturing ${file} (attempt ${attempt})`);
    try {
      win.webContents.invalidate();
      await new Promise((r) => setTimeout(r, 700));
      const capture = win.webContents.capturePage();
      const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('capture timeout')), 6000));
      const image = await Promise.race([capture, timeout]);
      writeFileSync(join(HERE, file), image.toPNG());
      log(`done ${file}, ${image.getSize().width}x${image.getSize().height}`);
      return;
    } catch (err) {
      log(`attempt ${attempt} failed: ${err.message}`);
      if (attempt === 5) throw err;
    }
  }
};

app.whenReady().then(async () => {
  log('ready, loading zoom sheet');
  const win = new BrowserWindow({
    width: 1540,
    height: 840,
    show: true,
    useContentSize: true,
    backgroundColor: '#26221e',
  });
  await win.loadURL('file:///' + join(HERE, 'zoom-final.html').replace(/\\/g, '/'));
  await win.webContents.insertCSS('*, *::before, *::after { animation-play-state: paused !important; transition: none !important; }');
  await new Promise((r) => setTimeout(r, 1200));
  await shot(win, 'zoom-white.png');
  // reload with ?row=dark so the page itself scrolls to the dark row on load
  await win.loadURL('file:///' + join(HERE, 'zoom-final.html').replace(/\\/g, '/') + '?row=dark');
  await new Promise((r) => setTimeout(r, 1200));
  await shot(win, 'zoom-dark.png');
  app.exit(0);
});
setTimeout(() => {
  if (!require('electron').app.isReady()) { console.error('[snap] never became ready'); process.exit(1); }
}, 15000);
