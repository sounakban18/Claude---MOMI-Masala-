# MOMI MASALA — Rate Card Editor

A mobile-first, editable rate card app with a real local database
(IndexedDB), full product management (add/remove/edit), local backup
& restore, and a modern glass-style UI wrapped around a richer,
traditional maroon/cream/gold rate card.

Designed to run inside an Android WebView (Vercel → WebIntoApp APK) —
everything works fully offline after the first load. No server or
internet connection is required for normal use.

## How to use

- Open `index.html` on your phone or computer (or the packaged APK).
- **Tap a product card** to see its full, uncropped photo in an
  expandable sheet along with its name, weight, and price.
- **Tap a weight or price value** directly to edit it — saved to the
  local database immediately, survives refresh/close/reopen.
- **Tap the (+) button** (bottom-right) to add a new product: pick an
  image from the device, fill in both names, weight (kg), and price.
- **Tap the (−) icon** on a product's photo to remove it, with a
  confirmation step first — nothing is ever deleted silently.
- **Tap the database icon** (top-left of the header controls) to open
  **Backup & Data**: create a downloadable backup file, restore from
  one, and see when the last backup was made and how many products are
  currently stored.
- **Save** (top-right) still exports the current rate card as a
  PDF, PNG, or JPG. **Share** still hands it to the device's native
  share sheet where supported.

## Project structure

```
index.html                Page shell: header, sheets/modals, script loading order
css/style.css              All styling (glass app UI + rate card + sheets/modals)

js/db.js                    IndexedDB abstraction — the ONLY file that touches
                             indexedDB directly. Two object stores: "products"
                             and "meta" (migration flag, last-backup timestamp).
js/image-utils.js           Tiny helpers: base64 data URL <-> Blob conversion.
js/products.js               DEFAULT_PRODUCTS seed data (used once, on first
                             launch only) + BRAND/CONTACT + formatWeightKg().
js/app-state.js              Owns the live, in-memory product list. Everything
                             else reads AppState.products and calls its methods
                             (updateField, addProduct, removeProduct,
                             replaceAllWithBackup) instead of touching db.js
                             or IndexedDB directly.
js/backup.js                  Builds/validates/parses the backup JSON format.
                             Pure logic only — no DOM/UI code.
js/render.js                  Builds the rate card DOM (product cards, header,
                             footer) from AppState.products.
js/editor.js                   Tap-to-edit wiring, the remove-confirmation flow,
                             tap-to-expand wiring, and the fixed-width-card
                             responsive scaling.
js/ui-manage.js                Add-Product modal, generic confirm dialog, the
                             expand sheet, and the Backup & Data panel — all
                             the "app chrome" interactions that aren't the
                             rate card itself.
js/export.js                   Save (PDF/PNG/JPG) + Share, reading from
                             AppState.products so exports always reflect
                             whatever's currently in the database.
js/html2canvas.min.js / js/jspdf.min.js   Vendored, work fully offline.

assets/products/*.jpg      Original seed product photos, kept for reference.
assets/brand/                Logo (transparent PNG) + cropped shop banner.
```

## Data flow

```
UI  →  AppState (in-memory)  →  DB.js  →  IndexedDB (on-device)
```

Nothing renders directly from IndexedDB — `AppState.reload()` pulls
everything out, converts each product's stored image Blobs into
`blob:` object URLs (safe to use directly as `<img src>` and safe for
canvas export, unlike `file://`-referenced images), and *that* is what
`render.js` draws from. Any change (edit/add/remove/restore) updates
IndexedDB first, then calls `AppState.reload()` and re-renders.

Backup follows the same shape in reverse: `DB.getAllProducts()` →
convert each image Blob to a base64 string → one JSON file. Restore
reverses it: base64 → Blob → straight into IndexedDB, replacing
whatever was there (only after the user confirms, and only after the
file has been validated as a real backup).

## First-launch migration

On first open, `AppState.init()` checks the `meta.migrated` flag in
IndexedDB. If it's not set, the 9 products in `DEFAULT_PRODUCTS`
(products.js) get converted from their bundled base64 images into
Blobs and written into IndexedDB, and the flag is set. Every launch
after that skips migration entirely and loads straight from IndexedDB
— editing `DEFAULT_PRODUCTS` after the app has been used once has no
effect, since IndexedDB is already the source of truth. Verified this
doesn't duplicate products across repeated reloads.

## Backup file format

```
MOMI-MASALA-BACKUP-YYYY-MM-DD-HH-MM.json
```

```json
{
  "app": "MOMI MASALA Rate Card Editor",
  "formatVersion": 1,
  "backupCreatedAt": 1755344520000,
  "productCount": 9,
  "products": [
    {
      "id": 1, "nameBn": "এলাচ", "nameEn": "Cardamom",
      "weightKg": 0.025, "price": 60, "position": 1,
      "createdAt": 1755344000000, "updatedAt": 1755344000000,
      "images": ["data:image/jpeg;base64,..."]
    }
  ]
}
```

Everything needed to fully reconstruct the catalogue — including the
actual image bytes — lives inside this one file. If the APK's storage
is ever cleared, restoring this file brings everything back exactly as
it was.

## Product numbering vs database ID

The little numbered badge on each card (01, 02, ...) is based on
display **position**, not the database ID — IDs can become non-sequential
after products are added and removed (IndexedDB's auto-increment
keeps counting up), but the visible numbering always stays clean and
sequential. Editing (weight/price) targets a product by its stable
database ID, which never changes for that product.

## Why product images are Blobs in IndexedDB (not base64 strings)

Blobs are what IndexedDB is actually designed to store efficiently —
base64 text would be ~33% larger and slower to encode/decode on every
read. The seed images in `product-images.js` are base64 only because
that's what a static JS file can hold; they get converted to Blobs
once, during the first-launch migration, and from then on the database
only ever deals in Blobs.

## Notes on the export rendering

A couple of CSS patterns don't rasterize correctly inside the
`html2canvas` library used for Save/Share, so they're avoided (or
given export-only overrides) in `css/style.css`:

- `backdrop-filter` (glass blur) → export-only solid backgrounds
  (scoped under `#exportHost`)
- `display: inline-flex` on the "RATE CARD" pill silently dropped its
  text in exported output → uses `display: flex; width: fit-content`
  instead, which rasterizes correctly
- Remove buttons are hidden in the export copy (`#exportHost
  .remove-btn { display: none; }`) so they never appear in a saved file

None of this affects the live glass UI in the browser — only the
exported file.
