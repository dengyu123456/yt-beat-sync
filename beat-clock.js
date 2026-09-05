/* beat-clock.js — one clock, two sources.
 *
 * When a YouTube embed is the "real" audio, game time must follow the
 * player's timeline (so buffering and seeks stay honest). When the embed is
 * blocked or unavailable, the same clock silently falls back to wall time so
 * the metronome never starves.
 *
 * Subtleties baked in:
 * - getCurrentTime() is coarse and freezes during buffering; that is FINE,
 *   because it is the source of truth. What you must not do is mix it with
 *   your own extrapolation — the two drift apart and beats visibly slide.
 * - `intro` shifts t=0 to the moment the beat actually drops, so callers can
 *   reason in "seconds since the drop" regardless of the video's lead-in.
 * - Before the clock starts, time() returns 0 rather than a Unix epoch —
 *   a classic NaN/epoch bug when UI reads the clock too early.
 */
const BeatClock = {
  useExternal: false,
  externalTime: null, // () => seconds | null  (e.g. YTEngine.currentTime)
  wallStart: 0,
  base: 0,
  intro: 0,
  pausedAccum: 0,
  pauseStart: null,
  _frozen: 0,

  start({ externalTime = null, intro = 0 } = {}) {
    this.externalTime = externalTime;
    this.useExternal = !!externalTime;
    this.intro = Math.max(0, Number(intro) || 0);
    this.pausedAccum = 0;
    this.pauseStart = null;
    this.base = 0;
    this.wallStart = this.useExternal ? 0 : Date.now() / 1000;
  },

  /* Seconds since the drop. */
  time() {
    if (this.pauseStart) return this._frozen;
    if (this.useExternal) {
      const t = this.externalTime && this.externalTime();
      if (t != null) return Math.max(0, t - this.intro);
      // External clock missing: fall back to wall time from this moment on.
      if (!this.wallStart) this.wallStart = Date.now() / 1000;
    }
    if (!this.wallStart) return 0; // not started yet — do not return an epoch
    return Date.now() / 1000 - this.wallStart - this.pausedAccum + this.base;
  },

  pause() {
    if (this.pauseStart) return;
    this.pauseStart = Date.now();
    this._frozen = this.time();
  },

  resume() {
    if (!this.pauseStart) return;
    this.pausedAccum += (Date.now() - this.pauseStart) / 1000;
    this.pauseStart = null;
  },

  /* Manual alignment, in beats (useful for user-provided audio where the
   * intro is unknown). Positive = shift the beat grid later. */
  nudge(beatsDelta, bpm) {
    this.base += beatsDelta * (60 / bpm);
  },
};
