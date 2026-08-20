/* =========================================================
   EXPORT.JS
   Generates the PDF/PNG/JPG from the live AppState and hands
   the resulting file to FilePipeline.deliver() for the actual
   cross-platform download/share handling (see
   js/utils/file-pipeline.js for the mobile-download fix).
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
  const card = buildRateCard(false); // clean, non-editable render from latest AppState
  host.appendChild(card);

  await waitForImages(card);
  if (document.fonts && document.fonts.ready) {
    try { await document.fonts.ready; } catch (e) {}
  }
  await new Promise((r) => setTimeout(r, 60));

  // Real-mobile failure mode this guards against: a 9-product card at a
  // flat scale of 2.5 can produce a canvas with 15-20M+ total pixels,
  // which exceeds the GPU texture / canvas size limit on a lot of
  // lower-end Android devices (limits as low as ~4096x4096 = ~16.7M px
  // are common). When that limit is hit, canvas.toBlob() typically just
  // resolves with null instead of throwing anything catchable earlier —
  // so we clamp the *requested* scale up front to a safe total-pixel
  // budget instead of always using a flat 2.5, based on the card's
  // actual measured size (which varies with product count).
  const SAFE_MAX_PIXELS = 14_000_000; // conservative, well under common device caps
  const naturalWidth = card.offsetWidth;
  const naturalHeight = card.offsetHeight;
  const maxScaleForSafety = Math.sqrt(SAFE_MAX_PIXELS / (naturalWidth * naturalHeight));
  const safeScale = Math.min(scale, maxScaleForSafety);

  const attempts = [safeScale, safeScale * 0.7, 1.5, 1].filter((s, i, arr) => arr.indexOf(s) === i && s > 0);

  let lastErr = null;
  for (const attemptScale of attempts) {
    try {
      const canvas = await html2canvas(card, {
        scale: attemptScale,
        backgroundColor: "#FBF3E2",
        useCORS: true,
        logging: false,
      });
      if (canvas && canvas.width > 0 && canvas.height > 0) {
        if (attemptScale !== attempts[0]) {
          console.warn(`[Export] rendered at reduced scale ${attemptScale} after an earlier attempt failed`);
        }
        return canvas;
      }
      lastErr = new Error("html2canvas returned an empty canvas");
    } catch (err) {
      lastErr = err;
      console.warn(`[Export] html2canvas failed at scale ${attemptScale}, trying a lower scale:`, err);
    }
  }
  throw lastErr || new Error("html2canvas failed at every attempted scale");
}

function canvasToBlob(canvas, mime, quality) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("canvas.toBlob timed out (possible low-memory/mobile GPU limit)")), 20000);
    try {
      canvas.toBlob((blob) => { clearTimeout(timer); resolve(blob); }, mime, quality);
    } catch (err) {
      clearTimeout(timer);
      reject(err);
    }
  });
}

/* ---------- PNG / JPG ---------- */
async function generateImageBlob(type) {
  const canvas = await renderExportCanvas(2.5);
  const mime = type === "png" ? "image/png" : "image/jpeg";
  const quality = type === "png" ? undefined : 0.95;
  const blob = await canvasToBlob(canvas, mime, quality);
  FilePipeline.validateBlob(blob, type.toUpperCase());
  return { blob, mime };
}

/* ---------- PDF ---------- */
async function generatePdfBlob() {
  const canvas = await renderExportCanvas(2.5);
  const imgData = canvas.toDataURL("image/jpeg", 0.95);

  const { jsPDF } = window.jspdf;
  // Match the PDF page to the rate card's own aspect ratio so nothing
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
  FilePipeline.validateBlob(blob, "PDF");
  return { blob, mime: "application/pdf" };
}

/* ---------- honest, method-aware feedback ---------- */
function toastForMethod(method) {
  switch (method) {
    case "share": return "শেয়ার করা হয়েছে ✓";
    case "share-text-only": return "শেয়ার করা হয়েছে (ছবি ছাড়া) — এই ব্রাউজারে ফাইল শেয়ার সমর্থিত নয়";
    case "share-cancelled": return null; // user backed out — no message needed
    case "download": return "ডাউনলোড শুরু হয়েছে ✓";
    case "newtab": return "নতুন ট্যাবে খোলা হয়েছে — ছবিতে চেপে ধরে সেভ করুন";
    case "newtab-datauri": return "নতুন ট্যাবে খোলা হয়েছে — সেভ করতে চেপে ধরুন";
    default: return "সম্পন্ন হয়েছে ✓";
  }
}

