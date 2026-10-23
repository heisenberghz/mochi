import { FOCUS_DEFAULTS } from '../../shared/constants';
import type { AppSnapshot } from '../../shared/types';

export function mockSnapshot(): AppSnapshot {
  return {
    pet: {
      behavior: 'idle',
      mode: 'awake',
      energy: 80,
      mood: 70,
      xp: 0,
      level: 1,
      facing: 1,
      animationPaused: false,
    },
    focus: {
      status: 'idle',
      phase: 'work',
      remainingMs: FOCUS_DEFAULTS.workMin * 60_000,
      phaseDurationMs: FOCUS_DEFAULTS.workMin * 60_000,
      round: 1,
      totalRounds: FOCUS_DEFAULTS.rounds,
      completedToday: 0,
      focusedMsToday: 0,
      streakDays: 0,
      pauseReason: null,
      startedAtMs: null,
      config: { ...FOCUS_DEFAULTS },
    },
    settings: {
      petName: 'Mochi',
      roam: true,
      reducedMotion: 'system',
      sound: true,
      launchAtLogin: false,
      pauseWhenLocked: true,
      autoResume: false,
      quietHoursEnabled: true,
      quietStartMin: 22 * 60,
      quietEndMin: 7 * 60,
      hideInFullscreen: true,
      globalHotkeys: true,
    },
    welcome: true,
    recovery: null,
    hotkeyConflicts: [],
  };
}

export function formatTime(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
