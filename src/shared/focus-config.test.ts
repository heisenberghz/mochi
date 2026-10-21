import { describe, expect, it } from 'vitest';
import { clampFocusConfig, focusConfigIssues } from './focus-config';
import { FOCUS_DEFAULTS } from './constants';
import type { FocusConfig } from './types';

const base: FocusConfig = { ...FOCUS_DEFAULTS };

describe('focusConfigIssues', () => {
  it('accepts the defaults', () => {
    expect(focusConfigIssues(base)).toEqual([]);
  });

  it('accepts the ends of every range', () => {
    expect(
      focusConfigIssues({
        workMin: 5,
        shortBreakMin: 1,
        longBreakMin: 5,
        rounds: 2,
      }),
    ).toEqual([]);
    expect(
      focusConfigIssues({
        workMin: 120,
        shortBreakMin: 30,
        longBreakMin: 60,
        rounds: 8,
      }),
    ).toEqual([]);
  });

  it('refuses a focus length that is too short or too long', () => {
    const issues = focusConfigIssues({ workMin: 500 });

    expect(issues).toHaveLength(1);
    expect(issues[0]?.field).toBe('workMin');
    expect(issues[0]?.message).toMatch(/5 and 120/);
  });

  it('refuses a value that is not a whole number', () => {
    const issues = focusConfigIssues({ rounds: 2.5 });

    expect(issues).toHaveLength(1);
    expect(issues[0]?.field).toBe('rounds');
    expect(issues[0]?.message).toMatch(/whole number/i);
  });

  it('refuses a value that is not a number at all', () => {
    const issues = focusConfigIssues({ workMin: 'twenty' as never });

    expect(issues).toHaveLength(1);
    expect(issues[0]?.field).toBe('workMin');
  });

  it('reports every problem at once', () => {
    const issues = focusConfigIssues({ workMin: 1, shortBreakMin: 99, rounds: 0 });

    expect(issues.map((issue) => issue.field).sort()).toEqual([
      'rounds',
      'shortBreakMin',
      'workMin',
    ]);
  });

  it('says nothing about a field that was not part of the change', () => {
    expect(focusConfigIssues({ workMin: 25 })).toEqual([]);
  });

  it('ignores fields it does not know', () => {
    expect(focusConfigIssues({ nonsense: 5 } as never)).toEqual([]);
  });
});

describe('clampFocusConfig', () => {
  it('leaves a valid configuration alone', () => {
    expect(clampFocusConfig(base)).toEqual(base);
  });

  it('pulls a value back into range', () => {
    const clamped = clampFocusConfig({
      ...base,
      workMin: 900,
      shortBreakMin: 0,
      longBreakMin: 1,
      rounds: 100,
    });

    expect(clamped.workMin).toBe(120);
    expect(clamped.shortBreakMin).toBe(1);
    expect(clamped.longBreakMin).toBe(5);
    expect(clamped.rounds).toBe(8);
  });

  it('keeps the toggles as they are', () => {
    const clamped = clampFocusConfig({
      ...base,
      autoStartBreak: false,
      autoStartWork: true,
    });

    expect(clamped.autoStartBreak).toBe(false);
    expect(clamped.autoStartWork).toBe(true);
  });
});
