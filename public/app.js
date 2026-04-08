(() => {
  const audio = document.getElementById("bgm-audio");
  const toggle = document.getElementById("bgm-toggle");
  const vol = document.getElementById("bgm-volume");

  if (!audio || !toggle) return;

  const STORAGE_KEY = "animeShop.bgm";
  const SESSION_TIME_KEY = "animeShop.bgmTime";
  const SESSION_PLAYING_KEY = "animeShop.bgmPlaying";

  function setUi(playing) {
    toggle.setAttribute("aria-pressed", playing ? "true" : "false");
    toggle.textContent = playing ? "BGM: On" : "BGM: Off";
  }

  function loadPrefs() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { enabled: false, volume: 0.35 };
      const parsed = JSON.parse(raw);
      return {
        enabled: Boolean(parsed.enabled),
        volume:
          typeof parsed.volume === "number"
            ? Math.min(1, Math.max(0, parsed.volume))
            : 0.35
      };
    } catch {
      return { enabled: false, volume: 0.35 };
    }
  }

  function savePrefs(enabled, volume) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ enabled, volume }));
    } catch {
      // ignore
    }
  }

  const prefs = loadPrefs();
  audio.loop = true;
  audio.volume = prefs.volume;
  if (vol) vol.value = String(Math.round(prefs.volume * 100));

  // Resume across navigation (per-tab) so it doesn't restart on every page.
  try {
    const savedTime = Number(sessionStorage.getItem(SESSION_TIME_KEY));
    if (Number.isFinite(savedTime) && savedTime > 0) {
      audio.currentTime = savedTime;
    }
  } catch {
    // ignore
  }

  function persistTime() {
    try {
      if (!Number.isFinite(audio.currentTime)) return;
      sessionStorage.setItem(SESSION_TIME_KEY, String(audio.currentTime));
      sessionStorage.setItem(SESSION_PLAYING_KEY, audio.paused ? "0" : "1");
    } catch {
      // ignore
    }
  }

  const persistInterval = window.setInterval(persistTime, 1000);
  window.addEventListener("beforeunload", persistTime);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") persistTime();
  });
  audio.addEventListener("timeupdate", () => {
    // Keep it light: the interval does most of the work, this catches quick nav.
  });
  audio.addEventListener("ended", persistTime);

  // Autoplay is usually blocked; we only attempt play when user chose "On" before.
  setUi(false);
  const wasPlaying = sessionStorage.getItem(SESSION_PLAYING_KEY) === "1";
  if (prefs.enabled || wasPlaying) {
    audio.play().then(
      () => setUi(true),
      () => setUi(false)
    );
  }

  toggle.addEventListener("click", async () => {
    const isPlaying = !audio.paused;
    if (isPlaying) {
      audio.pause();
      setUi(false);
      savePrefs(false, audio.volume);
      return;
    }

    try {
      await audio.play();
      setUi(true);
      savePrefs(true, audio.volume);
    } catch {
      setUi(false);
    }
  });

  if (vol) {
    vol.addEventListener("input", () => {
      const v = Number(vol.value);
      if (!Number.isFinite(v)) return;
      const volume = Math.min(1, Math.max(0, v / 100));
      audio.volume = volume;
      savePrefs(!audio.paused, volume);
    });
  }

  window.addEventListener("pagehide", () => {
    persistTime();
    window.clearInterval(persistInterval);
  });
})();