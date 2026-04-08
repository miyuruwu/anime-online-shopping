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

  // --- Seamless navigation (PJAX) ---
  const MAIN_SELECTOR = "main";

  function sameOrigin(url) {
    return url.origin === window.location.origin;
  }

  function shouldHandle(url) {
    if (!sameOrigin(url)) return false;
    if (url.pathname === "/shop") return true;
    if (url.pathname.startsWith("/shop/c/")) return true;
    if (url.pathname.startsWith("/shop/p/")) return true;
    return false;
  }

  async function fetchAndSwap(url, { push = true } = {}) {
    try {
      const res = await fetch(url, {
        headers: { "X-Requested-With": "fetch" }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const html = await res.text();
      const doc = new DOMParser().parseFromString(html, "text/html");
      const newMain = doc.querySelector(MAIN_SELECTOR);
      const curMain = document.querySelector(MAIN_SELECTOR);
      if (!newMain || !curMain) throw new Error("Missing main element");

      curMain.replaceWith(newMain);
      document.title = doc.title || document.title;

      // Update active nav link state
      const navLinks = document.querySelectorAll(".nav .nav-link");
      navLinks.forEach((link) => {
        const href = link.getAttribute("href") || "";
        const active = href && window.location.pathname.startsWith(href);
        link.classList.toggle("active", Boolean(active));
      });

      if (push) {
        window.history.pushState({ url }, "", url);
      }

      window.scrollTo({ top: 0, behavior: "instant" });
    } catch (err) {
      // Fallback to full navigation if anything fails
      window.location.href = url;
    }
  }

  document.addEventListener("click", (event) => {
    const link = event.target.closest("a");
    if (!link) return;
    if (link.target && link.target !== "_self") return;
    if (link.hasAttribute("download")) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    const href = link.getAttribute("href");
    if (!href || href.startsWith("#")) return;

    const url = new URL(href, window.location.href);
    if (!shouldHandle(url)) return;

    event.preventDefault();
    fetchAndSwap(url.toString(), { push: true });
  });

  window.addEventListener("popstate", (event) => {
    const url = (event.state && event.state.url) || window.location.href;
    fetchAndSwap(url, { push: false });
  });
})();