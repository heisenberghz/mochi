import { spawn } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const electronPath = require('electron');

const resultFile = join(process.cwd(), 'smoke-result.json');
const imageFile = join(process.cwd(), 'smoke-result.png');
rmSync(resultFile, { force: true });
rmSync(imageFile, { force: true });

if (!existsSync(join(process.cwd(), 'out/main/index.js'))) {
  console.error('Build output missing. Run `npm run build` first.');
  process.exit(1);
}

const child = spawn(electronPath, ['.', '--smoke-test'], {
  cwd: process.cwd(),
  env: { ...process.env, MOCHI_TEST: '1' },
  stdio: 'inherit',
});

const timeout = setTimeout(() => {
  console.error('Smoke test timed out after 30s.');
  child.kill();
  process.exit(1);
}, 30_000);

child.on('exit', (code) => {
  clearTimeout(timeout);
  if (code !== 0) {
    console.error(`Electron exited with code ${code}`);
    process.exit(code ?? 1);
  }
  if (!existsSync(resultFile)) {
    console.error('Smoke result file was not written.');
    process.exit(1);
  }
  const result = JSON.parse(readFileSync(resultFile, 'utf8'));
  console.log('Smoke result:', JSON.stringify(result, null, 2));
  if (!result.visible || !result.alwaysOnTop || result.focusable !== false) {
    console.error('Smoke assertions failed: pet window flags are wrong.');
    process.exit(1);
  }
  if (!result.dom?.root || !result.dom?.svg) {
    console.error('Pet renderer did not mount.');
    process.exit(1);
  }
  if (!result.pngBytes || result.captureEmpty) {
    console.error('Pet renderer produced no pixels.');
    process.exit(1);
  }

  const den = result.den;
  if (!den || !den.visible) {
    console.error('Den window did not open.');
    process.exit(1);
  }
  if (!den.dom?.root) {
    console.error('Den renderer did not mount.');
    process.exit(1);
  }
  if (!Array.isArray(den.dom.nav) || !den.dom.nav.includes('Settings')) {
    console.error('Den navigation is incomplete.', den.dom.nav);
    process.exit(1);
  }
  if (typeof den.dom.ring !== 'string' || !/^\d{2}:\d{2}$/.test(den.dom.ring)) {
    console.error('Den focus timer is not rendered.', den.dom.ring);
    process.exit(1);
  }
  if (!den.pngBytes || den.captureEmpty) {
    console.error('Den renderer produced no pixels.');
    process.exit(1);
  }

  const flow = result.focusFlow ?? {};
  if (flow.error) {
    console.error('Focus flow threw.', flow.error);
    process.exit(1);
  }
  if (flow.running?.status !== 'running') {
    console.error('Focus did not start.', flow.running);
    process.exit(1);
  }
  if (flow.running?.behavior !== 'focus') {
    console.error('Pet did not enter focus behavior.', flow.running);
    process.exit(1);
  }
  if (flow.paused !== 'paused') {
    console.error('Focus did not pause.', flow.paused);
    process.exit(1);
  }
  if (flow.stopped !== 'idle') {
    console.error('Focus did not stop.', flow.stopped);
    process.exit(1);
  }
  if (result.state?.pet?.behavior !== 'idle') {
    console.error('Pet stayed in focus after stop.', result.state?.pet?.behavior);
    process.exit(1);
  }

  console.log('Smoke assertions passed.');
  process.exit(0);
});
