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

  const canvas = await html2canvas(card, {
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
    showToast("ফাইল তৈরি করা যায়নি। আবার চেষ্টা করুন।");
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
      showToast("শেয়ার করা যায়নি। আবার চেষ্টা করুন।");
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
