/* =========================================================
   BACKUP.JS
   Builds a self-contained JSON backup (products + images as
   base64 + timestamps) and can validate + parse one back into
   DB-ready records. UI wiring (buttons, confirm dialogs,
   file picker) lives in ui-manage.js — this file only knows
   how to build/read the backup format itself.
   ========================================================= */

const BACKUP_FORMAT_VERSION = 1;

function pad2(n) { return String(n).padStart(2, "0"); }

function backupFilename(date = new Date()) {
  const y = date.getFullYear();
  const m = pad2(date.getMonth() + 1);
  const d = pad2(date.getDate());
  const hh = pad2(date.getHours());
  const mm = pad2(date.getMinutes());
  return `MOMI-MASALA-BACKUP-${y}-${m}-${d}-${hh}-${mm}.json`;
}

async function buildBackupPayload() {
  const raw = await DB.getAllProducts();
  const products = [];
  for (const p of raw) {
    const imagesB64 = [];
    for (const blob of p.images) {
      imagesB64.push(await blobToDataUrl(blob));
    }
    products.push({
      id: p.id,
      nameBn: p.nameBn,
      nameEn: p.nameEn,
      weightKg: p.weightKg,
      price: p.price,
      position: p.position,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      images: imagesB64,
    });
  }

  return {
    app: "MOMI MASALA Rate Card Editor",
    formatVersion: BACKUP_FORMAT_VERSION,
    backupCreatedAt: Date.now(),
    productCount: products.length,
    products,
  };
}

async function downloadBackup() {
  const payload = await buildBackupPayload();
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = backupFilename(new Date(payload.backupCreatedAt));
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 8000);

  await DB.setMeta("lastBackupAt", payload.backupCreatedAt);
  await DB.setMeta("lastBackupCount", payload.productCount);
  return payload;
}

/* Validates the parsed JSON shape. Returns { ok, error, payload }. */
function validateBackup(parsed) {
  if (!parsed || typeof parsed !== "object") return { ok: false, error: "ফাইলটি সঠিক ব্যাকআপ ফাইল নয়" };
  if (!Array.isArray(parsed.products)) return { ok: false, error: "ব্যাকআপে কোনো প্রোডাক্ট তথ্য পাওয়া যায়নি" };
  if (typeof parsed.formatVersion !== "number") return { ok: false, error: "ব্যাকআপ ফরম্যাট চেনা যায়নি" };
  for (const p of parsed.products) {
    if (!p.nameBn || !p.nameEn || !Array.isArray(p.images) || p.images.length === 0) {
      return { ok: false, error: "ব্যাকআপের কিছু প্রোডাক্ট তথ্য অসম্পূর্ণ" };
    }
  }
  return { ok: true, payload: parsed };
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

/* Converts a validated backup payload into DB-ready records
   (base64 images turned back into Blobs). */
async function backupPayloadToRecords(payload) {
  const records = [];
  for (const p of payload.products) {
    const blobs = [];
    for (const src of p.images) blobs.push(await dataUrlToBlob(src));
    records.push({
      id: p.id,
      nameBn: p.nameBn,
      nameEn: p.nameEn,
      weightKg: p.weightKg,
      price: p.price,
      position: p.position,
      createdAt: p.createdAt || Date.now(),
      updatedAt: p.updatedAt || Date.now(),
      images: blobs,
    });
  }
  return records;
}
