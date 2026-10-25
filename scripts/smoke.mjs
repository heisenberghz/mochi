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

  // The art must sit exactly where the click target expects it.
  const rect = result.dom?.spriteRect;
  check(
    rect?.left === 60 && rect?.top === 134,
    'The pet art is not where the click target expects it.',
    rect,
  );
  check(
    rect?.width === 200 && rect?.height === 220,
    'The pet art is not the size the click target expects.',
    rect,
  );

  // The drift guard warns when the art and the click target disagree.
  const drift = (result.diagnostics ?? []).filter((line) =>
    String(line).includes('drifted'),
  );
  check(drift.length === 0, 'The pet art has drifted from the click target.', drift);

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
    flow.behaviorAfterStop === 'idle',
    'Pet stayed in focus after stop.',
    flow.behaviorAfterStop,
  );
  check(
    flow.configWorkMin === 50,
    'The focus configuration did not change.',
    flow.configWorkMin,
  );

  // The Locker round-trip. The display check is the part that can silently
  // regress: the state can change while the art ignores it.
  const locker = result.lockerFlow ?? {};
  check(!locker.error, 'The locker flow threw.', locker.error);
  check(
    locker.before?.[0] === 'glasses',
    'The pet did not start wearing the glasses.',
    locker.before,
  );
  check(locker.off?.ok === true, 'Taking the glasses off was refused.', locker.off);
  check(
    (locker.afterOff ?? []).length === 0,
    'The glasses stayed equipped after being taken off.',
    locker.afterOff,
  );
  check(
    locker.petGlassesOff === 'none',
    'The pet still shows glasses the Locker took off.',
    locker.petGlassesOff,
  );
  check(locker.on?.ok === true, 'Putting the glasses back on was refused.', locker.on);
  check(
    locker.afterOn?.[0] === 'glasses',
    'The glasses did not come back on.',
    locker.afterOn,
  );
  check(
    locker.petGlassesOn === 'block',
    'The pet does not show the glasses the Locker put on.',
    locker.petGlassesOn,
  );
  check(locker.locked?.ok === false, 'A locked cosmetic was equipped.', locker.locked);
  check(
    locker.afterLocked?.[0] === 'glasses',
    'A refused toggle changed what the pet wears.',
    locker.afterLocked,
  );

  // The full cosmetic sweep. Every item: on → visible, off → gone. The XP
  // grant is test-only (isolated save), so nothing here touches the real one.
  const sweep = locker.sweep ?? {};
  check(locker.level === 10, 'The test pet did not reach level 10.', locker.level);
  for (const id of ['leaf-hat', 'mug', 'scarf-aurora']) {
    const step = sweep[id] ?? {};
    check(!step.error, `The ${id} step threw.`, step.error);
    check(step.putOn?.ok === true, `Putting the ${id} on was refused.`, step.putOn);
    check(
      step.afterOn?.includes(id) === true,
      `The ${id} did not stick when equipped.`,
      step.afterOn,
    );
    check(
      step.displayOn === 'block',
      `The pet does not show the ${id} it is wearing.`,
      step.displayOn,
    );
    check(step.takeOff?.ok === true, `Taking the ${id} off was refused.`, step.takeOff);
    check(
      step.afterOff?.includes(id) === false,
      `The ${id} stayed equipped after being taken off.`,
      step.afterOff,
    );
    check(
      step.displayOff === 'none',
      `The pet still shows the ${id} after it was taken off.`,
      step.displayOff,
    );
  }

  // One slot, one scarf: the second scarf must retire the first.
  const swap = locker.swap ?? {};
  check(
    swap.afterFirst?.includes('scarf-moss') === true,
    'The first scarf did not stick.',
    swap.afterFirst,
  );
  check(
    swap.afterSecond?.includes('scarf-sky') === true &&
      swap.afterSecond?.includes('scarf-moss') === false,
    'The second scarf did not replace the first.',
    swap.afterSecond,
  );
  check(
    swap.firstDisplay === 'none' && swap.secondDisplay === 'block',
    'The wrong scarf is visible after the swap.',
    { first: swap.firstDisplay, second: swap.secondDisplay },
  );

  // The bed: worn items vanish at bedtime, the bed is the exception.
  const bed = locker.bed ?? {};
  check(
    bed.afterEquip?.includes('scarf-moss') === true &&
      bed.afterEquip?.includes('bed') === true,
    'The scarf and the bed were not equipped together.',
    bed.afterEquip,
  );
  check(bed.asleep === 'sleep', 'The test pet did not fall asleep.', bed.asleep);
  check(
    bed.bedAsleep === 'block',
    'The bed is not visible while the pet sleeps.',
    bed.bedAsleep,
  );
  check(
    bed.scarfAsleep === 'none',
    'The scarf stays visible at bedtime (it should curl away with the outfit).',
    bed.scarfAsleep,
  );
  check(bed.bedAwake === 'none', 'The bed is visible while the pet is awake.', bed.bedAwake);
  check(
    bed.scarfAwake === 'block',
    'The scarf did not come back after waking.',
    bed.scarfAwake,
  );
  check(
    bed.afterTakeOff?.includes('bed') === false &&
      bed.afterTakeOff?.includes('scarf-moss') === false,
    'Taking the scarf and bed off did not clear them.',
    bed.afterTakeOff,
  );

  console.log('Phase 1 assertions passed.');

  // --- The window and the pet's behaviour ----------------------------------

  const win = result.windowChecks ?? {};
  check(!win.error, 'The window checks threw.', win.error);

  // The pet must never sit over the taskbar.
  check(
    win.taskbar?.y <= win.taskbar?.maxY,
    'The pet can be parked over the taskbar.',
    win.taskbar,
  );

  // The pet must keep living while it is hidden.
  check(
    (win.hiddenBroadcasts ?? 0) > 0,
    'The pet stopped living while it was hidden.',
    win.hiddenBroadcasts,
  );

  // Reduced motion must stop the window moving.
  check(win.reducedMotion?.active === true, 'Reduced motion was not reported.', win.reducedMotion);
  check(
    win.reducedMotion?.moved === 0,
    'The pet still walked with reduced motion on.',
    win.reducedMotion,
  );

  // With motion on, the pet must walk at the documented speed.
  const walkSpeed = (win.walk?.distance ?? 0) / ((win.walk?.durationMs ?? 1) / 1000);
  check(
    walkSpeed >= 60 && walkSpeed <= 90,
    'The pet is not walking at the documented speed.',
    { speed: walkSpeed, ...win.walk },
  );

  // Dropping near a corner must glide, not teleport.
  const snap = win.snap ?? {};
  check(
    snap.mid?.x !== snap.target?.x || snap.mid?.y !== snap.target?.y,
    'The pet teleported into the corner instead of gliding.',
    snap,
  );
  check(
    snap.mid?.x > snap.target?.x && snap.mid?.x < snap.start?.x,
    'The pet did not glide towards the corner.',
    snap,
  );
  check(
    snap.end?.x === snap.target?.x && snap.end?.y === snap.target?.y,
    'The pet did not end up in the corner.',
    snap,
  );

  // The Den must not be able to claim the welcome message.
  check(
    win.welcomeFromDen?.ok === false,
    'The Den was able to claim the welcome message.',
    win.welcomeFromDen,
  );

  console.log('Window and behaviour assertions passed.');

  // --- The power events ----------------------------------------------------

  const power = result.powerFlow ?? {};
  check(!power.error, 'The power flow threw.', power.error);
  check(
    power.duringSleep?.status === 'paused',
    'Suspending did not pause the session.',
    power.duringSleep,
  );
  check(
    power.duringSleep?.pauseReason === 'suspend',
    'The pause did not say it was a suspend.',
    power.duringSleep,
  );
  check(
    power.duringSleep?.remainingMs > 0,
    'The session lost its remaining time when the machine slept.',
    power.duringSleep,
  );
  check(
    power.duringSleep.remainingMs <= power.beforeSleep + 50 &&
      power.duringSleep.remainingMs > power.beforeSleep - 1500,
    'The session did not keep its remaining time when the machine slept.',
    { before: power.beforeSleep, during: power.duringSleep },
  );
  check(
    power.afterWake?.status === 'paused',
    'Waking up restarted the session by itself.',
    power.afterWake,
  );
  check(
    power.afterWake?.pauseReason === 'suspend',
    'The pause reason changed on wake.',
    power.afterWake,
  );
  check(
    Math.abs((power.afterWake?.remainingMs ?? 0) - (power.duringSleep?.remainingMs ?? 0)) <= 50,
    'Waking up consumed part of the session.',
    { during: power.duringSleep, after: power.afterWake },
  );
  check(
    power.whileLocked?.status === 'paused',
    'Locking did not pause the session.',
    power.whileLocked,
  );
  check(
    power.whileLocked?.pauseReason === 'lock',
    'The pause did not say it was a lock.',
    power.whileLocked,
  );
  check(
    power.afterUnlock?.status === 'paused',
    'Unlocking restarted the session by itself.',
    power.afterUnlock,
  );

  console.log('Power event assertions passed.');

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
