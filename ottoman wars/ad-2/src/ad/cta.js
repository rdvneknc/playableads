import { AD } from '../config.js';

function storeUrl() {
  const ua = navigator.userAgent || '';
  return /iPhone|iPad|iPod|Macintosh/i.test(ua) && 'ontouchend' in document ? AD.iosStoreUrl : AD.storeUrl;
}

let lastOpen = 0;

export function openStore() {
  // Debounce double taps (pointerdown on overlapping hit areas).
  const now = Date.now();
  if (now - lastOpen < 600) return;
  lastOpen = now;

  const url = storeUrl();
  try {
    if (window.FbPlayableAd?.onCTAClick) return void window.FbPlayableAd.onCTAClick(); // Meta
    if (window.ExitApi?.exit) return void window.ExitApi.exit(); // Google Ads
    if (typeof window.install === 'function') return void window.install(); // Mintegral
    if (window.dapi?.openStoreUrl) return void window.dapi.openStoreUrl(); // ironSource
    if (window.mraid?.open) return void window.mraid.open(url); // AppLovin, Unity, Vungle…
  } catch (err) {
    console.warn('CTA bridge failed, falling back to window.open', err);
  }
  window.open(url, '_blank');
}

export function notifyGameEnd() {
  try {
    window.gameEnd?.(); // Mintegral
  } catch {
    /* optional network hooks */
  }
}
