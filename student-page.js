/* Reaction buttons — student page (sdcc.gd/react)
 *
 * Webflow setup: give each button an attribute  data-react="heart" | "clap" | "fire"
 * Anything with that attribute becomes a reaction button. Style it however you like
 * in Webflow — this file only handles behaviour.
 *
 * Optional: an element with  data-react-status  gets "live" / "offline" text.
 *
 * Load AFTER the supabase UMD script, before </body>.
 */
(() => {
  'use strict';

  const CONFIG = {
    url: 'https://jtelqybifbiazhmltear.supabase.co',
    key: 'sb_publishable_YS4zJgl-oPOL2GRKvhNqoQ_uD85_ZEO',
    channel: 'sdcc-reactions-v1',
    cooldownMs: 350,        // per-button, prevents one phone flooding the wire
  };

  const params = new URLSearchParams(location.search);
  const channelName = params.get('room') || CONFIG.channel;   // unused for now; see notes
  const role = document.body.hasAttribute('data-react-host') ? 'host' : 'student';

  const statusEl = document.querySelector('[data-react-status]');
  const setStatus = (t) => { if (statusEl) statusEl.textContent = t; };

  if (!window.supabase) {
    console.error('[react] supabase-js not loaded');
    setStatus('unavailable');
    return;
  }

  const client = window.supabase.createClient(CONFIG.url, CONFIG.key);
  const channel = client.channel(channelName, {
    config: { broadcast: { self: false, ack: false } },
  });

  let ready = false;

  channel.subscribe((status) => {
    ready = status === 'SUBSCRIBED';
    setStatus(ready ? 'live' : 'connecting');
    console.log('[react] channel:', status);
  });

  const lastSent = new Map();

  function send(icon) {
    const now = Date.now();
    if (now - (lastSent.get(icon) || 0) < CONFIG.cooldownMs) return false;
    lastSent.set(icon, now);

    if (!ready) return false;

    channel.send({
      type: 'broadcast',
      event: 'reaction',
      payload: { icon, role, ts: now },
    });
    return true;
  }

  // --- Wire up the buttons --------------------------------------------------
  document.querySelectorAll('[data-react]').forEach((el) => {
    const icon = el.getAttribute('data-react');

    const fire = (e) => {
      e.preventDefault();
      if (!send(icon)) return;

      // Local feedback so a tap always feels like it did something,
      // even though the student can't see the projected overlay.
      el.classList.add('is-reacting');
      setTimeout(() => el.classList.remove('is-reacting'), 220);
      if (navigator.vibrate) navigator.vibrate(12);
    };

    // pointerdown fires ~100ms sooner than click on touch devices
    el.addEventListener('pointerdown', fire);
    el.addEventListener('contextmenu', (e) => e.preventDefault());  // no long-press menu
  });

  // Stop double-tap zoom from eating rapid taps
  let lastTouch = 0;
  document.addEventListener('touchend', (e) => {
    const now = Date.now();
    if (now - lastTouch < 300) e.preventDefault();
    lastTouch = now;
  }, { passive: false });
})();
