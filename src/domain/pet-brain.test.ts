import { describe, expect, it } from 'vitest';
import { PetBrain, levelForXp } from './pet-brain';

const context = {
  idleSeconds: 0,
  focusActive: false,
  quietHours: false,
  canRoam: true,
};

describe('PetBrain', () => {
  it('starts idle and awake with healthy energy', () => {
    const brain = new PetBrain({ now: 1_000_000, rng: () => 0 });
    const state = brain.snapshot();
    expect(state.behavior).toBe('idle');
    expect(state.mode).toBe('awake');
    expect(state.energy).toBe(80);
    expect(state.mood).toBe(70);
  });

  it('starts a walk when the roam timer is due', () => {
    const now = 1_000_000;
    const brain = new PetBrain({ now, rng: () => 0 });
    const result = brain.tick(now + 90_000, context);

    expect(result.walkStart).toEqual({ durationMs: 2600, facing: -1 });
    expect(result.state.behavior).toBe('walk');
  });

  it('returns to idle and schedules the next walk after a walk ends', () => {
    const now = 1_000_000;
    const brain = new PetBrain({ now, rng: () => 0 });
    const walk = brain.tick(now + 90_000, context);
    expect(walk.walkStart).toBeDefined();

    const after = brain.tick(now + 90_000 + 3000, context);
    expect(after.state.behavior).toBe('idle');
  });

  it('sleeps after ten minutes of idle and wakes when the user returns', () => {
    const now = 1_000_000;
    const brain = new PetBrain({ now, rng: () => 0 });

    const asleep = brain.tick(now + 1_000, { ...context, idleSeconds: 600 });
    expect(asleep.state.behavior).toBe('sleep');
    expect(asleep.state.mode).toBe('sleep');

    const awake = brain.tick(now + 3000, { ...context, idleSeconds: 0 });
    expect(awake.state.behavior).toBe('wake');
  });

  it('sleeps during quiet hours after five idle minutes', () => {
    const now = 1_000_000;
    const brain = new PetBrain({ now, rng: () => 0 });
    const result = brain.tick(now + 1_000, {
      ...context,
      idleSeconds: 300,
      quietHours: true,
    });
    expect(result.state.behavior).toBe('sleep');
  });

  it('forces sleep when energy is low, and a poke wakes the pet', () => {
    const now = 1_000_000;
    const brain = new PetBrain({ now, rng: () => 0 });
    brain.restore({ energy: 10 });

    const asleep = brain.tick(now + 1000, context);
    expect(asleep.state.behavior).toBe('sleep');

    const poked = brain.poke(now + 2000);
    expect(poked.woke).toBe(true);
    expect(poked.state.behavior).toBe('wake');
  });

  it('caps mood gain from pokes at eight per day', () => {
    const now = 1_000_000;
    const brain = new PetBrain({ now, rng: () => 0 });

    let gained = 0;
    for (let i = 0; i < 12; i += 1) {
      gained += brain.poke(now + i).moodGain;
    }

    expect(gained).toBe(8);
    expect(brain.snapshot().mood).toBe(78);
  });

  it('enters and leaves focus mode', () => {
    const now = 1_000_000;
    const brain = new PetBrain({ now, rng: () => 0 });

    const focused = brain.tick(now + 1000, { ...context, focusActive: true });
    expect(focused.state.behavior).toBe('focus');
    expect(focused.state.mode).toBe('focus');

    const after = brain.tick(now + 2000, { ...context, focusActive: false });
    expect(after.state.behavior).toBe('idle');
    expect(after.state.mode).toBe('awake');
  });

  it('leaves focus immediately when the session stops', () => {
    const now = 1_000_000;
    const brain = new PetBrain({ now, rng: () => 0 });
    brain.tick(now + 500, { ...context, focusActive: true });
    expect(brain.snapshot().behavior).toBe('focus');

    brain.endFocus(now + 1000);
    expect(brain.snapshot().behavior).toBe('idle');
    expect(brain.snapshot().mode).toBe('awake');
  });

  it('handles drag start and end', () => {
    const now = 1_000_000;
    const brain = new PetBrain({ now, rng: () => 0 });
    brain.startDrag();

    expect(brain.tick(now + 1000, context).state.behavior).toBe('drag');

    brain.endDrag(now + 2000);
    expect(brain.tick(now + 2500, context).state.behavior).toBe('idle');
  });

  it('adds XP and derives levels from the documented thresholds', () => {
    const brain = new PetBrain({ now: 1_000_000, rng: () => 0 });
    brain.addXp(70);
    expect(brain.snapshot().level).toBe(2);

    // Thresholds are 10 x (n - 1) x (n + 5): level 3 starts at 160 XP.
    expect(levelForXp(159)).toBe(2);
    expect(levelForXp(160)).toBe(3);

    brain.addXp(90); // 160 total = level 3 threshold
    expect(brain.snapshot().level).toBe(3);
    expect(levelForXp(1350)).toBe(10);
  });
});
