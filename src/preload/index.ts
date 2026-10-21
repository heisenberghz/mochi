import { contextBridge, ipcRenderer } from 'electron';
import type {
  AppSnapshot,
  BubbleSpec,
  FocusAction,
  MochiApi,
  OkResult,
  Point,
  Settings,
  SettingsResult,
} from '../shared/types';

function onState(cb: (snapshot: AppSnapshot) => void): () => void {
  const listener = (_event: Electron.IpcRendererEvent, snapshot: AppSnapshot): void => {
    cb(snapshot);
  };
  ipcRenderer.on('state:update', listener);
  return () => ipcRenderer.removeListener('state:update', listener);
}

function onBubble(cb: (bubble: BubbleSpec) => void): () => void {
  const listener = (_event: Electron.IpcRendererEvent, bubble: BubbleSpec): void => {
    cb(bubble);
  };
  ipcRenderer.on('pet:bubble', listener);
  return () => ipcRenderer.removeListener('pet:bubble', listener);
}

function focus(action: FocusAction): Promise<OkResult> {
  switch (action) {
    case 'start':
      return ipcRenderer.invoke('focus:start');
    case 'pause':
      return ipcRenderer.invoke('focus:pause');
    case 'resume':
      return ipcRenderer.invoke('focus:resume');
    case 'skip':
      return ipcRenderer.invoke('focus:skip');
    case 'stop':
      return ipcRenderer.invoke('focus:stop');
  }
}

const api: MochiApi = {
  v: 1,
  bootstrap: () => ipcRenderer.invoke('app:bootstrap') as Promise<AppSnapshot>,
  onState,
  onBubble,
  setInteractive: (interactive: boolean) =>
    ipcRenderer.invoke('window:setInteractive', interactive) as Promise<OkResult>,
  poke: () => ipcRenderer.invoke('pet:poke') as Promise<OkResult>,
  dragStart: (cursor: Point) =>
    ipcRenderer.invoke('pet:dragStart', cursor) as Promise<OkResult>,
  dragEnd: (cursor: Point) =>
    ipcRenderer.invoke('pet:dragEnd', cursor) as Promise<OkResult>,
  contextMenu: (cursor: Point) =>
    ipcRenderer.invoke('pet:contextMenu', cursor) as Promise<OkResult>,
  openDen: () => ipcRenderer.invoke('window:openDen') as Promise<OkResult>,
  openDataFolder: () => ipcRenderer.invoke('app:openDataFolder') as Promise<OkResult>,
  focus,
  updateSettings: (patch: Partial<Settings>) =>
    ipcRenderer.invoke('settings:update', patch) as Promise<SettingsResult>,
  setPetVisible: (visible: boolean) =>
    ipcRenderer.invoke('window:setPetVisible', visible) as Promise<OkResult>,
};

contextBridge.exposeInMainWorld('mochi', api);
