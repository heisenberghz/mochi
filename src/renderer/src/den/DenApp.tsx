import { useCallback, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import type {
  AppSnapshot,
  FocusAction,
  FocusConfig,
  FocusConfigIssue,
  FocusPauseReason,
  FocusPhase,
  InsightsView,
  Settings,
} from '../../../shared/types';
import { COSMETICS, HOTKEY_DEFAULTS, PET_SCALES, unlockedCosmetics } from '../../../shared/constants';
import { formatTime, mockSnapshot } from '../mock';

type Tab = 'home' | 'focus' | 'insights' | 'locker' | 'settings';

const TABS: ReadonlyArray<{ id: Tab; label: string }> = [
  { id: 'home', label: 'Home' },
  { id: 'focus', label: 'Focus' },
  { id: 'insights', label: 'Insights' },
  { id: 'locker', label: 'Locker' },
  { id: 'settings', label: 'Settings' },
];

const PHASE_LABEL: Record<FocusPhase, string> = {
  work: 'Focus',
  shortBreak: 'Short break',
  longBreak: 'Long break',
};

const BEHAVIOR_LABEL: Record<AppSnapshot['pet']['behavior'], string> = {  idle: 'hanging out',
  lookLeft: 'looking left',
  lookRight: 'looking right',
  earFlick: 'flicking an ear',
  stretch: 'stretching',
  yawn: 'yawning',
  walk: 'wandering around',
  sleep: 'taking a nap',
  wake: 'waking up',
  wave: 'saying hello',
  focus: 'focusing with you',
  celebrate: 'celebrating',
  drag: 'being carried',
};

/** Why the session is not running, in words a person can read. */
const PAUSE_REASON: Record<FocusPauseReason, string> = {
  user: 'you paused it',
  idle: 'you went away for a while',
  lock: 'the computer was locked',
  suspend: 'the computer was asleep',
  recovered: 'it was saved when Mochi closed',
};

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function clockTime(msFromNow: number): string {
  return new Date(Date.now() + msFromNow).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface ToggleProps {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}

function Toggle({ label, description, checked, onChange }: ToggleProps) {
  return (
    <div className="setting-row">
      <div className="setting-copy">
        <span className="setting-label">{label}</span>
        <span className="setting-desc">{description}</span>
      </div>
      <label className="switch">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span className="switch-track" aria-hidden="true">
          <span className="switch-thumb" />
        </span>
        <span className="sr-only">{label}</span>
      </label>
    </div>
  );
}

function Meter({ label, value }: { label: string; value: number }) {
  const rounded = Math.round(value);
  return (
    <div className="meter">
      <div className="meter-head">
        <span>{label}</span>
        <span className="meter-value">{rounded}</span>
      </div>
      <div
        className="meter-track"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={rounded}
      >
        <span className="meter-fill" style={{ width: `${Math.min(100, Math.max(0, rounded))}%` }} />
      </div>
    </div>
  );
}

function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`card ${className}`.trim()}>{children}</section>;
}

interface NumberFieldProps {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  suffix?: string;
  issue?: FocusConfigIssue;
  onCommit: (value: number) => void;
}

function NumberField({
  id,
  label,
  value,
  min,
  max,
  suffix,
  issue,
  onCommit,
}: NumberFieldProps) {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const commit = (): void => {
    const parsed = Number(draft);
    if (!Number.isFinite(parsed)) {
      setDraft(String(value));
      return;
    }
    if (parsed === value) return;
    onCommit(parsed);
  };

  return (
    <div className="number-field">
      <label className="setting-label" htmlFor={id}>
        {label}
      </label>
      <div className="number-input-row">
        <input
          id={id}
          className={`number-input${issue ? ' has-issue' : ''}`}
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur();
          }}
          aria-invalid={issue ? true : undefined}
          aria-describedby={issue ? `${id}-issue` : undefined}
        />
        {suffix ? <span className="number-suffix">{suffix}</span> : null}
      </div>
      {issue ? (
        <p className="field-issue" id={`${id}-issue`} role="alert">
          {issue.message}
        </p>
      ) : null}
    </div>
  );
}

interface FocusConfigEditorProps {
  config: FocusConfig;
  onSaved: (config: FocusConfig) => void;
}

