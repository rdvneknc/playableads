import { AD } from '../config.js';

function storeUrl() {
  const ua = navigator.userAgent || '';
  return /iPhone|iPad|iPod/i.test(ua) ? AD.iosStoreUrl : AD.storeUrl;
}

// Opens the store through whichever ad-network bridge is present.
export function openStore() {
  const url = storeUrl();
  try {
    if (window.FbPlayableAd?.onCTAClick) {
      window.FbPlayableAd.onCTAClick();
      return;
    }
    if (window.ExitApi?.exit) {
      window.ExitApi.exit();
      return;
    }
    if (window.mraid?.open) {
      window.mraid.open(url);
      return;
    }
  } catch (err) {
    console.warn('CTA bridge failed, falling back to window.open', err);
  }
  window.open(url, '_blank');
}

// Some networks (e.g. Mintegral) want to know when the playable has finished.
export function notifyGameEnd() {
  try {
    window.gameEnd?.();
  } catch {
    /* optional hooks */
  }
}
