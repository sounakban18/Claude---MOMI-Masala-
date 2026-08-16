/* =========================================================
   EXPORT & SHARE
   Builds a fresh, non-editable copy of the brochure from the
   live PRODUCTS data, rasterizes it at high resolution, and
   either downloads it (PDF/PNG/JPG) or hands it to the native
   share sheet. Fully independent of the editor's DOM, so the
   exported/shared file never contains input borders, cursors,
   or the app's own header/controls.
   ========================================================= */

function validateAllBeforeExport() {
  if (AppState.products.length === 0) return false;
  return AppState.products.every((p) => {
    const priceOk = typeof p.price === "number" && p.price >= 0 && !isNaN(p.price);
    const weightOk = typeof p.weightKg === "number" && p.weightKg > 0 && !isNaN(p.weightKg);
    return priceOk && weightOk;
  });
}

function waitForImages(root) {
  const imgs = Array.from(root.querySelectorAll("img"));
  return Promise.all(
    imgs.map(
      (img) =>
        new Promise((resolve) => {
          if (img.complete && img.naturalWidth > 0) resolve();
          else {
            img.addEventListener("load", resolve, { once: true });
            img.addEventListener("error", resolve, { once: true });
          }
        })
    )
  );
}

async function renderExportCanvas(scale = 2.5) {
  const host = document.getElementById("exportHost");
  host.innerHTML = "";
  const brochure = buildRateCard(false); // clean, non-editable render from latest data
  host.appendChild(brochure);

  await waitForImages(brochure);
  if (document.fonts && document.fonts.ready) {
    try { await document.fonts.ready; } catch (e) {}
  }
  await new Promise((r) => setTimeout(r, 60));

  const canvas = await html2canvas(brochure, {
    scale,
    backgroundColor: "#FBF3E2",
    useCORS: true,
    logging: false,
  });
  return canvas;
}

function canvasToBlob(canvas, mime, quality) {
  return new Promise((resolve) => canvas.toBlob(resolve, mime, quality));
}

function isIOS() {
  return (
    /iP(hone|od|ad)/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

/* Shared delivery path for a finished file: try the iOS share sheet
   first (since Mobile Safari often just opens blobs instead of
   downloading them), otherwise do a normal anchor download. */
async function deliverBlob(blob, mime, filename, shareTitle) {
  if (isIOS() && navigator.canShare) {
    const file = new File([blob], filename, { type: mime });
    if (navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: shareTitle });
        return;
      } catch (e) { /* user cancelled — fall through to download */ }
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  if (isIOS()) setTimeout(() => window.open(url, "_blank"), 150);
  setTimeout(() => URL.revokeObjectURL(url), 8000);
}

/* ---------- PNG / JPG ---------- */
async function exportImage(type) {
  const canvas = await renderExportCanvas(2.5);
  const mime = type === "png" ? "image/png" : "image/jpeg";
  const quality = type === "png" ? undefined : 0.95;
  const blob = await canvasToBlob(canvas, mime, quality);
  if (!blob) throw new Error("canvas.toBlob returned null");
  await deliverBlob(blob, mime, `momi-masala-ratecard.${type}`, "MOMI MASALA Rate Card");
}

/* ---------- PDF ---------- */
async function exportPdf() {
  const canvas = await renderExportCanvas(2.5);
  const imgData = canvas.toDataURL("image/jpeg", 0.95);

  const { jsPDF } = window.jspdf;
  // Match the PDF page to the brochure's own aspect ratio so nothing
  // gets letterboxed, cropped, or stretched.
  const widthMm = 210; // A4 width, portrait
  const heightMm = (canvas.height / canvas.width) * widthMm;

  const doc = new jsPDF({
    orientation: heightMm >= widthMm ? "portrait" : "landscape",
    unit: "mm",
    format: [widthMm, heightMm],
  });
  doc.addImage(imgData, "JPEG", 0, 0, widthMm, heightMm);

  const blob = doc.output("blob");
  await deliverBlob(blob, "application/pdf", "momi-masala-ratecard.pdf", "MOMI MASALA Rate Card");
}

/* ---------- Share ---------- */
async function shareRateCard() {
  try {
    const canvas = await renderExportCanvas(2);
    const blob = await canvasToBlob(canvas, "image/jpeg", 0.92);
    if (!blob) throw new Error("no blob");

    const file = new File([blob], "momi-masala-ratecard.jpg", { type: "image/jpeg" });
    const shareData = {
      files: [file],
      title: "MOMI MASALA",
      text: "MOMI MASALA — Product Rate Card",
    };

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share(shareData);
      return;
    }
    if (navigator.share) {
      // some browsers support share() for text but not files
      await navigator.share({ title: shareData.title, text: shareData.text });
      showToast("এই ব্রাউজারে ছবি শেয়ার সমর্থিত নয় — Save করে ছবিটি ম্যানুয়ালি শেয়ার করুন");
      return;
    }
    throw new Error("share unsupported");
  } catch (err) {
    if (err && err.name === "AbortError") return; // user cancelled share sheet
    console.error(err);
    showToast("শেয়ারিং সমর্থিত নয় এই ব্রাউজারে — এর বদলে Save ব্যবহার করুন");
  }
}

