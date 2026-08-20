/* =========================================================
   THEME.JS
   Three-mode theme system: AUTO (follow prefers-color-scheme),
   LIGHT, DARK. The user's manual choice persists in
   localStorage; AUTO listens to the OS-level media query and
   reacts live.

   Implementation notes:
   - The resolved theme (light or dark) is exposed on
     <html data-theme="..."> so CSS can target both modes.
   - The user-chosen mode (auto | light | dark) is exposed on
     <html data-theme-mode="..."> for the segmented-control
     active state.
   ========================================================= */

const ThemeManager = (() => {
  const STORAGE_KEY = "momi-masala-theme-mode";
  const VALID = new Set(["auto", "light", "dark"]);
  const mq = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;

  let currentMode = "auto";     // what the user picked
  let currentResolved = "light"; // the actually-applied mode

  function readStored() {
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      return VALID.has(v) ? v : "auto";
    } catch (_) {
      return "auto";
    }
  }

  function persist(mode) {
    try { localStorage.setItem(STORAGE_KEY, mode); } catch (_) {}
  }

  function resolveMode(mode) {
    if (mode === "light" || mode === "dark") return mode;
    return (mq && mq.matches) ? "dark" : "light";
  }

  function apply() {
    currentResolved = resolveMode(currentMode);
    const html = document.documentElement;
    html.setAttribute("data-theme", currentResolved);
    html.setAttribute("data-theme-mode", currentMode);
  }

  function set(mode) {
    if (!VALID.has(mode)) mode = "auto";
    currentMode = mode;
    persist(mode);
    apply();
    // notify any UI listeners (the segmented control updates active state)
    document.dispatchEvent(new CustomEvent("themechange", {
      detail: { mode: currentMode, resolved: currentResolved },
    }));
  }

  function getMode() { return currentMode; }
  function getResolved() { return currentResolved; }

  function init() {
    currentMode = readStored();
    apply();
    if (mq && typeof mq.addEventListener === "function") {
      mq.addEventListener("change", () => {
        if (currentMode === "auto") apply();
      });
    }
  }

  return { init, set, getMode, getResolved };
})();

window.ThemeManager = ThemeManager;
