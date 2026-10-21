import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CLICK_MAX_DURATION,
  DRAG_THRESHOLD,
  HIT_ELLIPSE,
  HIT_HYSTERESIS,
  INTERACTIVE_EXIT_DELAY,
} from '../../../shared/constants';
import type { AppSnapshot, BubbleAction, BubbleSpec } from '../../../shared/types';
import { mockSnapshot } from '../mock';
import { PetSprite } from './PetSprite';

interface DragState {
  pointerId: number;
  startX: number;
  startY: number;
  startedAt: number;
  dragging: boolean;
}

function isInside(x: number, y: number, bubbleVisible: boolean): boolean {
  const rx = HIT_ELLIPSE.rx + HIT_HYSTERESIS;
  const ry = HIT_ELLIPSE.ry + HIT_HYSTERESIS;
  const nx = (x - HIT_ELLIPSE.cx) / rx;
  const ny = (y - HIT_ELLIPSE.cy) / ry;
  if (nx * nx + ny * ny <= 1) return true;
  if (bubbleVisible && x >= 16 && x <= 304 && y >= 4 && y <= 108) return true;
  return false;
}

function useReducedMotion(snapshot: AppSnapshot | null): boolean {
  const [systemPrefers, setSystemPrefers] = useState(false);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = (): void => setSystemPrefers(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  const setting = snapshot?.settings.reducedMotion ?? 'system';
  return setting === 'on' || (setting === 'system' && systemPrefers);
}

export function PetApp() {
  const [snapshot, setSnapshot] = useState<AppSnapshot | null>(null);
  const [bubble, setBubble] = useState<BubbleSpec | null>(null);
  const [poked, setPoked] = useState(false);
  const [interactive, setInteractive] = useState(false);

  const interactiveRef = useRef(false);
  const exitTimer = useRef<number | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const pokeTimer = useRef<number | null>(null);
  const bubbleRef = useRef<BubbleSpec | null>(null);
  const reducedMotion = useReducedMotion(snapshot);

  // The main process cannot read the system's motion preference, so it is told
  // what the effective setting is. Without this, reduced motion would only
  // quiet the CSS and the pet would still walk across the screen.
  useEffect(() => {
    const api = window.mochi;
    if (!api) return;
    void api.setReducedMotion(reducedMotion);
  }, [reducedMotion]);

  bubbleRef.current = bubble;

  const showBubble = useCallback((next: BubbleSpec) => {
    setBubble(next);
  }, []);

  useEffect(() => {
    if (!window.mochi) {
      const fallback = mockSnapshot();
      setSnapshot(fallback);
      if (fallback.welcome) {
        showBubble({
          id: 'welcome',
          text: "Hi, I'm Mochi.",
          action: { id: 'start-focus', label: 'Start a 25-minute focus' },
          durationMs: 12_000,
        });
      }
      return;
    }

    let alive = true;
    const unsubscribeState = window.mochi.onState((next) => {
      if (alive) setSnapshot(next);
    });
    const unsubscribeBubble = window.mochi.onBubble((next) => {
      if (alive) showBubble(next);
    });

    window.mochi
      .bootstrap()
      .then((initial) => {
        if (!alive) return;
        setSnapshot(initial);
        if (initial.welcome) {
          showBubble({
            id: 'welcome',
            text: "Hi, I'm Mochi.",
            action: { id: 'start-focus', label: 'Start a 25-minute focus' },
            durationMs: 12_000,
          });
          // The pet owns the welcome message, so it is the pet that claims it.
          void window.mochi.ackWelcome();
        }
      })
      .catch((error: unknown) => {
        console.error('bootstrap failed', error);
        setSnapshot(mockSnapshot());
      });

    return () => {
      alive = false;
      unsubscribeState();
      unsubscribeBubble();
      void window.mochi.setInteractive(false);
    };
  }, [showBubble]);

  useEffect(() => {
    if (!bubble) return;
    const timer = window.setTimeout(() => setBubble(null), bubble.durationMs);
    return () => window.clearTimeout(timer);
  }, [bubble]);

  const setWindowInteractive = useCallback((next: boolean) => {
    if (interactiveRef.current === next) return;
    interactiveRef.current = next;
    setInteractive(next);
    if (window.mochi) void window.mochi.setInteractive(next);
  }, []);

  useEffect(() => {
    const clearExit = (): void => {
      if (exitTimer.current !== null) window.clearTimeout(exitTimer.current);
      exitTimer.current = null;
    };

    const scheduleExit = (): void => {
      if (exitTimer.current !== null) return;
      exitTimer.current = window.setTimeout(() => {
        exitTimer.current = null;
        setWindowInteractive(false);
      }, INTERACTIVE_EXIT_DELAY);
    };

    const onMove = (event: MouseEvent): void => {
      // A drag in progress must never lose the window's interactivity. If it
      // did, the pointerup would never arrive and the pet would stay stuck
      // being carried until the watchdog rescued it.
      if (dragRef.current) {
        clearExit();
        setWindowInteractive(true);
        return;
      }

      const inside = isInside(event.clientX, event.clientY, bubbleRef.current !== null);
      if (inside) {
        clearExit();
        setWindowInteractive(true);
      } else if (interactiveRef.current) {
        scheduleExit();
      }
    };

    const onLeave = (): void => {
      if (dragRef.current) return;
      if (interactiveRef.current) scheduleExit();
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseleave', onLeave);
    return () => {
      clearExit();
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseleave', onLeave);
    };
  }, [setWindowInteractive]);

  const triggerPoke = useCallback(() => {
    if (!window.mochi) return;
    setPoked(true);
    if (pokeTimer.current !== null) window.clearTimeout(pokeTimer.current);
    pokeTimer.current = window.setTimeout(() => setPoked(false), 420);
    void window.mochi.poke();
  }, []);

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>): void => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.screenX,
      startY: event.screenY,
      startedAt: performance.now(),
      dragging: false,
    };
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>): void => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.screenX - drag.startX;
    const dy = event.screenY - drag.startY;
    if (!drag.dragging && Math.hypot(dx, dy) >= DRAG_THRESHOLD) {
      drag.dragging = true;
      if (window.mochi) {
        void window.mochi.dragStart({ x: event.screenX, y: event.screenY });
      }
    }
  };

  const endPointer = (event: React.PointerEvent<HTMLDivElement>, canceled: boolean): void => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;

    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // The capture may already be gone after a cancel.
    }

    if (drag.dragging) {
      if (window.mochi) void window.mochi.dragEnd({ x: event.screenX, y: event.screenY });
      return;
    }

    const duration = performance.now() - drag.startedAt;
    if (!canceled && duration <= CLICK_MAX_DURATION) triggerPoke();
  };

  const action = useMemo(() => bubble?.action ?? null, [bubble]);
  const secondaryAction = useMemo(() => bubble?.secondaryAction ?? null, [bubble]);

  const runBubbleAction = (target: BubbleAction | null): void => {
    if (!target) return;
    if (window.mochi) {
      if (target.id === 'start-focus') void window.mochi.focus('start');
      if (target.id === 'resume-focus') void window.mochi.focus('resume');
      if (target.id === 'end-focus') void window.mochi.focus('stop');
    }
    setBubble(null);
  };

  const pet = snapshot?.pet ?? mockSnapshot().pet;

  return (
    <div className="pet-root">
      {bubble ? (
        <div className="bubble" role="status" aria-live="polite">
          <p className="bubble-text">{bubble.text}</p>
          <div className="bubble-row">
            {action ? (
              <button
                type="button"
                className="bubble-action"
                onClick={() => runBubbleAction(action)}
              >
                {action.label}
              </button>
            ) : (
              <span className="bubble-spacer" />
            )}
            {secondaryAction ? (
              <button
                type="button"
                className="bubble-action bubble-action-secondary"
                onClick={() => runBubbleAction(secondaryAction)}
              >
                {secondaryAction.label}
              </button>
            ) : null}
            <button
              type="button"
              className="bubble-close"
              aria-label="Dismiss"
              onClick={() => setBubble(null)}
            >
              ×
            </button>
          </div>
          <span className="bubble-tail" aria-hidden="true" />
        </div>
      ) : null}

      <div className="pet-stage">
        <div
          className="pet-interaction"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={(event) => endPointer(event, false)}
          onPointerCancel={(event) => endPointer(event, true)}
          onDoubleClick={() => {
            if (window.mochi) void window.mochi.openDen();
          }}
          onContextMenu={(event) => {
            event.preventDefault();
            if (window.mochi) {
              void window.mochi.contextMenu({ x: event.clientX, y: event.clientY });
            }
          }}
        >
          <PetSprite
            behavior={pet.behavior}
            facing={pet.facing}
            reducedMotion={reducedMotion}
            poked={poked}
            interactive={interactive}
          />
        </div>
      </div>
    </div>
  );
}
