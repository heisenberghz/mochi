/**
 * Is something genuinely fullscreen above the desktop?
 *
 * The size-based check (`work area equals the raw screen size`) cannot tell a
 * fullscreen game from a taskbar that simply hides itself; on such a desktop
 * the two numbers always agree, so the pet would think it is always in a game
 * and stay hidden forever. This detector asks Windows which window is at the
 * front and measures that window instead: a borderless window that covers a
 * whole display is fullscreen, while shell chrome and normal framed windows
 * are not.
 *
 * The bindings are built lazily, and if the bridge cannot be loaded the
 * detector answers null, leaving the caller to fall back to the old check.
 */
import koffi from 'koffi';

interface MonitorRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

interface WindowStyle {
  /** Bitfield from GWL_STYLE. */
  style: number;
  /** Bitfield from GWL_EXSTYLE. */
  exStyle: number;
  /** The window's registered class name. */
  className: string;
  /** The window's rectangle, in physical pixels. */
  rect: MonitorRect;
}

const GWL_STYLE = -16;
const GWL_EXSTYLE = -20;
const MONITOR_DEFAULTTONEAREST = 2;

/** A window with a caption has a title bar — a maximized app, not a game. */
const WS_CAPTION = 0x00c00000;

/** Tool windows (tooltips, floating palettes) never count as fullscreen. */
const WS_EX_TOOLWINDOW = 0x80;

/** Class names of Windows' own desktop furniture, never games. */
const SHELL_CLASS_NAMES = new Set([
  'Shell_TrayWnd', // the taskbar
  'Shell_SecondaryTrayWnd', // taskbars on other monitors
  'Progman', // the desktop wallpaper
  'WorkerW', // the desktop icon layer
  'Windows.UI.Core.CoreWindow', // charms, toasts, and similar overlays
  'ApplicationFrameWindow', // modern app hosts
  'XamlExplorerHostIslandWindow',
]);

/**
 * Pure testable rule: does this window describe a fullscreen game?
 *
 * A fullscreen window is frameless (no title bar), not a tool window, not
 * shell furniture, and covers the bounds of the display it sits on.
 */
export function looksLikeFullScreen(win: WindowStyle, monitor: MonitorRect): boolean {
  if (win.style & WS_CAPTION) return false;
  if (win.exStyle & WS_EX_TOOLWINDOW) return false;
  if (SHELL_CLASS_NAMES.has(win.className)) return false;
  return (
    win.rect.left <= monitor.left &&
    win.rect.top <= monitor.top &&
    win.rect.right >= monitor.right &&
    win.rect.bottom >= monitor.bottom
  );
}

/**
 * Ask Windows about whichever window is in front right now, or null when the
 * raw bindings could not be built in this environment.
 */
export function isRealFullScreen(): boolean | null {
  const user32 = loadBindings();
  if (!user32) return null;

  const hwnd = user32.getForegroundWindow();
  if (!hwnd) return false;

  const classNameBuf = ['\0'.repeat(256)];
  user32.getClassName(hwnd, classNameBuf, 256);
  const className = classNameBuf[0] ?? '';

  const style = user32.getWindowLong(hwnd, GWL_STYLE);
  const exStyle = user32.getWindowLong(hwnd, GWL_EXSTYLE);

  const rectObj = {};
  if (!user32.getWindowRect(hwnd, rectObj)) return false;

  const monitor = user32.monitorFromWindow(hwnd, MONITOR_DEFAULTTONEAREST);
  if (!monitor) return false;
  const info = { cbSize: koffi.sizeof(user32.monitorInfo as never) };
  if (!user32.getMonitorInfo(monitor, info)) return false;

  return looksLikeFullScreen(
    { style, exStyle, className, rect: rectObj as MonitorRect },
    (info as unknown as { rcMonitor: MonitorRect }).rcMonitor,
  );
}

interface User32Bindings {
  monitorInfo: unknown;
  getForegroundWindow(): unknown;
  getWindowRect(h: unknown, rect: object): boolean;
  monitorFromWindow(h: unknown, flags: number): unknown;
  getMonitorInfo(monitor: unknown, info: object): boolean;
  getWindowLong(h: unknown, index: number): number;
  getClassName(h: unknown, buf: string[], max: number): number;
}

/** Registered once per process; koffi dislikes duplicate type names. */
let bindings: User32Bindings | null = null;

function loadBindings(): User32Bindings | null {
  if (bindings !== null) return bindings;
  try {
    const user32 = koffi.load('user32.dll');
    // A named opaque type that the function prototypes below take by name.
    koffi.pointer('MochiHWND', koffi.opaque());
    const RECT = koffi.struct('MochiRECT', {
      left: 'long',
      top: 'long',
      right: 'long',
      bottom: 'long',
    });
    const MONITORINFO = koffi.struct('MochiMonitorInfo', {
      cbSize: 'uint32_t',
      rcMonitor: RECT,
      rcWork: RECT,
      dwFlags: 'uint32_t',
    });

    const getForegroundWindow = user32.func('MochiHWND __stdcall GetForegroundWindow()');
    const getWindowRect = user32.func('bool __stdcall GetWindowRect(MochiHWND hwnd, _Out_ MochiRECT *rect)');
    const monitorFromWindow = user32.func('MochiHWND __stdcall MonitorFromWindow(MochiHWND hwnd, uint32_t flags)');
    const getMonitorInfo = user32.func('bool __stdcall GetMonitorInfoW(MochiHWND monitor, _Inout_ MochiMonitorInfo *info)');
    const getWindowLong = user32.func('int __stdcall GetWindowLongW(MochiHWND hwnd, int index)');
    const getClassName = user32.func('int __stdcall GetClassNameW(MochiHWND hwnd, _Out_ char *name, int max)');

    bindings = {
      monitorInfo: MONITORINFO,
      getForegroundWindow,
      getWindowRect,
      monitorFromWindow,
      getMonitorInfo,
      getWindowLong,
      getClassName,
    };
    return bindings;
  } catch {
    return null;
  }
}
