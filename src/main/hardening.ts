import { shell, type BrowserWindow, type Session } from 'electron';
import { isAllowedExternalUrl } from '../shared/external-links';

/**
 * Refuse every renderer permission request.
 *
 * Mochi needs none of them: the pet is a local overlay and the Den reads
 * local files only. Later notifications will go through the main-process
 * `Notification` API, which this does not affect.
 */
export function denyAllPermissions(session: Session): void {
  session.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false);
  });
}

/**
 * Stop the window from navigating anywhere or opening child windows, and route
 * allow-listed https links to the user's browser instead.
 *
 * A reload of the current document is allowed through — it is not a navigation
 * away from the app, and blocking it would break development reloads.
 */
export function hardenWebContents(win: BrowserWindow): void {
  const contents = win.webContents;

  contents.on('will-navigate', (event, url) => {
    if (isSameDocument(contents.getURL(), url)) return;
    event.preventDefault();
    openInBrowser(url);
  });

  contents.on('will-redirect', (event) => {
    event.preventDefault();
  });

  contents.setWindowOpenHandler(({ url }) => {
    openInBrowser(url);
    return { action: 'deny' };
  });
}

/**
 * Open a link outside the app, but only if it passes the allow-list. Anything
 * else is dropped on the floor.
 */
function openInBrowser(url: string): void {
  if (!isAllowedExternalUrl(url)) return;
  void shell.openExternal(url).catch(() => {
    // No browser, or the OS refused. Nothing useful to do about it.
  });
}

/** True when `next` is the same page as `current`, ignoring the hash. */
function isSameDocument(current: string, next: string): boolean {
  try {
    const a = new URL(current);
    const b = new URL(next);
    return a.origin === b.origin && a.pathname === b.pathname && a.search === b.search;
  } catch {
    return false;
  }
}
