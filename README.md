# MOMI MASALA — Rate Card Editor

A mobile-first, editable rate card app with a real local database
(IndexedDB), full product management (add/remove/edit), local backup
& restore, and a modern glass-style UI wrapped around a richer,
traditional maroon/cream/gold rate card.

Designed to run inside an Android WebView (Vercel → WebIntoApp APK) —
everything works fully offline after the first load. No server or
internet connection is required for normal use.

## This round's fixes (in order of priority, per explicit instruction)

**1. Real root cause of "file creation failed" found and fixed.** In
`js/utils/file-pipeline.js`, `navigator.canShare({files:[file]})` was
called directly inside an `if` condition, unguarded. On several real
Android WebView builds (and some desktop Chrome versions) with
partial/buggy Web Share Level 2 support, `canShare()` **throws** a
`TypeError` instead of returning `false` — and that exception
propagated straight out of the whole delivery pipeline before it ever
reached the anchor-download fallback, which is exactly what would
produce a hard failure on mobile while desktop (where the browser's
`canShare` implementation happens to be well-behaved) kept working.
Fixed by wrapping the entire feature-detection-through-share-attempt
block in one try/catch, so any failure there — from feature detection
through the actual `share()` call — now falls through to the download
fallback instead of aborting everything. **Reproduced this exact
scenario in a test** (a fake `navigator.share`/`canShare` that throws,
mimicking the buggy WebView) and confirmed the file still downloads
successfully afterward.

**2. Second, independent mobile failure mode fixed:** a 9-product card
rendered at a flat `scale: 2.5` can produce a canvas with 15–20M+ total
pixels, which exceeds the GPU texture/canvas size limit on a lot of
lower-end Android devices (limits as low as ~4096×4096 ≈ 16.7M pixels
are common). When that limit is hit, `canvas.toBlob()` typically just
resolves with `null` rather than throwing anything catchable earlier.
`renderExportCanvas()` in `js/export.js` now measures the card's actual
size first and clamps the requested scale to a safe total-pixel budget
before ever calling html2canvas, with automatic retry at progressively
lower scales if an attempt still fails. Also added a 20-second timeout
around `canvas.toBlob()` so a hang (rather than an error) can't leave
the button stuck on "Generating..." forever.

**3. Error messages are now specific**, not one generic string —
`describeExportError()` in `export.js` inspects what actually failed
(empty blob / timeout / canvas failure / delivery failure) and shows a
message that matches, so a real failure on a real device gives an
actionable clue instead of the same unhelpful text every time.

**4. Dark mode / Light mode / System** (`js/theme.js`) — three
options, System is the default, persisted to `localStorage`, reacts
live to OS theme changes via `prefers-color-scheme` while System is
selected. Applied with an inline `<head>` script (before first paint,
no flash-of-wrong-theme) plus the full interactive picker. Only the
app chrome changes — a CSS variable-scoping rule explicitly re-pins
`.ratecard` (both the live preview and the export target) back to its
fixed light/brand colours regardless of theme, so exported files never
come out dark or inverted.

**5. Branding hierarchy strengthened**: the Bengali "মমি মসলা" title
is now a large heading directly under the logo (previously there
wasn't a dedicated Bengali title element at all), and the two phone
numbers are now real `tel:` links in large, high-contrast, brand- and
WhatsApp-green-coloured pills placed directly below the brand
name/banner block — not buried in the footer, and with a minimum
44px tap-target height for mobile. Note: the phone numbers were
updated to 9674165494 / 7866051940 per this round's explicit
instruction — this **differs** from 9674165424 / 7980051940, which
was read directly off the actual shop signboard photo in an earlier
round. Worth double-checking which pair is actually correct.

**6. A real bug caught by testing, not just claimed to be fixed:**
after widening the expand-sheet's image for more visual presence, its
close button became unclickable — the image sat on top of it with a
higher effective stacking order. Caught this by actually clicking the
button in a test rather than only looking at a screenshot; fixed with
an explicit `z-index` and a more visible glass backdrop on the close
button so it's clickable regardless of what's behind it (photo or
plain sheet background).

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
js/export.js                   Save (PDF/PNG/JPG) + Share generation logic,
                             reading from AppState.products so exports
                             always reflect whatever's currently in the
                             database. Delivery goes through utils/file-pipeline.js.
js/utils/file-pipeline.js      Cross-platform file delivery (the mobile
                             download/share fix — see below). The only
                             file that touches URL.createObjectURL,
                             <a download>, or navigator.share directly.
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

## Mobile download/share fix (js/utils/file-pipeline.js)

**Root cause found:** the previous file-delivery code only attempted
the Web Share API on iOS. On Android — which is what the WebIntoApp
WebView wraps — it went straight to an `<a download>` click on a
`blob:` URL. Android WebViews generally have no download manager
wired up for client-generated `blob:` URLs (that mechanism normally
only fires for real HTTP downloads unless the host app explicitly
implements a `DownloadListener`), so the click silently did nothing —
and the old code still reported success regardless, since it never
checked whether anything had actually happened.

**The fix** (`js/utils/file-pipeline.js`) is a single shared delivery
path used by both Save and Share, in this order:

1. Validate the blob has real, non-zero content before doing anything.
2. Try the Web Share API with a real `File` object on **any**
   mobile/WebView context now, not just iOS — this is the path most
   likely to actually work inside a WebView, since Chromium-based
   WebViews (what WebIntoApp uses) support it via an Android share
   intent.
3. Fall back to a normal anchor + blob URL download.
4. Fall back to opening the blob in a new tab (hands off to the
   system browser, or allows a long-press "save image").
5. Last resort: same thing with a `data:` URI, since some locked-down
   WebViews block `blob:` navigation specifically but still allow
   `data:` URIs.

Each step is honestly reported back via a method-specific toast (e.g.
"Download started" vs "Shared" vs "Opened in new tab — long-press to
save") rather than one blanket "saved" message — the app never claims
a file was saved when it can't actually confirm that.

**Testing note:** I verified this end-to-end in headless Chromium with
both a desktop context and an Android-device-emulated context (Pixel
5 UA/viewport/touch), confirming the full fallback chain executes
without errors and produces valid, correctly-sized, correctly-MIME'd
files in both cases. I could not verify the Web Share API's actual
behavior inside the real WebIntoApp WebView itself, since Playwright's
Chromium doesn't implement `navigator.share` regardless of device
emulation — that step should be tested in the built APK directly. If
it still doesn't trigger a native share sheet there, the WebView build
likely needs its manifest/config updated to grant the share intent
permission (a WebIntoApp project setting, not something fixable from
the web code alone).

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
