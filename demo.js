/* demo.js — glue: UI → YTEngine + BeatClock + Metronome. */
(() => {
  const $ = (id) => document.getElementById(id);
  const ball = $('ball'), readout = $('readout');

  function extractVideoId(url) {
    const m = String(url).match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
    return m ? m[1] : (/^[A-Za-z0-9_-]{11}$/.test(url.trim()) ? url.trim() : null);
  }

  // Preload the API on the very first interaction so the player can be
  // created synchronously inside the play-click gesture window.
  YTEngine.preload();
  window.addEventListener('pointerdown', () => YTEngine.preload(), { once: true });

  Metronome.onPulse = (_t, idx) => {
    ball.classList.remove('pulsing');
    void ball.offsetWidth; // restart the CSS animation
    ball.classList.add('pulsing');
    ball.dataset.beat = idx;
  };

  let useYT = true;
  let tick = null;

  $('play').onclick = () => {
    const vid = extractVideoId($('vid').value);
    const bpm = Math.min(160, Math.max(60, Number($('bpm').value) || 96));
    const intro = Number($('intro').value) || 0;
    useYT = !!vid;

    Metronome.start(bpm); // inside the click handler: gesture unlocks audio

    BeatClock.start({
      externalTime: useYT ? () => YTEngine.currentTime() : null,
      intro,
    });

    if (useYT) {
      YTEngine.play(vid, 'yt-player', () => {
        // Embed failed (blocked/network): keep going on the wall clock.
        useYT = false;
        BeatClock.start({ externalTime: null, intro });
      });
    }

    clearInterval(tick);
    tick = setInterval(() => {
      const t = BeatClock.time();
      const beat = Math.floor(t / (60 / Metronome.bpm));
      readout.textContent = [
        `clock source : ${useYT && YTEngine.currentTime() != null ? 'youtube timeline' : 'wall clock (fallback)'}`,
        `since drop   : ${t.toFixed(2)}s`,
        `beat / bar   : ${beat % 4} / ${Math.floor(beat / 4) + 1}`,
        `audio state  : ${Metronome.ctx ? Metronome.ctx.state : '—'}`,
      ].join('\n');
    }, 120);
  };

  $('stop').onclick = () => {
    Metronome.stop();
    YTEngine.stop();
    clearInterval(tick);
    readout.textContent = 'stopped';
  };

  $('nudge-l').onclick = () => BeatClock.nudge(-0.25, Metronome.bpm);
  $('nudge-r').onclick = () => BeatClock.nudge(+0.25, Metronome.bpm);

  // Keep the grid honest when the tab comes back from background.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) BeatClock.pause();
    else BeatClock.resume();
  });
})();