function FocusConfigEditor({ config, onSaved }: FocusConfigEditorProps) {
  const [issues, setIssues] = useState<FocusConfigIssue[]>([]);

  const issueFor = useCallback(
    (field: keyof FocusConfig): FocusConfigIssue | undefined =>
      issues.find((issue) => issue.field === field),
    [issues],
  );

  const update = useCallback(
    async (patch: Partial<FocusConfig>) => {
      const api = window.mochi;
      if (!api) return;
      try {
        const result = await api.updateFocusConfig(patch);
        setIssues(result.issues);
        if (result.ok) onSaved(result.config);
      } catch {
        setIssues([]);
      }
    },
    [onSaved],
  );

  return (
    <Card>
      <div className="card-head">
        <h2 className="eyebrow">Session lengths</h2>
      </div>

      <div className="field-grid">
        <NumberField
          id="work-min"
          label="Focus"
          value={config.workMin}
          min={5}
          max={120}
          suffix="min"
          issue={issueFor('workMin')}
          onCommit={(value) => void update({ workMin: value })}
        />
        <NumberField
          id="short-break-min"
          label="Short break"
          value={config.shortBreakMin}
          min={1}
          max={30}
          suffix="min"
          issue={issueFor('shortBreakMin')}
          onCommit={(value) => void update({ shortBreakMin: value })}
        />
        <NumberField
          id="long-break-min"
          label="Long break"
          value={config.longBreakMin}
          min={5}
          max={60}
          suffix="min"
          issue={issueFor('longBreakMin')}
          onCommit={(value) => void update({ longBreakMin: value })}
        />
        <NumberField
          id="rounds"
          label="Rounds"
          value={config.rounds}
          min={2}
          max={8}
          issue={issueFor('rounds')}
          onCommit={(value) => void update({ rounds: value })}
        />
      </div>

      <Toggle
        label="Start breaks automatically"
        description="A break begins the moment a block ends."
        checked={config.autoStartBreak}
        onChange={(value) => void update({ autoStartBreak: value })}
      />
      <Toggle
        label="Start the next block automatically"
        description="Work begins by itself after a break."
        checked={config.autoStartWork}
        onChange={(value) => void update({ autoStartWork: value })}
      />
    </Card>
  );
}

