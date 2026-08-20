/* =========================================================
   FILE-PIPELINE.JS
   Cross-platform "get this file into the user's hands" logic.
   This is the single place both Save (PDF/PNG/JPG) and Share
   go through — no other file in the app should call
   URL.createObjectURL / <a download> / navigator.share
   directly.

   ROOT CAUSE THIS FILE FIXES:
   The previous implementation only tried the Web Share API on
   iOS. On Android — which is what the WebIntoApp WebView wraps
   — it went straight to `<a download>` + a blob: URL click.
   Android WebViews generally have no download manager wired up
   for client-generated blob: URLs (that only fires for real
   HTTP downloads unless the host app explicitly implements a
   DownloadListener), so the click silently did nothing. The
   code still reported success either way, since it never
   checked whether anything actually happened.

   THE FIX:
    1. Validate the blob has real content before doing anything.
    2. Try the Web Share API with a real File object FIRST on
       *any* mobile/WebView context, not just iOS — this is the
       path most likely to actually work inside a WebView, since
       modern Chromium-based WebViews (which WebIntoApp uses)
       support it natively via an Android share intent.
    3. Fall back to a normal anchor + blob URL download (works
       in ordinary mobile/desktop browsers).
    4. Fall back to opening the blob in a new tab, so at minimum
       the system browser (outside the restrictive WebView) or a
       long-press "save image/save page" can take over.
    5. Last resort: same thing with a data: URI, since some
       locked-down WebViews block blob: navigation specifically
       but still allow data: URIs.
   Each step is honestly reported back (never a blanket "saved"
   message) so the UI can tell the user what actually happened.
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
   * Attempts, in order: Web Share (real File) -> anchor download ->
   * new-tab blob -> new-tab data URI. Returns { method } describing
   * what actually happened, or throws if every strategy failed.
   */
  async function deliver(blob, mime, filename, { title, text } = {}) {
    validateBlob(blob, filename);
    const file = new File([blob], filename, { type: mime });
    const env = detectEnv();
    console.info("[FilePipeline] delivering", { filename, mime, size: blob.size, env });

    // 1. Web Share API with a real File — tried on ALL platforms now,
    //    not just iOS, since this is the path most likely to work
    //    inside the Android WebView that WebIntoApp wraps.
    //    IMPORTANT: navigator.canShare() itself can throw on some
    //    Android WebView builds with partial/buggy Web Share Level 2
    //    (file-sharing) support, rather than returning false. That
    //    exception was previously unguarded and aborted the entire
    //    pipeline before it ever reached the download fallback below
    //    — this whole block is now one try/catch so any failure here,
    //    from feature detection through the actual share() call, just
    //    falls through to strategy 2 instead of crashing everything.
    try {
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: title || filename, text });
          return { method: "share" };
        } catch (err) {
          if (err && err.name === "AbortError") return { method: "share-cancelled" };
          throw err;
        }
      }
    } catch (err) {
      console.warn("[FilePipeline] share unavailable/failed, falling back:", err);
    }

    // 2. Standard anchor + blob URL download.
    try {
      await anchorDownload(blob, filename);
      return { method: "download" };
    } catch (err) {
      console.warn("[FilePipeline] anchor download failed, falling back:", err);
    }

    // 3. New tab with the blob URL (system browser / long-press save).
    try {
      openInNewTab(blob);
      return { method: "newtab" };
    } catch (err) {
      console.warn("[FilePipeline] new-tab blob open failed, falling back:", err);
    }

    // 4. Last resort: data URI in a new tab.
    try {
      await openDataUrlInNewTab(blob);
      return { method: "newtab-datauri" };
    } catch (err) {
      console.error("[FilePipeline] all delivery strategies failed:", err);
      throw new Error("All file delivery strategies failed");
    }
  }

  /** Explicit share-only entry point for the Share button (no download fallback —
      if sharing truly isn't supported, the caller should tell the user to use Save). */
  async function shareOnly(blob, mime, filename, { title, text } = {}) {
    validateBlob(blob, filename);
    const file = new File([blob], filename, { type: mime });

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
      return { method: "share" };
    } catch (err) {
      if (err && err.name === "AbortError") return { method: "share-cancelled" };
      throw err;
    }
  }

  return { deliver, shareOnly, detectEnv, validateBlob };
})();
