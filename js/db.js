/* =========================================================
   DB.JS — IndexedDB abstraction layer
   Every other file talks to the database through this object
   only; nothing else touches indexedDB directly. Two object
   stores:
     - "products": one record per product (id, names, weight,
       price, images as Blobs, position, timestamps)
     - "meta": small key/value store for things like the
       "has migration run" flag and "last backup" timestamp
   ========================================================= */

const DB = (() => {
  const DB_NAME = "momiMasalaDB";
  const DB_VERSION = 1;
  const STORE_PRODUCTS = "products";
  const STORE_META = "meta";

  let dbPromise = null;

  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);

      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_PRODUCTS)) {
          const store = db.createObjectStore(STORE_PRODUCTS, { keyPath: "id", autoIncrement: true });
          store.createIndex("position", "position", { unique: false });
        }
        if (!db.objectStoreNames.contains(STORE_META)) {
          db.createObjectStore(STORE_META, { keyPath: "key" });
        }
      };

      req.onsuccess = (e) => resolve(e.target.result);
      req.onerror = (e) => reject(e.target.error);
    });
    return dbPromise;
  }

  function tx(storeName, mode) {
    return open().then((db) => db.transaction(storeName, mode).objectStore(storeName));
  }

  /* ---------- products ---------- */

  async function getAllProducts() {
    const store = await tx(STORE_PRODUCTS, "readonly");
    return new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => {
        const items = req.result || [];
        items.sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
        resolve(items);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async function putProduct(product) {
    const store = await tx(STORE_PRODUCTS, "readwrite");
    return new Promise((resolve, reject) => {
      const req = store.put(product);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function deleteProduct(id) {
    const store = await tx(STORE_PRODUCTS, "readwrite");
    return new Promise((resolve, reject) => {
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async function clearAllProducts() {
    const store = await tx(STORE_PRODUCTS, "readwrite");
    return new Promise((resolve, reject) => {
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async function bulkPutProducts(list) {
    const store = await tx(STORE_PRODUCTS, "readwrite");
    return new Promise((resolve, reject) => {
      let remaining = list.length;
      if (remaining === 0) { resolve(); return; }
      list.forEach((item) => {
        const req = store.put(item);
        req.onsuccess = () => { remaining--; if (remaining === 0) resolve(); };
        req.onerror = () => reject(req.error);
      });
    });
  }

  /* ---------- meta ---------- */

  async function getMeta(key) {
    const store = await tx(STORE_META, "readonly");
    return new Promise((resolve, reject) => {
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result ? req.result.value : undefined);
      req.onerror = () => reject(req.error);
    });
  }

  async function setMeta(key, value) {
    const store = await tx(STORE_META, "readwrite");
    return new Promise((resolve, reject) => {
      const req = store.put({ key, value });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  return {
    open,
    getAllProducts,
    putProduct,
    deleteProduct,
    clearAllProducts,
    bulkPutProducts,
    getMeta,
    setMeta,
  };
})();
