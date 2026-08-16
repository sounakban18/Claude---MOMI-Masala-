/* =========================================================
   APP-STATE.JS
   The single place that owns "live" product data in memory.
   Everything else (render.js, editor.js, ui-manage.js,
   export.js) reads from AppState.products and calls its
   methods to change data — nobody else talks to DB directly
   except through here.

   AppState.products: render-ready records. `images` is an
   array of blob: object URLs (safe to use directly as <img
   src>). `raw` holds the original DB record (with real Blobs)
   for anything that needs the actual bytes (backup export).
   ========================================================= */

const AppState = {
  products: [], // render-ready, sorted by position
  ready: false,

  async init() {
    await DB.open();
    const migrated = await DB.getMeta("migrated");
    if (!migrated) {
      await this._migrateDefaults();
      await DB.setMeta("migrated", true);
    }
    await this.reload();
    this.ready = true;
  },

  async _migrateDefaults() {
    const now = Date.now();
    const records = [];
    for (const p of DEFAULT_PRODUCTS) {
      const blobs = [];
      for (const src of p.images) {
        blobs.push(await dataUrlToBlob(src));
      }
      records.push({
        id: p.id,
        nameBn: p.nameBn,
        nameEn: p.nameEn,
        weightKg: p.weightKg,
        price: p.price,
        images: blobs,
        position: p.position,
        createdAt: now,
        updatedAt: now,
      });
    }
    await DB.bulkPutProducts(records);
  },

  /* Rebuilds AppState.products from whatever is currently in IndexedDB.
     Revokes previously-created object URLs first to avoid leaking them. */
  async reload() {
    this._revokeUrls();
    const raw = await DB.getAllProducts();
    this.products = raw.map((p) => ({
      ...p,
      images: p.images.map((blob) => URL.createObjectURL(blob)),
      raw: p,
    }));
  },

  _revokeUrls() {
    this.products.forEach((p) => p.images.forEach((url) => URL.revokeObjectURL(url)));
  },

  getById(id) {
    return this.products.find((p) => p.id === id);
  },

  /* ---------- field edits (weight / price) ---------- */
  async updateField(id, field, value) {
    const product = this.products.find((p) => p.id === id);
    if (!product) return;
    const record = { ...product.raw, [field]: value, updatedAt: Date.now() };
    await DB.putProduct(record);
    product.raw = record;
    product[field] = value;
  },

  /* ---------- add ---------- */
  async addProduct({ nameBn, nameEn, weightKg, price, imageFile }) {
    const maxPosition = this.products.reduce((m, p) => Math.max(m, p.position ?? 0), 0);
    const now = Date.now();
    const record = {
      nameBn,
      nameEn,
      weightKg,
      price,
      images: [imageFile],
      position: maxPosition + 1,
      createdAt: now,
      updatedAt: now,
    };
    const id = await DB.putProduct(record);
    await this.reload();
    return id;
  },

  /* ---------- remove ---------- */
  async removeProduct(id) {
    await DB.deleteProduct(id);
    await this._recompactPositions();
    await this.reload();
  },

  async _recompactPositions() {
    const raw = await DB.getAllProducts();
    raw.sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    for (let i = 0; i < raw.length; i++) {
      const wanted = i + 1;
      if (raw[i].position !== wanted) {
        raw[i].position = wanted;
        raw[i].updatedAt = Date.now();
        await DB.putProduct(raw[i]);
      }
    }
  },

  /* ---------- backup / restore support ---------- */
  async replaceAllWithBackup(records) {
    this._revokeUrls();
    await DB.clearAllProducts();
    await DB.bulkPutProducts(records);
    await this.reload();
  },
};
