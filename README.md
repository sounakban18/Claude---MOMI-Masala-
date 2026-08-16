# MOMI MASALA — Product Brochure App

A mobile-first, editable product brochure for MOMI MASALA's 9 premium
spice items, with a modern glass-style app UI wrapped around a warm,
traditional brochure design. Open `index.html` directly in any browser
— no server, build step, or install required.

## How to use

- Open `index.html` on your phone or computer.
- Tap any **weight** or **price** value to edit it. Everything else
  (product photos, names, numbering, branding, contact info) is fixed.
- Tap **Save** in the top-right header for a dropdown with **PDF**,
  **PNG**, or **JPG** — each downloads the brochure with your latest
  edits and none of the app's own UI (no buttons, no input borders).
- Tap **Share** to hand the brochure straight to your device's native
  share sheet (WhatsApp, Mail, Messages, etc.) where supported. If the
  browser doesn't support file sharing, it lets you know so you can use
  Save instead rather than doing nothing.

## Project structure

```
index.html               Page shell, loads css/js in order
css/style.css             All styling (glass app UI + brochure design)
js/products.js            Product data (names, weight, price) — edit here
js/product-images.js      Product photos + shop signage, base64-embedded
js/render.js              Builds the brochure DOM from the data
js/editor.js              Tap-to-edit behaviour + responsive scaling
js/export.js              Save (PDF/PNG/JPG) + Share logic
js/html2canvas.min.js     Vendored rasterizing library (works offline)
js/jspdf.min.js           Vendored PDF library (works offline)
assets/products/*.jpg     Your original product photos, kept for reference
assets/brand/             Cropped shop signage photo, kept for reference
```

## Editing product data

Everything about a product lives in one place: `js/products.js`. There
are exactly **9 products** — if you add a 10th, also add its image to
`js/product-images.js` (see below), or it won't have a picture.

```js
{
  id: 1,
  nameBn: "এলাচ",
  nameEn: "Green Cardamom",
  image: PRODUCT_IMAGES.cardamom,
  imagePath: "assets/products/01-cardamom.jpg",
  weight: "25gm",
  price: 60,
}
```

Day-to-day weight/price changes don't need any of this — they're
editable directly by tapping the field in the app. Edit this file only
for permanent defaults, reordering, or adding/removing a product.

## Why product photos are base64-embedded

The real photo files are also kept in `assets/products/` so the project
stays easy to browse and maintain, but `js/product-images.js` embeds
the same photos as base64 and that's what the app actually displays.

This is because opening an HTML file directly from disk (`file://` —
the normal way to open a downloaded app like this) makes browsers treat
any separately-referenced local image file as cross-origin for canvas
purposes, which silently breaks PDF/PNG/JPG export with a security
error. Base64 sidesteps that entirely, so export works with zero setup
on any device, with or without a real web server.

To swap a photo: replace the file in `assets/products/`, then
regenerate its base64 with this Python snippet run from the project
root, and paste the output into the matching entry in
`js/product-images.js`:

```python
import base64
with open("assets/products/01-cardamom.jpg", "rb") as f:
    print(base64.b64encode(f.read()).decode("ascii"))
```

## Store info source

Brand name, phone numbers, address, and proprietor name in
`js/products.js` (`BRAND` / `CONTACT`) were read directly off the
supplied shop signboard photo. The signboard's PIN code wasn't legible
in the photo, so it was left out rather than guessed — add it to
`CONTACT.address` if you have it. The cropped signboard image used in
the app header strip lives at `assets/brand/shop-signboard.jpg`.

## Notes on the export rendering

A couple of modern CSS effects used in the live app UI don't rasterize
correctly inside the `html2canvas` library used for Save/Share, so
`css/style.css` has export-only overrides (scoped under `#exportHost`)
that swap them for solid-colour equivalents at export time:

- `backdrop-filter` (glass blur) → plain solid backgrounds
- gradient text (`background-clip: text`) → solid brand-maroon text

This only affects the exported file — the live glass UI in the browser
is unaffected.
