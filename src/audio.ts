/**
 * Tiny procedural sound engine (Web Audio). Every effect is synthesised on the
 * fly — no asset files, no downloads, nothing to cache. The context is created
 * lazily on the first user gesture, as browsers require.
 */
export class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  muted = false;

  /** Must be called from a user gesture (Play click). */
  resume(): void {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.35;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.35;
    return this.muted;
  }

  private noiseBurst(freq: number, dur: number, volume = 1): void {
    if (!this.ctx || !this.master || this.muted) return;
    const t = this.ctx.currentTime;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = freq;
    filter.Q.value = 0.9;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.5 * volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter).connect(gain).connect(this.master);
    src.start(t);
  }

  private tone(type: OscillatorType, from: number, to: number, dur: number, volume = 0.6): void {
    if (!this.ctx || !this.master || this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t + dur);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain).connect(this.master);
    osc.start(t);
    osc.stop(t + dur);
  }

  breakBlock(sound: string): void {
    const freq = sound === "stone" ? 1900 : sound === "wood" ? 1300 : sound === "sand" ? 520 : 780;
    this.noiseBurst(freq, 0.16, 1);
  }

  place(): void {
    this.tone("triangle", 190, 120, 0.09, 0.5);
    this.noiseBurst(900, 0.05, 0.4);
  }

  pop(): void {
    this.tone("sine", 380, 640, 0.09, 0.35);
  }

  step(): void {
    this.noiseBurst(480, 0.05, 0.35);
  }

  hurt(): void {
    this.tone("sawtooth", 320, 140, 0.22, 0.5);
  }

  mobHit(): void {
    this.tone("square", 420, 260, 0.07, 0.4);
  }

  mobDeath(): void {
    this.tone("square", 220, 70, 0.25, 0.5);
    this.noiseBurst(700, 0.15, 0.6);
  }

  jump(): void {
    this.tone("sine", 300, 430, 0.08, 0.2);
  }
}
