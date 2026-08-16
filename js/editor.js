/* =========================================================
   EDITOR.JS
   Owns the live, editable rate card view: builds it from
   AppState.products, wires up tap-to-edit for weight/price
   (persisted immediately to IndexedDB), and re-renders the
   whole card after any data change (edit, add, remove,
   restore) so the UI never drifts from the database.
   ========================================================= */

const CARD_WIDTH = 720;

function renderEditor() {
  const host = document.getElementById("editorCard");
  host.innerHTML = "";
  host.appendChild(buildRateCard(true));
  fitToViewport();
  refitAfterImagesLoad(host);
}

/* ---------- tap-to-edit: weight (kg) and price ---------- */

function wireEditing(rootEl) {
  rootEl.querySelectorAll(".field").forEach((fieldEl) => {
    fieldEl.addEventListener("click", (e) => {
      e.stopPropagation(); // don't also trigger the card's expand handler
      activateField(fieldEl);
    });
  });

  rootEl.querySelectorAll(".product-card").forEach((cardEl) => {
    cardEl.addEventListener("click", (e) => {
      if (e.target.closest(".field") || e.target.closest(".remove-btn")) return;
      openExpandSheet(parseInt(cardEl.dataset.id, 10));
    });
  });

  rootEl.querySelectorAll(".remove-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      requestRemoveProduct(parseInt(btn.dataset.removeId, 10));
    });
  });
}

function activateField(fieldEl) {
  if (fieldEl.querySelector("input")) return;

  const id = parseInt(fieldEl.dataset.id, 10);
  const type = fieldEl.dataset.type; // "weightKg" | "price"
  const product = AppState.getById(id);
  const currentValue = type === "price" ? String(product.price) : String(product.weightKg);

  fieldEl.classList.add("editing");
  fieldEl.parentElement.classList.add("field-editing");
  fieldEl.innerHTML = "";
  const input = document.createElement("input");
  input.className = "field-input";
  input.value = currentValue;
  input.inputMode = "decimal";
  fieldEl.appendChild(input);
  input.focus();
  input.select();

  const commit = () => saveField(fieldEl, product, type, input.value, currentValue);
  input.addEventListener("blur", commit);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") input.blur();
    if (e.key === "Escape") { input.value = currentValue; input.blur(); }
  });
}

async function saveField(fieldEl, product, type, rawValue, fallback) {
  const value = rawValue.trim().replace(/kg|₹|,/gi, "").trim();
  const num = parseFloat(value);
  let valid = true;
  let display;
  let newValue;

  if (type === "price") {
    if (value === "" || isNaN(num) || num < 0) { valid = false; display = `₹${fallback}`; }
    else { newValue = num % 1 === 0 ? num : Math.round(num * 100) / 100; display = `₹${newValue}`; }
  } else {
    if (value === "" || isNaN(num) || num <= 0) { valid = false; display = formatWeightKg(fallback); }
    else { newValue = num; display = formatWeightKg(num); }
  }

  fieldEl.classList.remove("editing");
  fieldEl.parentElement.classList.remove("field-editing");
  fieldEl.textContent = display;

  if (!valid) {
    fieldEl.classList.add("invalid");
    setTimeout(() => fieldEl.classList.remove("invalid"), 350);
    showToast(
      type === "price"
        ? "দাম অবশ্যই একটি বৈধ সংখ্যা হতে হবে (০ বা তার বেশি)"
        : "ওজন অবশ্যই ০ এর বেশি একটি সংখ্যা হতে হবে (কেজিতে), যেমন 0.025"
    );
    return;
  }

  fieldEl.classList.add("just-saved");
  setTimeout(() => fieldEl.classList.remove("just-saved"), 420);

  try {
    await AppState.updateField(product.id, type, newValue);
    showToast(type === "price" ? "দাম আপডেট হয়েছে ✓" : "ওজন আপডেট হয়েছে ✓", 1600);
  } catch (err) {
    console.error(err);
    showToast("সেভ করা যায়নি, আবার চেষ্টা করুন");
  }
}

/* ---------- remove product ---------- */

function requestRemoveProduct(id) {
  const product = AppState.getById(id);
  if (!product) return;
  openConfirmDialog({
    title: "প্রোডাক্ট মুছবেন?",
    message: `"${product.nameBn} / ${product.nameEn}" ব্রোশিওর থেকে স্থায়ীভাবে সরিয়ে দেওয়া হবে।`,
    confirmLabel: "Remove",
    danger: true,
    onConfirm: async () => {
      try {
        await AppState.removeProduct(id);
        renderEditor();
        showToast("প্রোডাক্ট মুছে ফেলা হয়েছে ✓");
      } catch (err) {
        console.error(err);
        showToast("মুছতে সমস্যা হয়েছে, আবার চেষ্টা করুন");
      }
    },
  });
}

/* =========================================================
   RESPONSIVE SCALING — fixed design width, scaled to fit
   ========================================================= */

function fitToViewport() {
  const stage = document.getElementById("stage");
  const wrapper = document.getElementById("editorCard");
  if (!stage || !wrapper) return;

  const available = stage.parentElement.clientWidth;
  const scale = Math.min(1, available / CARD_WIDTH);
  const naturalHeight = wrapper.offsetHeight;

  wrapper.style.transform = `scale(${scale})`;
  wrapper.style.transformOrigin = "top left";

  stage.style.width = `${CARD_WIDTH * scale}px`;
  stage.style.height = `${naturalHeight * scale}px`;
  stage.style.margin = "0 auto";
}

function refitAfterImagesLoad(host) {
  const imgs = host.querySelectorAll("img");
  let remaining = imgs.length;
  if (remaining === 0) { fitToViewport(); return; }
  imgs.forEach((img) => {
    if (img.complete) { remaining--; if (remaining === 0) fitToViewport(); }
    else img.addEventListener("load", () => { remaining--; if (remaining <= 0) fitToViewport(); });
  });
}

window.addEventListener("resize", fitToViewport);

/* ---------- toast ---------- */
function showToast(msg, ms = 2400) {
  const toastEl = document.getElementById("toast");
  toastEl.textContent = msg;
  toastEl.classList.add("show");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toastEl.classList.remove("show"), ms);
}
