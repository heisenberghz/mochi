import { spawn } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const electronPath = require('electron');

const resultFile = join(process.cwd(), 'smoke-result.json');
const recoverFile = join(process.cwd(), 'smoke-recover.json');
const imageFile = join(process.cwd(), 'smoke-result.png');

rmSync(resultFile, { force: true });
rmSync(recoverFile, { force: true });
rmSync(imageFile, { force: true });

if (!existsSync(join(process.cwd(), 'out/main/index.js'))) {
  console.error('Build output missing. Run `npm run build` first.');
  process.exit(1);
}

function runPhase(args, timeoutMs) {
  return new Promise((resolve, reject) => {
    const child = spawn(electronPath, ['.', ...args], {
      cwd: process.cwd(),
      env: { ...process.env, MOCHI_TEST: '1' },
      stdio: 'inherit',
    });

    const timer = setTimeout(() => {
      console.error(`Smoke test timed out after ${timeoutMs / 1000}s.`);
      child.kill();
      reject(new Error('timed out'));
    }, timeoutMs);

    child.on('exit', (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(`Electron exited with code ${code}`));
        return;
      }
      resolve();
    });
  });
}

function check(condition, message, detail) {
  if (condition) return;
  console.error(message, detail ?? '');
  process.exit(1);
}

async function main() {
  // --- Phase one: the app itself -------------------------------------------

  await runPhase(['--smoke-test'], 40_000);

  check(existsSync(resultFile), 'Smoke result file was not written.');

  const result = JSON.parse(readFileSync(resultFile, 'utf8'));
  console.log('Smoke result:', JSON.stringify(result, null, 2));

  check(result.visible, 'Pet window flags are wrong: it is not visible.');
  check(result.alwaysOnTop, 'Pet window flags are wrong: it is not always on top.');
  check(result.focusable === false, 'Pet window flags are wrong: it can take focus.');
  check(result.dom?.root, 'Pet renderer did not mount.');
  check(result.dom?.svg, 'Pet renderer did not mount.');
  check(result.pngBytes > 0 && !result.captureEmpty, 'Pet renderer produced no pixels.');

  const den = result.den;
  check(den, 'Den window did not open.');
  check(den.visible, 'Den window did not open.');
  check(den.dom?.root, 'Den renderer did not mount.');
  check(
    Array.isArray(den.dom.nav) && den.dom.nav.includes('Settings'),
    'Den navigation is incomplete.',
    den.dom.nav,
  );
  check(
    typeof den.dom.ring === 'string' && /^\d{2}:\d{2}$/.test(den.dom.ring),
    'Den focus timer is not rendered.',
    den.dom.ring,
  );
  check(den.pngBytes > 0 && !den.captureEmpty, 'Den renderer produced no pixels.');

  const focusTab = den.tabs?.Focus;
  check(focusTab, 'The Den focus tab did not render.');
  check(
    focusTab.fields >= 4,
    'The Den focus configuration editor is missing.',
    focusTab.fields,
  );
  check(
    Array.isArray(focusTab.buttons) && focusTab.buttons.includes('Skip'),
    'The Den focus view has no Skip button.',
    focusTab.buttons,
  );

  const settingsTab = den.tabs?.Settings;
  check(settingsTab, 'The Den settings tab did not render.');
  check(settingsTab.inputs >= 2, 'The Den settings tab has no controls.', settingsTab.inputs);

  const flow = result.focusFlow ?? {};
  check(!flow.error, 'Focus flow threw.', flow.error);
  check(flow.running?.status === 'running', 'Focus did not start.', flow.running);
  check(flow.running?.behavior === 'focus', 'Pet did not enter focus behavior.', flow.running);
  check(flow.paused === 'paused', 'Focus did not pause.', flow.paused);
  check(flow.stopped === 'idle', 'Focus did not stop.', flow.stopped);
  check(
    result.state?.pet?.behavior === 'idle',
    'Pet stayed in focus after stop.',
    result.state?.pet?.behavior,
  );
  check(
    flow.configWorkMin === 50,
    'The focus configuration did not change.',
    flow.configWorkMin,
  );

  console.log('Phase 1 assertions passed.');

  // --- Phase two: launch again and see what comes back ---------------------

  await runPhase(['--smoke-test=recover'], 40_000);

  check(existsSync(recoverFile), 'The recovery file was not written.');

  const recovered = JSON.parse(readFileSync(recoverFile, 'utf8'));
  console.log('Recovered state:', JSON.stringify(recovered, null, 2));

  check(
    recovered.focus?.status === 'paused',
    'A session left running did not come back paused.',
    recovered.focus,
  );
  check(
    recovered.focus?.pauseReason === 'recovered',
    'The recovered session did not say why it was paused.',
    recovered.focus,
  );
  check(
    recovered.focus?.remainingMs > 0 && recovered.focus.remainingMs <= 50 * 60_000,
    'The recovered session lost its remaining time.',
    recovered.focus?.remainingMs,
  );
  check(
    recovered.config?.workMin === 50,
    'The session length did not survive the restart.',
    recovered.config,
  );

  console.log('Recovery assertions passed.');
  console.log('Smoke assertions passed.');
}

main().catch((error) => {
  console.error(error?.message ?? error);
  process.exit(1);
});