/* ---------- Wiring: dropdown + buttons ---------- */
async function handleSaveOption(type, triggerEl) {
  if (!validateAllBeforeExport()) {
    showToast("কিছু দাম/ওজন খালি বা ভুল আছে — এক্সপোর্টের আগে ঠিক করুন");
    return;
  }
  closeSaveMenu();

  const original = triggerEl.querySelector("b").textContent;
  triggerEl.querySelector("b").textContent = "তৈরি হচ্ছে...";
  triggerEl.style.pointerEvents = "none";

  try {
    if (type === "pdf") await exportPdf();
    else await exportImage(type);
    showToast("ব্রোশিওর সেভ হয়েছে ✓");
  } catch (err) {
    console.error(err);
    showToast("এক্সপোর্ট ব্যর্থ হয়েছে, আবার চেষ্টা করুন");
  } finally {
    triggerEl.querySelector("b").textContent = original;
    triggerEl.style.pointerEvents = "";
  }
}

function openSaveMenu() {
  document.getElementById("saveMenu").classList.add("open");
  document.getElementById("saveBtn").setAttribute("aria-expanded", "true");
}
function closeSaveMenu() {
  document.getElementById("saveMenu").classList.remove("open");
  document.getElementById("saveBtn").setAttribute("aria-expanded", "false");
}

document.addEventListener("DOMContentLoaded", () => {
  const saveMenu = document.getElementById("saveMenu");
  const saveBtn = document.getElementById("saveBtn");
  const shareBtn = document.getElementById("shareBtn");

  saveBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    saveMenu.classList.contains("open") ? closeSaveMenu() : openSaveMenu();
  });

  document.addEventListener("click", (e) => {
    if (!saveMenu.contains(e.target)) closeSaveMenu();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeSaveMenu();
  });

  document.getElementById("optPdf").addEventListener("click", (e) => handleSaveOption("pdf", e.currentTarget));
  document.getElementById("optPng").addEventListener("click", (e) => handleSaveOption("png", e.currentTarget));
  document.getElementById("optJpg").addEventListener("click", (e) => handleSaveOption("jpg", e.currentTarget));

  shareBtn.addEventListener("click", async () => {
    if (!validateAllBeforeExport()) {
      showToast("কিছু দাম/ওজন খালি বা ভুল আছে — শেয়ারের আগে ঠিক করুন");
      return;
    }
    shareBtn.style.pointerEvents = "none";
    const label = shareBtn.querySelector("span");
    const original = label.textContent;
    label.textContent = "...";
    try {
      await shareRateCard();
    } finally {
      label.textContent = original;
      shareBtn.style.pointerEvents = "";
    }
  });
});
