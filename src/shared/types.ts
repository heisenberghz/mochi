export type Behavior =
  | 'idle'
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
}

export interface FocusConfig {
  workMin: number;
  shortBreakMin: number;
  longBreakMin: number;
  rounds: number;
  autoStartBreak: boolean;
  autoStartWork: boolean;
}

export interface FocusView {
  status: FocusStatus;
  phase: FocusPhase;
  remainingMs: number;
  phaseDurationMs: number;
  round: number;
  totalRounds: number;
  completedToday: number;
  config: FocusConfig;
}

export type ReducedMotion = 'system' | 'on' | 'off';

export interface Settings {
  petName: string;
  roam: boolean;
  reducedMotion: ReducedMotion;
  sound: boolean;
  launchAtLogin: boolean;
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
  id: 'start-focus' | 'dismiss';
  label: string;
}

export interface BubbleSpec {
  id: string;
  text: string;
  action?: BubbleAction;
  durationMs: number;
}

export type FocusAction = 'start' | 'pause' | 'resume' | 'stop';

export interface OkResult {
  ok: boolean;
  error?: string;
}

export interface SettingsResult extends OkResult {
  settings: Settings;
}

export interface MochiApi {
  readonly v: 1;
  bootstrap(): Promise<AppSnapshot>;
  onState(cb: (snapshot: AppSnapshot) => void): () => void;
  onBubble(cb: (bubble: BubbleSpec) => void): () => void;
  setInteractive(interactive: boolean): Promise<OkResult>;
  poke(): Promise<OkResult>;
  dragStart(cursor: Point): Promise<OkResult>;
  dragEnd(cursor: Point): Promise<OkResult>;
  contextMenu(cursor: Point): Promise<OkResult>;
  openDen(): Promise<OkResult>;
  openDataFolder(): Promise<OkResult>;
  focus(action: FocusAction): Promise<OkResult>;
  updateSettings(patch: Partial<Settings>): Promise<SettingsResult>;
  setPetVisible(visible: boolean): Promise<OkResult>;
}

declare global {
  interface Window {
    mochi: MochiApi;
  }
}

export {};
