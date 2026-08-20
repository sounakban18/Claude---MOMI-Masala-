/* =========================================================
   UI-MANAGE.JS
   Wires up everything that isn't the rate card itself:
   the Add-Product modal, the reusable confirm dialog, the
   tap-to-expand product sheet, and the Backup/Data panel.
   ========================================================= */

/* ---------- generic confirm dialog ---------- */

let _activeConfirmCleanup = null;

function openConfirmDialog({ title, message, confirmLabel = "Confirm", danger = false, onConfirm }) {
  if (_activeConfirmCleanup) _activeConfirmCleanup();

  const modal = document.getElementById("confirmModal");
  modal.querySelector(".confirm-title").textContent = title;
  modal.querySelector(".confirm-message").textContent = message;
  const confirmBtn = modal.querySelector(".confirm-ok");
  confirmBtn.textContent = confirmLabel;
  confirmBtn.classList.toggle("danger", !!danger);

  const cleanup = () => {
    modal.classList.remove("open");
    document.body.classList.remove("sheet-open");
    confirmBtn.removeEventListener("click", onOk);
    modal.querySelector(".confirm-cancel").removeEventListener("click", onCancel);
    _activeConfirmCleanup = null;
  };
  const onOk = () => { cleanup(); onConfirm && onConfirm(); };
  const onCancel = () => cleanup();

  confirmBtn.addEventListener("click", onOk);
  modal.querySelector(".confirm-cancel").addEventListener("click", onCancel);
  _activeConfirmCleanup = cleanup;

  modal.classList.add("open");
  document.body.classList.add("sheet-open");
}

function dismissConfirmDialog() {
  if (_activeConfirmCleanup) _activeConfirmCleanup();
}

/* ---------- expand sheet (tap a product card) ---------- */

function openExpandSheet(id) {
  const product = AppState.getById(id);
  if (!product) return;
  const sheet = document.getElementById("expandSheet");

  const imagesHtml = product.images
    .map((src) => `<img src="${src}" alt="${product.nameEn}">`)
    .join("");

  sheet.querySelector(".expand-images").innerHTML = imagesHtml;
  sheet.querySelector(".expand-bn").textContent = product.nameBn;
  sheet.querySelector(".expand-en").textContent = product.nameEn;
  sheet.querySelector(".expand-weight").textContent = formatWeightKg(product.weightKg);
  sheet.querySelector(".expand-price").textContent = `₹${product.price}`;

  sheet.classList.add("open");
  document.body.classList.add("sheet-open");
}

function closeExpandSheet() {
  document.getElementById("expandSheet").classList.remove("open");
  document.body.classList.remove("sheet-open");
}

/* ---------- add product modal ---------- */

let selectedImageFile = null;

function openAddProductModal() {
  const modal = document.getElementById("addProductModal");
  modal.querySelector("#newNameBn").value = "";
  modal.querySelector("#newNameEn").value = "";
  modal.querySelector("#newWeight").value = "";
  modal.querySelector("#newPrice").value = "";
  modal.querySelector("#newImagePreview").style.backgroundImage = "";
  modal.querySelector("#newImagePreview").classList.remove("has-image");
  selectedImageFile = null;
  modal.classList.add("open");
  document.body.classList.add("sheet-open");
}

function closeAddProductModal() {
  document.getElementById("addProductModal").classList.remove("open");
  document.body.classList.remove("sheet-open");
}

async function handleSaveNewProduct() {
  const nameBn = document.getElementById("newNameBn").value.trim();
  const nameEn = document.getElementById("newNameEn").value.trim();
  const weightKg = parseFloat(document.getElementById("newWeight").value);
  const price = parseFloat(document.getElementById("newPrice").value);

  if (!nameBn || !nameEn) { showToast("দুটি নামই লিখুন (বাংলা ও ইংরেজি)"); return; }
  if (!selectedImageFile) { showToast("একটি প্রোডাক্ট ছবি বেছে নিন"); return; }
  if (isNaN(weightKg) || weightKg <= 0) { showToast("ওজন সঠিকভাবে দিন (কেজিতে), যেমন 0.025"); return; }
  if (isNaN(price) || price < 0) { showToast("দাম সঠিকভাবে দিন"); return; }

  const btn = document.getElementById("btnSaveNewProduct");
  const original = btn.textContent;
  btn.disabled = true;
  btn.textContent = "সেভ হচ্ছে...";

  try {
    await AppState.addProduct({ nameBn, nameEn, weightKg, price, imageFile: selectedImageFile });
    closeAddProductModal();
    renderEditor();
    showToast("প্রোডাক্ট যোগ হয়েছে ✓");
  } catch (err) {
    console.error(err);
    showToast("প্রোডাক্ট যোগ করা যায়নি, আবার চেষ্টা করুন");
  } finally {
    btn.disabled = false;
    btn.textContent = original;
  }
}

/* ---------- backup panel ---------- */

async function refreshBackupPanelInfo() {
  const lastBackupAt = await DB.getMeta("lastBackupAt");
  const count = AppState.products.length;
  document.getElementById("lastBackupValue").textContent = lastBackupAt
    ? new Date(lastBackupAt).toLocaleString("bn-BD", { dateStyle: "medium", timeStyle: "short" })
    : "এখনও নেওয়া হয়নি";
  document.getElementById("productsStoredValue").textContent = String(count);
}

function openBackupPanel() {
  refreshBackupPanelInfo();
  document.getElementById("backupPanel").classList.add("open");
  document.body.classList.add("sheet-open");
}

