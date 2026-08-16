/* =========================================================
   PRODUCT DATA — brochure edition (10 premium spice items)
   Sequence is fixed per instruction:
     1. Cardamom (Elaichi)
     2. Clove (Lobongo)
     3. Cinnamon (Daruchini)
     4-10. In the exact order the photos were supplied.

   `image` is the actual bytes used for display/export (see
   product-images.js for why). `imagePath` documents which
   file in /assets/products/ it corresponds to, for anyone
   maintaining this later.
   ========================================================= */

const PRODUCTS = [
  {
    id: 1,
    nameBn: "এলাচ",
    nameEn: "Green Cardamom",
    image: PRODUCT_IMAGES.cardamom,
    imagePath: "assets/products/01-cardamom.jpg",
    weight: "25gm",
    price: 60,
  },
  {
    id: 2,
    nameBn: "লবঙ্গ",
    nameEn: "Clove",
    image: PRODUCT_IMAGES.clove,
    imagePath: "assets/products/02-clove.jpg",
    weight: "25gm",
    price: 25,
  },
  {
    id: 3,
    nameBn: "দারুচিনি",
    nameEn: "Cinnamon Bark",
    image: PRODUCT_IMAGES.cinnamonBark,
    imagePath: "assets/products/03-cinnamon-bark.jpg",
    weight: "25gm",
    price: 25,
  },
  {
    id: 4,
    nameBn: "দারুচিনি স্টিক",
    nameEn: "Cinnamon Sticks",
    image: PRODUCT_IMAGES.cinnamonSticks,
    imagePath: "assets/products/04-cinnamon-sticks.jpg",
    weight: "25gm",
    price: 30,
  },
  {
    id: 5,
    nameBn: "জায়ফল",
    nameEn: "Nutmeg",
    image: PRODUCT_IMAGES.nutmeg,
    imagePath: "assets/products/05-nutmeg.jpg",
    weight: "25gm",
    price: 40,
  },
  {
    id: 6,
    nameBn: "জয়ত্রী",
    nameEn: "Mace",
    image: PRODUCT_IMAGES.mace,
    imagePath: "assets/products/06-mace.jpg",
    weight: "25gm",
    price: 50,
  },
  {
    id: 7,
    nameBn: "জিরে",
    nameEn: "Cumin Seeds",
    image: PRODUCT_IMAGES.cuminSeeds,
    imagePath: "assets/products/07-cumin-seeds.jpg",
    weight: "100gm",
    price: 25,
  },
  {
    id: 8,
    nameBn: "সাদা গোলমরিচ",
    nameEn: "White Pepper",
    image: PRODUCT_IMAGES.whitePepper,
    imagePath: "assets/products/08-white-pepper.jpg",
    weight: "100gm",
    price: 60,
  },
  {
    id: 9,
    nameBn: "কালো গোলমরিচ",
    nameEn: "Black Pepper",
    image: PRODUCT_IMAGES.blackPepper,
    imagePath: "assets/products/09-black-pepper.jpg",
    weight: "100gm",
    price: 50,
  },
];

/* =========================================================
   BRAND / STORE DATA
   Extracted directly from the supplied shop signboard photo.
   Phone numbers and address below were read off that photo —
   the PIN code was not legible on the signboard, so it is
   left out rather than guessed. Edit here if anything needs
   correcting.
   ========================================================= */

const BRAND = {
  nameBn: "মমি মসলা",
  nameEn: "MOMI MASALA",
  tagline: "বিশুদ্ধ মসলা • ঘরোয়া স্বাদ • নির্ভরযোগ্য মান",
  proprietor: "প্রোঃ গোপাল চক্রবর্তী",
  catalogueLabelBn: "প্রোডাক্ট ব্রোশিওর",
  catalogueLabelEn: "PRODUCT BROCHURE",
  subheading: "৯টি নির্বাচিত মসলার প্যাকেট সাইজ ও মূল্য",
  footerLine: "বিশুদ্ধ মসলা • সুস্থ পরিবার • সুস্বাদু জীবন",
};

const CONTACT = {
  callPhone: "9674165424",
  whatsappPhone: "7980051940",
  address: "নীহারবিন্দু আবাসন, সরোজ পার্ক, বারাসাত",
};
