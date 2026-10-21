import { app, session } from 'electron';
import { join } from 'node:path';
import { MochiController } from './controller';
import { denyAllPermissions } from './hardening';
import { Store } from './store';

/**
 * `--smoke-test` runs the automated check. `--smoke-test=recover` runs the
 * second half of it: launching again to prove a session left running by the
 * first launch comes back.
 */
const smokeArg = process.argv.find((arg) => arg.startsWith('--smoke-test'));
const smoke = smokeArg !== undefined;
const smokeRecover = smokeArg === '--smoke-test=recover';

// Keep automated runs away from the real user profile.
if (smoke) {
  app.setPath('userData', join(app.getPath('temp'), 'mochi-smoke'));
}

if (process.env['MOCHI_DISABLE_GPU'] === '1') {
  app.disableHardwareAcceleration();
}

app.setAppUserModelId('com.mochipet.desktop');

let controller: MochiController | null = null;

const hasLock = app.requestSingleInstanceLock();
if (!hasLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    controller?.onSecondInstance();
  });

  app.whenReady().then(async () => {
    denyAllPermissions(session.defaultSession);

    const store = new Store(app.getPath('userData'));
    controller = new MochiController(store, smoke, smokeRecover);
    await controller.start();

    app.on('before-quit', () => {
      controller?.stop();
    });
  });

  // Mochi lives in the tray; closing windows must not quit the app.
  app.on('window-all-closed', () => {
    // Intentionally keep the process alive.
  });
}