function closeBackupPanel() {
  document.getElementById("backupPanel").classList.remove("open");
  document.body.classList.remove("sheet-open");
}

async function handleCreateBackup() {
  const btn = document.getElementById("btnCreateBackup");
  const original = btn.textContent;
  btn.disabled = true;
  btn.textContent = "ব্যাকআপ তৈরি হচ্ছে...";
  try {
    await downloadBackup();
    await refreshBackupPanelInfo();
    showToast("ব্যাকআপ তৈরি হয়েছে ✓");
  } catch (err) {
    console.error(err);
    showToast("ব্যাকআপ তৈরি করা যায়নি");
  } finally {
    btn.disabled = false;
    btn.textContent = original;
  }
}

function handleRestoreBackupClick() {
  document.getElementById("restoreFileInput").click();
}

async function handleRestoreFileSelected(e) {
  const file = e.target.files[0];
  e.target.value = ""; // allow re-selecting the same file later
  if (!file) return;

  let parsed;
  try {
    const text = await readFileAsText(file);
    parsed = JSON.parse(text);
  } catch (err) {
    showToast("ফাইলটি পড়া যায়নি — এটি একটি বৈধ ব্যাকআপ ফাইল কিনা দেখুন");
    return;
  }

  const result = validateBackup(parsed);
  if (!result.ok) { showToast(result.error); return; }

  const payload = result.payload;
  const dateStr = new Date(payload.backupCreatedAt).toLocaleString("bn-BD", { dateStyle: "medium", timeStyle: "short" });

  openConfirmDialog({
    title: "ব্যাকআপ পুনরুদ্ধার করবেন?",
    message: `এই ব্যাকআপে ${payload.productCount}টি প্রোডাক্ট আছে (তৈরি: ${dateStr})। বর্তমান সব প্রোডাক্ট এর দ্বারা প্রতিস্থাপিত হবে। এই কাজটি ফেরানো যাবে না।`,
    confirmLabel: "Restore",
    danger: true,
    onConfirm: async () => {
      try {
        showToast("পুনরুদ্ধার হচ্ছে...", 60000);
        const records = await backupPayloadToRecords(payload);
        await AppState.replaceAllWithBackup(records);
        renderEditor();
        await refreshBackupPanelInfo();
        showToast("ব্যাকআপ পুনরুদ্ধার হয়েছে ✓");
      } catch (err) {
        console.error(err);
        showToast("পুনরুদ্ধার ব্যর্থ হয়েছে, আবার চেষ্টা করুন");
      }
    },
  });
}

/* ---------- wiring ---------- */

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("fabAddProduct").addEventListener("click", openAddProductModal);
  document.getElementById("closeAddProductModal").addEventListener("click", closeAddProductModal);
  document.getElementById("btnSaveNewProduct").addEventListener("click", handleSaveNewProduct);

  const dropZone = document.getElementById("newImagePreview");
  const fileInput = document.getElementById("newImageFile");
  dropZone.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", () => {
    const file = fileInput.files[0];
    if (!file) return;
    selectedImageFile = file;
    const url = URL.createObjectURL(file);
    dropZone.style.backgroundImage = `url(${url})`;
    dropZone.classList.add("has-image");
  });

  document.getElementById("dataBtn").addEventListener("click", openBackupPanel);
  document.getElementById("closeBackupPanel").addEventListener("click", closeBackupPanel);
  document.getElementById("btnCreateBackup").addEventListener("click", handleCreateBackup);
  document.getElementById("btnRestoreBackup").addEventListener("click", handleRestoreBackupClick);
  document.getElementById("restoreFileInput").addEventListener("change", handleRestoreFileSelected);

  document.getElementById("closeExpandSheet").addEventListener("click", closeExpandSheet);
  document.getElementById("sheetBackdrop").addEventListener("click", () => {
    closeExpandSheet();
    closeAddProductModal();
    closeBackupPanel();
    closeThemeSheet();
    dismissConfirmDialog();
  });
});

/* ---------- theme sheet (auto / light / dark) ---------- */

function openThemeSheet() {
  const sheet = document.getElementById("themeSheet");
  syncThemeSeg();
  sheet.classList.add("open");
  document.body.classList.add("sheet-open");
}

function closeThemeSheet() {
  const sheet = document.getElementById("themeSheet");
  if (sheet) sheet.classList.remove("open");
  document.body.classList.remove("sheet-open");
}

function syncThemeSeg() {
  const mode = window.ThemeManager ? window.ThemeManager.getMode() : "auto";
  document.querySelectorAll(".theme-seg-opt").forEach((b) => {
    b.classList.toggle("active", b.dataset.mode === mode);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  if (!window.ThemeManager) return;
  const themeBtn = document.getElementById("themeBtn");
  const themeSheet = document.getElementById("themeSheet");
  const themeClose = document.getElementById("closeThemeSheet");
  const themeSeg = document.getElementById("themeSeg");

  if (themeBtn) themeBtn.addEventListener("click", openThemeSheet);
  if (themeClose) themeClose.addEventListener("click", closeThemeSheet);
  if (themeSeg) {
    themeSeg.querySelectorAll(".theme-seg-opt").forEach((b) => {
      b.addEventListener("click", () => {
        window.ThemeManager.set(b.dataset.mode);
        syncThemeSeg();
        closeThemeSheet();
      });
    });
  }

  syncThemeSeg();
  document.addEventListener("themechange", syncThemeSeg);
});
