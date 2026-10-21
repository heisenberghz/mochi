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
    brain.startDrag(now);

    expect(brain.tick(now + 1000, context).state.behavior).toBe('drag');

    brain.endDrag(now + 2000);
    expect(brain.tick(now + 2500, context).state.behavior).toBe('idle');
  });

  it('goes back to what it was doing after being put down', () => {
    const now = 1_000_000;
    const brain = new PetBrain({ now, rng: () => 0 });

    brain.tick(now + 500, { ...context, focusActive: true });
    expect(brain.snapshot().mode).toBe('focus');

    brain.startDrag(now + 1000);
    expect(brain.snapshot().behavior).toBe('drag');

    brain.endDrag(now + 2000);
    expect(brain.snapshot().mode).toBe('focus');
    expect(brain.snapshot().behavior).toBe('focus');
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

describe('PetBrain priority', () => {
  it('does not let a celebration interrupt a focus session', () => {
    const now = 1_000_000;
    const brain = new PetBrain({ now, rng: () => 0 });

    brain.tick(now + 500, { ...context, focusActive: true });
    expect(brain.snapshot().behavior).toBe('focus');

    brain.celebrate(now + 1000);
    expect(brain.snapshot().behavior).toBe('focus');
  });

  it('does not let a celebration interrupt being carried', () => {
    const now = 1_000_000;
    const brain = new PetBrain({ now, rng: () => 0 });

    brain.startDrag(now);
    brain.celebrate(now + 1000);

    expect(brain.snapshot().behavior).toBe('drag');
  });

  it('does not let a wave interrupt a focus session', () => {
    const now = 1_000_000;
    const brain = new PetBrain({ now, rng: () => 0 });

    brain.tick(now + 500, { ...context, focusActive: true });
    brain.wave(now + 1000);

    expect(brain.snapshot().behavior).toBe('focus');
  });

  it('does not let one celebration interrupt another', () => {
    const now = 1_000_000;
    const brain = new PetBrain({ now, rng: () => 0 });

    brain.celebrate(now + 1000);
    expect(brain.snapshot().behavior).toBe('celebrate');

    brain.celebrate(now + 2000);
    expect(brain.snapshot().behavior).toBe('celebrate');
  });

  it('waits ten seconds between celebrations', () => {
    const now = 1_000_000;
    const brain = new PetBrain({ now, rng: () => 0 });

    brain.celebrate(now + 1000);
    // The celebration finishes, then another one is refused.
    brain.tick(now + 5000, context);
    brain.celebrate(now + 5000);
    expect(brain.snapshot().behavior).toBe('idle');

    // Ten seconds later it is allowed again.
    brain.celebrate(now + 12_000);
    expect(brain.snapshot().behavior).toBe('celebrate');
  });
});

describe('PetBrain watchdog', () => {
  // The pet is kept from wandering, so the only thing that happens in these
  // tests is the watchdog.
  const still = { ...context, canRoam: false };

  it('rescues the pet when it is left being carried', () => {
    const now = 1_000_000;
    const brain = new PetBrain({ now, rng: () => 0 });

    brain.startDrag(now);
    expect(brain.snapshot().behavior).toBe('drag');

    // Nobody let go.
    brain.tick(now + 60_000, still);
    expect(brain.snapshot().behavior).toBe('idle');
    expect(brain.snapshot().mode).toBe('awake');
  });

  it('leaves a focus session alone, however long it runs', () => {
    const now = 1_000_000;
    const brain = new PetBrain({ now, rng: () => 0 });

    brain.tick(now + 500, { ...still, focusActive: true });
    brain.tick(now + 60 * 60_000, { ...still, focusActive: true });

    expect(brain.snapshot().behavior).toBe('focus');
  });

  it('stops the animation when it keeps having to rescue the pet', () => {
    const now = 1_000_000;
    const brain = new PetBrain({ now, rng: () => 0 });

    for (let attempt = 0; attempt < 3; attempt += 1) {
      brain.startDrag(now + attempt * 60_000);
      brain.tick(now + attempt * 60_000 + 60_000, still);
    }

    expect(brain.snapshot().animationPaused).toBe(true);
  });

  it('starts the animation again once the pet behaves', () => {
    const now = 1_000_000;
    const brain = new PetBrain({ now, rng: () => 0 });

    for (let attempt = 0; attempt < 3; attempt += 1) {
      brain.startDrag(now + attempt * 60_000);
      brain.tick(now + attempt * 60_000 + 60_000, still);
    }
    expect(brain.snapshot().animationPaused).toBe(true);

    // The pet settles down and does something deliberate again.
    brain.wave(now + 200_000);
    brain.tick(now + 201_000, still);

    expect(brain.snapshot().animationPaused).toBe(false);
  });
});
