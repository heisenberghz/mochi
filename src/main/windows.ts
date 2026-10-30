import { app, BrowserWindow, screen } from 'electron';
import { join } from 'node:path';
import type { PetScale } from '../shared/constants';
import { petWindowSize } from '../shared/geometry';
import { hardenWebContents } from './hardening';
import type { Store } from './store';

const isDev = !app.isPackaged;

function rendererUrl(surface: 'pet' | 'den'): string {
  const devUrl = process.env['ELECTRON_RENDERER_URL'];
  if (devUrl) {
    const url = new URL(devUrl);
    url.searchParams.set('surface', surface);
    return url.toString();
  }
  return '';
}

export function loadSurface(win: BrowserWindow, surface: 'pet' | 'den'): void {
  const dev = rendererUrl(surface);
  if (dev) {
    void win.loadURL(dev);
    return;
  }
  void win.loadFile(join(__dirname, '../renderer/index.html'), {
    query: { surface },
  });
}

function defaultPetPosition(scale: PetScale): { x: number; y: number } {
  const size = petWindowSize(scale);
  const { workArea } = screen.getPrimaryDisplay();
  return {
    x: Math.round(workArea.x + workArea.width - size.width - 24),
    y: Math.round(workArea.y + workArea.height - size.height - 16),
  };
}

export function clampToDisplay(
  x: number,
  y: number,
  size: { width: number; height: number },
): { x: number; y: number } {
  const bounds = { x, y, width: size.width, height: size.height };
  const display = screen.getDisplayMatching(bounds);
  const area = display.workArea;

  return {
    x: Math.round(
      Math.min(area.x + area.width - 96, Math.max(area.x - size.width + 96, x)),
    ),
    // The pet's feet must never reach the taskbar, so the whole window stays
    // inside the work area vertically.
    y: Math.round(
      Math.min(area.y + area.height - size.height, Math.max(area.y, y)),
    ),
  };
}

export function createPetWindow(store: Store): BrowserWindow {
  const saved = store.state.placement;
  // The pet's scale is a window property as much as an art property: the
  // whole layer (art, bubble, swing room) grows together, and the page zoom
  // does the growing so every logical number inside stays as it was.
  const scale = store.state.settings.petScale;
  const size = petWindowSize(scale);
  const position = saved ? clampToDisplay(saved.x, saved.y, size) : defaultPetPosition(scale);

  const win = new BrowserWindow({
    width: size.width,
    height: size.height,
    x: position.x,
    y: position.y,
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
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      backgroundThrottling: false,
      devTools: isDev,
      spellcheck: false,
      safeDialogs: true,
      disableDialogs: true,
    },
  });

  win.setAlwaysOnTop(true, 'screen-saver');
  win.setMenu(null);
  win.setIgnoreMouseEvents(true, { forward: true });
  // The zoom is what actually scales the page. It belongs to the webContents,
  // so it must be set again if this same webContents ever reloads.
  win.webContents.setZoomFactor(scale);
  hardenWebContents(win);
  loadSurface(win, 'pet');

  return win;
}

export function createDenWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 980,
    height: 700,
    minWidth: 820,
    minHeight: 580,
    show: false,
    backgroundColor: '#F7F2E9',
    title: 'Mochi',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      devTools: isDev,
      spellcheck: false,
      safeDialogs: true,
      disableDialogs: true,
    },
  });

  win.setMenu(null);
  hardenWebContents(win);
  loadSurface(win, 'den');
  return win;
}

export function placeNearDefault(win: BrowserWindow): void {
  // The window carries its own scale: zoom is per-webContents, so the
  // window's zoom answers "how big is this pet" without any extra wiring.
  const scale = win.webContents.getZoomFactor() as PetScale;
  const position = defaultPetPosition(scale);
  win.setPosition(position.x, position.y);
}

export function clampPlacement(win: BrowserWindow): void {
  const bounds = win.getBounds();
  const next = clampToDisplay(bounds.x, bounds.y, bounds);
  if (next.x !== bounds.x || next.y !== bounds.y) {
    win.setPosition(next.x, next.y);
  }
}
