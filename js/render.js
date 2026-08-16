/* =========================================================
   RATE CARD RENDERER
   Builds the entire rate card from PRODUCTS + BRAND + CONTACT.
   Used identically by the live editor and the clean export,
   so the exported file always matches what's on screen.

   editable=true  -> weight/price become tappable fields
   editable=false -> plain text only (used for export)
   ========================================================= */

function buildProductPhotos(product) {
  if (product.images.length === 1) {
    return `<div class="photo-frame single"><img src="${product.images[0]}" alt="${product.nameEn}" loading="eager"></div>`;
  }
  // Cinnamon: two images shown together, side by side, inside one card
  return `
    <div class="photo-frame split">
      ${product.images.map((src) => `<img src="${src}" alt="${product.nameEn}" loading="eager">`).join("")}
    </div>
  `;
}

function buildProductCard(product) {
  const card = document.createElement("div");
  card.className = "product-card";
  card.innerHTML = `
    <div class="card-photo">
      ${buildProductPhotos(product)}
      <span class="no-tag">${String(product.id).padStart(2, "0")}</span>
    </div>
    <div class="card-body">
      <div class="p-names">
        <span class="p-bn">${product.nameBn}</span>
        <span class="p-en">${product.nameEn}</span>
      </div>
      <div class="p-meta">
        <span class="meta-weight">
          <span class="field" data-id="${product.id}" data-type="weight">${formatWeightKg(product.weightKg)}</span>
        </span>
        <span class="meta-price">
          <span class="field" data-id="${product.id}" data-type="price">₹${product.price}</span>
        </span>
      </div>
    </div>
  `;
  return card;
}

function buildRateCard(editable) {
  const page = document.createElement("div");
  page.className = "ratecard" + (editable ? " editable" : "");
  page.id = editable ? "editorCardInner" : "exportCardInner";

  page.innerHTML = `
    <div class="header">
      <img class="brand-logo" src="${BRAND.logo}" alt="MOMI MASALA logo">

      <div class="banner-block">
        <img class="shop-banner" src="${BRAND.banner}" alt="MOMI MASALA shop signboard">
        <div class="banner-contact">
          <span class="bc-item">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.2c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.4 0 .8-.2 1L6.6 10.8z"/></svg>
            ${CONTACT.callPhone}
          </span>
          <span class="bc-item">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15L2 22l5.1-1.3A10 10 0 1 0 12 2zm0 18.2c-1.6 0-3.2-.4-4.5-1.3l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1-.2.2-.7.8-.8 1-.2.2-.3.2-.5.1-.2-.1-1-.4-2-1.2-.7-.6-1.2-1.4-1.4-1.6-.1-.2 0-.4.1-.5.1-.1.2-.3.4-.4.1-.2.2-.3.2-.5.1-.2 0-.4 0-.5-.1-.1-.6-1.4-.8-1.9-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.2.2-.9.9-.9 2.2 0 1.3.9 2.6 1.1 2.8.1.2 1.9 2.9 4.6 4 .6.3 1.1.4 1.5.6.6.2 1.2.2 1.6.1.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.2-.3-.2-.5-.3z"/></svg>
            ${CONTACT.whatsappPhone}
          </span>
        </div>
      </div>

      <div class="brand-name-row">
        <span class="brand-name-en">${BRAND.nameEn}</span>
        <span class="brand-tagline">${BRAND.taglineBn} • ${BRAND.tagline}</span>
      </div>

      <div class="ratecard-pill">
        <span class="rc-bn">${BRAND.catalogueLabelBn}</span>
        <span class="rc-dot">•</span>
        <span class="rc-en">${BRAND.catalogueLabelEn}</span>
      </div>
      <div class="divider"></div>
    </div>

    <div class="grid" id="productGrid"></div>

    <div class="footer-tagline">${BRAND.footerLine}</div>
    <div class="proprietor">${BRAND.proprietor} • ${CONTACT.address}</div>
  `;

  const grid = page.querySelector("#productGrid");
  PRODUCTS.forEach((p) => grid.appendChild(buildProductCard(p)));

  if (editable) wireEditing(page);
  return page;
}
