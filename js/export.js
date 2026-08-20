/* =========================================================
   EXPORT.JS
   Generates the PDF/PNG/JPG from the LIVE AppState (so edits
   always reflect in the exported file) and hands the result to
   FilePipeline.deliver() for cross-platform download/share.

   Every stage of the pipeline tags its errors with `err.stage`,
   which is logged to the console for debugging. The user-facing
   toast stays short and friendly.
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

async function ensureFontsLoaded() {
  if (document.fonts && document.fonts.ready) {
    try { await document.fonts.ready; } catch (e) {}
  }
}

/* Tag a thrown error with a stage + the current snapshot so the
   console makes the failure obvious. */
function tagStage(err, stage, extra) {
  if (!err) return;
  err.stage = err.stage || stage;
  if (extra) Object.assign(err, extra);
  return err;
}

/* Render the off-screen rate card and turn it into a canvas. */
async function renderExportCanvas(scale = 2.5) {
  const host = document.getElementById("exportHost");
  host.innerHTML = "";
  const card = buildRateCard(false); // clean, non-editable render
  host.appendChild(card);

  try {
    await waitForImages(card);
  } catch (e) {
    tagStage(e, "image-load", { where: "waitForImages" });
    throw e;
  }
  await ensureFontsLoaded();
  // small settle delay for layout
  await new Promise((r) => setTimeout(r, 80));

  if (typeof html2canvas !== "function") {
    const err = new Error("html2canvas library is not loaded");
    err.stage = "library-load";
    throw err;
  }

  try {
    const canvas = await html2canvas(card, {
      scale,
      backgroundColor: "#FBF3E2",
      useCORS: true,
      logging: false,
      allowTaint: false,
    });
    if (!canvas || canvas.width === 0 || canvas.height === 0) {
      const err = new Error("html2canvas returned an empty canvas");
      err.stage = "canvas-render";
      throw err;
    }
    return canvas;
  } catch (e) {
    tagStage(e, "canvas-render", { where: "html2canvas" });
    throw e;
  }
}

function canvasToBlob(canvas, mime, quality) {
  return new Promise((resolve, reject) => {
    if (!canvas || typeof canvas.toBlob !== "function") {
      const err = new Error("canvas.toBlob is not available in this browser");
      err.stage = "toBlob-availability";
      return reject(err);
    }
    try {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            const err = new Error("canvas.toBlob returned null");
            err.stage = "toBlob";
            return reject(err);
          }
          resolve(blob);
        },
        mime,
        quality
      );
    } catch (e) {
      tagStage(e, "toBlob");
      reject(e);
    }
  });
}

async function generateImageBlob(type) {
  let canvas;
  try {
    canvas = await renderExportCanvas(2.5);
  } catch (e) { throw e; }
  const mime = type === "png" ? "image/png" : "image/jpeg";
  const quality = type === "png" ? undefined : 0.95;
  let blob;
  try {
    blob = await canvasToBlob(canvas, mime, quality);
  } catch (e) {
    tagStage(e, "blob-creation", { format: type.toUpperCase() });
    throw e;
  }
  FilePipeline.validateBlob(blob, type.toUpperCase());
  return { blob, mime };
}

async function generatePdfBlob() {
  let canvas;
  try {
    canvas = await renderExportCanvas(2.5);
  } catch (e) { throw e; }
  let imgData;
  try {
    imgData = canvas.toDataURL("image/jpeg", 0.95);
    if (!imgData || imgData.length < 100) {
      const err = new Error("canvas.toDataURL returned empty");
      err.stage = "toDataURL";
      throw err;
    }
  } catch (e) {
    tagStage(e, "toDataURL", { format: "PDF" });
    throw e;
  }

  if (!window.jspdf || !window.jspdf.jsPDF) {
    const err = new Error("jsPDF library is not loaded");
    err.stage = "library-load";
    throw err;
  }

  const { jsPDF } = window.jspdf;
  const widthMm = 210;
  const heightMm = (canvas.height / canvas.width) * widthMm;
  let doc;
  try {
    doc = new jsPDF({
      orientation: heightMm >= widthMm ? "portrait" : "landscape",
      unit: "mm",
      format: [widthMm, heightMm],
    });
    doc.addImage(imgData, "JPEG", 0, 0, widthMm, heightMm);
  } catch (e) {
    tagStage(e, "pdf-generation", { where: "jsPDF.addImage" });
    throw e;
  }

  let blob;
  try {
    blob = doc.output("blob");
  } catch (e) {
    tagStage(e, "pdf-output", { where: "doc.output" });
    throw e;
  }
  FilePipeline.validateBlob(blob, "PDF");
  return { blob, mime: "application/pdf" };
}

