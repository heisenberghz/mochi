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

export type { CosmeticId } from './constants';
import type { CosmeticId } from './constants';

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
  /** What the player has put on the pet, one cosmetic per slot. */
  equipped: CosmeticId[];
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
  /** Toast and sound go quiet between these hours, when enabled. */
  quietHoursEnabled: boolean;
  /** Minutes past midnight. `start` may be later than `end`, meaning overnight. */
  quietStartMin: number;
  quietEndMin: number;
  /** Best effort: hide the pet while an exclusive-fullscreen app has the screen. */
  hideInFullscreen: boolean;
  /** The three global hotkeys (pet, focus, Den), as one switch. */
  globalHotkeys: boolean;
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

/** One range (a week or a month) of focus history. */
export interface InsightsRange {
  /** Total time actually focused, in milliseconds. */
  focusedMs: number;
  /** Finished work blocks in the range. */
  blocks: number;
  /** Finished breaks in the range. */
  breaks: number;
  /** Days with at least some focus. */
  activeDays: number;
  /** The best day in the range, and how much was focused on it. */
  bestDay: { dayKey: string; focusedMs: number } | null;
  /** Focus minutes per day in the range, oldest first, zeros for quiet days. */
  days: Array<{ dayKey: string; focusedMs: number }>;
}

export interface InsightsView {
  week: InsightsRange;
  month: InsightsRange;
  /** Consecutive days with a finished block, up to today. */
  streakDays: number;
  /** The longest run of consecutive block-days ever recorded. */
  longestStreakDays: number;
  /** The last eight sessions, newest first. */
  recent: Array<{ dayKey: string; phase: FocusPhase; focusedMs: number; completed: boolean }>;
  /** True when there is nothing to show yet, so the Den can be honest about it. */
  empty: boolean;
}

export interface AppSnapshot {
  pet: PetView;
  focus: FocusView;
  settings: Settings;
  welcome: boolean;
  /** Set once, when saved data could not be used as-is. */
  recovery: RecoveryNotice | null;
  /** Global hotkeys that failed to register, with the accelerator shown. */
  hotkeyConflicts: string[];
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
  /** Toggle a cosmetic on the pet. Only an unlocked one is accepted. */
  equip(id: string): Promise<OkResult>;
  updateFocusConfig(patch: Partial<FocusConfig>): Promise<FocusConfigResult>;
  updateSettings(patch: Partial<Settings>): Promise<SettingsResult>;
  setPetVisible(visible: boolean): Promise<OkResult>;
  /** Listen for a sound the main process asks the pet to play. */
  onSound(cb: (sound: { kind: 'chime' }) => void): () => void;
  /** The Insights tab's numbers, worked out from the saved history. */
  getInsights(): Promise<InsightsView>;
  /** The exact payload an export would write, as pretty JSON. */
  getExportPayload(): Promise<string>;
  /** Ask for a path, then write the export there. */
  exportData(): Promise<OkResult & { path?: string }>;
  /** Erase everything. The Den asks for confirmation before calling this. */
  resetData(): Promise<OkResult>;
  /** Move Mochi to the screen the cursor is on. */
  bringHere(): Promise<OkResult>;
}

declare global {
  interface Window {
    mochi: MochiApi;
  }
}

export {};