/* ---------- specific, honest error messages instead of one generic string ---------- */
function describeExportError(err) {
  const msg = (err && err.message) || "";
  if (/0 bytes|blob creation returned nothing/i.test(msg)) {
    return "ছবি তৈরি হয়নি (খালি ফাইল) — ফোনের মেমরি কম থাকতে পারে, আবার চেষ্টা করুন";
  }
  if (/timed out/i.test(msg)) {
    return "সময় বেশি লাগছে — নেটওয়ার্ক/মেমরি ধীর হতে পারে, আবার চেষ্টা করুন";
  }
  if (/every attempted scale|html2canvas/i.test(msg)) {
    return "ছবি তৈরি করা যায়নি — ফোনের ব্রাউজার এত বড় ছবি তৈরি সমর্থন করছে না";
  }
  if (/delivery strategies failed/i.test(msg)) {
    return "ফাইল তৈরি হয়েছে কিন্তু সেভ/শেয়ার করা যায়নি — ব্রাউজার সেটিংস দেখুন";
  }
  return "ফাইল তৈরি করা যায়নি। আবার চেষ্টা করুন।";
}

/* ---------- Wiring: Save dropdown ---------- */
let exportInProgress = false;

async function handleSaveOption(type, triggerEl) {
  if (exportInProgress) return; // prevent overlapping export requests
  if (!validateAllBeforeExport()) {
    showToast("কিছু দাম/ওজন খালি বা ভুল আছে — এক্সপোর্টের আগে ঠিক করুন");
    return;
  }
  closeSaveMenu();
  exportInProgress = true;
  setAllSaveOptionsDisabled(true);

  const labelEl = triggerEl.querySelector("b");
  const original = labelEl.textContent;
  labelEl.textContent = "তৈরি হচ্ছে...";
  showToast("রেট কার্ড তৈরি হচ্ছে...", 60000);

  try {
    const { blob, mime } = type === "pdf" ? await generatePdfBlob() : await generateImageBlob(type);
    const filename = `momi-masala-ratecard.${type}`;
    const result = await FilePipeline.deliver(blob, mime, filename, { title: "MOMI MASALA Rate Card" });
    const msg = toastForMethod(result.method);
    if (msg) showToast(msg);
    else hideToast();
  } catch (err) {
    console.error("[Export] failed:", err);
    showToast(describeExportError(err));
  } finally {
    labelEl.textContent = original;
    exportInProgress = false;
    setAllSaveOptionsDisabled(false);
  }
}

function setAllSaveOptionsDisabled(disabled) {
  document.querySelectorAll(".save-option").forEach((el) => { el.style.pointerEvents = disabled ? "none" : ""; el.style.opacity = disabled ? "0.55" : ""; });
  const shareBtn = document.getElementById("shareBtn");
  if (shareBtn) shareBtn.style.pointerEvents = disabled ? "none" : "";
}

function openSaveMenu() {
  document.getElementById("saveMenu").classList.add("open");
  document.getElementById("saveBtn").setAttribute("aria-expanded", "true");
}
function closeSaveMenu() {
  document.getElementById("saveMenu").classList.remove("open");
  document.getElementById("saveBtn").setAttribute("aria-expanded", "false");
}

/* ---------- Wiring: Share button ---------- */
async function handleShareClick() {
  if (exportInProgress) return;
  if (!validateAllBeforeExport()) {
    showToast("কিছু দাম/ওজন খালি বা ভুল আছে — শেয়ারের আগে ঠিক করুন");
    return;
  }
  exportInProgress = true;
  setAllSaveOptionsDisabled(true);

  const shareBtn = document.getElementById("shareBtn");
  const label = shareBtn.querySelector("span");
  const original = label.textContent;
  label.textContent = "...";
  showToast("তৈরি হচ্ছে...", 60000);

  try {
    const { blob, mime } = await generateImageBlob("jpg");
    const result = await FilePipeline.shareOnly(blob, mime, "momi-masala-ratecard.jpg", {
      title: "MOMI MASALA",
      text: "MOMI MASALA — Product Rate Card",
    });
    const msg = toastForMethod(result.method);
    if (msg) showToast(msg);
    else hideToast();
  } catch (err) {
    if (err && err.code === "UNSUPPORTED") {
      showToast("এই ব্রাউজারে শেয়ারিং সমর্থিত নয় — এর বদলে Save ব্যবহার করুন");
    } else {
      console.error("[Share] failed:", err);
      showToast(describeExportError(err));
    }
  } finally {
    label.textContent = original;
    exportInProgress = false;
    setAllSaveOptionsDisabled(false);
  }
}

function hideToast() {
  const toastEl = document.getElementById("toast");
  toastEl.classList.remove("show");
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

  shareBtn.addEventListener("click", handleShareClick);
});