/** Minutes and hours, for the day so far. */
function formatMinutes(ms: number): string {
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

/** The slider's spoken value, like "Large (125%)". */
function sizeLabel(scale: Settings['petScale']): string {
  const percent = `${Math.round(scale * 100)}%`;
  switch (scale) {
    case 0.75:
      return `Snug (${percent})`;
    case 1.25:
      return `Large (${percent})`;
    case 1.5:
      return `Grand (${percent})`;
    default:
      return `Normal (${percent})`;
  }
}

/** How far along the slider's track the scale sits, as a percent. */
function fillPercent(scale: Settings['petScale']): number {
  const step = PET_SCALES.indexOf(scale);
  return Math.round((step / (PET_SCALES.length - 1)) * 100);
}

/** A readable day, like "Mar 10". */
function formatDay(dayKey: string | null): string {
  if (!dayKey) return '—';
  const [year, month, day] = dayKey.split('-').map((part) => Number(part));
  const date = new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** Quiet-hour times as clock text, like "22:00". */
function formatQuiet(minute: number): string {
  const hours = Math.floor(minute / 60);
  const rest = minute % 60;
  return `${String(hours).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
}

export function DenApp() {
  const [snapshot, setSnapshot] = useState<AppSnapshot>(() => mockSnapshot());
  const [connected, setConnected] = useState(false);
  const [tab, setTab] = useState<Tab>('home');
const [highContrast, setHighContrast] = useState(false);
  const [notice, setNotice] = useState<{ text: string; sticky?: boolean } | null>(null);

  /**
   * A line at the foot of the window. Successes leave on their own;
   * failures stick (with a dismiss button) until they are seen.
   */
  const say = useCallback((text: string, sticky = false) => {
    setNotice(sticky ? { text, sticky: true } : { text });
  }, []);
  const [busy, setBusy] = useState(false);
  const [nameDraft, setNameDraft] = useState<string | null>(null);
  const [recoveryDismissed, setRecoveryDismissed] = useState(false);
  const [insights, setInsights] = useState<InsightsView | null>(null);
  const [insightsRange, setInsightsRange] = useState<7 | 30>(7);
  const [exportPreview, setExportPreview] = useState<string | null>(null);
  const [resetArmed, setResetArmed] = useState(false);
  const resetHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const resetTriggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const api = window.mochi;
    if (!api) return;

    let alive = true;
    const unsubscribe = api.onState((next) => {
      if (alive) setSnapshot(next);
    });

    api
      .bootstrap()
      .then((initial) => {
        if (!alive) return;
        setSnapshot(initial);
        setConnected(true);
      })
      .catch(() => {
        if (alive) say('Your data could not be loaded just now. Showing a preview.', true);
      });

    return () => {
      alive = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!notice || notice.sticky) return;
    const timer = window.setTimeout(() => setNotice(null), 5000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  // The reset dialog closes on Escape, and it owns the keyboard while open:
  // focus arrives on its title the moment it opens, the widget return trip
  // puts focus back on "Reset everything…" when it leaves. Otherwise
  // "modal" is a claim, not a fact, and Tab walks the page behind a cloth.
  useEffect(() => {
    if (!resetArmed) return;
    resetHeadingRef.current?.focus();
    const lastTrigger = resetTriggerRef.current;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setResetArmed(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      lastTrigger?.focus();
    };
  }, [resetArmed]);

  /** Where focus was before the reset dialog was armed. */
  const armReset = useCallback(() => {
    resetTriggerRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setResetArmed(true);
  }, []);

  // Keyboard capture for the dialog's Tab cycle. With aria-modal the page's
  // content is hidden from assistive tech, so Tab must stay inside too.
  const trapResetTab = useCallback((event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab') return;
    const dialog = event.currentTarget;
    const focusable = Array.from(
      dialog.querySelectorAll<HTMLElement>('button:not(:disabled)'),
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    if (first === undefined) return;
    const last = focusable[focusable.length - 1] ?? first;
    const active = document.activeElement as HTMLElement | null;
    if (focusable.indexOf(active ?? first) === -1) {
      event.preventDefault();
      first.focus();
      return;
    }
    if (event.shiftKey && (active === first || !dialog.contains(active))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (active === last || !dialog.contains(active))) {
      event.preventDefault();
      first.focus();
    }
  }, []);

  // Insights are read when the tab opens and quietly refreshed while it
  // stays open. They are never fetched otherwise — no chatty background work.
  useEffect(() => {
    if (tab !== 'insights') return;
    const api = window.mochi;
    if (!api) return;

    let alive = true;
    const read = () => {
      api
        .getInsights()
        .then((view) => {
          if (alive) setInsights(view);
        })
        .catch(() => {
          if (alive) say('Insights could not be read just now.', true);
        });
    };

    read();
    const timer = window.setInterval(read, 60_000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [tab]);

  const runFocus = useCallback(
    async (action: FocusAction) => {
      const api = window.mochi;
      if (!api || busy) return;
      setBusy(true);
      try {
        const result = await api.focus(action);
        if (!result.ok) say('That did not work. Please try again.', true);
      } catch {
        say('That did not work. Please try again.', true);
      } finally {
        setBusy(false);
      }
    },
    [busy],
  );

  const saveSettings = useCallback(async (patch: Partial<Settings>) => {
    setSnapshot((prev) => ({ ...prev, settings: { ...prev.settings, ...patch } }));
    const api = window.mochi;
    if (!api) return;
    try {
      const result = await api.updateSettings(patch);
      if (result.ok) {
        setSnapshot((prev) => ({ ...prev, settings: result.settings }));
      } else {
        say('Could not save that setting.', true);
      }
    } catch {
      say('Could not save that setting.', true);
    }
  }, []);

  const showPet = useCallback(async () => {
    const api = window.mochi;
    if (!api) return;
    try {
      await api.setPetVisible(true);
      say(`${snapshot.settings.petName} is back on your desktop.`);
    } catch {
      say(`Could not show ${snapshot.settings.petName}.`, true);
    }
  }, [snapshot.settings.petName]);

  const openDataFolder = useCallback(async () => {
    const api = window.mochi;
    if (!api) return;
    try {
      const result = await api.openDataFolder();
      if (!result.ok) say('Could not open the data folder.', true);
    } catch {
      say('Could not open the data folder.', true);
    }
  }, []);

  const { pet, focus, settings } = snapshot;
  const cosmetics = unlockedCosmetics(pet.level);
  const recovery = snapshot.recovery;
  const range =
    insights && !insights.empty
      ? insightsRange === 7
        ? insights.week
        : insights.month
      : undefined;
  const chartMax = Math.max(1, ...(range?.days.map((day) => day.focusedMs) ?? [1]));
  const chartLabel = range
    ? `Focus minutes per day over the last ${insightsRange} days; tallest day ${formatMinutes(
        chartMax,
      )}.`
    : 'No focus history yet.';
  const phase = PHASE_LABEL[focus.phase];
  const totalMs = Math.max(1, focus.phaseDurationMs);
  const progress =
    focus.status === 'idle'
      ? 0
      : Math.min(1, Math.max(0, 1 - focus.remainingMs / totalMs));
  const ringStyle = {
    background: `conic-gradient(var(--accent) ${progress * 360}deg, var(--line) 0deg)`,
  } as CSSProperties;
  const isWorking = focus.phase === 'work';

  return (
    <div className={`den-root${highContrast ? ' high-contrast' : ''}`}>
      <aside className="den-sidebar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            {settings.petName.slice(0, 1).toUpperCase()}
          </span>
          <span className="brand-copy">
            <span className="brand-name">{settings.petName}</span>
            <span className="brand-tag">quiet focus companion</span>
          </span>
        </div>

        <nav className="nav" aria-label="Sections">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`nav-item${tab === item.id ? ' is-active' : ''}`}
              aria-current={tab === item.id ? 'page' : undefined}
              onClick={() => setTab(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="sidebar-foot">
          <span className={`status-dot${connected ? ' is-live' : ''}`} aria-hidden="true" />
          <span>{connected ? `${settings.petName} is running` : 'Preview mode'}</span>
        </div>
      </aside>

      <main className="den-main">
        <header className="den-header">
          <div>
            <h1 className="den-title">
              {tab === 'home'
                ? `${greeting()}.`
                : tab === 'focus'
                  ? 'Focus'
                  : tab === 'insights'
                    ? 'Insights'
                    : tab === 'locker'
                      ? 'Locker'
                      : 'Settings'}
            </h1>
            <p className="den-subtitle">
              {tab === 'home'
                ? `${settings.petName} is ${BEHAVIOR_LABEL[pet.behavior]}.`
                : tab === 'focus'
                  ? 'One block at a time. Breaks are part of the work.'
                  : tab === 'insights'
                    ? 'The truth about your week, without judgment.'
                    : tab === 'locker'
                      ? 'Earned by being companions. Nothing else.'
                      : 'Small choices. Everything stays on this PC.'}
            </p>
          </div>
          {tab !== 'settings' ? (
            <div className="header-meta">
              <span className="pill">Level {pet.level}</span>
              <span
                className="pill pill-muted"
                title="XP is what Mochi earns for every finished block."
              >
                {pet.xp} XP
              </span>
            </div>
          ) : null}
        </header>

        {recovery && !recoveryDismissed ? (
          <div className="banner banner-recovery" role="alert">
            <div className="banner-copy">
              <p className="banner-text">{recovery.message}</p>
              <p className="banner-path">{recovery.folder}</p>
            </div>
            <div className="banner-actions">
              <button
                type="button"
                className="btn btn-soft btn-small"
                onClick={() => void openDataFolder()}
              >
                Open folder
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-small"
                onClick={() => setRecoveryDismissed(true)}
              >
                Dismiss
              </button>
            </div>
          </div>
        ) : null}

        {!connected ? (
          <div className="banner" role="note">
            Preview mode. Mochi isn't running, so the controls are asleep.
          </div>
        ) : null}

        {tab === 'home' ? (
          <div className="grid-home">
            <Card className="focus-card">
              <div className="card-head">
                <h2 className="eyebrow">Current session</h2>
                <span className={`phase-tag${isWorking ? ' is-work' : ''}`}>{phase}</span>
              </div>

              <div className="focus-body">
                <div style={ringStyle} className="ring">
                  <div className="ring-inner">
                    <span className="ring-time">{formatTime(focus.remainingMs)}</span>
                    <span className="ring-caption">
                      {focus.status === 'running'
                        ? `ends at ${clockTime(focus.remainingMs)}`
                        : focus.status === 'paused'
                          ? 'Paused'
                          : 'Not started'}
                    </span>
                  </div>
                </div>

                <div className="focus-controls">
                  {focus.status === 'idle' ? (
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={!connected || busy}
                      onClick={() => void runFocus('start')}
                    >
                      Start focus
                    </button>
                  ) : focus.status === 'running' ? (
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={!connected || busy}
                      onClick={() => void runFocus('pause')}
                    >
                      Pause
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={!connected || busy}
                      onClick={() => void runFocus('resume')}
                    >
                      Resume
                    </button>
                  )}

                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={!connected || focus.status === 'idle' || busy}
                    onClick={() => void runFocus('stop')}
                  >
                    End session
                  </button>

                  <p className="focus-note">
                    {settings.reducedMotion === 'on'
                      ? `Reduced motion is on, so the pet stays still. ${Math.round(
                          focus.config.workMin,
                        )} min work, ${Math.round(focus.config.shortBreakMin)} min break.`
                      : `${Math.round(focus.config.workMin)} min work, ${Math.round(
                          focus.config.shortBreakMin,
                        )} min break.`}
                  </p>
                </div>
              </div>

              <div className="rounds" role="group" aria-label={`Round ${focus.round} of ${focus.totalRounds}`}>
                {Array.from({ length: focus.totalRounds }, (_, index) => {
                  const done = index + 1 < focus.round;
                  const current = index + 1 === focus.round;
                  return (
                    <span
                      key={index}
                      className={`round-dot${done ? ' is-done' : ''}${current ? ' is-current' : ''}`}
                    />
                  );
                })}
                <span className="rounds-label">
                  Round {focus.round} of {focus.totalRounds}
                </span>
              </div>
            </Card>

            <div className="stack">
              <Card>
                <div className="card-head">
                  <h2 className="eyebrow">Today</h2>
                </div>
                <div className="stat-row">
                  <div className="stat">
                    <span className="stat-value">{focus.completedToday}</span>
                    <span className="stat-label">focus blocks</span>
                  </div>
                  <div className="stat">
                    <span className="stat-value">{formatMinutes(focus.focusedMsToday)}</span>
                    <span className="stat-label">focused today</span>
                  </div>
                  <div className="stat">
                    <span className="stat-value">{pet.level}</span>
                    <span className="stat-label">level</span>
                  </div>
                </div>
                {focus.streakDays > 0 ? (
                  <p className="tip">
                    {focus.streakDays} day{focus.streakDays === 1 ? '' : 's'} in a row.
                  </p>
                ) : null}
                <Meter label="Energy" value={pet.energy} />
                <Meter label="Mood" value={pet.mood} />
              </Card>

              <Card>
                <div className="card-head">
                  <h2 className="eyebrow">A gentle tip</h2>
                </div>
                <p className="tip">
                  Put the window over a quiet corner of the screen. {settings.petName} walks
                  a little when you are away, and naps when you are gone for a while.
                </p>
                <button type="button" className="btn btn-soft" onClick={() => void showPet()}>
                  Show {settings.petName}
                </button>
              </Card>
            </div>
          </div>
        ) : null}

        {tab === 'focus' ? (
          <div className="grid-focus">
            <Card className="focus-card">
              <div className="focus-body focus-body-tall">
                <div style={ringStyle} className="ring ring-large">
                  <div className="ring-inner">
                    <span className="ring-time">{formatTime(focus.remainingMs)}</span>
                    <span className="ring-caption">{phase}</span>
                  </div>
                </div>

                <div className="focus-controls">
                  <div className="phase-switch" role="group" aria-label="Session state">
                    <span className={`phase-chip${focus.status === 'running' ? ' is-on' : ''}`}>
                      {focus.status === 'running' ? 'In progress' : focus.status === 'paused' ? 'Paused' : 'Not started'}
                    </span>
                    <span className="phase-chip">
                      Block {focus.completedToday} today
                    </span>
                  </div>

                  <div className="button-row">
                    {focus.status === 'idle' ? (
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={!connected || busy}
                        onClick={() => void runFocus('start')}
                      >
                        Start focus
                      </button>
                    ) : focus.status === 'running' ? (
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={!connected || busy}
                        onClick={() => void runFocus('pause')}
                      >
                        Pause
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={!connected || busy}
                        onClick={() => void runFocus('resume')}
                      >
                        Resume
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn-ghost"
                      disabled={!connected || focus.status === 'idle' || busy}
                      onClick={() => void runFocus('skip')}
                    >
                      Skip
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      disabled={!connected || focus.status === 'idle' || busy}
                      onClick={() => void runFocus('stop')}
                    >
                      End session
                    </button>
                  </div>

                  {focus.status === 'paused' ? (
                    <p className="focus-note">
                      Paused — {PAUSE_REASON[focus.pauseReason ?? 'user']}.
                    </p>
                  ) : null}
                </div>
              </div>
            </Card>

            <div className="stack">
              <Card>
                <div className="card-head">
                  <h2 className="eyebrow">This session</h2>
                </div>
                <ul className="checklist">
                  <li>
                    <span className="check" aria-hidden="true" />
                    <span>
                      {Math.round(focus.config.workMin)} minutes of focus
                    </span>
                  </li>
                  <li>
                    <span className="check" aria-hidden="true" />
                    <span>
                      {Math.round(focus.config.shortBreakMin)} minute short break
                    </span>
                  </li>
                  <li>
                    <span className="check" aria-hidden="true" />
                    <span>
                      {Math.round(focus.config.longBreakMin)} minute long break after{' '}
                      {focus.totalRounds} rounds
                    </span>
                  </li>
                </ul>
                <p className="tip">
                  A block is one stretch of focus — the timer, start to end. A round is one
                  block plus its short break. Breaks start on their own. Work does not, so
                  you can step away without coming back to a running timer.
                </p>
              </Card>

              <Card>
                <div className="card-head">
                  <h2 className="eyebrow">XP</h2>
                </div>
                <p className="tip">
                  Each finished block earns at least {Math.round(focus.config.workMin)} XP, plus
                  a small bonus. You are on {pet.xp} XP right now.
                </p>
              </Card>

              <FocusConfigEditor
                config={focus.config}
                onSaved={(config) => {
                  setSnapshot((prev) => ({ ...prev, focus: { ...prev.focus, config } }));
                }}
              />
            </div>
          </div>
        ) : null}

        {tab === 'insights' ? (
          <div className="grid-insights">
            {insights && range && !insights.empty ? (
              <>
                <div className="stack">
                  <Card>
                    <div className="card-head">
                      <h2 className="eyebrow">Focus minutes</h2>
                      <div className="range-toggle" role="group" aria-label="Range">
                        <button
                          type="button"
                          className={`range-btn${insightsRange === 7 ? ' is-active' : ''}`}
                          aria-pressed={insightsRange === 7}
                          onClick={() => setInsightsRange(7)}
                        >
                          7 days
                        </button>
                        <button
                          type="button"
                          className={`range-btn${insightsRange === 30 ? ' is-active' : ''}`}
                          aria-pressed={insightsRange === 30}
                          onClick={() => setInsightsRange(30)}
                        >
                          30 days
                        </button>
                      </div>
                    </div>
                    <div className="chart" role="img" aria-label={chartLabel}>
                      {range.days.map((day) => (
                        <div key={day.dayKey} className="chart-col" title={day.dayKey}>
                          <div
                            className="chart-bar"
                            style={{
                              height: `${Math.max(
                                2,
                                Math.round((day.focusedMs / Math.max(1, chartMax)) * 100),
                              )}%`,
                            }}
                          />
                        </div>
                      ))}
                    </div>
                    {/* The picture is an image to sighted browsing, so the
                        numbers live here too — a plain table for assistive
                        tech, matching the picture day for day. */}
                    <table className="sr-only">
                      <caption>{chartLabel}</caption>
                      <thead>
                        <tr>
                          <th scope="col">Day</th>
                          <th scope="col">Focused</th>
                        </tr>
                      </thead>
                      <tbody>
                        {range.days.map((day) => (
                          <tr key={day.dayKey}>
                            <th scope="row">{day.dayKey}</th>
                            <td>{formatMinutes(day.focusedMs)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p className="tip">
                      {range === insights.week ? 'This week' : 'This month'}: best day was{' '}
                      {formatDay(range.bestDay?.dayKey ?? null)},{' '}
                      {formatMinutes(range.bestDay?.focusedMs ?? 0)}.
                    </p>
                  </Card>

                  <Card>
                    <div className="stat-row">
                      <div className="stat">
                        <span className="stat-value">{formatMinutes(range.focusedMs)}</span>
                        <span className="stat-label">focused</span>
                      </div>
                      <div className="stat">
                        <span className="stat-value">{range.blocks}</span>
                        <span className="stat-label">blocks</span>
                      </div>
                      <div className="stat">
                        <span className="stat-value">{range.breaks}</span>
                        <span className="stat-label">breaks</span>
                      </div>
                      <div className="stat">
                        <span className="stat-value">{range.activeDays}</span>
                        <span className="stat-label">active days</span>
                      </div>
                    </div>
                  </Card>

                  <Card>
                    <div className="stat-row">
                      <div className="stat">
                        <span className="stat-value">{insights.streakDays}</span>
                        <span className="stat-label">current streak (days)</span>
                      </div>
                      <div className="stat">
                        <span className="stat-value">{insights.longestStreakDays}</span>
                        <span className="stat-label">longest streak (days)</span>
                      </div>
                    </div>
                  </Card>
                </div>

                <Card>
                  <div className="card-head">
                    <h2 className="eyebrow">Recent sessions</h2>
                  </div>
                  {insights.recent.length > 0 ? (
                    <ul className="session-list">
                      {insights.recent.map((session, index) => (
                        <li key={`${session.dayKey}-${index}`} className="session-row">
                          <span className="session-day">{formatDay(session.dayKey)}</span>
                          <span className="session-phase">
                            {session.phase === 'work' ? 'Focus' : session.phase === 'shortBreak' ? 'Short break' : 'Long break'}
                          </span>
                          <span className="session-mins">{formatMinutes(session.focusedMs)}</span>
                          <span
                            className={`session-tag${session.completed ? ' is-complete' : ''}`}
                          >
                            {session.completed ? 'completed' : 'partial'}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="tip">Nothing yet. The first block is yours.</p>
                  )}
                </Card>
              </>
            ) : (
              <Card>
                <div className="card-head">
                  <h2 className="eyebrow">Insights</h2>
                </div>
                <p className="tip">
                  A quiet start. There is nothing to show because nothing has happened yet —
                  and there is no "behind" to catch up to. Finish one block and this page
                  starts filling in.
                </p>
                {connected ? (
                  <button
                    type="button"
                    className="btn btn-primary btn-small"
                    disabled={busy}
                    onClick={() => void runFocus('start')}
                  >
                    Start a block
                  </button>
                ) : null}
              </Card>
            )}
          </div>
        ) : null}

        {tab === 'locker' ? (
          <div className="grid-locker">
            <Card>
              <div className="card-head">
                <h2 className="eyebrow">Locker</h2>
                <span className="pill">Level {pet.level}</span>
              </div>
              <div className="locker-grid">
                {COSMETICS.map((cosmetic) => {
                  const unlocked = cosmetics.includes(cosmetic.id);
                  const worn = pet.equipped.includes(cosmetic.id);
                  return (
                    <div
                      key={cosmetic.id}
                      className={`cosmetic ${unlocked ? 'unlocked' : 'locked'}${worn ? ' worn' : ''}`}
                    >
                      <div className={`cosmetic-icon cosmetic-${cosmetic.id}`} />
                      <div className="cosmetic-info">
                        <span className="cosmetic-label">{cosmetic.label}</span>
                        <span className="cosmetic-level">
                          {unlocked
                            ? worn
                              ? 'Wearing'
                              : 'Unlocked'
                            : `Level ${cosmetic.unlockLevel}`}
                        </span>
                      </div>
                      {unlocked ? (
                        <button
                          type="button"
                          className="cosmetic-toggle"
                          disabled={!connected}
                          onClick={async () => {
                            const api = window.mochi;
                            if (!api) return;
                            try {
                              await api.equip(cosmetic.id);
                            } catch {
                              say('Could not change that just now.', true);
                            }
                          }}
                        >
                          {worn ? 'Take off' : 'Wear'}
                        </button>
                      ) : null}
                    </div>
                  );
                })}
                {/* The spare spot: keeps the grid from stranding the last
                    item alone, and quiet-promises that the collection grows. */}
                <div className="cosmetic-spot" aria-hidden="true">
                  <div className="cosmetic-icon cosmetic-spot-icon" />
                  <div className="cosmetic-info">
                    <span className="cosmetic-label">A spare spot</span>
                    <span className="cosmetic-level">
                      More arrives as {settings.petName} grows
                    </span>
                  </div>
                </div>
              </div>
              <p className="tip">
                Free to wear — anything unlocked goes on and off as much as you like,
                one thing per spot. Cosmetics unlock as {settings.petName} gains levels;
                no pressure, no currency.
              </p>
            </Card>
          </div>
        ) : null}

        {tab === 'settings' ? (
          <div className="grid-settings">
            <div className="stack">
            <Card>
              <div className="card-head">
                <h2 className="eyebrow">Companion</h2>
              </div>

              <div className="setting-row">
                <div className="setting-copy">
                  <label className="setting-label" htmlFor="pet-name">
                    Name
                  </label>
                  <span className="setting-desc">Up to 20 characters.</span>
                </div>
                <input
                  id="pet-name"
                  className="text-input"
                  value={nameDraft ?? settings.petName}
                  maxLength={20}
                  onChange={(event) => setNameDraft(event.target.value)}
                  onBlur={() => {
                    if (nameDraft !== null) {
                      const next = nameDraft.trim() || settings.petName;
                      setNameDraft(null);
                      if (next !== settings.petName) void saveSettings({ petName: next });
                    }
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') event.currentTarget.blur();
                  }}
                />
              </div>

              <div className="setting-row setting-row-stacked">
                <div className="setting-copy">
                  <label className="setting-label" htmlFor="pet-scale">
                    Pet size
                  </label>
                  <span className="setting-desc">
                    Adjust the size of your pet. She snaps to the sizes where
                    her pixels stay crisp.
                  </span>
                </div>
                <div className="size-slider-row">
                  <input
                    type="range"
                    id="pet-scale"
                    className="size-slider"
                    min={0}
                    max={PET_SCALES.length - 1}
                    step={1}
                    value={PET_SCALES.indexOf(settings.petScale)}
                    aria-valuetext={sizeLabel(settings.petScale)}
                    onChange={(event) => {
                      const next = PET_SCALES[Number(event.target.value)];
                      if (next !== undefined) void saveSettings({ petScale: next });
                    }}
                    style={{
                      ['--fill' as string]: `${fillPercent(settings.petScale)}%`,
                    }}
                  />
                  <button
                    type="button"
                    className="size-reset"
                    onClick={() => void saveSettings({ petScale: 1 })}
                  >
                    Reset
                  </button>
                </div>
              </div>

              <Toggle
                label={`Let ${settings.petName} wander`}
                description="Small walks along the bottom of the screen."
                checked={settings.roam}
                onChange={(value) => void saveSettings({ roam: value })}
              />

              <Toggle
                label="Sound"
                description="A soft chime when a block ends."
                checked={settings.sound}
                onChange={(value) => void saveSettings({ sound: value })}
              />

              <div className="setting-row setting-row-stacked">
                <div className="setting-copy">
                  <label className="setting-label" htmlFor="motion">
                    Motion level
                  </label>
                  <span className="setting-desc">
                    Reduced motion keeps the pet still and calm.
                  </span>
                </div>
                <select
                  id="motion"
                  className="select-input"
                  value={settings.reducedMotion}
                  onChange={(event) => {
                    const value = event.target.value;
                    if (value === 'on' || value === 'off' || value === 'system') {
                      void saveSettings({ reducedMotion: value });
                    }
                  }}
                >
                  <option value="system">Follow Windows</option>
                  <option value="on">Reduced</option>
                  <option value="off">Full</option>
                </select>
              </div>

              <Toggle
                label="Start with Windows"
                description="Starts when you sign in. Applies once Mochi is installed as an app."
                checked={settings.launchAtLogin}
                onChange={(value) => void saveSettings({ launchAtLogin: value })}
              />
            </Card>

              <Card>
                <div className="card-head">
                  <h2 className="eyebrow">Display</h2>
                </div>
                <Toggle
                  label="High contrast"
                  description="Stronger contrast for the Den."
                  checked={highContrast}
                  onChange={setHighContrast}
                />
                <Toggle
                  label="Hide in fullscreen apps"
                  description="Best effort: Mochi steps aside when a game takes the whole screen."
                  checked={settings.hideInFullscreen}
                  onChange={(value) => void saveSettings({ hideInFullscreen: value })}
                />
              </Card>

              <Card>
                <div className="card-head">
                  <h2 className="eyebrow">Sessions</h2>
                </div>
                <Toggle
                  label="Pause when the computer is locked"
                  description="A locked computer is not focus time."
                  checked={settings.pauseWhenLocked}
                  onChange={(value) => void saveSettings({ pauseWhenLocked: value })}
                />
                <Toggle
                  label="Carry on by itself"
                  description="After an idle pause, start again without asking."
                  checked={settings.autoResume}
                  onChange={(value) => void saveSettings({ autoResume: value })}
                />
              </Card>
            </div>

            <div className="stack">
              <Card>
                <div className="card-head">
                  <h2 className="eyebrow">Quiet hours</h2>
                </div>
                <Toggle
                  label="Quiet hours"
                  description="No toast and no chime during these hours. The pet still celebrates."
                  checked={settings.quietHoursEnabled}
                  onChange={(value) => void saveSettings({ quietHoursEnabled: value })}
                />
                {settings.quietHoursEnabled ? (
                  <>
                    <div className="setting-row">
                      <div className="setting-copy">
                        <label className="setting-label" htmlFor="quiet-start">
                          Starts
                        </label>
                        <span className="setting-desc">The hour the quiet begins.</span>
                      </div>
                      <select
                        id="quiet-start"
                        className="select-input"
                        value={Math.floor(settings.quietStartMin / 60)}
                        onChange={(event) =>
                          void saveSettings({ quietStartMin: Number(event.target.value) * 60 })
                        }
                      >
                        {Array.from({ length: 24 }, (_, hour) => (
                          <option key={hour} value={hour}>
                            {formatQuiet(hour * 60)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="setting-row">
                      <div className="setting-copy">
                        <label className="setting-label" htmlFor="quiet-end">
                          Ends
                        </label>
                        <span className="setting-desc">Next morning is fine — it can run past midnight.</span>
                      </div>
                      <select
                        id="quiet-end"
                        className="select-input"
                        value={Math.floor(settings.quietEndMin / 60)}
                        onChange={(event) =>
                          void saveSettings({ quietEndMin: Number(event.target.value) * 60 })
                        }
                      >
                        {Array.from({ length: 24 }, (_, hour) => (
                          <option key={hour} value={hour}>
                            {formatQuiet(hour * 60)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                ) : null}
              </Card>

              <Card>
                <div className="card-head">
                  <h2 className="eyebrow">Shortcuts</h2>
                </div>
                <Toggle
                  label="Global keyboard shortcuts"
                  description="Work even while another app is in front."
                  checked={settings.globalHotkeys}
                  onChange={(value) => void saveSettings({ globalHotkeys: value })}
                />
                {settings.globalHotkeys ? (
                  <ul className="shortcut-list" aria-label="Shortcut defaults">
                    <li>
                      <kbd>{HOTKEY_DEFAULTS.pet}</kbd> Show or hide {settings.petName}
                    </li>
                    <li>
                      <kbd>{HOTKEY_DEFAULTS.focus}</kbd> Start or pause focus
                    </li>
                    <li>
                      <kbd>{HOTKEY_DEFAULTS.den}</kbd> Open the Den
                    </li>
                  </ul>
                ) : null}
                {snapshot.hotkeyConflicts.length > 0 ? (
                  <p className="tip warn" role="note">
                    {snapshot.hotkeyConflicts.join(', ')}{' '}
                    {snapshot.hotkeyConflicts.length === 1 ? 'is' : 'are'} already used by another
                    app. The tray menu still works.
                  </p>
                ) : null}
              </Card>

              <Card>
                <div className="card-head">
                  <h2 className="eyebrow">Data &amp; privacy</h2>
                </div>
                <p className="tip">
                  {settings.petName} keeps its data in one file on this PC. No account, no
                  telemetry, no network calls.
                </p>
                {exportPreview !== null ? (
                  <details className="export-preview">
                    <summary>Your data, exactly as it would be saved</summary>
                    <pre>{exportPreview}</pre>
                  </details>
                ) : null}
                <div className="button-row">
                  <button
                    type="button"
                    className="btn btn-soft"
                    onClick={() => {
                      setExportPreview(null);
                      void window.mochi?.getExportPayload().then(setExportPreview).catch(() => {
                        say('The data could not be read just now.', true);
                      });
                    }}
                  >
                    Preview your data
                  </button>
                  <button
                    type="button"
                    className="btn btn-soft"
                    disabled={busy}
                    onClick={async () => {
                      const api = window.mochi;
                      if (!api) return;
                      try {
                        const result = await api.exportData();
                        say(result.ok ? 'Backup saved.' : 'Backup cancelled.', !result.ok);
                      } catch {
                        say('Backup cancelled.');
                      }
                    }}
                  >
                    Save a backup…
                  </button>
                  <button type="button" className="btn btn-soft" onClick={() => void openDataFolder()}>
                    Open data folder
                  </button>
                </div>
                <div className="button-row">
                  <button
                    type="button"
                    className="btn btn-danger btn-small"
                    onClick={() => armReset()}
                  >
                    Reset everything…
                  </button>
                  <span className="setting-desc">Erases every level, every minute, every setting.</span>
                </div>
              </Card>
            </div>
          </div>
        ) : null}

        {resetArmed ? (
          <div
            className="modal-backdrop"
            role="presentation"
            onClick={() => setResetArmed(false)}
          >
            <div
              className="modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="reset-title"
              onClick={(event) => event.stopPropagation()}
              onKeyDown={trapResetTab}
            >
              <h2 id="reset-title" tabIndex={-1} ref={resetHeadingRef} style={{ outline: 'none' }}>
                Reset everything?
              </h2>
              <p>
                This erases every level, every minute, every setting — {settings.petName} forgets
                you completely. There is no undo.
              </p>
              <div className="button-row">
                <button type="button" className="btn btn-soft" onClick={() => setResetArmed(false)}>
                  Keep my data
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  disabled={busy}
                  onClick={async () => {
                    const api = window.mochi;
                    if (!api) return;
                    setBusy(true);
                    try {
                      const result = await api.resetData();
                      say(result.ok ? `A fresh start. ${settings.petName} says hello again.` : 'The reset did not work.', !result.ok);
                      setResetArmed(false);
                    } catch {
                      say('The reset did not work.', true);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Erase everything
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {notice ? (
          <div className="toast" role="status" aria-live="polite">
            <span>{notice.text}</span>
            {notice.sticky ? (
              <button
                type="button"
                className="toast-dismiss"
                onClick={() => setNotice(null)}
              >
                Dismiss
              </button>
            ) : null}
          </div>
        ) : null}
      </main>
    </div>
  );
}
