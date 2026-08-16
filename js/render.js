/* =========================================================
   BROCHURE RENDERER
   Builds the entire catalogue from PRODUCTS + BRAND + CONTACT.
   Used identically by the live editor and the clean export,
   so the exported image always matches what's on screen.

   editable=true  -> weight/price become tappable fields
   editable=false -> plain text only (used for export)
   ========================================================= */

function buildProductCard(product) {
  const card = document.createElement("div");
  card.className = "product-card";
  card.innerHTML = `
    <div class="no-badge">${product.id}</div>
    <div class="photo-frame">
      <img src="${product.image}" alt="${product.nameEn}" loading="eager">
    </div>
    <div class="p-names">
      <span class="p-bn">${product.nameBn}</span>
      <span class="p-en">${product.nameEn}</span>
    </div>
    <div class="p-meta">
      <div class="meta-pill weight">
        <span class="meta-label">ওজন / WEIGHT</span>
        <span class="field" data-id="${product.id}" data-type="weight">${product.weight}</span>
      </div>
      <div class="meta-pill price">
        <span class="meta-label">দর / RATE</span>
        <span class="field" data-id="${product.id}" data-type="price">₹${product.price}</span>
      </div>
    </div>
  `;
  return card;
}

function buildBrochure(editable) {
  const page = document.createElement("div");
  page.className = "brochure" + (editable ? " editable" : "");
  page.id = editable ? "editorBrochureInner" : "exportBrochureInner";

  page.innerHTML = `
    <div class="header">
      <div class="header-top">
        <div class="logo-badge">
          <span class="chili">🌶️</span>
          <span class="word1">MOMI</span>
          <span class="word2">MASALA</span>
        </div>
        <div class="title-block">
          <h1 class="brand-title">${BRAND.nameBn}</h1>
          <div class="brand-sub">${BRAND.nameEn}</div>
          <div class="brand-tagline">${BRAND.tagline}</div>
        </div>
      </div>

      <div class="brochure-pill">
        <span class="bp-bn">${BRAND.catalogueLabelBn}</span>
        <span class="bp-dot">•</span>
        <span class="bp-en">${BRAND.catalogueLabelEn}</span>
      </div>
      <div class="subheading">${BRAND.subheading}</div>
      <div class="divider"></div>
    </div>

    <div class="grid" id="productGrid"></div>

    <div class="footer-tagline">${BRAND.footerLine}</div>

    <div class="footer-bar">
      <span class="fb-item">${CONTACT.callPhone}</span>
      <span class="fb-dot">•</span>
      <span class="fb-item">${CONTACT.whatsappPhone}</span>
      <span class="fb-dot">•</span>
      <span class="fb-addr">${CONTACT.address}</span>
    </div>
    <div class="proprietor">${BRAND.proprietor}</div>
  `;

  const grid = page.querySelector("#productGrid");
  PRODUCTS.forEach((p) => grid.appendChild(buildProductCard(p)));

  if (editable) wireEditing(page);
  return page;
}
