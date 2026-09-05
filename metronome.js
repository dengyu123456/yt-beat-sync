/* metronome.js — Web Audio metronome with a lookahead scheduler.
 *
 * The classic mistake is setInterval(beat, 60000 / bpm): intervals are
 * clamped in background tabs and jitter ±tens of ms, which is unusable for
 * anything rhythm-critical. Instead:
 *
 * - A short-interval timer (40ms) schedules every beat that falls inside a
 *   150ms lookahead window.
 * - SOUND is scheduled on the AudioContext clock (sample-accurate).
 * - VISUALS are driven by wall time via setTimeout aligned to each beat, so
 *   they still fire while the context is suspended/interrupted — the audio
 *   clock freezes in those states and would otherwise starve the metronome.
 *
 * Autoplay policy: an AudioContext starts suspended and can only be resumed
 * inside a user-gesture handler. On Android, granting the mic can flip the
 * context to 'interrupted' — a state that 'state === suspended' checks miss
 * entirely, so notes are scheduled but never heard. wake() covers both.
 */
const Metronome = {
  ctx: null,
  on: false,
  loop: null,
  bpm: 100,
  muted: false,
  beatTimes: [],
  onPulse: null, // (beatTimeSeconds, indexWithinBar) => void

  ensure() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.ctx.onstatechange = () => {
        if (!this.on || !this.ctx || this.ctx.state === 'running') return;
        this.wake();
      };
    }
  },

  /* Resume from 'suspended' AND 'interrupted' alike. */
  wake() {
    if (this.ctx && this.ctx.state !== 'running') {
      try { const p = this.ctx.resume(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* noop */ }
    }
  },

  kick(t) {
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.frequency.setValueAtTime(120, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    o.connect(g).connect(this.ctx.destination);
    o.start(t); o.stop(t + 0.16);
  },

  hat(t) {
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = 'square';
    o.frequency.setValueAtTime(6000, t);
    g.gain.setValueAtTime(0.08, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    o.connect(g).connect(this.ctx.destination);
    o.start(t); o.stop(t + 0.06);
  },

  start(bpm = 100) {
    this.ensure();
    this.wake(); // must be called from a gesture handler chain
    this.stop();
    this.on = true;
    this.bpm = bpm;
    this.beatTimes = [];
    const interval = 60 / bpm;
    const wallNow = () => Date.now() / 1000;
    let next = wallNow() + 0.08, beat = 0;
    this.loop = setInterval(() => {
      while (next < wallNow() + 0.15) {
        const tt = next, idx = beat % 4;
        // Visual pulse aligned to the beat, carrying the index within the bar.
        setTimeout(() => this.onPulse && this.onPulse(tt, idx), Math.max(0, (tt - wallNow()) * 1000));
        this.beatTimes.push(tt);
        if (this.beatTimes.length > 16) this.beatTimes.shift();
        if (!this.muted && this.ctx.state === 'running') {
          const at = this.ctx.currentTime + Math.max(0, tt - wallNow());
          if (beat % 2 === 0) this.kick(at); else this.hat(at);
        }
        next += interval;
        beat++;
      }
    }, 40);
  },

  /* Signed ms between now and the nearest beat — for timing feedback UIs. */
  nearestBeatOffset() {
    if (!this.beatTimes.length) return null;
    const now = Date.now() / 1000;
    let best = null;
    for (const t of this.beatTimes) {
      const d = (now - t) * 1000;
      if (best === null || Math.abs(d) < Math.abs(best)) best = d;
    }
    return best;
  },

  stop() { this.on = false; clearInterval(this.loop); },
};
