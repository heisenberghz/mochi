import { FOCUS_LIMITS } from './constants';
import type { FocusConfig } from './types';

export interface FocusConfigIssue {
  field: keyof FocusConfig;
  message: string;
}

const RANGE_FIELDS = {
  workMin: FOCUS_LIMITS.workMin,
  shortBreakMin: FOCUS_LIMITS.shortBreakMin,
  longBreakMin: FOCUS_LIMITS.longBreakMin,
  rounds: FOCUS_LIMITS.rounds,
} as const;

/**
 * Check a proposed focus configuration and say what is wrong with it.
 *
 * The Den shows these messages next to the field, so a value that is out of
 * range is refused rather than quietly clamped.
 */
export function focusConfigIssues(candidate: Partial<FocusConfig>): FocusConfigIssue[] {
  const issues: FocusConfigIssue[] = [];

  for (const [field, range] of Object.entries(RANGE_FIELDS) as [
    keyof typeof RANGE_FIELDS,
    { min: number; max: number },
  ][]) {
    const value = candidate[field];
    if (value === undefined) continue;

    if (typeof value !== 'number' || !Number.isFinite(value)) {
      issues.push({ field, message: 'Enter a number.' });
      continue;
    }
    if (!Number.isInteger(value)) {
      issues.push({ field, message: 'Use a whole number.' });
      continue;
    }
    if (value < range.min || value > range.max) {
      issues.push({ field, message: `Choose between ${range.min} and ${range.max}.` });
    }
  }

  return issues;
}

/**
 * Force every value into range. Used when reading state off disk or applying a
 * change that has already been validated, so nothing can produce a phase of
 * zero minutes.
 */
export function clampFocusConfig(config: FocusConfig): FocusConfig {
  const clamp = (value: number, range: { min: number; max: number }): number =>
    Math.min(range.max, Math.max(range.min, Math.round(value)));

  return {
    workMin: clamp(config.workMin, FOCUS_LIMITS.workMin),
    shortBreakMin: clamp(config.shortBreakMin, FOCUS_LIMITS.shortBreakMin),
    longBreakMin: clamp(config.longBreakMin, FOCUS_LIMITS.longBreakMin),
    rounds: clamp(config.rounds, FOCUS_LIMITS.rounds),
    autoStartBreak: config.autoStartBreak,
    autoStartWork: config.autoStartWork,
  };
}
