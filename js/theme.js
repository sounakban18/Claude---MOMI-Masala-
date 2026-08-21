/* =========================================================
   THEME.JS
   Three modes: "light" | "dark" | "system" (default). Only
   the app CHROME (backgrounds, panels, sheets, buttons that
   aren't brand-coloured) responds to this — see the
   [data-theme="dark"] overrides in style.css. The rate card
   itself (.ratecard, in both the live editor and the export
   render) intentionally ignores theme and always renders in
   its normal MOMI MASALA brand colours, so exported files
   never come out dark/inverted.
   ========================================================= */

const ThemeManager = (() => {
  const STORAGE_KEY = "momiThemePreference"; // "light" | "dark" | "system"
  const mql = window.matchMedia("(prefers-color-scheme: dark)");

  function getPreference() {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
  }

  function effectiveTheme(pref) {
    if (pref === "system") return mql.matches ? "dark" : "light";
    return pref;
  }

  function apply(pref) {
    const effective = effectiveTheme(pref);
    document.documentElement.setAttribute("data-theme", effective);
    document.documentElement.setAttribute("data-theme-pref", pref);
    updateSelectorUI(pref);
  }

  function setPreference(pref) {
    localStorage.setItem(STORAGE_KEY, pref);
    apply(pref);
  }

  function updateSelectorUI(pref) {
    document.querySelectorAll(".theme-option").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.theme === pref);
    });
    const icon = document.getElementById("themeBtnIcon");
    if (!icon) return;
    const effective = effectiveTheme(pref);
    icon.textContent = pref === "system" ? "◐" : effective === "dark" ? "☾" : "☀";
  }

  function init() {
    apply(getPreference());
    // live-update when the OS theme changes, but only while "system" is selected
    mql.addEventListener("change", () => {
      if (getPreference() === "system") apply("system");
    });
  }

  return { init, setPreference, getPreference };
})();

document.addEventListener("DOMContentLoaded", () => {
  ThemeManager.init();

  const themeBtn = document.getElementById("themeBtn");
  const themeMenu = document.getElementById("themeMenu");
  if (!themeBtn || !themeMenu) return;

  themeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    themeMenu.classList.toggle("open");
  });
  document.addEventListener("click", (e) => {
    if (!themeMenu.contains(e.target) && e.target !== themeBtn) themeMenu.classList.remove("open");
  });
  document.querySelectorAll(".theme-option").forEach((btn) => {
    btn.addEventListener("click", () => {
      ThemeManager.setPreference(btn.dataset.theme);
      themeMenu.classList.remove("open");
    });
  });
});
