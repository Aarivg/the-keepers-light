// All audio is synthesized with the Web Audio API rather than loaded from
// sound files — there are no real footstep/wind recordings to ship yet, and
// procedural noise gets the placeholder feel across without binary assets.
// Swap `_playFootstep` / `_startWind` for real buffered samples in a later
// pass without touching call sites (`footstep()` / `setListenerMood()`).

export class AudioManager {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.windGain = null;
    this._started = false;
  }

  /** Must be called after a user gesture (browsers block audio otherwise). */
  start() {
    if (this._started) return;
    this._started = true;

    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.55;
    this.master.connect(this.ctx.destination);

    this._noiseBuffer = this._createNoiseBuffer();
    this._startWind();
  }

  suspend() {
    this.ctx?.suspend();
  }

  resume() {
    this.ctx?.resume();
  }

  _createNoiseBuffer() {
    const length = this.ctx.sampleRate * 1; // 1s of white noise, reused/looped
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  /** speedRatio in [0,1] roughly walk..sprint; used to vary pitch/volume slightly. */
  footstep(speedRatio = 0.5) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;

    const source = this.ctx.createBufferSource();
    source.buffer = this._noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 220 + Math.random() * 60;
    filter.Q.value = 0.9;

    const gain = this.ctx.createGain();
    const peak = 0.18 + speedRatio * 0.12;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(peak, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);

    source.start(t);
    source.stop(t + 0.12);
  }

  /** A few seconds of filtered, crackling noise standing in for the radio's last recording. */
  playRadioStatic(durationSec = 3.2) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;

    const source = this.ctx.createBufferSource();
    source.buffer = this._noiseBuffer;
    source.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1400;
    filter.Q.value = 0.5;

    // Fast, irregular gain flutter reads as radio crackle rather than a
    // clean tone — two LFOs at unrelated rates beat against each other.
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(0.22, t + 0.15);
    gain.gain.setValueAtTime(0.22, t + durationSec - 0.3);
    gain.gain.linearRampToValueAtTime(0.0001, t + durationSec);

    const crackleA = this.ctx.createOscillator();
    crackleA.frequency.value = 11;
    const crackleAGain = this.ctx.createGain();
    crackleAGain.gain.value = 0.08;
    const crackleB = this.ctx.createOscillator();
    crackleB.frequency.value = 17;
    const crackleBGain = this.ctx.createGain();
    crackleBGain.gain.value = 0.06;

    crackleA.connect(crackleAGain);
    crackleB.connect(crackleBGain);
    crackleAGain.connect(gain.gain);
    crackleBGain.connect(gain.gain);
    crackleA.start(t);
    crackleB.start(t);
    crackleA.stop(t + durationSec);
    crackleB.stop(t + durationSec);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);

    source.start(t);
    source.stop(t + durationSec);
  }

  _startWind() {
    // Low, unsettling wind drone: filtered looping noise with a slow LFO on
    // the filter cutoff so it breathes rather than sitting static.
    const source = this.ctx.createBufferSource();
    source.buffer = this._noiseBuffer;
    source.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 340;
    filter.Q.value = 0.6;

    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 140;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    lfo.start();

    this.windGain = this.ctx.createGain();
    this.windGain.gain.value = 0.12;

    source.connect(filter);
    filter.connect(this.windGain);
    this.windGain.connect(this.master);
    source.start();
  }

  /** Extension point: Phase 2/3 can duck ambient wind under dialogue, etc. */
  setAmbientVolume(v) {
    if (this.windGain) this.windGain.gain.value = v;
  }
}
