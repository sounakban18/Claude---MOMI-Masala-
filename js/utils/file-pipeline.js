/* =========================================================
   FILE-PIPELINE.JS
   Two completely separate delivery paths — this file is the
   fix for "Save behaves like Share":

   - saveToDevice(): used by SAVE. Only ever tries to put a
     real file onto the device (download). It NEVER calls
     navigator.share() under any circumstance.
   - shareOnly(): used by SHARE. Only ever opens the native
     share sheet. It NEVER falls back to a download.

   ROOT CAUSE OF "Save became Share":
   The previous single `deliver()` function tried the Web
   Share API FIRST for every Save action, before ever
   attempting a real download. On any device where
   navigator.share happens to be available (most real Android
   phones and iPhones), tapping "Save as PNG" therefore just
   opened the native share sheet instead of downloading a file
   — which is exactly the bug being reported. Save and Share
   are now two independent functions with no shared fallback
   logic between them.

   ROOT CAUSE OF THE EARLIER MOBILE DOWNLOAD FAILURE (kept
   fixed here): a plain `<a download>` click on a blob: URL is
   not reliably handled by every Android WebView (no
   DownloadListener wired up for client-generated blobs), so
   saveToDevice() still needs its own fallback chain — just
   one that never involves the share sheet:
     1. Validate the blob has real content.
     2. Anchor + blob URL download.
     3. Open the blob in a new tab (system browser / long-press
        save can take over there).
     4. Last resort: same thing with a data: URI, since some
        locked-down WebViews block blob: navigation but still
        allow data: URIs.
   ========================================================= */

const FilePipeline = (() => {
  function detectEnv() {
    const ua = navigator.userAgent || "";
    const isIOS = /iP(hone|od|ad)/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const isAndroid = /Android/.test(ua);
    // Chromium WebViews (incl. WebIntoApp) typically carry a "; wv)" token
    // in the UA string that a normal mobile browser tab does not.
    const isAndroidWebView = isAndroid && /;\s?wv\)/.test(ua);
    const isMobile = isIOS || isAndroid || /Mobi/.test(ua);
    return { isIOS, isAndroid, isAndroidWebView, isMobile, ua };
  }

  function validateBlob(blob, label) {
    if (!blob) throw new Error(`${label}: blob creation returned nothing`);
    if (blob.size === 0) throw new Error(`${label}: blob has 0 bytes — generation likely failed`);
    return blob;
  }

  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  function anchorDownload(blob, filename) {
    return new Promise((resolve, reject) => {
      try {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.rel = "noopener";
        a.style.display = "none";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        // Do not revoke immediately — some browsers read the blob
        // asynchronously after the click event returns.
        setTimeout(() => URL.revokeObjectURL(url), 10000);
        resolve();
      } catch (err) {
        reject(err);
      }
    });
  }

  function openInNewTab(blob) {
    const url = URL.createObjectURL(blob);
    const win = window.open(url, "_blank");
    if (!win) { URL.revokeObjectURL(url); throw new Error("popup blocked"); }
    setTimeout(() => URL.revokeObjectURL(url), 15000);
  }

  async function openDataUrlInNewTab(blob) {
    const dataUrl = await blobToDataUrl(blob);
    const win = window.open(dataUrl, "_blank");
    if (!win) throw new Error("popup blocked for data URI fallback");
  }

  /**
   * SAVE path only. Attempts, in order: anchor download -> new-tab
   * blob -> new-tab data URI. Never touches navigator.share. Returns
   * { method } describing what actually happened, or throws if every
   * strategy failed.
   */
  async function saveToDevice(blob, mime, filename) {
    validateBlob(blob, filename);
    const env = detectEnv();
    console.info("[FilePipeline] saveToDevice", { filename, mime, size: blob.size, env });

    try {
      await anchorDownload(blob, filename);
      console.info("[FilePipeline] download initiated via <a download>");
      return { method: "download" };
    } catch (err) {
      console.warn("[FilePipeline] anchor download failed, falling back:", err);
    }

    try {
      openInNewTab(blob);
      console.info("[FilePipeline] opened in new tab (blob: URL)");
      return { method: "newtab" };
    } catch (err) {
      console.warn("[FilePipeline] new-tab blob open failed, falling back:", err);
    }

    try {
      await openDataUrlInNewTab(blob);
      console.info("[FilePipeline] opened in new tab (data: URI)");
      return { method: "newtab-datauri" };
    } catch (err) {
      console.error("[FilePipeline] all save strategies failed:", err);
      throw new Error("All save strategies failed");
    }
  }

  /** SHARE path only. Opens the native share sheet with a real File.
      Never falls back to a download — if sharing truly isn't available,
      the caller should tell the user to use Save instead. */
  async function shareOnly(blob, mime, filename, { title, text } = {}) {
    validateBlob(blob, filename);
    const file = new File([blob], filename, { type: mime });
    console.info("[FilePipeline] shareOnly", { filename, mime, size: blob.size });

    if (!navigator.share) throw Object.assign(new Error("Web Share API not available"), { code: "UNSUPPORTED" });

    // canShare() itself can throw on some WebView builds — treat that the
    // same as "can't share files" rather than letting it crash the caller.
    let canShareFiles = false;
    try {
      canShareFiles = !navigator.canShare || navigator.canShare({ files: [file] });
    } catch (err) {
      console.warn("[FilePipeline] canShare() threw, treating as unsupported:", err);
      canShareFiles = false;
    }

    if (!canShareFiles) {
      // some browsers support share() for text/url but not files
      try {
        await navigator.share({ title: title || filename, text });
        return { method: "share-text-only" };
      } catch (err) {
        if (err && err.name === "AbortError") return { method: "share-cancelled" };
        throw err;
      }
    }
    try {
      await navigator.share({ files: [file], title: title || filename, text });
      console.info("[FilePipeline] native share sheet completed");
      return { method: "share" };
    } catch (err) {
      if (err && err.name === "AbortError") return { method: "share-cancelled" };
      throw err;
    }
  }

  return { saveToDevice, shareOnly, detectEnv, validateBlob };
})();
