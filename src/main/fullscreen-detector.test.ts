import { describe, expect, it } from 'vitest';
import { looksLikeFullScreen } from './fullscreen-detector';

const MONITOR = { left: 0, top: 0, right: 1536, bottom: 864 } as const;

function baseline(): Parameters<typeof looksLikeFullScreen> {
  return [
    {
      style: 0x80000000, // WS_POPUP, borderless like a game
      exStyle: 0,
      className: 'UnityWndClass',
      rect: { left: 0, top: 0, right: MONITOR.right, bottom: MONITOR.bottom },
    },
    MONITOR,
  ];
}

describe('looksLikeFullScreen', () => {
  it('sees a borderless window covering the display as fullscreen', () => {
    const [win, monitor] = baseline();
    expect(looksLikeFullScreen(win, monitor)).toBe(true);
  });

  it('does not mistake a maximized app with a title bar for a game', () => {
    const [win, monitor] = baseline();
    win.style |= 0x00c00000; // WS_CAPTION
    expect(looksLikeFullScreen(win, monitor)).toBe(false);
  });

  it('does not mistake a smaller window for a game', () => {
    const [win, monitor] = baseline();
    win.rect = { left: 10, top: 10, right: 800, bottom: 600 };
    expect(looksLikeFullScreen(win, monitor)).toBe(false);
  });

  it('never counts the taskbar, even if it covers everything', () => {
    const [win, monitor] = baseline();
    win.className = 'Shell_TrayWnd';
    expect(looksLikeFullScreen(win, monitor)).toBe(false);
  });

  it('never counts the desktop layers', () => {
    const [win, monitor] = baseline();
    win.className = 'Progman';
    expect(looksLikeFullScreen(win, monitor)).toBe(false);
  });

  it('never counts tool windows', () => {
    const [win, monitor] = baseline();
    win.exStyle |= 0x80; // WS_EX_TOOLWINDOW
    expect(looksLikeFullScreen(win, monitor)).toBe(false);
  });

  it('tolerates a window that spills a pixel past the display edge', () => {
    const [win, monitor] = baseline();
    win.rect = { left: -1, top: -1, right: 1537, bottom: 865 };
    expect(looksLikeFullScreen(win, monitor)).toBe(true);
  });
});
