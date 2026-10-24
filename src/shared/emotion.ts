/**
 * How the pet's face follows what is going on inside it.
 *
 * The pet cannot cry or grin — everything is a transform on the art that is
 * already there: heavy eyelids when it is tired, a wider glide to the mouth
 * when it is pleased. The thresholds live here, with the numbers, so the
 * renderer only decides where to put the attribute and never what it means.
 */

/** The pet is rested, neither sleepy nor sparkling. */
export type Emotion = 'content' | 'droopy' | 'bright';

export interface EmotionInput {
  energy: number;
  mood: number;
}

/** At or below this energy the eyelids come down, whatever the mood is. */
export const EMOTION_DROOPY_ENERGY = 30;

/** At or above this mood the pet wears its bright face. */
export const EMOTION_BRIGHT_MOOD = 80;

/**
 * The one emotion the face shows. Tired wins over happy — the eyelids come
 * down first, at any mood; the mood only brightens a rested pet.
 */
export function emotionFor({ energy, mood }: EmotionInput): Emotion {
  if (energy <= EMOTION_DROOPY_ENERGY) return 'droopy';
  if (mood >= EMOTION_BRIGHT_MOOD) return 'bright';
  return 'content';
}
