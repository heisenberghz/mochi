/**
 * Stress-repro: the pet page at zoom 1.5, idled and then MOVED like a walk,
 * captured mid-motion and after settle. Run twice:
 *   npx electron art-mockups/pet-scale-stress.cjs              (GPU on)
 *   $env:REPRO_NO_GPU='1'; npx electron art-mockups/pet-scale-stress.cjs
 * Saves art-mockups/repro-<phase>.png shots of the whole screen.
 */
const { app, BrowserWindow, desktopCapturer, screen } = require('electron');
const { writeFileSync } = require('node:fs');
const { join } = require('node:path');

const HERE = __dirname;
const MODE = process.env.REPRO_MODE || 'baseline';
const TAG = MODE;
const log = (line) => console.log(`[stress.${TAG}] ${line}`);

if (MODE === 'nogpu') app.disableHardwareAcceleration();
if (MODE === 'dcomp') app.commandLine.appendSwitch('disable-direct-composition');
if (MODE === 'softcomp') app.commandLine.appendSwitch('disable-gpu-compositing');

process.on('uncaughtException', (err) => {
  console.error(`[stress.${TAG}] crashed:`, err.stack);
  app.exit(1);
});
process.on('unhandledRejection', (err) => {
  console.error(`[stress.${TAG}] async failure:`, err && err.stack);
  app.exit(1);
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function grab(name) {
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: { width: 1920, height: 1080 },
  });
  const shot = sources[0];
  if (!shot) throw new Error('no screen source');
  writeFileSync(join(HERE, `repro-${TAG}-${name}.png`), shot.thumbnail.toPNG());
  log(`saved repro-${TAG}-${name}.png`);
}

function petWindow(x, y) {
  const win = new BrowserWindow({
    width: 480,
    height: 540,
    x,
    y,
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    resizable: false,
    movable: true,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    closable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    focusable: false,
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      devTools: false,
      spellcheck: false,
    },
  });
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setMenu(null);
  win.setIgnoreMouseEvents(true, { forward: true });
  void win.loadFile(join(HERE, '..', 'out', 'renderer', 'index.html'), {
    query: { surface: 'pet' },
  });
  return win;
}

app.whenReady().then(async () => {
  log(`ready (REPRO_MODE=${MODE})`);
  const area = screen.getPrimaryDisplay().workArea;

  // Windows parked at the TOP of the screen: away from where a desk pet ever
  // stands, so a running instance of the app cannot bleed through the
  // transparent areas. That ran the diagnosis before: the "fragments" seen
  // mid-screen were another instance of the pet behind the windows.
  const top = area.y + 16;
  const staticWin = petWindow(area.x + 80, top);
  const mover = petWindow(area.x + 700, top);

  await sleep(2600);
  staticWin.showInactive();
  mover.showInactive();
  await sleep(1200);

  // Both at 1.5, by the same selector the real page drives.
  for (const win of [staticWin, mover]) {
    await win.webContents.executeJavaScript(
      `(() => { const el = document.querySelector('.pet-scaled'); if (el) el.style.zoom = '1.5'; return el ? 'ok' : 'missing'; })()`,
    );
  }
  await sleep(900);
  await grab('idle');

  // Walk the mover: real walk glides ~70 DIP/s for seconds; here 14 slides
  // of 8 DIP at ~55 ms, then capture DURING the next slide and after settle.
  const startX = mover.getBounds().x;
  const walkY = mover.getBounds().y;
  let x = startX;
  for (let i = 0; i < 14; i += 1) {
    x += 8;
    mover.setPosition(x, walkY);
    await sleep(55);
  }
  mover.setPosition(x + 8, walkY);
  await grab('moving');
  await sleep(700);
  await grab('settled');

  // One big jump, like a drag landing / a size swap with re-clamping.
  mover.setPosition(startX + 40, walkY);
  await grab('jumped');

  // Bypass the desktop compositor: what does the PAGE itself contain?
  const page = await mover.webContents.capturePage();
  writeFileSync(join(HERE, `repro-${TAG}-page.png`), page.toPNG());
  log('saved repro-' + TAG + '-page.png');
  void staticWin;

  app.exit(0);
});
setTimeout(() => {
  if (!app.isReady()) { console.error('[stress] never became ready'); process.exit(1); }
}, 15000);
