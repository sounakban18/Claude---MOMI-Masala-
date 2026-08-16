/* =========================================================
   IMAGE-UTILS.JS
   Small conversion helpers shared by the DB migration step
   and the backup/restore system. Images live as Blobs inside
   IndexedDB (more efficient than base64 strings), but a JSON
   backup file can only hold text, so backups store base64
   strings and convert back to Blobs on restore.
   ========================================================= */

async function dataUrlToBlob(dataUrl) {
  const res = await fetch(dataUrl);
  return res.blob();
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
