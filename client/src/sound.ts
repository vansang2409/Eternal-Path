type SoundEffect = "hit" | "levelUp" | "loot" | "skill" | "modalOpen";

const STORAGE_KEY = "soundMuted";
const MASTER_GAIN = 0.08;

type WebAudioWindow = Window & typeof globalThis & {
  webkitAudioContext?: typeof AudioContext;
};

class SoundManager {
  private context?: AudioContext;
  private muted = localStorage.getItem(STORAGE_KEY) === "true";
  private hasUserGesture = false;

  constructor() {
    const unlock = () => {
      this.hasUserGesture = true;
      void this.resume();
    };
    window.addEventListener("pointerdown", unlock, { once: true, capture: true });
    window.addEventListener("keydown", unlock, { once: true, capture: true });
  }

  isMuted(): boolean {
    return this.muted;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    localStorage.setItem(STORAGE_KEY, String(muted));
    if (muted) {
      void this.context?.suspend();
    } else {
      void this.resume();
    }
  }

  toggleMuted(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  markUserGesture(): void {
    this.hasUserGesture = true;
    void this.resume();
  }

  play(effect: SoundEffect): void {
    if (this.muted || !this.hasUserGesture) return;
    const context = this.ensureContext();
    if (!context) return;
    if (context.state === "suspended") void context.resume();

    if (effect === "hit") this.playHit(context);
    if (effect === "levelUp") this.playLevelUp(context);
    if (effect === "loot") this.playLoot(context);
    if (effect === "skill") this.playSkill(context);
    if (effect === "modalOpen") this.playModalOpen(context);
  }

  private ensureContext(): AudioContext | undefined {
    if (this.context) return this.context;
    const AudioContextCtor = window.AudioContext ?? (window as WebAudioWindow).webkitAudioContext;
    if (!AudioContextCtor) return undefined;
    this.context = new AudioContextCtor();
    if (this.muted) void this.context.suspend();
    return this.context;
  }

  private async resume(): Promise<void> {
    if (this.muted || !this.hasUserGesture) return;
    const context = this.ensureContext();
    if (context?.state === "suspended") await context.resume();
  }

  private playHit(context: AudioContext): void {
    this.tone(context, 180, 0, 0.075, "square", 0.75);
    this.tone(context, 115, 0.035, 0.08, "triangle", 0.5);
  }

  private playLevelUp(context: AudioContext): void {
    this.tone(context, 392, 0, 0.16, "sine", 0.45, 523);
    this.tone(context, 494, 0.035, 0.17, "sine", 0.38, 659);
    this.tone(context, 659, 0.07, 0.18, "sine", 0.34, 784);
  }

  private playLoot(context: AudioContext): void {
    this.tone(context, 880, 0, 0.11, "sine", 0.44);
    this.tone(context, 1320, 0.055, 0.12, "triangle", 0.28);
  }

  private playSkill(context: AudioContext): void {
    this.tone(context, 260, 0, 0.06, "sawtooth", 0.42, 360);
    this.tone(context, 520, 0.03, 0.11, "triangle", 0.32, 420);
  }

  private playModalOpen(context: AudioContext): void {
    this.tone(context, 660, 0, 0.14, "sine", 0.25);
    this.tone(context, 990, 0.025, 0.15, "sine", 0.18);
  }

  private tone(
    context: AudioContext,
    frequency: number,
    delaySeconds: number,
    durationSeconds: number,
    type: OscillatorType,
    volume: number,
    endFrequency = frequency
  ): void {
    const start = context.currentTime + delaySeconds;
    const end = start + durationSeconds;
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), end);

    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(MASTER_GAIN * volume, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(start);
    oscillator.stop(end + 0.02);
  }
}

export const soundManager = new SoundManager();
