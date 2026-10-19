import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import type {
  AppSnapshot,
  FocusAction,
  FocusPhase,
  Settings,
} from '../../../shared/types';
import { formatTime, mockSnapshot } from '../mock';

type Tab = 'home' | 'focus' | 'settings';

const TABS: ReadonlyArray<{ id: Tab; label: string }> = [
  { id: 'home', label: 'Home' },
  { id: 'focus', label: 'Focus' },
  { id: 'settings', label: 'Settings' },
];

const PHASE_LABEL: Record<FocusPhase, string> = {
  work: 'Focus',
  shortBreak: 'Short break',
  longBreak: 'Long break',
};

const BEHAVIOR_LABEL: Record<AppSnapshot['pet']['behavior'], string> = {
  idle: 'hanging out',
  walk: 'wandering around',
  sleep: 'taking a nap',
  wake: 'waking up',
  wave: 'saying hello',
  focus: 'focusing with you',
  celebrate: 'celebrating',
  drag: 'being carried',
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

export function DenApp() {
  const [snapshot, setSnapshot] = useState<AppSnapshot>(() => mockSnapshot());
  const [connected, setConnected] = useState(false);
  const [tab, setTab] = useState<Tab>('home');
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [nameDraft, setNameDraft] = useState<string | null>(null);

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
        if (alive) setNotice('Mochi could not load your data. Showing a preview.');
      });

    return () => {
      alive = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 5000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const runFocus = useCallback(
    async (action: FocusAction) => {
      const api = window.mochi;
      if (!api || busy) return;
      setBusy(true);
      try {
        const result = await api.focus(action);
        if (!result.ok) setNotice('That did not work. Please try again.');
      } catch {
        setNotice('That did not work. Please try again.');
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
        setNotice('Could not save that setting.');
      }
    } catch {
      setNotice('Could not save that setting.');
    }
  }, []);

  const showPet = useCallback(async () => {
    const api = window.mochi;
    if (!api) return;
    try {
      await api.setPetVisible(true);
      setNotice(`${snapshot.settings.petName} is back on your desktop.`);
    } catch {
      setNotice('Could not show Mochi.');
    }
  }, [snapshot.settings.petName]);

  const { pet, focus, settings } = snapshot;
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
    <div className="den-root">
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
          <span>{connected ? 'Mochi is running' : 'Preview mode'}</span>
        </div>
      </aside>

      <main className="den-main">
        <header className="den-header">
          <div>
            <h1 className="den-title">
              {tab === 'home' ? `${greeting()}.` : tab === 'focus' ? 'Focus' : 'Settings'}
            </h1>
            <p className="den-subtitle">
              {tab === 'home'
                ? `${settings.petName} is ${BEHAVIOR_LABEL[pet.behavior]}.`
                : tab === 'focus'
                  ? 'One block at a time. Breaks are part of the work.'
                  : 'Small choices. Everything stays on this PC.'}
            </p>
          </div>
          {tab !== 'settings' ? (
            <div className="header-meta">
              <span className="pill">Level {pet.level}</span>
              <span className="pill pill-muted">{pet.xp} XP</span>
            </div>
          ) : null}
        </header>

        {!connected ? (
          <div className="banner" role="note">
            Preview mode. Controls are disabled until the desktop app is running.
          </div>
        ) : null}

        {tab === 'home' ? (
          <div className="grid-home">
            <Card className="focus-card">
              <div className="card-head">
                <span className="eyebrow">Current session</span>
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
                          ? 'paused'
                          : 'ready to start'}
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
                      ? 'Reduced motion is on, so the pet stays still.'
                      : `${Math.round(focus.config.workMin)} min work, ${Math.round(
                          focus.config.shortBreakMin,
                        )} min break.`}
                  </p>
                </div>
              </div>

              <div className="rounds" aria-label={`Round ${focus.round} of ${focus.totalRounds}`}>
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
                  <span className="eyebrow">Today</span>
                </div>
                <div className="stat-row">
                  <div className="stat">
                    <span className="stat-value">{focus.completedToday}</span>
                    <span className="stat-label">focus blocks</span>
                  </div>
                  <div className="stat">
                    <span className="stat-value">{pet.level}</span>
                    <span className="stat-label">level</span>
                  </div>
                </div>
                <Meter label="Energy" value={pet.energy} />
                <Meter label="Mood" value={pet.mood} />
              </Card>

              <Card>
                <div className="card-head">
                  <span className="eyebrow">A gentle tip</span>
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
                      onClick={() => void runFocus('stop')}
                    >
                      End session
                    </button>
                  </div>
                </div>
              </div>
            </Card>

            <div className="stack">
              <Card>
                <div className="card-head">
                  <span className="eyebrow">This session</span>
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
                  Breaks start on their own. Work does not, so you can step away without
                  coming back to a running timer.
                </p>
              </Card>

              <Card>
                <div className="card-head">
                  <span className="eyebrow">XP</span>
                </div>
                <p className="tip">
                  Each finished block earns at least {Math.round(focus.config.workMin)} XP, plus
                  a small bonus. You are on {pet.xp} XP right now.
                </p>
              </Card>
            </div>
          </div>
        ) : null}

        {tab === 'settings' ? (
          <div className="grid-settings">
            <Card>
              <div className="card-head">
                <span className="eyebrow">Companion</span>
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

              <Toggle
                label="Start with Windows"
                description="Only applies to the installed app."
                checked={settings.launchAtLogin}
                onChange={(value) => void saveSettings({ launchAtLogin: value })}
              />
            </Card>

            <div className="stack">
              <Card>
                <div className="card-head">
                  <span className="eyebrow">Motion</span>
                </div>
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
              </Card>

              <Card>
                <div className="card-head">
                  <span className="eyebrow">Privacy</span>
                </div>
                <p className="tip">
                  {settings.petName} keeps its data in one file on this PC. No account, no
                  telemetry, no network calls.
                </p>
                <button type="button" className="btn btn-soft" onClick={() => void showPet()}>
                  Bring {settings.petName} back
                </button>
              </Card>
            </div>
          </div>
        ) : null}

        {notice ? (
          <div className="toast" role="status" aria-live="polite">
            {notice}
          </div>
        ) : null}
      </main>
    </div>
  );
}
