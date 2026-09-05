/* yt-engine.js — thin wrapper around the YouTube IFrame Player API.
 *
 * Hard-won details:
 * - The API script must be preloaded BEFORE the user clicks play. Creating a
 *   player costs a network round-trip; if you start loading the API inside the
 *   click handler, the player is created after the gesture window closes and
 *   mobile browsers block autoplay with sound.
 * - Reuse one player instance and switch videos with loadVideoById(). Repeated
 *   destroy()/new YT.Player() cycles leak iframes and eventually throw.
 * - loadVideoById() does not fire onReady, so call playVideo() manually after
 *   a short delay.
 * - A watchdog covers the "player never becomes ready / stays unstarted" case
 *   (blocked embeds, network filters) so callers can fall back gracefully.
 */
const YTEngine = {
  player: null,
  ready: false,
  pending: null,
  watchdog: null,

  loadApi() {
    if (window.YT && window.YT.Player) {
      this.ready = true;
      if (this.pending) { const p = this.pending; this.pending = null; p(); }
      return;
    }
    if (document.getElementById('yt-api')) return;
    const tag = document.createElement('script');
    tag.id = 'yt-api';
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);
    window.onYouTubeIframeAPIReady = () => {
      this.ready = true;
      if (this.pending) { const p = this.pending; this.pending = null; p(); }
    };
  },

  /* Call this on page load (or on first pointerdown) — NOT inside the play
   * click handler. See the module comment for why. */
  preload() { this.loadApi(); },

  play(videoId, containerId, onFallback, startSeconds = 0) {
    this.loadApi();
    if (this.watchdog) { clearTimeout(this.watchdog); this.watchdog = null; }
    const fallback = () => { if (onFallback) onFallback(); };
    const startAt = Math.max(0, Math.floor(Number(startSeconds) || 0));

    // 12s watchdog: only fall back on a definite failure (unstarted/cued).
    this.watchdog = setTimeout(() => {
      let st = null;
      if (this.player) { try { st = this.player.getPlayerState(); } catch (e) { /* noop */ } }
      if (!this.player || st === -1 || st === 5) fallback();
    }, 12000);

    const createNew = () => {
      const host = document.getElementById(containerId);
      if (!host) { fallback(); return; }
      host.innerHTML = '';
      this.player = new YT.Player(host, {
        videoId,
        playerVars: { start: startAt, rel: 0, modestbranding: 1, playsinline: 1, controls: 1 },
        events: {
          onReady: () => { try { this.player && this.player.playVideo && this.player.playVideo(); } catch (e) { /* noop */ } },
          onError: () => { fallback(); },
        },
      });
    };

    const useExisting = () => {
      try {
        this.player.loadVideoById(videoId, startAt);
        // loadVideoById does not fire onReady — play manually.
        setTimeout(() => { try { this.player && this.player.playVideo && this.player.playVideo(); } catch (e) { /* noop */ } }, 500);
      } catch (e) {
        createNew();
      }
    };

    const start = () => { if (this.player) useExisting(); else createNew(); };
    if (window.YT && window.YT.Player) start();
    else this.pending = start;
  },

  /* Seconds on the YouTube timeline, or null when no player is usable. */
  currentTime() {
    if (this.player && this.player.getCurrentTime) {
      try { return this.player.getCurrentTime(); } catch (e) { /* fallthrough */ }
    }
    return null;
  },

  stop() {
    if (this.watchdog) { clearTimeout(this.watchdog); this.watchdog = null; }
    if (this.player) { try { this.player.stopVideo(); this.player.destroy(); } catch (e) { /* noop */ } this.player = null; }
  },
};
