import {
  app,
  BrowserWindow,
  dialog,
  globalShortcut,
  Menu,
  type MenuItemConstructorOptions,
  nativeImage,
  Notification,
  powerMonitor,
  screen,
  shell,
  Tray,
  ipcMain,
  type IpcMainInvokeEvent,
} from 'electron';
import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PetBrain, type WalkStart } from '../domain/pet-brain';
import { FocusTimer, type FocusAggregates, type FocusPersisted } from '../domain/focus-timer';
import { computeInsights } from '../domain/insights';
import { isQuietHour, type QuietHoursConfig } from '../domain/quiet-hours';
import {
  BUBBLE_UNSOLICITED_MAX_PER_HOUR,
  BUBBLE_UNSOLICITED_MIN_GAP_MS,
  BEHAVIOR_TICK_MS,
  CURRENT_SCHEMA_VERSION,
  FOCUS_DEFAULTS,
  FOCUS_PHASE_BONUS_XP,
  FOCUS_TICK_MS,
  FOCUS_XP_PER_MINUTE,
  HOTKEY_DEFAULTS,
  IDLE_AUTO_PAUSE_SECONDS,
  QUIET_MINUTE_MAX,
  QUIET_MINUTE_MIN,
  SNAP_DISTANCE,
  SNAP_DURATION_MS,
  WALK_SPEED_DIP_PER_SECOND,
} from '../shared/constants';
import { localDateKey } from '../shared/dates';
import { defaultPersistedState } from '../domain/persistence-schema';
import type {
  AppSnapshot,
  BubbleSpec,
  FocusAction,
  FocusConfig,
  FocusConfigResult,
  FocusPauseReason,
  InsightsView,
  OkResult,
  Point,
  Settings,
} from '../shared/types';
import { focusConfigIssues } from '../shared/focus-config';
import { Store } from './store';
import { monotonicNow, systemFocusClock } from './clock';
import { clampPlacement, createDenWindow, createPetWindow } from './windows';

const SETTINGS_KEYS: (keyof Settings)[] = [
  'petName',
  'roam',
  'reducedMotion',
  'sound',
  'launchAtLogin',
  'pauseWhenLocked',
  'autoResume',
  'quietHoursEnabled',
  'quietStartMin',
  'quietEndMin',
  'hideInFullscreen',
  'globalHotkeys',
];

/** How often the pet checks whether a fullscreen app has taken the screen. */
const FULLSCREEN_CHECK_MS = 1000;

/** Margins kept between Mochi and the edge of the work area. */
const WINDOW_EDGE_MARGIN = 24;

/** Insights needs a zero history to show an honest empty state. */
const EMPTY_AGGREGATES: FocusAggregates = {
  dayKey: '1970-01-01',
  completedToday: 0,
  focusedMsToday: 0,
  focusedByDay: {},
  completedByDay: {},
  breakByDay: {},
  breaksByDay: {},
  streakDays: 0,
  lastCompletedDay: null,
};

