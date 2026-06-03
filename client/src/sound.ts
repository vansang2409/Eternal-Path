type SoundEffect = "hit" | "levelUp" | "loot" | "skill" | "modalOpen";

const STORAGE_KEY = "soundMuted";
const MASTER_GAIN = 0.08;
const AMBIENT_GAIN = 0.018;

// Ambient drone presets keyed by biome+phase mood. Each preset is a small
// chord (2-3 tones) layered through a slow tremolo.
export type AmbientMood = "townCalm" | "forestDay" | "forestNight" | "deepDark" | "desert" | "snow" | "swamp" | "dungeon";
const AMBIENT_PRESETS: Record<AmbientMood, { tones: number[]; type: OscillatorType; tremoloHz: number }> = {
  townCalm:    { tones: [220, 277, 330], type: "sine",     tremoloHz: 0.18 },
  forestDay:   { tones: [196, 247, 294], type: "triangle", tremoloHz: 0.22 },
  forestNight: { tones: [110, 147, 174], type: "sine",     tremoloHz: 0.12 },
  deepDark:    { tones: [82, 110, 138],  type: "sawtooth", tremoloHz: 0.09 },
  desert:      { tones: [233, 311],      type: "triangle", tremoloHz: 0.16 },
  snow:        { tones: [261, 392, 523], type: "sine",     tremoloHz: 0.14 },
  swamp:       { tones: [98, 130, 165],  type: "sine",     tremoloHz: 0.1 },
  dungeon:     { tones: [73, 98, 110],   type: "sawtooth", tremoloHz: 0.08 }
};

type WebAudioWindow = Window & typeof globalThis & {
  webkitAudioContext?: typeof AudioContext;
};

class SoundManager {
  private context?: AudioContext;
  private muted = localStorage.getItem(STORAGE_KEY) === "true";
  private hasUserGesture = false;
  private ambientNodes: Array<{ osc: OscillatorNode; gain: GainNode; lfo: OscillatorNode; lfoGain: GainNode }> = [];
  private currentMood?: AmbientMood;

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
      this.stopAmbient();
      void this.context?.suspend();
    } else {
      void this.resume();
    }
  }

  setAmbient(mood: AmbientMood | undefined): void {
    if (mood === this.currentMood) return;
    this.currentMood = mood;
    this.stopAmbient();
    if (!mood) return;
    if (this.muted || !this.hasUserGesture) return;
    const context = this.ensureContext();
    if (!context) return;
    const preset = AMBIENT_PRESETS[mood];
    const now = context.currentTime;
    for (const freq of preset.tones) {
      const osc = context.createOscillator();
      const gain = context.createGain();
      osc.type = preset.type;
      osc.frequency.value = freq;
      // Slow tremolo to give the pad some life.
      const lfo = context.createOscillator();
      const lfoGain = context.createGain();
      lfo.frequency.value = preset.tremoloHz;
      lfoGain.gain.value = AMBIENT_GAIN * 0.35;
      lfo.connect(lfoGain);
      lfoGain.connect(gain.gain);
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(AMBIENT_GAIN, now + 1.5);
      osc.connect(gain);
      gain.connect(context.destination);
      osc.start();
      lfo.start();
      this.ambientNodes.push({ osc, gain, lfo, lfoGain });
    }
  }

  private stopAmbient(): void {
    const context = this.context;
    if (!context) {
      this.ambientNodes = [];
      return;
    }
    const now = context.currentTime;
    for (const node of this.ambientNodes) {
      try {
        node.gain.gain.cancelScheduledValues(now);
        node.gain.gain.setValueAtTime(node.gain.gain.value, now);
        node.gain.gain.linearRampToValueAtTime(0, now + 0.6);
        node.osc.stop(now + 0.8);
        node.lfo.stop(now + 0.8);
      } catch (_) { /* ignore */ }
    }
    this.ambientNodes = [];
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
    // Reapply ambient after resume.
    if (this.currentMood && this.ambientNodes.length === 0) {
      const mood = this.currentMood;
      this.currentMood = undefined; // force re-trigger
      this.setAmbient(mood);
    }
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
