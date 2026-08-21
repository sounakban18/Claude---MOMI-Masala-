/* =========================================================
   DEFAULT_PRODUCTS — seed data only.
   This array is used exactly once: the first time the app
   opens and IndexedDB is empty, it gets migrated in as real
   database records (see db-init.js). After that, IndexedDB
   is the single source of truth — editing this array later
   has no effect on an app that has already launched once.

   Cinnamon (id 3) is the one product with TWO images shown
   together in a single card — everything else has one.
   Weight is stored in KG; `formatWeightKg()` turns a number
   into the display string ("0.025 kg", "1 kg").
   ========================================================= */

const DEFAULT_PRODUCTS = [
  { id: 1, nameBn: "এলাচ", nameEn: "Cardamom", images: [PRODUCT_IMAGES.cardamom], weightKg: 0.025, price: 60, position: 1 },
  { id: 2, nameBn: "লবঙ্গ", nameEn: "Clove", images: [PRODUCT_IMAGES.clove], weightKg: 0.025, price: 25, position: 2 },
  { id: 3, nameBn: "দারুচিনি", nameEn: "Cinnamon", images: [PRODUCT_IMAGES.cinnamonA, PRODUCT_IMAGES.cinnamonB], weightKg: 0.025, price: 25, position: 3 },
  { id: 4, nameBn: "জায়ফল", nameEn: "Nutmeg", images: [PRODUCT_IMAGES.nutmeg], weightKg: 0.025, price: 40, position: 4 },
  { id: 5, nameBn: "জৈত্রী", nameEn: "Mace", images: [PRODUCT_IMAGES.mace], weightKg: 0.025, price: 50, position: 5 },
  { id: 6, nameBn: "সা-জিরে", nameEn: "Caraway Seeds / Black Cumin", images: [PRODUCT_IMAGES.caraway], weightKg: 0.1, price: 25, position: 6 },
  { id: 7, nameBn: "সাদা মরিচ", nameEn: "White Pepper", images: [PRODUCT_IMAGES.whitePepper], weightKg: 0.1, price: 60, position: 7 },
  { id: 8, nameBn: "গোল মরিচ", nameEn: "Black Pepper", images: [PRODUCT_IMAGES.blackPepper], weightKg: 0.1, price: 50, position: 8 },
  { id: 9, nameBn: "গোলাপ পাপড়ি", nameEn: "Rose Petals", images: [PRODUCT_IMAGES.rosePetals], weightKg: 0.1, price: 40, position: 9 },
];

/* Turns a numeric kg value into the display string, matching the
   spec's examples: whole numbers show plain ("1 kg"), everything
   else shows 3 decimal places ("0.025 kg", "0.100 kg"). */
function formatWeightKg(kg) {
  const n = Number(kg);
  const str = Number.isInteger(n) ? String(n) : n.toFixed(3);
  return `${str} kg`;
}

/* =========================================================
   BRAND / STORE DATA
   Phone numbers, address, and proprietor were read directly
   off the shop signboard photo. The PIN code wasn't legible
   on the signboard, so it's left out rather than guessed.
   ========================================================= */

const BRAND = {
  logo: LOGO_IMAGE,
  banner: SHOP_BANNER,
  nameBn: "মমি মসলা",
  nameEn: "MOMI MASALA",
  tagline: "Premium Spice Collection",
  taglineBn: "প্রিমিয়াম স্পাইস কালেকশন",
  proprietor: "প্রোঃ গোপাল চক্রবর্তী",
  catalogueLabelBn: "মূল্য তালিকা",
  catalogueLabelEn: "RATE CARD",
  footerLine: "বিশুদ্ধ মসলা • সুস্থ পরিবার • সুস্বাদু জীবন",
};

const CONTACT = {
  callPhone: "9674165494",
  whatsappPhone: "7866051940",
  address: "নীহারবিন্দু আবাসন, সরোজ পার্ক, বারাসাত",
};
