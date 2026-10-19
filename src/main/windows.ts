import { app, BrowserWindow, screen } from 'electron';
import { join } from 'node:path';
import { PET_WINDOW } from '../shared/constants';
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

function defaultPetPosition(): { x: number; y: number } {
  const { workArea } = screen.getPrimaryDisplay();
  return {
    x: Math.round(workArea.x + workArea.width - PET_WINDOW.width - 24),
    y: Math.round(workArea.y + workArea.height - PET_WINDOW.height - 16),
  };
}

function clampToDisplay(x: number, y: number): { x: number; y: number } {
  const bounds = { x, y, width: PET_WINDOW.width, height: PET_WINDOW.height };
  const display = screen.getDisplayMatching(bounds);
  const area = display.workArea;
  return {
    x: Math.round(
      Math.min(area.x + area.width - 96, Math.max(area.x - PET_WINDOW.width + 96, x)),
    ),
    y: Math.round(Math.min(area.y + area.height - 96, Math.max(area.y - 60, y))),
  };
}

export function createPetWindow(store: Store): BrowserWindow {
  const saved = store.state.placement;
  const position = saved ? clampToDisplay(saved.x, saved.y) : defaultPetPosition();

  const win = new BrowserWindow({
    width: PET_WINDOW.width,
    height: PET_WINDOW.height,
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
      spellcheck: false,
      safeDialogs: true,
      disableDialogs: true,
    },
  });

  win.setMenu(null);
  loadSurface(win, 'den');
  return win;
}

export function placeNearDefault(win: BrowserWindow): void {
  const position = defaultPetPosition();
  win.setPosition(position.x, position.y);
}

export function clampPlacement(win: BrowserWindow): void {
  const bounds = win.getBounds();
  const next = clampToDisplay(bounds.x, bounds.y);
  if (next.x !== bounds.x || next.y !== bounds.y) {
    win.setPosition(next.x, next.y);
  }
}
