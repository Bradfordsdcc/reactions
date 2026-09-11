/* Reaction buttons — student page (sdcc.gd/react)
 *
 * Webflow setup, per button:
 *   data-react="heart"          reaction key, matches REACTIONS in overlay.html
 *
 * Optional elements:
 *   [data-react-status]         gets "live" / "connecting" text
 *   [data-react-timer]          inside a button, gets a countdown while cooling
 *
 * Classes toggled on a button:
 *   .is-reacting     220ms after a successful tap
 *   .is-cooling      while a cooldown is running
 * Also sets the CSS custom property --cooldown (1 → 0) for a bar or ring.
 *
 * Load AFTER the supabase UMD script, before </body>.
 */
(() => {
  'use strict';

  const CONFIG = {
    url: 'https://jtelqybifbiazhmltear.supabase.co',
    key: 'sb_publishable_YS4zJgl-oPOL2GRKvhNqoQ_uD85_ZEO',
    channel: 'sdcc-reactions-v1',

    defaultCooldownMs: 350,

    // Per-reaction overrides. Keys match data-react values.
    cooldowns: {
      holymoly: 30 * 60 * 1000,   // 30 minutes
    },
  };

  const params = new URLSearchParams(location.search);
  const channelName = params.get('room') || CONFIG.channel;
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

  // --- Cooldown state ------------------------------------------------------
  // Long cooldowns persist in localStorage so a refresh doesn't reset them.
  // Honour-system only — anyone with DevTools can clear it. Fine for a class.
  const KEY = 'rx-cooldown-';
  const memUntil = new Map();
  const cooldownFor = (icon) =>
    CONFIG.cooldowns[icon] !== undefined ? CONFIG.cooldowns[icon] : CONFIG.defaultCooldownMs;
  const persists = (icon) => cooldownFor(icon) >= 10000;

  function readUntil(icon) {
    if (!persists(icon)) return memUntil.get(icon) || 0;
    return parseInt(localStorage.getItem(KEY + icon) || '0', 10);
  }
  function writeUntil(icon, t) {
    if (!persists(icon)) memUntil.set(icon, t);
    else { try { localStorage.setItem(KEY + icon, String(t)); } catch (e) {} }
  }

  function fmt(ms) {
    const s = Math.ceil(ms / 1000);
    if (s < 60) return s + 's';
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  }

  function paint(el) {
    const icon = el.getAttribute('data-react');
    const total = cooldownFor(icon);
    const left = readUntil(icon) - Date.now();
    const timerEl = el.querySelector('[data-react-timer]');

    if (left > 0) {
      el.classList.add('is-cooling');
      el.style.setProperty('--cooldown', (left / total).toFixed(3));
      if (timerEl) timerEl.textContent = fmt(left);
    } else {
      el.classList.remove('is-cooling');
      el.style.setProperty('--cooldown', '0');
      if (timerEl) timerEl.textContent = '';
    }
  }

  // --- Buttons -------------------------------------------------------------
  const buttons = [].slice.call(document.querySelectorAll('[data-react]'));

  buttons.forEach((el) => {
    const icon = el.getAttribute('data-react');

    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (Date.now() < readUntil(icon)) { paint(el); return; }
      if (!ready) return;

      writeUntil(icon, Date.now() + cooldownFor(icon));

      channel.send({
        type: 'broadcast',
        event: 'reaction',
        payload: { icon: icon, role: role, ts: Date.now() },
      });

      el.classList.add('is-reacting');
      setTimeout(() => el.classList.remove('is-reacting'), 220);
      if (navigator.vibrate) navigator.vibrate(cooldownFor(icon) > 10000 ? [18, 40, 18] : 12);
      paint(el);
    });

    el.addEventListener('contextmenu', (ev) => ev.preventDefault());
    paint(el);
  });

  // One shared ticker keeps every countdown current.
  setInterval(() => buttons.forEach(paint), 500);

  // Stop double-tap zoom eating rapid taps
  let lastTouch = 0;
  document.addEventListener('touchend', (e) => {
    const now = Date.now();
    if (now - lastTouch < 300) e.preventDefault();
    lastTouch = now;
  }, { passive: false });
})();
