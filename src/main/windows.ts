import { app, BrowserWindow, screen } from 'electron';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import type { PetScale } from '../shared/constants';
import { petWindowSize } from '../shared/geometry';
import { hardenWebContents } from './hardening';
import { nodeFileOps, writeFileAtomically } from './atomic-write';
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
  // The pet's scale decides the window's size: the window is the container
  // the page's scaled layer stretches into. The growing itself is done by
  // the page (pet.css .pet-scaled), because an Electron page zoom is shared
  // per origin and the Den loads from the same file origin.
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
  // The window is the scale's container; the page scales itself from inside
  // (pet.css .pet-scaled), because an Electron page zoom is shared per
  // origin and both windows load from the same file origin.
  hardenWebContents(win);
  clearPersistedZoomLevels();
  neutralisePersistedZoom(win);
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
  neutralisePersistedZoom(win);
  loadSurface(win, 'den');
  return win;
}

export function clampPlacement(win: BrowserWindow): void {
  const bounds = win.getBounds();
  const next = clampToDisplay(bounds.x, bounds.y, bounds);
  if (next.x !== bounds.x || next.y !== bounds.y) {
    win.setPosition(next.x, next.y);
  }
}

/**
 * Chromium persists per-origin page zoom inside the profile. An older build
 * set the pet's scale as a page zoom, and that value kept being restored on
 * every fresh launch — the page opened pre-zoomed inside a window sized for
 * the setting, which chopped her. Stamping the factor back to 1 on every
 * navigation heals profiles that carry the old value and keeps it gone: the
 * pet's real scaling lives in pet.css (.pet-scaled) and is never written
 * through this channel at all.
 */
function neutralisePersistedZoom(win: BrowserWindow): void {
  win.webContents.on('did-navigate', () => {
    if (Math.abs(win.webContents.getZoomFactor() - 1) > 1e-6) {
      win.webContents.setZoomFactor(1);
    }
  });
}

/**
 * Deletes the stored per-host zoom levels from the profile's Preferences —
 * the file Chromium itself would otherwise restore from. Zoom entries land
 * there only when code writes a page zoom (the old mechanism); nothing in
 * this build does, so an empty table is this build's steady state. Storage
 * that must survive goes through the Store instead, so touching Chromium's
 * preference file cannot lose the pet, the placement or any setting. The
 * stamp above remains as the live safety net for values applied before this
 * cleanup runs.
 */
function clearPersistedZoomLevels(): void {
  if (zoomPrefsCleared) return;
  zoomPrefsCleared = true;
  let prefsPath: string;
  try {
    prefsPath = join(app.getPath('userData'), 'Preferences');
  } catch {
    return;
  }
  try {
    const prefs: unknown = JSON.parse(readFileSync(prefsPath, 'utf8'));
    if (
      typeof prefs !== 'object' ||
      prefs === null ||
      !('partition' in prefs) ||
      typeof (prefs as { partition: unknown }).partition !== 'object'
    ) {
      return;
    }
    const partition = (prefs as { partition: Record<string, unknown> }).partition;
    if (
      'per_host_zoom_levels' in partition &&
      Object.keys((partition.per_host_zoom_levels ?? {}) as object).length > 0
    ) {
      delete partition.per_host_zoom_levels;
      writeFileAtomically(prefsPath, JSON.stringify(prefs), nodeFileOps);
    }
  } catch {
    // An unparseable Preferences is not ours to fix; the stamp above still
    // heals whatever zoom it contains.
  }
}

let zoomPrefsCleared = false;
