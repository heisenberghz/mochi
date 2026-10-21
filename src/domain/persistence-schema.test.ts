import { describe, expect, it } from 'vitest';
import { CURRENT_SCHEMA_VERSION, FOCUS_DEFAULTS } from '../shared/constants';
import v1Fixture from './fixtures/state-v1.json';
import {
  migrateState,
  SchemaError,
  UnsupportedVersionError,
  defaultPersistedState,
} from './persistence-schema';

const TODAY = '2026-03-10';

describe('migrateState', () => {
  it('upgrades a version 1 file', () => {
    const outcome = migrateState(v1Fixture, TODAY);

    expect(outcome.applied).toEqual([2]);
    expect(outcome.state.version).toBe(CURRENT_SCHEMA_VERSION);
  });

  it('keeps everything a version 1 file had', () => {
    const { state } = migrateState(v1Fixture, TODAY);

    expect(state.pet).toEqual(v1Fixture.pet);
    expect(state.placement).toEqual(v1Fixture.placement);
    expect(state.hasSeenWelcome).toBe(true);

    // Every setting the old file had is kept as it was.
    expect(state.settings.petName).toBe(v1Fixture.settings.petName);
    expect(state.settings.roam).toBe(v1Fixture.settings.roam);
    expect(state.settings.reducedMotion).toBe(v1Fixture.settings.reducedMotion);
    expect(state.settings.sound).toBe(v1Fixture.settings.sound);
    expect(state.settings.launchAtLogin).toBe(v1Fixture.settings.launchAtLogin);

    // Settings the old file never had arrive with their defaults.
    expect(state.settings.pauseWhenLocked).toBe(true);
    expect(state.settings.autoResume).toBe(false);
  });

  it('gives a version 1 file a focus section', () => {
    const { state } = migrateState(v1Fixture, TODAY);

    expect(state.focus.config).toEqual(FOCUS_DEFAULTS);
    expect(state.focus.aggregates.dayKey).toBe(TODAY);
    expect(state.focus.aggregates.completedToday).toBe(0);
    expect(state.focus.aggregates.focusedMsToday).toBe(0);
    expect(state.focus.aggregates.focusedByDay).toEqual({});
    expect(state.focus.aggregates.streakDays).toBe(0);
    expect(state.focus.aggregates.lastCompletedDay).toBeNull();
    expect(state.focus.sessions).toEqual([]);
    expect(state.focus.active).toBeNull();
  });

  it('changes nothing when it is run again', () => {
    const first = migrateState(v1Fixture, TODAY);
    const second = migrateState(first.state, TODAY);

    expect(second.applied).toEqual([]);
    expect(second.state).toEqual(first.state);
  });

  it('is the same every time it is run', () => {
    const first = migrateState(v1Fixture, TODAY);
    const second = migrateState(v1Fixture, TODAY);

    expect(second.state).toEqual(first.state);
  });

  it('drops fields it does not know about', () => {
    const { state } = migrateState(
      { ...v1Fixture, somethingFromTheFuture: { nested: true } },
      TODAY,
    );

    expect('somethingFromTheFuture' in state).toBe(false);
  });

  it('refuses a file from a newer build', () => {
    expect(() => migrateState({ version: 99 }, TODAY)).toThrow(UnsupportedVersionError);
  });

  it('refuses a file with no version', () => {
    expect(() => migrateState({ pet: {} }, TODAY)).toThrow(SchemaError);
  });

  it('refuses a file that is not an object', () => {
    expect(() => migrateState('hello', TODAY)).toThrow(SchemaError);
    expect(() => migrateState([1, 2, 3], TODAY)).toThrow(SchemaError);
    expect(() => migrateState(null, TODAY)).toThrow(SchemaError);
  });

  it('clamps a pet that has impossible numbers', () => {
    const { state } = migrateState(
      { version: 1, pet: { energy: 500, mood: -20, xp: -5, level: 99, facing: 7 } },
      TODAY,
    );

    expect(state.pet.energy).toBe(100);
    expect(state.pet.mood).toBe(20);
    expect(state.pet.xp).toBe(0);
    expect(state.pet.level).toBe(20);
    expect(state.pet.facing).toBe(1);
  });

  it('clamps a focus configuration to the limits', () => {
    const { state } = migrateState(
      { version: 1, focus: { config: { workMin: 900, shortBreakMin: 0, rounds: 100 } } },
      TODAY,
    );

    expect(state.focus.config.workMin).toBe(120);
    expect(state.focus.config.shortBreakMin).toBe(1);
    expect(state.focus.config.rounds).toBe(8);
  });

  it('keeps a valid focus configuration', () => {
    const { state } = migrateState(
      {
        version: 1,
        focus: {
          config: {
            workMin: 50,
            shortBreakMin: 10,
            longBreakMin: 20,
            rounds: 3,
            autoStartBreak: false,
            autoStartWork: true,
          },
        },
      },
      TODAY,
    );

    expect(state.focus.config.workMin).toBe(50);
    expect(state.focus.config.rounds).toBe(3);
    expect(state.focus.config.autoStartBreak).toBe(false);
    expect(state.focus.config.autoStartWork).toBe(true);
  });

  it('keeps the daily totals', () => {
    const { state } = migrateState(
      {
        version: 1,
        focus: {
          aggregates: {
            dayKey: '2026-03-09',
            completedToday: 3,
            focusedMsToday: 45 * 60_000,
            focusedByDay: { '2026-03-09': 45 * 60_000 },
            streakDays: 4,
            lastCompletedDay: '2026-03-09',
          },
        },
      },
      TODAY,
    );

    expect(state.focus.aggregates.completedToday).toBe(3);
    expect(state.focus.aggregates.focusedMsToday).toBe(45 * 60_000);
    expect(state.focus.aggregates.focusedByDay['2026-03-09']).toBe(45 * 60_000);
    expect(state.focus.aggregates.streakDays).toBe(4);
    expect(state.focus.aggregates.lastCompletedDay).toBe('2026-03-09');
  });

  it('throws away day totals that make no sense', () => {
    const { state } = migrateState(
      {
        version: 1,
        focus: {
          aggregates: {
            focusedByDay: { good: 1000, bad: 'lots', negative: -5, zero: 0 },
          },
        },
      },
      TODAY,
    );

    expect(state.focus.aggregates.focusedByDay).toEqual({ good: 1000 });
  });

  it('keeps a session history but caps it', () => {
    const sessions = Array.from({ length: 60 }, (_, index) => ({
      dayKey: '2026-03-10',
      phase: 'work',
      focusedMs: index,
      completed: true,
    }));

    const { state } = migrateState({ version: 1, focus: { sessions } }, TODAY);

    expect(state.focus.sessions).toHaveLength(30);
    expect(state.focus.sessions[29]?.focusedMs).toBe(59);
  });

  it('always brings an active session back paused', () => {
    const { state } = migrateState(
      {
        version: 1,
        focus: {
          active: {
            status: 'running',
            phase: 'shortBreak',
            round: 2,
            remainingMs: 120_000,
            startedAtMs: 1234,
            pauseReason: 'idle',
          },
        },
      },
      TODAY,
    );

    expect(state.focus.active?.status).toBe('paused');
    expect(state.focus.active?.phase).toBe('shortBreak');
    expect(state.focus.active?.remainingMs).toBe(120_000);
    expect(state.focus.active?.pauseReason).toBe('idle');
  });

  it('discards an active session that is nonsense', () => {
    const { state } = migrateState(
      { version: 1, focus: { active: { status: 'wat', remainingMs: 'lots' } } },
      TODAY,
    );

    expect(state.focus.active?.status).toBe('paused');
    expect(state.focus.active?.remainingMs).toBe(1000);
    expect(state.focus.active?.pauseReason).toBe('recovered');
  });
});

describe('defaultPersistedState', () => {
  it('starts a fresh install with nothing in it', () => {
    const state = defaultPersistedState(TODAY);

    expect(state.version).toBe(CURRENT_SCHEMA_VERSION);
    expect(state.pet.xp).toBe(0);
    expect(state.placement).toBeNull();
    expect(state.hasSeenWelcome).toBe(false);
    expect(state.focus.aggregates.dayKey).toBe(TODAY);
    expect(state.focus.active).toBeNull();
  });
});