function isPoint(value: unknown): value is Point {
  if (typeof value !== 'object' || value === null) return false;
  const point = value as Record<string, unknown>;
  return (
    typeof point.x === 'number' &&
    Number.isFinite(point.x) &&
    typeof point.y === 'number' &&
    Number.isFinite(point.y)
  );
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** How often the idle clock is read. Reading it every tick would be wasteful. */
const IDLE_CHECK_INTERVAL_MS = 5000;

interface SmokeFocusFlow {
  start?: unknown;
  running?: { status: string; behavior: string; remainingMs: number };
  pause?: unknown;
  paused?: string;
  stop?: unknown;
  stopped?: string;
  behaviorAfterStop?: string;
  configWorkMin?: number;
  error?: string;
}

interface SmokeLockerFlow {
  before?: string[];
  off?: unknown;
  afterOff?: string[];
  petGlassesOff?: string;
  on?: unknown;
  afterOn?: string[];
  petGlassesOn?: string;
  locked?: unknown;
  afterLocked?: string[];
  /** Level after the test-only XP grant that opens the whole Locker. */
  level?: number;
  /** Every unlocked cosmetic: on → visible, off → gone. */
  sweep?: Record<string, SmokeCosmeticStep>;
  /** Two items in one slot: the second must replace the first. */
  swap?: {
    first?: unknown;
    afterFirst?: string[];
    second?: unknown;
    afterSecond?: string[];
    firstDisplay?: string;
    secondDisplay?: string;
    afterTakeOff?: string[];
  };
  /** The bed only shows while asleep, and only it survives sleep. */
  bed?: {
    afterEquip?: string[];
    asleep?: string;
    bedAsleep?: string;
    scarfAsleep?: string;
    awake?: string;
    bedAwake?: string;
    scarfAwake?: string;
    afterTakeOff?: string[];
  };
  error?: string;
}

interface SmokeCosmeticStep {
  putOn?: unknown;
  afterOn?: string[];
  displayOn?: string;
  takeOff?: unknown;
  afterOff?: string[];
  displayOff?: string;
  error?: string;
}

interface SmokeFocusSnapshot {
  status: string;
  pauseReason: string | null;
  remainingMs: number;
}

interface SmokePowerFlow {
  beforeSleep: number;
  duringSleep: SmokeFocusSnapshot;
  afterWake: SmokeFocusSnapshot;
  whileLocked: SmokeFocusSnapshot;
  afterUnlock: SmokeFocusSnapshot;
  error?: string;
}

export class MochiController {
  private readonly store: Store;
  private readonly smoke: boolean;
  private readonly smokeRecover: boolean;

  private petWindow: BrowserWindow | null = null;
  private denWindow: BrowserWindow | null = null;
  private tray: Tray | null = null;

  /** Replaced wholesale when the user resets everything. */
  private brain: PetBrain;
  private focus: FocusTimer;

  private behaviorTimer: NodeJS.Timeout | null = null;
  private focusTimer: NodeJS.Timeout | null = null;
  private motionTimer: NodeJS.Timeout | null = null;
  private dragTimer: NodeJS.Timeout | null = null;
  private dragWatchdog: NodeJS.Timeout | null = null;
  private dragOffset: Point | null = null;
  private isQuitting = false;

  private welcome: boolean;
  private lastTrayKey = '';
  private timersStarted = false;
  /** Whether the idle pause has already been offered to the user. */
  private idlePauseOffered = false;
  /** Rate limiting for bubbles the pet shows on its own. */
  private lastUnsolicitedBubbleAt = 0;
  private unsolicitedThisHour = 0;
  private bubbleHourKey = 0;
  private lastIdleCheckAt = 0;
  /** Debug trail for the smoke run: every equip invocation, in order. */
  private equipTrace: string[] = [];
  /** Global hotkeys that failed to register, shown in Settings. */
  private hotkeyConflicts: string[] = [];
  private registeredHotkeys = new Map<string, Electron.Accelerator>();
  /** Set when Mochi hid itself because a fullscreen game took the screen. */
  private hiddenByFullscreen = false;
  private fullscreenTimer: NodeJS.Timeout | null = null;
  /** Whether reduced motion is actually in effect, as the pet reports it. */
  private reducedMotionActive = false;

  constructor(store: Store, smoke = false, smokeRecover = false) {
    this.store = store;
    this.smoke = smoke;
    this.smokeRecover = smokeRecover;
    this.brain = new PetBrain({ now: Date.now() });
    this.brain.restore(store.state.pet, Date.now());
    this.focus = new FocusTimer(FOCUS_DEFAULTS, systemFocusClock);
    // A session that was running when the app last closed comes back paused,
    // ready for the user to pick up or abandon.
    this.focus.restore(this.store.state.focus);
    this.welcome = !store.state.hasSeenWelcome;
  }

  onSecondInstance(): void {
    this.showPet();
    this.openDen();
  }

  async start(): Promise<void> {
    this.applyLoginItem();
    this.petWindow = createPetWindow(this.store);
    this.petWindow.setIgnoreMouseEvents(true, { forward: true });
    this.wirePetWindow();
    this.registerIpc();

    if (!this.smoke) {
      this.createTray();
      this.applyHotkeys();
    }

    this.petWindow.webContents.once('did-finish-load', () => {
      this.startTimers();
      if (this.smoke) {
        this.petWindow?.showInactive();
        void this.runSmoke();
        return;
      }
      setTimeout(() => {
        if (!this.petWindow?.isVisible()) this.showPet();
      }, 120);
      setTimeout(() => {
        this.brain.wave(Date.now());

        // A session that was running when the app last closed comes back
        // paused. Offer to pick it up rather than quietly dropping it.
        const focus = this.focus.state();
        if (focus.status === 'paused' && focus.pauseReason === 'recovered') {
          this.showBubble({
            id: `focus-recovered-${Date.now()}`,
            text: 'I kept your last session. Ready to carry on?',
            durationMs: 12_000,
            action: { id: 'resume-focus', label: 'Resume' },
          });
        }
      }, 900);
    });

    // Suspending stops the session here and picks it up where it left off when
    // the machine wakes. Whatever happened while it slept is not focus time,
    // and the pause is what keeps it that way — no deadline arithmetic, and it
    // does not matter whether the monotonic clock runs during sleep.
    powerMonitor.on('suspend', () => this.onSuspend());
    powerMonitor.on('resume', () => this.onResume());
    powerMonitor.on('lock-screen', () => this.onLock());
    powerMonitor.on('unlock-screen', () => this.onUnlock());
    screen.on('display-metrics-changed', () => {
      if (this.petWindow) clampPlacement(this.petWindow);
    });
    screen.on('display-removed', () => {
      if (this.petWindow) clampPlacement(this.petWindow);
    });
  }

  async runSmoke(): Promise<void> {
    if (this.smokeRecover) {
      await this.runSmokeRecover();
      return;
    }

    const win = this.petWindow;
    if (!win) return;

    const diagnostics: string[] = [];
    win.webContents.on('console-message', (event) => {
      diagnostics.push(`console:${event.level}:${event.message}`);
    });
    win.webContents.on('did-fail-load', (_event, code, description) => {
      diagnostics.push(`load-failed:${code}:${description}`);
    });

    await new Promise((resolve) => setTimeout(resolve, 1800));
    win.showInactive();
    await new Promise((resolve) => setTimeout(resolve, 400));

    let dom: unknown = null;
    try {
      dom = await win.webContents.executeJavaScript(
        `({
          root: !!document.querySelector('.pet-root'),
          svg: !!document.querySelector('.pet-svg'),
          sprite: document.querySelector('.pet-sprite')?.className ?? null,
          bodyBackground: getComputedStyle(document.body).backgroundColor,
          rects: document.querySelectorAll('svg *').length,
          text: document.body.innerText.slice(0, 120),
          spriteRect: (() => {
            const rect = document.querySelector('.pet-sprite')?.getBoundingClientRect();
            return rect
              ? { left: rect.left, top: rect.top, width: rect.width, height: rect.height }
              : null;
          })()
        })`,
      );
    } catch (error) {
      diagnostics.push(`eval-failed:${String(error)}`);
    }

    const petCapture = await this.captureWindow(win, 'smoke-result.png');
    diagnostics.push(...petCapture.diagnostics);

    // Open the real Den and drive a focus session through the preload bridge,
    // exactly as the UI does.
    this.openDen();
    const den = await this.waitForDen(6000);
    let denDom: unknown = null;
    let denCapture = { pngBytes: 0, empty: true, diagnostics: [] as string[] };
    const tabs: Record<string, unknown> = {};
    const windowChecks: Record<string, unknown> = {};
    const focusFlow: SmokeFocusFlow = {};
    const lockerFlow: SmokeLockerFlow = {};
    const powerFlow: SmokePowerFlow = {
      beforeSleep: 0,
      duringSleep: { status: 'idle', pauseReason: null, remainingMs: 0 },
      afterWake: { status: 'idle', pauseReason: null, remainingMs: 0 },
      whileLocked: { status: 'idle', pauseReason: null, remainingMs: 0 },
      afterUnlock: { status: 'idle', pauseReason: null, remainingMs: 0 },
    };

    if (den) {
      await this.sleep(500);
      try {
        denDom = await den.webContents.executeJavaScript(
          `({
            root: !!document.querySelector('.den-root'),
            nav: Array.from(document.querySelectorAll('.nav-item')).map((n) => n.textContent),
            title: document.querySelector('.den-title')?.textContent ?? null,
            ring: document.querySelector('.ring-time')?.textContent ?? null,
            cards: document.querySelectorAll('.card').length,
            recovery: document.querySelector('.banner-recovery')?.textContent ?? null,
            fields: document.querySelectorAll('.number-field').length,
            buttons: Array.from(document.querySelectorAll('.btn')).map((b) => b.textContent.trim())
          })`,
        );
      } catch (error) {
        diagnostics.push(`den-eval-failed:${String(error)}`);
      }

      try {
        focusFlow.start = await den.webContents.executeJavaScript(
          "window.mochi.focus('start')",
        );
        await this.sleep(1200);
        const running = this.snapshot();
        focusFlow.running = {
          status: running.focus.status,
          behavior: running.pet.behavior,
          remainingMs: running.focus.remainingMs,
        };
        focusFlow.pause = await den.webContents.executeJavaScript(
          "window.mochi.focus('pause')",
        );
        focusFlow.paused = this.snapshot().focus.status;
        focusFlow.stop = await den.webContents.executeJavaScript(
          "window.mochi.focus('stop')",
        );
        focusFlow.stopped = this.snapshot().focus.status;
        // The pet's posture, captured here rather than at the end, because
        // later steps deliberately wake it up.
        focusFlow.behaviorAfterStop = this.brain.snapshot().behavior;

        // Change the session length, so the next launch can prove it stuck.
        await den.webContents.executeJavaScript(
          "window.mochi.updateFocusConfig({ workMin: 50 })",
        );
        focusFlow.configWorkMin = this.focus.getConfig().workMin;
      } catch (error) {
        focusFlow.error = String(error);
      }

      // The Locker: wearing something must round-trip — off, back on, and a
      // refusal for a locked cosmetic. What the pet actually shows is read
      // from the pet window, because a state that changes without the art
      // following is exactly the bug this guards against.
      //
      // The smoke save keeps its level *and* its outfit between runs (focus
      // sessions grant XP, and a high level lets the mug in the door). Reset
      // to a fresh pet: level 1, wearing only the glasses it starts with —
      // otherwise nothing would look locked and every check would rot away.
      try {
        this.brain.restore({ xp: 0, equipped: ['glasses'] }, Date.now());
        lockerFlow.before = [...this.brain.snapshot().equipped];
        lockerFlow.off = await den.webContents.executeJavaScript(
          "window.mochi.equip('glasses')",
        );
        lockerFlow.afterOff = [...this.brain.snapshot().equipped];
        lockerFlow.petGlassesOff = await this.cosmeticDisplay('.pet-svg .glasses');
        lockerFlow.on = await den.webContents.executeJavaScript(
          "window.mochi.equip('glasses')",
        );
        lockerFlow.afterOn = [...this.brain.snapshot().equipped];
        lockerFlow.petGlassesOn = await this.cosmeticDisplay('.pet-svg .glasses');
        lockerFlow.locked = await den.webContents.executeJavaScript(
          "window.mochi.equip('mug')",
        );
        lockerFlow.afterLocked = [...this.brain.snapshot().equipped];
      } catch (error) {
        lockerFlow.error = String(error);
      }

      // The full sweep: grant XP to this throwaway test pet until the whole
      // Locker is open, then every cosmetic goes on, must be visible at its
      // anchor, comes off, and must be gone. The two scarves also prove the
      // one-per-slot rule, and the bed proves sleep only spares the bed.
      try {
        lockerFlow.sweep = {};
        this.brain.addXp(1400); // level 10 costs 1350 xp — the bed's price
        lockerFlow.level = this.brain.snapshot().level;
        const sleep = (ms: number) =>
          new Promise<void>((resolve) => setTimeout(resolve, ms));

        for (const [id, selector] of [
          ['leaf-hat', '.accessory.leaf-hat'],
          ['mug', '.accessory.mug'],
          ['scarf-aurora', '.accessory.scarf-aurora'],
        ] as const) {
          const step: SmokeCosmeticStep = {};
          try {
            step.putOn = await den.webContents.executeJavaScript(
              `window.mochi.equip(${JSON.stringify(id)})`,
            );
            await sleep(80);
            step.afterOn = [...this.brain.snapshot().equipped];
            step.displayOn = await this.cosmeticDisplay(selector);
            step.takeOff = await den.webContents.executeJavaScript(
              `window.mochi.equip(${JSON.stringify(id)})`,
            );
            await sleep(80);
            step.afterOff = [...this.brain.snapshot().equipped];
            step.displayOff = await this.cosmeticDisplay(selector);
          } catch (error) {
            step.error = String(error);
          }
          lockerFlow.sweep[id] = step;
        }

        // The scarf swap: the neck holds one, so the new scarf retires the old.
        if (!lockerFlow.swap) lockerFlow.swap = {};
        lockerFlow.swap.first = await den.webContents.executeJavaScript(
          "window.mochi.equip('scarf-moss')",
        );
        await sleep(80);
        lockerFlow.swap.afterFirst = [...this.brain.snapshot().equipped];
        lockerFlow.swap.second = await den.webContents.executeJavaScript(
          "window.mochi.equip('scarf-sky')",
        );
        await sleep(80);
        lockerFlow.swap.afterSecond = [...this.brain.snapshot().equipped];
        lockerFlow.swap.firstDisplay = await this.cosmeticDisplay(
          '.accessory.scarf-moss',
        );
        lockerFlow.swap.secondDisplay = await this.cosmeticDisplay(
          '.accessory.scarf-sky',
        );
        await den.webContents.executeJavaScript("window.mochi.equip('scarf-sky')");
        await sleep(80);
        lockerFlow.swap.afterTakeOff = [...this.brain.snapshot().equipped];

        // The bed: worn items vanish at bedtime, the bed is the exception.
        if (!lockerFlow.bed) lockerFlow.bed = {};
        await den.webContents.executeJavaScript("window.mochi.equip('scarf-moss')");
        await den.webContents.executeJavaScript("window.mochi.equip('bed')");
        await sleep(80);
        lockerFlow.bed.afterEquip = [...this.brain.snapshot().equipped];
        this.brain.forceSleep(Date.now());
        this.broadcast();
        await sleep(200);
        lockerFlow.bed.asleep = this.brain.snapshot().behavior;
        lockerFlow.bed.bedAsleep = await this.cosmeticDisplay('.accessory.bed');
        lockerFlow.bed.scarfAsleep = await this.cosmeticDisplay(
          '.accessory.scarf-moss',
        );
        this.brain.forceWake(Date.now());
        this.broadcast();
        await sleep(200);
        lockerFlow.bed.awake = this.brain.snapshot().behavior;
        lockerFlow.bed.bedAwake = await this.cosmeticDisplay('.accessory.bed');
        lockerFlow.bed.scarfAwake = await this.cosmeticDisplay(
          '.accessory.scarf-moss',
        );
        await den.webContents.executeJavaScript("window.mochi.equip('scarf-moss')");
        await den.webContents.executeJavaScript("window.mochi.equip('bed')");
        await sleep(80);
        lockerFlow.bed.afterTakeOff = [...this.brain.snapshot().equipped];
      } catch (error) {
        lockerFlow.bed = lockerFlow.bed ?? {};
        lockerFlow.swap = lockerFlow.swap ?? {};
        lockerFlow.error = [...(lockerFlow.error ? [lockerFlow.error] : []), String(error)].join('; ');
      }

      // The window and the pet's behaviour. Everything here is checked by the
      // smoke script, so none of it needs a person.
      try {
        const win = this.petWindow;
        const area = screen.getPrimaryDisplay().workArea;
        const size = win?.getBounds();

        // The pet must never be able to sit over the taskbar.
        if (win && size) {
          win.setBounds({
            x: area.x + 40,
            y: area.y + area.height - 40,
            width: size.width,
            height: size.height,
          });
          clampPlacement(win);
          const after = win.getBounds();
          windowChecks.taskbar = { y: after.y, maxY: area.y + area.height - after.height };
        }

        // The pet must keep living while it is hidden. Counting the broadcasts
        // is the proof that the behaviour tick is still running — before the
        // fix it stopped dead the moment the window was hidden.
        let broadcasts = 0;
        const originalBroadcast = this.broadcast.bind(this);
        (this as unknown as { broadcast: () => void }).broadcast = (): void => {
          broadcasts += 1;
          originalBroadcast();
        };

        this.hidePet();
        await this.sleep(1400);
        windowChecks.hiddenBroadcasts = broadcasts;

        (this as unknown as { broadcast: () => void }).broadcast = originalBroadcast;
        this.showPet();

        // Reduced motion must stop the window moving, not just the CSS.
        await den.webContents.executeJavaScript(
          "window.mochi.updateSettings({ reducedMotion: 'on' })",
        );
        await this.sleep(500);
        const beforeMotion = win?.getBounds().x ?? 0;
        this.simulateWalk();
        await this.sleep(1400);
        windowChecks.reducedMotion = {
          active: this.reducedMotionActive,
          moved: Math.abs((win?.getBounds().x ?? 0) - beforeMotion),
        };

        // With motion back on, the pet should walk at the documented speed.
        await den.webContents.executeJavaScript(
          "window.mochi.updateSettings({ reducedMotion: 'off' })",
        );
        await this.sleep(500);
        if (win && size) {
          win.setBounds({
            x: Math.round(area.x + (area.width - size.width) / 2),
            y: area.y + area.height - size.height,
            width: size.width,
            height: size.height,
          });
        }
        const walkStart = win?.getBounds().x ?? 0;
        this.simulateWalk();
        await this.sleep(4000);
        windowChecks.walk = {
          distance: Math.abs((win?.getBounds().x ?? 0) - walkStart),
          durationMs: 3600,
        };

        // Dropping the pet near a corner should glide into it, not teleport.
        if (win && size) {
          const corner = { x: area.x + 16, y: area.y + 16 };
          // Close enough to snap to, but far enough that a jump would show.
          const offset = 30;
          win.setBounds({
            x: corner.x + offset,
            y: corner.y + offset,
            width: size.width,
            height: size.height,
          });
          this.simulateDrop();
          await this.sleep(80);
          const mid = win.getBounds();
          windowChecks.snap = {
            start: { x: corner.x + offset, y: corner.y + offset },
            mid: { x: mid.x, y: mid.y },
            target: corner,
          };
          await this.sleep(500);
          const end = win.getBounds();
          windowChecks.snap = {
            ...(windowChecks.snap as Record<string, unknown>),
            end: { x: end.x, y: end.y },
          };
        }

        // The Den must not be able to claim the welcome message.
        windowChecks.welcomeFromDen = await den.webContents.executeJavaScript(
          "window.mochi.ackWelcome()",
        );
      } catch (error) {
        windowChecks.error = String(error);
      }

      // The power events. A session must not lose time while the machine is
      // asleep, and it must stay paused when the screen is locked.
      try {
        await den.webContents.executeJavaScript("window.mochi.focus('start')");
        await this.sleep(1200);

        powerFlow.beforeSleep = this.focus.state().remainingMs;

        this.simulatePowerEvent('suspend');
        const duringSleep = this.focus.state();
        powerFlow.duringSleep = {
          status: duringSleep.status,
          pauseReason: duringSleep.pauseReason,
          remainingMs: duringSleep.remainingMs,
        };

        this.simulatePowerEvent('resume');
        const afterWake = this.focus.state();
        powerFlow.afterWake = {
          status: afterWake.status,
          pauseReason: afterWake.pauseReason,
          remainingMs: afterWake.remainingMs,
        };

        await den.webContents.executeJavaScript("window.mochi.focus('resume')");
        await this.sleep(200);

        this.simulatePowerEvent('lock-screen');
        const whileLocked = this.focus.state();
        powerFlow.whileLocked = {
          status: whileLocked.status,
          pauseReason: whileLocked.pauseReason,
          remainingMs: whileLocked.remainingMs,
        };

        this.simulatePowerEvent('unlock-screen');
        const afterUnlock = this.focus.state();
        powerFlow.afterUnlock = {
          status: afterUnlock.status,
          pauseReason: afterUnlock.pauseReason,
          remainingMs: afterUnlock.remainingMs,
        };
      } catch (error) {
        powerFlow.error = String(error);
      }

      // Walk through the Den's tabs, so each one is known to render.
      for (const tabName of ['Focus', 'Settings']) {
        await den.webContents.executeJavaScript(
          `Array.from(document.querySelectorAll('.nav-item'))
             .find((n) => n.textContent === ${JSON.stringify(tabName)})?.click()`,
        );
        await this.sleep(350);
        tabs[tabName] = await den.webContents.executeJavaScript(
          `({
            fields: document.querySelectorAll('.number-field').length,
            buttons: Array.from(document.querySelectorAll('.btn')).map((b) => b.textContent.trim()),
            inputs: document.querySelectorAll('input, select').length,
            cards: document.querySelectorAll('.card').length
          })`,
        );
      }

      denCapture = await this.captureWindow(den, 'smoke-den.png');
    }

    const result = {
      electron: process.versions.electron,
      chrome: process.versions.chrome,
      node: process.versions.node,
      visible: win.isVisible(),
      alwaysOnTop: win.isAlwaysOnTop(),
      focusable: win.isFocusable(),
      bounds: win.getBounds(),
      ignoreMouseDefault: true,
      pngBytes: petCapture.pngBytes,
      captureEmpty: petCapture.empty,
      dom,
      diagnostics,
      den: den
        ? {
            visible: den.isVisible(),
            bounds: den.getBounds(),
            dom: denDom,
            tabs,
            pngBytes: denCapture.pngBytes,
            captureEmpty: denCapture.empty,
            diagnostics: denCapture.diagnostics,
          }
        : null,
      focusFlow,
      lockerFlow,
      equipTrace: this.equipTrace,
      powerFlow,
      windowChecks,
      state: this.petWindow ? this.snapshot() : null,
    };
    writeFileSync(
      join(process.cwd(), 'smoke-result.json'),
      `${JSON.stringify(result, null, 2)}\n`,
      'utf8',
    );
    console.log(`SMOKE_RESULT ${JSON.stringify(result)}`);

    // Leave a session running, so the second launch can prove that a session
    // left behind comes back rather than being lost.
    if (den) {
      try {
        await den.webContents.executeJavaScript("window.mochi.focus('start')");
        await this.sleep(300);
      } catch {
        // The recovery check will notice.
      }
    }

    // app.exit() skips before-quit, so the pending write is flushed by hand.
    this.persistNow();
    app.exit(0);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * The second half of the smoke check: launch again and report what was
   * recovered from disk. A session that was running when the app closed must
   * come back paused, with its time intact, and the configuration it was
   * using must still be there.
   */
  private async runSmokeRecover(): Promise<void> {
    await this.sleep(1200);

    const result = {
      focus: this.focus.state(),
      config: this.focus.getConfig(),
      welcome: this.welcome,
    };

    writeFileSync(
      join(process.cwd(), 'smoke-recover.json'),
      `${JSON.stringify(result, null, 2)}\n`,
      'utf8',
    );
    console.log(`SMOKE_RECOVER ${JSON.stringify(result)}`);
    app.exit(0);
  }

  private async waitForDen(timeoutMs: number): Promise<BrowserWindow | null> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const den = this.denWindow;
      if (den && !den.isDestroyed() && !den.webContents.isLoading()) return den;
      await this.sleep(100);
    }
    return this.denWindow;
  }

  private async captureWindow(
    win: BrowserWindow,
    fileName: string,
  ): Promise<{ pngBytes: number; empty: boolean; diagnostics: string[] }> {
    const diagnostics: string[] = [];
    for (let attempt = 0; attempt < 4; attempt += 1) {
      try {
        const image = await win.webContents.capturePage();
        const png = image.toPNG();
        if (png.length > 0 && !image.isEmpty()) {
          writeFileSync(join(process.cwd(), fileName), png);
          return { pngBytes: png.length, empty: false, diagnostics };
        }
        diagnostics.push(`capture-empty:${attempt}`);
      } catch (error) {
        diagnostics.push(`capture-failed:${String(error)}`);
      }
      await this.sleep(150);
    }
    return { pngBytes: 0, empty: true, diagnostics };
  }

  stop(): void {
    this.isQuitting = true;
    this.persistNow();
    if (this.behaviorTimer) clearInterval(this.behaviorTimer);
    if (this.focusTimer) clearInterval(this.focusTimer);
    if (this.fullscreenTimer) clearInterval(this.fullscreenTimer);
    this.fullscreenTimer = null;
    globalShortcut.unregisterAll();
    this.stopMotion();
    this.stopDrag();
    this.tray?.destroy();
    this.tray = null;
  }

  private wirePetWindow(): void {
    const win = this.petWindow;
    if (!win) return;

    win.on('closed', () => {
      this.petWindow = null;
    });

    win.webContents.on('render-process-gone', () => {
      if (this.isQuitting) return;
      setTimeout(() => {
        if (this.isQuitting || this.petWindow) return;
        this.petWindow = createPetWindow(this.store);
        this.petWindow.setIgnoreMouseEvents(true, { forward: true });
        this.wirePetWindow();
        this.petWindow.webContents.once('did-finish-load', () => {
          this.petWindow?.showInactive();
          this.broadcast();
        });
      }, 600);
    });
  }

  private startTimers(): void {
    if (this.timersStarted) return;
    this.timersStarted = true;
    this.behaviorTimer = setInterval(() => this.behaviorTick(), BEHAVIOR_TICK_MS);
    this.focusTimer = setInterval(() => this.focusTick(), FOCUS_TICK_MS);
    this.fullscreenTimer = setInterval(() => this.checkFullscreen(), FULLSCREEN_CHECK_MS);
    this.behaviorTick();
    this.focusTick();
  }

  private behaviorTick(): void {
    if (!this.petWindow) return;
    const now = Date.now();
    const focusState = this.focus.state();
    const result = this.brain.tick(now, {
      idleSeconds: powerMonitor.getSystemIdleTime(),
      // Focus posture is for a running work phase and nothing else. On a break
      // the pet is awake and free to stretch and wander, and a paused session
      // means nobody is there anyway.
      focusActive: focusState.status === 'running' && focusState.phase === 'work',
      quietHours: isQuietHour(now, this.quietConfig()),
      // Reduced motion is not only about the CSS. The window must stop moving
      // too, or the pet still walks across the screen.
      canRoam: this.store.state.settings.roam && !this.reducedMotionActive,
    });

    if (result.walkStart) {
      this.startWalk(result.walkStart);
    }

    this.broadcast();

    // The store debounces this, so the saved state never falls more than a
    // couple of seconds behind what is on screen.
    this.persist();
  }

  /**
   * Unsolicited bubbles (idle pause, wake-up, level-up) are rate-limited so
   * they never nag: at most one every five minutes, six per hour.
   */
  private canShowUnsolicitedBubble(now: number): boolean {
    const hourKey = Math.floor(now / 3_600_000);
    if (this.bubbleHourKey !== hourKey) {
      this.bubbleHourKey = hourKey;
      this.unsolicitedThisHour = 0;
    }
    if (this.unsolicitedThisHour >= BUBBLE_UNSOLICITED_MAX_PER_HOUR) return false;
    if (now - this.lastUnsolicitedBubbleAt < BUBBLE_UNSOLICITED_MIN_GAP_MS) return false;
    return true;
  }

  /**
   * Offer to carry on after the session paused itself.
   */
  private offerToResume(reason: FocusPauseReason): void {
    const focus = this.focus.state();
    if (focus.status !== 'paused' || focus.pauseReason !== reason) return;

    this.showBubble(
      {
        id: `focus-paused-${reason}-${Date.now()}`,
        text:
          reason === 'lock'
            ? 'Your computer was locked, so I paused. Carry on?'
            : 'Your computer was asleep, so I paused. Carry on?',
        durationMs: 6000,
        action: { id: 'resume-focus', label: 'Resume' },
      },
      true,
    );
  }

  /** The machine went to sleep. The session stops here and picks up later. */
  private onSuspend(): void {
    this.focus.pause(monotonicNow(), 'suspend');
    this.persistNow();
  }

  /** The machine woke up. The session stays paused until the user says so. */
  private onResume(): void {
    this.brain.forceWake(Date.now());
    clampPlacement(this.petWindow!);
    this.offerToResume('suspend');
    this.broadcast();
  }

  /** The screen was locked. A locked computer is not focus time. */
  private onLock(): void {
    if (!this.store.state.settings.pauseWhenLocked) return;
    this.focus.pause(monotonicNow(), 'lock');
    this.persistNow();
  }

  /** The screen was unlocked. The session stays paused until the user says so. */
  private onUnlock(): void {
    this.offerToResume('lock');
  }

  /**
   * Drive the power events the operating system would send.
   *
   * Only the smoke test can use this. In a real build it does nothing, so
   * there is no way to reach it from anywhere.
   */
  simulatePowerEvent(event: 'suspend' | 'resume' | 'lock-screen' | 'unlock-screen'): void {
    if (!this.smoke) return;

    switch (event) {
      case 'suspend':
        this.onSuspend();
        return;
      case 'resume':
        this.onResume();
        return;
      case 'lock-screen':
        this.onLock();
        return;
      case 'unlock-screen':
        this.onUnlock();
        return;
    }
  }

  /** Make the pet walk now. Only the smoke test can use this. */
  simulateWalk(): void {
    if (!this.smoke) return;
    this.walkNow();
  }

  /** Drop the pet where it is, as if the user let go. Only the smoke test can use this. */
  simulateDrop(): void {
    if (!this.smoke) return;
    this.endDrag(false);
  }

  /**
   * Pause a work phase that has been left alone for too long.
   *
   * The session stops rather than ticking away with nobody there, and the
   * question is asked when the user is back rather than while they are away.
   */
  private autoPauseIfIdle(wallNow: number): void {
    if (this.smoke) return; // the real clock is outside the smoke run's control
    if (wallNow - this.lastIdleCheckAt < IDLE_CHECK_INTERVAL_MS) return;
    this.lastIdleCheckAt = wallNow;

    const focus = this.focus.state();

    if (focus.status === 'paused' && focus.pauseReason === 'idle') {
      // Ask the moment the user is back, not while they are still away.
      if (!this.idlePauseOffered && powerMonitor.getSystemIdleTime() < IDLE_AUTO_PAUSE_SECONDS) {
        this.idlePauseOffered = true;
        this.showBubble({
          id: `focus-idle-${wallNow}`,
          text: 'You went quiet for a while, so I paused. Carry on?',
          durationMs: 12_000,
          action: { id: 'resume-focus', label: 'Resume' },
          secondaryAction: { id: 'end-focus', label: 'End' },
        });
      }
      return;
    }

    if (focus.status !== 'running') return;
    if (focus.phase !== 'work') return; // a break is never interrupted
    if (this.store.state.settings.autoResume) return; // carry on by itself
    if (powerMonitor.getSystemIdleTime() < IDLE_AUTO_PAUSE_SECONDS) return;

    this.focus.pause(monotonicNow(), 'idle');
    this.persistNow();
    this.idlePauseOffered = false;
  }

  private focusTick(): void {
    // The timer runs on a monotonic clock, so changing the system clock cannot
    // stretch a session. The pet and the bubbles use wall-clock time.
    const wallNow = Date.now();
    const result = this.focus.tick(monotonicNow());
    const config = this.focus.getConfig();

    this.autoPauseIfIdle(wallNow);

    if (result.completedWork) {
      const before = this.brain.snapshot().level;
      const xp = Math.max(1, Math.round(config.workMin)) * FOCUS_XP_PER_MINUTE + FOCUS_PHASE_BONUS_XP;
      this.brain.addXp(xp);
      this.brain.rewardFocusPhase();
      this.brain.celebrate(wallNow);
      if (this.brain.snapshot().level > before) {
        // Level up: wave and tell the user something new is in the locker.
        this.brain.wave(wallNow);
        this.showBubble(
          {
            id: `level-up-${wallNow}`,
            text: `Level ${this.brain.snapshot().level}! Something new in the locker.`,
            durationMs: 6000,
          },
          true,
        );
      }
      // One toast, one chime, one celebration. Quiet hours take the toast and
      // the sound away, but the pet's own celebration is the in-pet cue that
      // always happens.
      this.notifyCompletion(`${Math.round(config.workMin)} minutes focused. That's a good block.`);
      this.playChime();
      this.showBubble({
        id: `work-complete-${wallNow}`,
        text: `${Math.round(config.workMin)} minutes. That's a good block.`,
        durationMs: 6000,
      });
      this.persistNow();
    }

    if (result.completedBreak) {
      const before = this.brain.snapshot().level;
      const xp = Math.max(1, Math.round(config.workMin)) * FOCUS_XP_PER_MINUTE + FOCUS_PHASE_BONUS_XP;
      this.brain.addXp(xp);
      this.brain.rewardBreak();
      this.brain.celebrate(wallNow);
      if (this.brain.snapshot().level > before) {
        this.brain.wave(wallNow);
        this.showBubble(
          {
            id: `level-up-${wallNow}`,
            text: `Level ${this.brain.snapshot().level}! Something new in the locker.`,
            durationMs: 6000,
          },
          true,
        );
      }
      this.showBubble({
        id: `break-complete-${wallNow}`,
        text: "Break's over. Ready when you are.",
        durationMs: 5000,
      });
      // No toast here: the work phase completing is the one toast the spec
      // allows, and the pet's bubble already said the same thing.
    }

    if (
      result.completedWork ||
      result.completedBreak ||
      result.dayRolledOver ||
      this.focus.state().status === 'running'
    ) {
      this.broadcast();
    }
  }

  private snapshot(): AppSnapshot {
    return {
      pet: this.brain.snapshot(),
      focus: this.focus.state(),
      settings: { ...this.store.state.settings },
      welcome: this.welcome,
      recovery: this.store.recovery,
      hotkeyConflicts: [...this.hotkeyConflicts],
    };
  }

  private broadcast(): void {
    const snapshot = this.snapshot();
    for (const win of [this.petWindow, this.denWindow]) {
      if (win && !win.isDestroyed()) {
        win.webContents.send('state:update', snapshot);
      }
    }
    this.updateTray();
  }

  /**
   * Send a bubble to the pet window. Unsolicited bubbles (idle pause, wake-up,
   * level-up) are rate-limited so they never nag.
   */
  private showBubble(bubble: BubbleSpec, unsolicited = false): void {
    if (!this.petWindow || !this.petWindow.isVisible()) return;
    if (unsolicited && !this.canShowUnsolicitedBubble(Date.now())) return;
    this.petWindow.webContents.send('pet:bubble', bubble);
    if (unsolicited) {
      this.lastUnsolicitedBubbleAt = Date.now();
      this.unsolicitedThisHour += 1;
    }
  }

  private showPet(): void {
    if (!this.petWindow) return;
    this.petWindow.showInactive();
    this.petWindow.setAlwaysOnTop(true, 'screen-saver');
    this.petWindow.setIgnoreMouseEvents(true, { forward: true });
    this.brain.wave(Date.now());
    this.broadcast();
  }

  private hidePet(): void {
    if (!this.petWindow) return;
    this.stopMotion();
    this.petWindow.setIgnoreMouseEvents(true, { forward: true });
    this.petWindow.hide();
    this.persistNow();
    this.broadcast();
  }

  private togglePet(): void {
    if (!this.petWindow) return;
    if (this.petWindow.isVisible()) this.hidePet();
    else this.showPet();
  }

  private openDen(): void {
    if (this.denWindow && !this.denWindow.isDestroyed()) {
      this.denWindow.show();
      this.denWindow.focus();
      this.denWindow.webContents.send('state:update', this.snapshot());
      return;
    }

    const den = createDenWindow();
    this.denWindow = den;
    den.on('close', (event) => {
      if (!this.isQuitting) {
        event.preventDefault();
        den.hide();
      }
    });
    den.on('closed', () => {
      this.denWindow = null;
    });
    den.webContents.once('did-finish-load', () => {
      den.show();
      den.focus();
      den.webContents.send('state:update', this.snapshot());
    });
  }

  private handleFocus(action: FocusAction): OkResult {
    // The timer runs on a monotonic clock; the pet and the bubble use the
    // wall clock.
    const now = monotonicNow();
    const wallNow = Date.now();

    switch (action) {
      case 'start':
        this.stopMotion();
        this.focus.start(now);
        this.showBubble({
          id: `focus-start-${wallNow}`,
          text: "I'll be right here.",
          durationMs: 3200,
        });
        break;
      case 'pause':
        this.focus.pause(now, 'user');
        break;
      case 'resume':
        this.focus.resume(now);
        break;
      case 'skip': {
        this.focus.skip(now);
        this.showBubble({
          id: `focus-skip-${wallNow}`,
          text: 'Skipped. No credit for that one.',
          durationMs: 3200,
        });
        break;
      }
      case 'stop': {
        // Ending a session early keeps whatever was genuinely focused.
        const result = this.focus.abandon();
        if (result.counts) {
          const minutes = Math.floor(result.focusedMs / 60_000);
          if (minutes > 0) {
            this.brain.addXp(minutes * FOCUS_XP_PER_MINUTE);
            this.brain.celebrate(wallNow);
            this.showBubble({
              id: `focus-partial-${wallNow}`,
              text: `${minutes} minutes logged. That still counts.`,
              durationMs: 5000,
            });
          }
        }
        this.brain.endFocus(wallNow);
        break;
      }
      default:
        return { ok: false, error: 'unknown focus action' };
    }
    // A focus command is worth keeping even if the app is killed a second
    // later, so it is written straight away.
    this.persistNow();
    this.broadcast();
    return { ok: true };
  }

  private startWalk(walk: WalkStart): void {
    if (!this.petWindow) return;
    this.stopMotion();

    // Reduced motion means the window stays where it is, whether the pet
    // decided to wander on its own or was asked to. The pet still walks on
    // screen; the window just does not move.
    if (this.reducedMotionActive) return;

    const win = this.petWindow;
    const bounds = win.getBounds();
    const display = screen.getDisplayMatching(bounds);
    const area = display.workArea;
    const startX = bounds.x;

    // The distance comes from the speed the pet is supposed to walk at, so the
    // step and the stride always agree.
    const duration = Math.max(600, walk.durationMs);
    const step = Math.round(WALK_SPEED_DIP_PER_SECOND * (duration / 1000));

    let targetX = startX + walk.facing * step;
    const minX = area.x + 8;
    const maxX = area.x + area.width - bounds.width - 8;

    if (targetX < minX || targetX > maxX) {
      targetX = startX - walk.facing * step;
      this.brain.flipFacing();
    }
    targetX = Math.round(Math.min(maxX, Math.max(minX, targetX)));

    if (Math.abs(targetX - startX) < 30) return;

    this.glideTo(targetX, bounds.y, duration);
  }

  /**
   * Move the window to a place over `durationMs`, easing as it goes.
   *
   * The bounds are only written when the rounded position actually changes,
   * and the new placement is saved when it arrives.
   */
  private glideTo(targetX: number, targetY: number, durationMs: number): void {
    const win = this.petWindow;
    if (!win || win.isDestroyed()) return;

    const start = win.getBounds();
    const duration = Math.max(80, durationMs);
    const startedAt = performance.now();
    let lastX = start.x;
    let lastY = start.y;

    const timer = setInterval(() => {
      if (!this.petWindow || this.petWindow.isDestroyed()) {
        clearInterval(timer);
        return;
      }

      const t = Math.min(1, (performance.now() - startedAt) / duration);
      const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      const x = Math.round(start.x + (targetX - start.x) * eased);
      const y = Math.round(start.y + (targetY - start.y) * eased);

      if (x !== lastX || y !== lastY) {
        lastX = x;
        lastY = y;
        this.petWindow.setBounds({ x, y, width: start.width, height: start.height });
      }

      if (t >= 1) {
        clearInterval(timer);
        this.store.setPlacement(lastX, lastY);
        this.store.flush();
      }
    }, 16);

    this.motionTimer = timer;
  }

  private stopMotion(): void {
    if (this.motionTimer) clearInterval(this.motionTimer);
    this.motionTimer = null;
  }

  private startDrag(): void {
    if (!this.petWindow) return;
    this.stopMotion();
    const win = this.petWindow;
    const bounds = win.getBounds();
    const cursor = screen.getCursorScreenPoint();
    this.dragOffset = { x: cursor.x - bounds.x, y: cursor.y - bounds.y };
    this.brain.startDrag(Date.now());
    win.setIgnoreMouseEvents(false);
    this.broadcast();

    this.stopDragTimers();
    this.dragTimer = setInterval(() => {
      if (!this.petWindow || !this.dragOffset) return;
      const display = screen.getDisplayMatching(this.petWindow.getBounds());
      const area = display.workArea;
      const current = screen.getCursorScreenPoint();
      const width = this.petWindow.getBounds().width;
      const height = this.petWindow.getBounds().height;
      const x = Math.min(
        area.x + area.width - 96,
        Math.max(area.x - width + 96, current.x - this.dragOffset.x),
      );
      // The pet's feet must never reach the taskbar, so the window stays
      // inside the work area vertically.
      const y = Math.min(
        area.y + area.height - height,
        Math.max(area.y, current.y - this.dragOffset.y),
      );
      this.petWindow.setBounds({
        x: Math.round(x),
        y: Math.round(y),
        width,
        height,
      });
    }, 16);

    this.dragWatchdog = setTimeout(() => this.endDrag(true), 15_000);
  }

  private endDrag(canceled = false): void {
    this.stopDragTimers();
    this.dragOffset = null;

    if (!this.petWindow) {
      this.brain.endDrag(Date.now());
      return;
    }

    const win = this.petWindow;
    const bounds = win.getBounds();
    let corner: Point | null = null;

    if (!canceled) {
      const display = screen.getDisplayMatching(bounds);
      const area = display.workArea;
      const margin = 16;
      const corners: Point[] = [
        { x: area.x + margin, y: area.y + margin },
        { x: area.x + area.width - bounds.width - margin, y: area.y + margin },
        { x: area.x + margin, y: area.y + area.height - bounds.height - margin },
        {
          x: area.x + area.width - bounds.width - margin,
          y: area.y + area.height - bounds.height - margin,
        },
      ];
      const nearest = corners.reduce((best, candidate) =>
        distance(bounds, candidate) < distance(bounds, best) ? candidate : best,
      );
      if (distance(bounds, nearest) <= SNAP_DISTANCE) {
        corner = { x: Math.round(nearest.x), y: Math.round(nearest.y) };
      }
    }

    if (corner) {
      // The pet glides into the corner rather than teleporting.
      this.glideTo(corner.x, corner.y, SNAP_DURATION_MS);
    } else {
      this.store.setPlacement(bounds.x, bounds.y);
      this.store.flush();
    }

    this.brain.endDrag(Date.now());
    win.setIgnoreMouseEvents(true, { forward: true });
    this.broadcast();
  }

  private stopDragTimers(): void {
    if (this.dragTimer) clearInterval(this.dragTimer);
    if (this.dragWatchdog) clearTimeout(this.dragWatchdog);
    this.dragTimer = null;
    this.dragWatchdog = null;
  }

  private stopDrag(): void {
    this.stopDragTimers();
    this.dragOffset = null;
  }

  private showContextMenu(): void {
    if (!this.petWindow) return;
    const focus = this.focus.state();
    const template: MenuItemConstructorOptions[] = [
      { label: `Mochi — ${this.trayStatus()}`, enabled: false },
      { type: 'separator' },
      {
        label: focus.status === 'running' ? 'Pause focus' : focus.status === 'paused' ? 'Resume focus' : 'Start focus',
        click: () => {
          if (focus.status === 'running') this.handleFocus('pause');
          else if (focus.status === 'paused') this.handleFocus('resume');
          else this.handleFocus('start');
        },
      },
      {
        label: 'Stop focus',
        enabled: focus.status !== 'idle',
        click: () => this.handleFocus('stop'),
      },
      { type: 'separator' },
      {
        label: 'Make Mochi walk',
        enabled: focus.status === 'idle',
        click: () => this.walkNow(),
      },
      { label: 'Bring Mochi here', click: () => this.bringHere() },
      {
        label: this.brain.snapshot().behavior === 'sleep' ? 'Wake Mochi' : 'Nap',
        click: () => {
          if (this.brain.snapshot().behavior === 'sleep') this.brain.forceWake(Date.now());
          else this.brain.forceSleep(Date.now());
          this.broadcast();
        },
      },
      { type: 'separator' },
      { label: 'Open Den', click: () => this.openDen() },
      { label: 'Hide Mochi', click: () => this.hidePet() },
      { label: 'Quit Mochi', click: () => app.quit() },
    ];
    Menu.buildFromTemplate(template).popup({ window: this.petWindow });
  }

  private walkNow(): void {
    this.stopMotion();
    const walk = this.brain.forceWalk(Date.now());
    this.startWalk(walk);
    this.broadcast();
  }

  private trayStatus(): string {
    const focus = this.focus.state();
    const pet = this.brain.snapshot();
    if (focus.status === 'running' || focus.status === 'paused') {
      const seconds = Math.ceil(focus.remainingMs / 1000);
      const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
      const ss = String(seconds % 60).padStart(2, '0');
      const label = focus.status === 'paused' ? 'paused' : focus.phase === 'work' ? 'focus' : 'break';
      return `${label} ${mm}:${ss}`;
    }
    if (pet.behavior === 'sleep') return 'sleeping';
    return 'idle';
  }

  private createTray(): void {
    const iconPath = app.isPackaged
      ? join(process.resourcesPath, 'icon.png')
      : join(app.getAppPath(), 'resources', 'icon.png');

    const image = existsSync(iconPath)
      ? nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })
      : nativeImage.createEmpty();

    this.tray = new Tray(image);
    this.tray.setToolTip('Mochi');
    this.tray.on('click', () => this.togglePet());
    this.updateTray();
  }

  private updateTray(): void {
    if (!this.tray) return;
    const snapshot = this.snapshot();
    const key = [
      snapshot.pet.behavior,
      snapshot.focus.status,
      Math.ceil(snapshot.focus.remainingMs / 1000),
      snapshot.settings.petName,
      this.petWindow?.isVisible() ?? false,
    ].join(':');
    if (key === this.lastTrayKey) return;
    this.lastTrayKey = key;

    const focus = snapshot.focus;
    const status = `${snapshot.settings.petName} — ${this.trayStatus()}`;
    this.tray.setToolTip(status);

    const template: MenuItemConstructorOptions[] = [
      { label: status, enabled: false },
      { type: 'separator' },
      {
        label:
          focus.status === 'running'
            ? 'Pause focus'
            : focus.status === 'paused'
              ? 'Resume focus'
              : 'Start focus',
        click: () => {
          if (focus.status === 'running') this.handleFocus('pause');
          else if (focus.status === 'paused') this.handleFocus('resume');
          else this.handleFocus('start');
        },
      },
      {
        label: 'Stop focus',
        enabled: focus.status !== 'idle',
        click: () => this.handleFocus('stop'),
      },
      { type: 'separator' },
      {
        label: 'Make Mochi walk',
        enabled: focus.status === 'idle',
        click: () => this.walkNow(),
      },
      { label: 'Bring Mochi here', click: () => this.bringHere() },
      {
        label: snapshot.pet.behavior === 'sleep' ? 'Wake Mochi' : 'Nap',
        click: () => {
          if (snapshot.pet.behavior === 'sleep') this.brain.forceWake(Date.now());
          else this.brain.forceSleep(Date.now());
          this.broadcast();
        },
      },
      { type: 'separator' },
      { label: 'Open Den', click: () => this.openDen() },
      {
        label: this.petWindow?.isVisible() ? 'Hide Mochi' : 'Show Mochi',
        click: () => this.togglePet(),
      },
      { label: 'Quit Mochi', click: () => app.quit() },
    ];

    this.tray.setContextMenu(Menu.buildFromTemplate(template));
  }

  private registerIpc(): void {
    const fromApp = (event: IpcMainInvokeEvent): boolean => {
      const id = event.sender.id;
      return Boolean(
        (this.petWindow && id === this.petWindow.webContents.id) ||
        (this.denWindow && id === this.denWindow.webContents.id),
      );
    };
    const fromPet = (event: IpcMainInvokeEvent): boolean =>
      !!this.petWindow && event.sender.id === this.petWindow.webContents.id;

    ipcMain.handle('app:bootstrap', (event) => {
      if (!fromApp(event)) return { error: 'unauthorized' };
      // Reading the state never changes it. The welcome message belongs to the
      // pet, so the Den cannot consume it by opening first.
      return this.snapshot();
    });

    ipcMain.handle('app:ackWelcome', (event): OkResult => {
      // Only the pet may claim the welcome message.
      if (!fromPet(event)) return { ok: false };
      if (!this.welcome) return { ok: true };

      this.welcome = false;
      this.store.markWelcomeSeen();
      this.store.flush();
      return { ok: true };
    });

    ipcMain.handle('window:setReducedMotion', (event, value: unknown): OkResult => {
      if (!fromPet(event) || typeof value !== 'boolean') return { ok: false };
      // The main process cannot read the system's motion preference, so the
      // pet tells it what the effective setting is.
      this.reducedMotionActive = value;
      return { ok: true };
    });

    ipcMain.handle('window:setInteractive', (event, value: unknown): OkResult => {
      if (!fromPet(event) || typeof value !== 'boolean') return { ok: false };
      // During the smoke test the real mouse would make the pet flaky, so the
      // window stays click-through and only the app itself drives it.
      if (!this.smoke) {
        this.petWindow?.setIgnoreMouseEvents(!value, { forward: true });
      }
      return { ok: true };
    });

    ipcMain.handle('pet:poke', (event): OkResult => {
      if (!fromPet(event)) return { ok: false };
      this.brain.poke(Date.now());
      this.broadcast();
      return { ok: true };
    });

    ipcMain.handle('pet:dragStart', (event, payload: unknown): OkResult => {
      if (!fromPet(event)) return { ok: false };
      if (!isPoint(payload)) return { ok: false, error: 'invalid cursor' };
      this.startDrag();
      return { ok: true };
    });

    ipcMain.handle('pet:dragEnd', (event, payload: unknown): OkResult => {
      if (!fromPet(event)) return { ok: false };
      if (!isPoint(payload)) return { ok: false, error: 'invalid cursor' };
      this.endDrag(false);
      return { ok: true };
    });

    ipcMain.handle('pet:contextMenu', (event, payload: unknown): OkResult => {
      if (!fromPet(event)) return { ok: false };
      if (!isPoint(payload)) return { ok: false, error: 'invalid cursor' };
      this.showContextMenu();
      return { ok: true };
    });

    ipcMain.handle('window:openDen', (event): OkResult => {
      if (!fromApp(event)) return { ok: false };
      this.openDen();
      return { ok: true };
    });

    ipcMain.handle('app:openDataFolder', async (event): Promise<OkResult> => {
      if (!fromApp(event)) return { ok: false };
      const folder = this.store.dataFolder;
      try {
        const error = await shell.openPath(folder);
        if (error) {
          // Opening the folder failed, so show the state file itself instead.
          shell.showItemInFolder(join(folder, 'state.json'));
        }
        return { ok: true };
      } catch {
        return { ok: false, error: 'could not open the data folder' };
      }
    });

    ipcMain.handle('window:setPetVisible', (event, value: unknown): OkResult => {
      if (!fromApp(event) || typeof value !== 'boolean') return { ok: false };
      if (value) this.showPet();
      else this.hidePet();
      return { ok: true };
    });

    ipcMain.handle('pet:equip', (event, id: unknown): OkResult => {
      if (!fromApp(event)) return { ok: false };
      this.equipTrace.push(
        `${String(id)}@${event.sender.id === this.petWindow?.webContents.id ? 'pet' : event.sender.id === this.denWindow?.webContents.id ? 'den' : 'other'}`,
      );
      const result = this.brain.equip(id);
      this.persistNow();
      this.broadcast();
      return { ok: result.applied };
    });

    ipcMain.handle('focus:start', (event): OkResult => {
      if (!fromApp(event)) return { ok: false };
      return this.handleFocus('start');
    });
    ipcMain.handle('focus:pause', (event): OkResult => {
      if (!fromApp(event)) return { ok: false };
      return this.handleFocus('pause');
    });
    ipcMain.handle('focus:resume', (event): OkResult => {
      if (!fromApp(event)) return { ok: false };
      return this.handleFocus('resume');
    });
    ipcMain.handle('focus:updateConfig', (event, payload: unknown): FocusConfigResult => {
      if (!fromApp(event)) {
        return { ok: false, config: this.focus.getConfig(), issues: [] };
      }
      if (typeof payload !== 'object' || payload === null) {
        return { ok: false, config: this.focus.getConfig(), issues: [] };
      }

      const patch = payload as Partial<FocusConfig>;
      const issues = focusConfigIssues(patch);
      if (issues.length > 0) {
        // Nothing is saved when something is out of range, and the Den shows
        // the message next to the field that caused it.
        return { ok: false, config: this.focus.getConfig(), issues };
      }

      this.focus.setConfig(patch);
      this.persistNow();
      this.broadcast();
      return { ok: true, config: this.focus.getConfig(), issues: [] };
    });

    ipcMain.handle('focus:skip', (event): OkResult => {
      if (!fromApp(event)) return { ok: false };
      return this.handleFocus('skip');
    });
    ipcMain.handle('focus:stop', (event): OkResult => {
      if (!fromApp(event)) return { ok: false };
      return this.handleFocus('stop');
    });

    ipcMain.handle('settings:update', (event, payload: unknown) => {
      if (!fromApp(event)) return { ok: false, settings: this.store.state.settings };
      if (typeof payload !== 'object' || payload === null) {
        return { ok: false, settings: this.store.state.settings };
      }
      const patch = payload as Record<string, unknown>;
      const next: Settings = { ...this.store.state.settings };
      for (const key of SETTINGS_KEYS) {
        if (!(key in patch)) continue;
        const value = patch[key];
        if (key === 'petName' && typeof value === 'string') next.petName = value.trim().slice(0, 20) || 'Mochi';
        if (key === 'roam' && typeof value === 'boolean') next.roam = value;
        if (
          key === 'reducedMotion' &&
          (value === 'on' || value === 'off' || value === 'system')
        ) {
          next.reducedMotion = value;
        }
        if (key === 'sound' && typeof value === 'boolean') next.sound = value;
        if (key === 'launchAtLogin' && typeof value === 'boolean') next.launchAtLogin = value;
        if (key === 'pauseWhenLocked' && typeof value === 'boolean') next.pauseWhenLocked = value;
        if (key === 'autoResume' && typeof value === 'boolean') next.autoResume = value;
        if (key === 'quietHoursEnabled' && typeof value === 'boolean') {
          next.quietHoursEnabled = value;
        }
        if (key === 'quietStartMin' && typeof value === 'number' && Number.isFinite(value)) {
          next.quietStartMin = Math.min(QUIET_MINUTE_MAX, Math.max(QUIET_MINUTE_MIN, value));
        }
        if (key === 'quietEndMin' && typeof value === 'number' && Number.isFinite(value)) {
          next.quietEndMin = Math.min(QUIET_MINUTE_MAX, Math.max(QUIET_MINUTE_MIN, value));
        }
        if (key === 'hideInFullscreen' && typeof value === 'boolean') {
          next.hideInFullscreen = value;
        }
        if (key === 'globalHotkeys' && typeof value === 'boolean') next.globalHotkeys = value;
      }
      this.store.setSettings(next);
      this.store.flush();
      this.applyLoginItem();
      this.applyHotkeys();
      this.broadcast();
      return { ok: true, settings: { ...next } };
    });

    ipcMain.handle('insights:get', (event): InsightsView => {
      if (!fromApp(event)) return computeInsights({
        aggregates: EMPTY_AGGREGATES,
        sessions: [],
        today: localDateKey(Date.now()),
      });
      return this.insightsView();
    });

    // The export shows the payload in the Den before anything is written, so
    // "your data" is never a mystery. Nothing here is secret: it is the same
    // JSON the save file holds.
    ipcMain.handle('data:exportPayload', (event): string => {
      if (!fromApp(event)) return '';
      return this.exportPayload();
    });

    ipcMain.handle(
      'data:exportSave',
      async (event): Promise<OkResult & { path?: string }> => {
        if (!fromApp(event)) return { ok: false };
        try {
          const result = await dialog.showSaveDialog({
            title: 'Export Mochi data',
            defaultPath: `mochi-export-${localDateKey(Date.now())}.json`,
            filters: [{ name: 'JSON', extensions: ['json'] }],
          });
          if (result.canceled || !result.filePath) return { ok: false };
          writeFileSync(result.filePath, this.exportPayload(), 'utf8');
          return { ok: true, path: result.filePath };
        } catch (error) {
          return { ok: false, error: String(error) };
        }
      },
    );

    // The Den is the only door, and it asks for confirmation on its own
    // screen before this is reachable.
    ipcMain.handle('data:reset', (event): OkResult => {
      if (!fromApp(event)) return { ok: false };
      this.resetAll();
      return { ok: true };
    });

    ipcMain.handle('window:bringHere', (event): OkResult => {
      if (!fromApp(event)) return { ok: false };
      this.bringHere();
      return { ok: true };
    });

  }

  private applyLoginItem(): void {
    if (!app.isPackaged) return;
    try {
      app.setLoginItemSettings({
        openAtLogin: this.store.state.settings.launchAtLogin,
        args: ['--autostart'],
      });
    } catch {
      // Autostart is best effort; the setting remains visible in the Den.
    }
  }

  /** The quiet-hours window the user configured, read from the settings. */
  private quietConfig(): QuietHoursConfig {
    const settings = this.store.state.settings;
    return {
      enabled: settings.quietHoursEnabled,
      startMin: settings.quietStartMin,
      endMin: settings.quietEndMin,
    };
  }

  /**
   * Global hotkeys: toggle the pet, start or pause focus, open the Den.
   *
   * Registration failure is never fatal. The accelerator another program has
   * taken is reported to the Den, and the action stays reachable from the tray.
   */
  private applyHotkeys(): void {
    globalShortcut.unregisterAll();
    this.hotkeyConflicts = [];

    if (!this.store.state.settings.globalHotkeys) return;

    const bindings: Array<[string, () => void]> = [
      [HOTKEY_DEFAULTS.pet, () => this.togglePet()],
      [HOTKEY_DEFAULTS.focus, () => this.hotkeyFocus()],
      [HOTKEY_DEFAULTS.den, () => this.openDen()],
    ];

    for (const [accelerator, action] of bindings) {
      try {
        if (!globalShortcut.register(accelerator, action)) {
          this.hotkeyConflicts.push(accelerator);
        }
      } catch {
        this.hotkeyConflicts.push(accelerator);
      }
    }
  }

  private hotkeyFocus(): void {
    const status = this.focus.state().status;
    if (status === 'running') this.handleFocus('pause');
    else this.handleFocus('start');
  }

  /**
   * One toast per phase completion.
   *
   * Quiet hours suppress the toast but keep the pet's celebration, which is
   * the subtle in-pet cue the requirement asks for. Clicking the toast opens
   * the Den, which is the only thing a toast is ever allowed to sell.
   */
  private notifyCompletion(text: string): void {
    if (this.smoke) return;
    if (isQuietHour(Date.now(), this.quietConfig())) return;
    try {
      const toast = new Notification({ title: 'Mochi', body: text, silent: true });
      toast.on('click', () => this.openDen());
      toast.show();
    } catch {
      // Toasts are best effort; the celebration in the pet window still happens.
    }
  }

  /**
   * The chime the pet renderer plays, if the user has sound on.
   *
   * The visual celebration is not muted; only the sound is.
   */
  private playChime(): void {
    const settings = this.store.state.settings;
    if (!settings.sound) return;
    if (isQuietHour(Date.now(), this.quietConfig())) return;
    try {
      this.petWindow?.webContents.send('pet:sound', { kind: 'chime' });
    } catch {
      // A window that just went away cannot hear a chime; nothing is lost.
    }
  }

  /**
   * Best effort: on Windows an exclusive-fullscreen app hides the taskbar, so
   * a display whose work area equals its full size is probably showing one.
   * The setting's description is honest about the limitation.
   */
  private checkFullscreen(): void {
    if (!this.store.state.settings.hideInFullscreen || this.isQuitting) {
      if (this.hiddenByFullscreen) {
        this.hiddenByFullscreen = false;
        this.showPet();
      }
      return;
    }

    const exclusive = screen
      .getAllDisplays()
      .some(
        (display) =>
          display.workArea.width === display.size.width &&
          display.workArea.height === display.size.height,
      );

    if (exclusive && !this.hiddenByFullscreen && this.petWindow?.isVisible()) {
      this.hiddenByFullscreen = true;
      this.petWindow.hide();
    } else if (!exclusive && this.hiddenByFullscreen) {
      this.hiddenByFullscreen = false;
      this.showPet();
    }
  }

  /** Move Mochi to the screen the cursor is on, at its bottom edge. */
  bringHere(): void {
    const win = this.petWindow;
    if (!win) return;

    const cursor = screen.getCursorScreenPoint();
    const area = screen.getDisplayNearestPoint(cursor).workArea;
    const bounds = win.getBounds();

    const minX = area.x + WINDOW_EDGE_MARGIN;
    const maxX = area.x + area.width - WINDOW_EDGE_MARGIN - bounds.width;
    const x = Math.min(Math.max(Math.round(cursor.x - bounds.width / 2), minX), Math.max(minX, maxX));
    const y = area.y + area.height - WINDOW_EDGE_MARGIN - bounds.height;

    win.setPosition(x, y);
    this.store.setPlacement(x, y);
    this.showPet();
  }

  /** The exact bytes an export writes. No paths, no secrets. */
  private exportPayload(): string {
    const { pet, focus, settings, hasSeenWelcome } = this.store.state;
    return JSON.stringify(
      {
        kind: 'mochi-data-export',
        version: CURRENT_SCHEMA_VERSION,
        exportedAt: new Date().toISOString(),
        pet,
        focus,
        settings,
        hasSeenWelcome,
      },
      null,
      2,
    );
  }

  /** Start over: the pet, the timer and the settings all forget everything. */
  private resetAll(): void {
    const fresh = defaultPersistedState(localDateKey(Date.now()));
    this.store.state = fresh;
    this.store.flush();

    this.brain = new PetBrain({ now: Date.now() });
    this.focus = new FocusTimer(FOCUS_DEFAULTS, systemFocusClock);
    this.welcome = true;
    this.idlePauseOffered = false;
    this.lastUnsolicitedBubbleAt = 0;
    this.unsolicitedThisHour = 0;
    this.bubbleHourKey = 0;

    this.applyLoginItem();
    this.applyHotkeys();
    this.broadcast();
  }

  /** What the pet window currently does with an art group. */
  private async cosmeticDisplay(selector: string): Promise<string> {
    const win = this.petWindow;
    if (!win || win.isDestroyed()) return 'no-window';
    try {
      return await win.webContents.executeJavaScript(
        `(() => { const el = document.querySelector(${JSON.stringify(selector)}); return el ? getComputedStyle(el).display : 'missing'; })()`,
      );
    } catch (error) {
      return `eval-failed:${String(error)}`;
    }
  }

  private insightsView(): InsightsView {
    const persisted: FocusPersisted = this.focus.serialize();
    return computeInsights({
      aggregates: persisted.aggregates,
      sessions: persisted.sessions,
      today: localDateKey(Date.now()),
    });
  }

  private persist(): void {
    this.store.setPet(this.brain.snapshot(), this.brain.lastSeen ?? Date.now());
    this.store.setFocus(this.focus.serialize());
    this.store.save();
  }

  /** Write the state to disk right now, for moments where a lost change shows. */
  private persistNow(): void {
    this.store.setPet(this.brain.snapshot(), this.brain.lastSeen ?? Date.now());
    this.store.setFocus(this.focus.serialize());
    this.store.flush();
  }
}
