# yt-beat-sync

A minimal, dependency-free demo of the three problems you hit the moment you
try to build anything rhythm-critical on top of a YouTube embed:

1. **Game time must follow the player's timeline, not your own clock.**
   `getCurrentTime()` is coarse and freezes while buffering — and that is
   exactly why it has to be the source of truth. Mixing it with your own
   extrapolation makes beats visibly slide.
2. **Autoplay policy is a game-design problem.** An `AudioContext` starts
   suspended; the YouTube player can only play with sound inside a user
   gesture window. On Android, granting the mic can flip the context to
   `'interrupted'`, a state most `state === 'suspended'` checks never catch.
3. **`setInterval(beat, 60000 / bpm)` is not a metronome.** Timers jitter and
   get clamped in background tabs. Sound has to be scheduled ahead on the
   audio clock; visuals have to run on wall time so they survive suspension.

## Run it

Any static file server works:

```bash
npx serve .        # or: python3 -m http.server
```

Paste a YouTube URL, set the BPM and how many seconds of intro the video has
before the beat drops, hit play. Buffer or seek the video — the beat grid
follows the player, because the ball is driven by `BeatClock`, and
`BeatClock` reads the YouTube timeline whenever it is available.

If the embed is blocked (or you leave the video field empty), the same clock
falls back to wall time and the demo keeps running.

## Files

| file | what it is |
|---|---|
| `yt-engine.js` | YouTube IFrame API wrapper: preload-before-gesture, singleton player + `loadVideoById`, failure watchdog |
| `beat-clock.js` | one clock, two sources (YT timeline / wall-clock fallback), pause/resume, intro offset, manual nudge |
| `metronome.js` | Web Audio lookahead scheduler; sound on the audio clock, visuals on wall time; `wake()` for suspended/interrupted |
| `demo.js` / `index.html` | the demo page wiring it together |

No build step, no dependencies. Take what you need.

## In production

This pattern ships in [The Rhyme Game](https://rhymegame.org), a free browser
game where you practice freestyle rhymes on real YouTube beats — the same
clock drives the bouncing ball and the bar-by-bar word drops there.

## License

MIT
