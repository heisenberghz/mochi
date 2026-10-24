import { describe, expect, it } from 'vitest';
import {
  EMOTION_BRIGHT_MOOD,
  EMOTION_DROOPY_ENERGY,
  emotionFor,
} from './emotion';

describe('the emotion of the face', () => {
  it('stays content in the wide middle', () => {
    expect(emotionFor({ energy: 80, mood: 70 })).toBe('content');
    expect(emotionFor({ energy: 40, mood: 40 })).toBe('content');
  });

  it('is content just the far side of both thresholds', () => {
    expect(
      emotionFor({ energy: EMOTION_DROOPY_ENERGY + 1, mood: 70 }),
    ).toBe('content');
    expect(
      emotionFor({ energy: 80, mood: EMOTION_BRIGHT_MOOD - 1 }),
    ).toBe('content');
  });

  it('wears the bright face at the mood threshold', () => {
    expect(emotionFor({ energy: 80, mood: EMOTION_BRIGHT_MOOD })).toBe('bright');
    expect(emotionFor({ energy: 100, mood: 100 })).toBe('bright');
  });

  it('brings the eyelids down at the droopy threshold', () => {
    expect(emotionFor({ energy: EMOTION_DROOPY_ENERGY, mood: 70 })).toBe('droopy');
    expect(emotionFor({ energy: 0, mood: 20 })).toBe('droopy');
  });

  it('lets tiredness win over happiness', () => {
    expect(emotionFor({ energy: 10, mood: 100 })).toBe('droopy');
  });
});