function toastForMethod(method) {
  switch (method) {
    case "share": return "শেয়ার করা হয়েছে ✓";
    case "share-text-only": return "শেয়ার করা হয়েছে (ছবি ছাড়া) — এই ব্রাউজারে ফাইল শে�়ার সমর্থিত নয়";
    case "share-cancelled": return null;
    case "download": return "ডাউনলোড শুরু হয়েছে ✓";
    case "newtab": return "নতুন ট্যাবে খোলা হয়েছে — ছবিতে চেপে ধরে সেভ করুন";
    case "newtab-datauri": return "নতুন ট্যাবে খোলা হয়েছে — সেভ করতে চেপে ধরুন";
    default: return "সম্পন্ন হয়েছে ✓";
  }
}

/* Map a thrown err.stage to a user-friendly Bengali message. The
   detailed error is still in the console (where the spec wants
   debugging info to live), but the user gets a clear hint. */
function toastForError(err) {
  if (err && err.code === "UNSUPPORTED") return "এই ব্রাউজারে শেয়ারিং সমর্থিত নয় — এর বদলে Save ব্যবহার করুন";
  const stage = err && err.stage;
  switch (stage) {
    case "library-load":     return "এক্সপোর্ট লাইব্রেরি লোড হয়নি — পেজ রিফ্রেশ করে আবার চেষ্টা করুন";
    case "image-load":       return "প্রোডাক্টের ছবি লোড হয়নি — কিছুক্ষণ অপেক্ষা করে আবার �েষ্টা করুন";
    case "canvas-render":    return "রেট কার্ড রেন্ডার করা যায়নি — আবার চেষ্টা করুন";
    case "toBlob":
    case "toBlob-availability":
    case "blob-creation":    return "ফাইল ত�রি করা যায়নি — আবার চেষ্টা করুন";
    case "toDataURL":        return "ছবি রূপান্তর করা যায়নি — আবার চেষ্টা করুন";
    case "pdf-generation":
    case "pdf-output":       return "PDF তৈরি করা যায়নি — আবার চেষ্টা করুন";
    case "object-url":
    case "anchor-click":
    case "newtab-blob":
    case "newtab-datauri":
    case "all-delivery":     return "�াইল ডেলিভার করা যায়নি — ব্রাউজার ডাউনলোড/শেয়ার সমর্থন করছে না";
    default:                 return "ফাইল তৈরি করা যায়নি। আবার চেষ্টা করুন।";
  }
}

/* ---------- Wiring: Save dropdown ---------- */
let exportInProgress = false;

async function handleSaveOption(type, triggerEl) {
  if (exportInProgress) return;
  if (!validateAllBeforeExport()) {
    showToast("কিছু দাম/ওজন খালি বা ভুল আছে — এক্সপোর্�ের আগে ঠিক করুন");
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
    const { blob, mime } = type === "pdf"
      ? await generatePdfBlob()
      : await generateImageBlob(type);
    const filename = `momi-masala-ratecard.${type}`;
    const result = await FilePipeline.deliver(blob, mime, filename, {
      title: "MOMI MASALA Rate Card",
    });
    const msg = toastForMethod(result.method);
    if (msg) showToast(msg);
    else hideToast();
  } catch (err) {
    console.error("[Export.save]", {
      type,
      stage: err && err.stage,
      message: err && err.message,
      stack: err && err.stack,
    });
    showToast(toastForError(err));
  } finally {
    labelEl.textContent = original;
    exportInProgress = false;
    setAllSaveOptionsDisabled(false);
  }
}

function setAllSaveOptionsDisabled(disabled) {
  document.querySelectorAll(".save-option").forEach((el) => {
    el.style.pointerEvents = disabled ? "none" : "";
    el.style.opacity = disabled ? "0.55" : "";
  });
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
    showToast("কিছু দাম/ওজন খালি বা ভুল আছে — শেয়ারের আগে �িক করুন");
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
    console.error("[Export.share]", {
      stage: err && err.stage,
      code: err && err.code,
      message: err && err.message,
      stack: err && err.stack,
    });
    showToast(toastForError(err));
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
