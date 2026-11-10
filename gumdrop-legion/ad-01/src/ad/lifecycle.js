// Ad container lifecycle: wait for MRAID ready + viewable, pause when hidden.
// Works standalone in a normal browser (no mraid → starts right away).

export function startWhenReady(start) {
  let started = false;
  const go = () => {
    if (started) return;
    started = true;
    start();
  };

  const m = window.mraid;
  if (!m) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go, { once: true });
    else go();
    return;
  }

  const whenViewable = () => {
    try {
      if (m.isViewable()) {
        go();
        return;
      }
      const onView = (viewable) => {
        if (!viewable) return;
        m.removeEventListener('viewableChange', onView);
        go();
      };
      m.addEventListener('viewableChange', onView);
    } catch {
      go();
    }
  };

  try {
    if (m.getState() === 'loading') m.addEventListener('ready', whenViewable);
    else whenViewable();
  } catch {
    go();
  }
}

// cb(paused: boolean) — fires when the ad is hidden / shown again.
export function onPauseChange(cb) {
  document.addEventListener('visibilitychange', () => cb(document.hidden));
  const m = window.mraid;
  if (!m) return;
  try {
    m.addEventListener('viewableChange', (viewable) => cb(!viewable));
  } catch {
    /* container without events */
  }
}

// cb(muted: boolean) — MRAID 3 volume signal, when the container supports it.
export function onVolumeChange(cb) {
  const m = window.mraid;
  if (!m) return;
  try {
    m.addEventListener('audioVolumeChange', (pct) => cb(pct === 0));
  } catch {
    /* MRAID < 3 */
  }
}

export function notifyGameReady() {
  try {
    window.gameReady?.(); // Mintegral
  } catch {
    /* optional */
  }
}
