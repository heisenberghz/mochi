export type Behavior =
  | 'idle'
  | 'lookLeft'
  | 'lookRight'
  | 'earFlick'
  | 'stretch'
  | 'yawn'
  | 'walk'
  | 'sleep'
  | 'wake'
  | 'wave'
  | 'focus'
  | 'celebrate'
  | 'drag';

export type PetMode = 'awake' | 'focus' | 'sleep' | 'drag';

export type FocusPhase = 'work' | 'shortBreak' | 'longBreak';
export type FocusStatus = 'idle' | 'running' | 'paused';

/** Why a session is not running. */
export type FocusPauseReason = 'user' | 'idle' | 'lock' | 'suspend' | 'recovered';

export interface Point {
  x: number;
  y: number;
}

export interface PetView {
  behavior: Behavior;
  mode: PetMode;
  energy: number;
  mood: number;
  xp: number;
  level: number;
  facing: -1 | 1;
  /** True when the pet's animation has stopped working and it is standing still. */
  animationPaused: boolean;
}

export interface FocusConfig {
  workMin: number;
  shortBreakMin: number;
  longBreakMin: number;
  rounds: number;
  autoStartBreak: boolean;
  autoStartWork: boolean;
}

/** One thing wrong with a proposed focus configuration. */
export interface FocusConfigIssue {
  field: keyof FocusConfig;
  message: string;
}

export interface FocusView {
  status: FocusStatus;
  phase: FocusPhase;
  remainingMs: number;
  phaseDurationMs: number;
  round: number;
  totalRounds: number;
  completedToday: number;
  /** Focus time recorded today, in milliseconds. */
  focusedMsToday: number;
  /** Consecutive days with at least one completed block. */
  streakDays: number;
  /** Why the session is not running, or null when it is. */
  pauseReason: FocusPauseReason | null;
  /** When the current phase began, on the monotonic clock. */
  startedAtMs: number | null;
  config: FocusConfig;
}

export type ReducedMotion = 'system' | 'on' | 'off';

export interface Settings {
  petName: string;
  roam: boolean;
  reducedMotion: ReducedMotion;
  sound: boolean;
  launchAtLogin: boolean;
  /** Pause the session when the computer is locked. */
  pauseWhenLocked: boolean;
  /** Carry on by itself after an idle pause, instead of asking. */
  autoResume: boolean;
}

export type RecoveryKind = 'quarantined' | 'newer-version';

export interface RecoveryNotice {
  kind: RecoveryKind;
  /** One sentence, written for a person rather than a log. */
  message: string;
  /** Where the affected files live. */
  folder: string;
  /** The files that were quarantined, or that a newer version owns. */
  files: string[];
}

export interface AppSnapshot {
  pet: PetView;
  focus: FocusView;
  settings: Settings;
  welcome: boolean;
  /** Set once, when saved data could not be used as-is. */
  recovery: RecoveryNotice | null;
}

export interface BubbleAction {
  id: 'start-focus' | 'resume-focus' | 'end-focus' | 'dismiss';
  label: string;
}

export interface BubbleSpec {
  id: string;
  text: string;
  /** The main thing the bubble is offering. */
  action?: BubbleAction;
  /** A second option, for when there really are two. */
  secondaryAction?: BubbleAction;
  durationMs: number;
}

export type FocusAction = 'start' | 'pause' | 'resume' | 'skip' | 'stop';

export interface OkResult {
  ok: boolean;
  error?: string;
}

export interface SettingsResult extends OkResult {
  settings: Settings;
}

export interface FocusConfigResult extends OkResult {
  config: FocusConfig;
  issues: FocusConfigIssue[];
}

export interface MochiApi {
  readonly v: 1;
  bootstrap(): Promise<AppSnapshot>;
  onState(cb: (snapshot: AppSnapshot) => void): () => void;
  onBubble(cb: (bubble: BubbleSpec) => void): () => void;
  /** The pet claims the welcome message. Only the pet window may call this. */
  ackWelcome(): Promise<OkResult>;
  /** The pet reports whether reduced motion is actually in effect. */
  setReducedMotion(active: boolean): Promise<OkResult>;
  setInteractive(interactive: boolean): Promise<OkResult>;
  poke(): Promise<OkResult>;
  dragStart(cursor: Point): Promise<OkResult>;
  dragEnd(cursor: Point): Promise<OkResult>;
  contextMenu(cursor: Point): Promise<OkResult>;
  openDen(): Promise<OkResult>;
  openDataFolder(): Promise<OkResult>;
  focus(action: FocusAction): Promise<OkResult>;
  updateFocusConfig(patch: Partial<FocusConfig>): Promise<FocusConfigResult>;
  updateSettings(patch: Partial<Settings>): Promise<SettingsResult>;
  setPetVisible(visible: boolean): Promise<OkResult>;
}

declare global {
  interface Window {
    mochi: MochiApi;
  }
}

export {};
