/* =========================================================
   FILE-PIPELINE.JS
   Cross-platform "get this file into the user's hands" logic.
   Single place both Save (PDF/PNG/JPG) and Share go through.
   No other file should call URL.createObjectURL / <a download> /
   navigator.share directly.

   STRATEGY (in order, every step is honestly reported):
     1. Validate the blob (non-zero size).
     2. Web Share API with a real File object — tried on ALL
        platforms, not just iOS. Chromium WebViews (incl. the
        WebIntoApp wrapper) support it natively.
     3. anchor + blob: URL click — works in ordinary browsers
        and many desktop WebViews.
     4. Open the blob: URL in a new tab — long-press "save image"
        or hands off to the system browser.
     5. Last resort: data: URI in a new tab.

   Each method returns { method, ok } so the UI can show what
   really happened instead of one blanket "saved" message.
   ========================================================= */

const FilePipeline = (() => {
  function detectEnv() {
    const ua = navigator.userAgent || "";
    const isIOS = /iP(hone|od|ad)/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const isAndroid = /Android/.test(ua);
    const isAndroidWebView = isAndroid && /;\s?wv\)/.test(ua);
    const isMobile = isIOS || isAndroid || /Mobi/.test(ua);
    const hasShare = typeof navigator.share === "function";
    const hasCanShare = typeof navigator.canShare === "function";
    return { isIOS, isAndroid, isAndroidWebView, isMobile, hasShare, hasCanShare, ua };
  }

  /* Throws a typed error if the blob is missing/empty. The
     export layer catches this and reports the exact stage. */
  function validateBlob(blob, label) {
    if (!blob) {
      const err = new Error(`${label}: blob creation returned nothing`);
      err.stage = "blob-creation";
      throw err;
    }
    if (blob.size === 0) {
      const err = new Error(`${label}: blob has 0 bytes — generation likely failed`);
      err.stage = "blob-creation";
      throw err;
    }
    return blob;
  }

  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("FileReader failed while converting blob"));
      reader.readAsDataURL(blob);
    });
  }

  /* Stage-tagged anchor download. Resolves once the click has
     been dispatched; does not revoke the URL immediately. */
  function anchorDownload(blob, filename) {
    return new Promise((resolve, reject) => {
      let url;
      try {
        url = URL.createObjectURL(blob);
      } catch (err) {
        err.stage = "object-url";
        return reject(err);
      }
      try {
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.rel = "noopener";
        a.style.display = "none";
        a.target = "_self";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 30000);
        resolve();
      } catch (err) {
        err.stage = "anchor-click";
        try { URL.revokeObjectURL(url); } catch (_) {}
        reject(err);
      }
    });
  }

  function openInNewTab(blob) {
    const url = URL.createObjectURL(blob);
    const win = window.open(url, "_blank", "noopener");
    if (!win) {
      URL.revokeObjectURL(url);
      const err = new Error("popup blocked");
      err.stage = "newtab-blob";
      throw err;
    }
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  async function openDataUrlInNewTab(blob) {
    const dataUrl = await blobToDataUrl(blob);
    const win = window.open(dataUrl, "_blank", "noopener");
    if (!win) {
      const err = new Error("popup blocked for data URI fallback");
      err.stage = "newtab-datauri";
      throw err;
    }
  }

  /* Try the Web Share API with a real File. Returns { method } on
     success/share-cancel/unsupported, throws on hard failure. */
  async function tryShare(file, opts) {
    if (!navigator.share) {
      const err = new Error("Web Share API not available");
      err.code = "UNSUPPORTED";
      err.stage = "share-availability";
      throw err;
    }
    if (navigator.canShare && !navigator.canShare({ files: [file] })) {
      // some browsers support text share but not files
      try {
        await navigator.share({
          title: opts.title || file.name,
          text: opts.text,
        });
        return { method: "share-text-only" };
      } catch (err) {
        if (err && err.name === "AbortError") return { method: "share-cancelled" };
        err.stage = "share-text-only";
        throw err;
      }
    }
    try {
      await navigator.share({
        files: [file],
        title: opts.title || file.name,
        text: opts.text,
      });
      return { method: "share" };
    } catch (err) {
      if (err && err.name === "AbortError") return { method: "share-cancelled" };
      err.stage = "share";
      throw err;
    }
  }

  /* Full fallback chain — used by Save. */
  async function deliver(blob, mime, filename, opts = {}) {
    validateBlob(blob, filename);
    const file = new File([blob], filename, { type: mime });
    const env = detectEnv();
    console.info("[FilePipeline.deliver] start", {
      filename,
      mime,
      size: blob.size,
      env,
    });

    // 1. Web Share API — preferred on mobile / WebView.
    if (env.hasShare) {
      try {
        const result = await tryShare(file, opts);
        if (result.method === "share-cancelled") return result;
        return result;
      } catch (err) {
        console.warn("[FilePipeline.deliver] share failed, falling back:", err);
      }
    }

    // 2. Standard anchor download.
    try {
      await anchorDownload(blob, filename);
      return { method: "download" };
    } catch (err) {
      console.warn("[FilePipeline.deliver] anchor download failed, falling back:", err);
    }

    // 3. Open the blob in a new tab (system browser / long-press save).
    try {
      openInNewTab(blob);
      return { method: "newtab" };
    } catch (err) {
      console.warn("[FilePipeline.deliver] new-tab blob open failed, falling back:", err);
    }

    // 4. Last resort: data: URI in a new tab.
    try {
      await openDataUrlInNewTab(blob);
      return { method: "newtab-datauri" };
    } catch (err) {
      console.error("[FilePipeline.deliver] all delivery strategies failed:", err);
      const final = new Error("All file delivery strategies failed");
      final.stage = "all-delivery";
      throw final;
    }
  }

  /* Share-only entry point. Throws UNSUPPORTED if the API is not
     present, otherwise tries to share a real File. */
  async function shareOnly(blob, mime, filename, opts = {}) {
    validateBlob(blob, filename);
    const file = new File([blob], filename, { type: mime });
    console.info("[FilePipeline.shareOnly] start", {
      filename,
      mime,
      size: blob.size,
    });
    try {
      return await tryShare(file, opts);
    } catch (err) {
      console.error("[FilePipeline.shareOnly] failed:", err);
      throw err;
    }
  }

  return { deliver, shareOnly, detectEnv, validateBlob };
})();
