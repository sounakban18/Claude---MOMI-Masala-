# MOMI MASALA — Rate Card Editor

A mobile-first, editable rate card for MOMI MASALA's 9 premium spice
items, with a modern glass-style app UI wrapped around a richer,
traditional maroon/cream/gold rate card. Open `index.html` directly in
any browser — no server, build step, or install required.

## How to use

- Open `index.html` on your phone or computer.
- Tap any **weight (kg)** or **price** value to edit it. Everything
  else (product photos, names, numbering, branding, contact info) is
  fixed.
- Tap **Save** in the top-right header for a dropdown with **PDF**,
  **PNG**, or **JPG** — each downloads the rate card with your latest
  edits and none of the app's own UI (no buttons, no input borders).
- Tap **Share** to hand the rate card straight to your device's native
  share sheet (WhatsApp, Mail, Messages, etc.) where supported. If the
  browser doesn't support file sharing, it lets you know so you can use
  Save instead rather than doing nothing.

## Project structure

```
index.html               Page shell, loads css/js in order
css/style.css             All styling (glass app UI + rate card design)
js/products.js            Product data (names, weight in kg, price) — edit here
js/product-images.js      Product photos + logo + shop banner, base64-embedded
js/render.js               Builds the rate card DOM from the data
js/editor.js                Tap-to-edit behaviour + responsive scaling
js/export.js                 Save (PDF/PNG/JPG) + Share logic
js/html2canvas.min.js      Vendored rasterizing library (works offline)
js/jspdf.min.js             Vendored PDF library (works offline)
assets/products/*.jpg      Original product photos, kept for reference
assets/brand/               Logo (transparent PNG) + cropped shop banner
```

## Editing product data

Everything about a product lives in one place: `js/products.js`. There
are exactly **9 products** — Cinnamon (id 3) is the one product with
**two** images shown together in a single card; every other product
has one.

```js
{
  id: 1,
  nameBn: "এলাচ",
  nameEn: "Cardamom",
  images: [PRODUCT_IMAGES.cardamom],
  weightKg: 0.025,
  price: 60,
}
```

Weight is stored as a plain number **in kilograms** (`0.025`, not
`"25gm"`). `formatWeightKg()` in `products.js` turns it into the
display string, matching the pattern from the spec: whole numbers show
plain (`1 kg`), everything else shows 3 decimals (`0.025 kg`,
`0.100 kg`). Day-to-day weight/price changes don't need any of this —
they're editable directly by tapping the field in the app.

## Why images are base64-embedded

The real photo/logo/banner files are also kept under `assets/` so the
project stays easy to browse and maintain, but `js/product-images.js`
embeds the same images as base64 and that's what the app actually
displays.

This is because opening an HTML file directly from disk (`file://` —
the normal way to open a downloaded app like this) makes browsers
treat any separately-referenced local image file as cross-origin for
canvas purposes, which silently breaks PDF/PNG/JPG export with a
security error. Base64 sidesteps that entirely, so export works with
zero setup on any device, with or without a real web server.

To swap an image: replace the file under `assets/`, then regenerate
its base64 with this Python snippet run from the project root, and
paste the output into the matching entry in `js/product-images.js`:

```python
import base64
with open("assets/products/01-cardamom.jpg", "rb") as f:
    print(base64.b64encode(f.read()).decode("ascii"))
```

## Asset notes

- **Logo** (`assets/brand/momi-logo.png`): the uploaded logo image with
  its black background removed (via border-connected flood-fill, not a
  simple color threshold — the dark maroon "MOMI MASALA" text in the
  artwork is preserved, only the actual background became transparent).
- **Shop banner** (`assets/brand/shop-banner.jpg`): cropped tightly to
  just the signboard from the shop photo (no roof, shutter, or street),
  then mildly upscaled and sharpened for a crisper look.
- **Store info**: phone numbers, address, and proprietor name in
  `js/products.js` (`BRAND` / `CONTACT`) were read directly off the
  signboard photo. The PIN code wasn't legible in the photo, so it was
  left out rather than guessed.
- **Product photos**: reused from earlier in the project conversation,
  since the latest round of instructions referenced new sequential
  uploads that weren't actually attached. Mapped as: Cardamom, Clove,
  Cinnamon (2 images), Nutmeg, Mace, Caraway Seeds/Black Cumin, White
  Pepper, Black Pepper, Rose Petals — double-check this mapping against
  your intended photos and swap any that don't match.

## Notes on the export rendering

A couple of CSS patterns used in the live app don't rasterize correctly
inside the `html2canvas` library used for Save/Share, so they're
avoided (or given export-only overrides) in `css/style.css`:

- `backdrop-filter` (glass blur) → export-only solid backgrounds
  (scoped under `#exportHost`)
- gradient text (`background-clip: text`) → avoided entirely in this
  version's design (solid brand-colour text used instead)
- `display: inline-flex` on the "RATE CARD" pill silently dropped its
  text in exported output → changed to `display: flex; width:
  fit-content` instead, which rasterizes correctly

None of this affects the live glass UI in the browser — only the
exported file.
