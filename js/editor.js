/* =========================================================
   EDITING BEHAVIOUR
   Only weight and price are interactive. Product names,
   numbering, photos, branding and contact details are never
   wired up here, so they can never be edited.
   ========================================================= */

function wireEditing(rootEl) {
  rootEl.querySelectorAll(".field").forEach((fieldEl) => {
    fieldEl.addEventListener("click", () => activateField(fieldEl));
  });
}

function activateField(fieldEl) {
  if (fieldEl.querySelector("input")) return;

  const id = parseInt(fieldEl.dataset.id, 10);
  const type = fieldEl.dataset.type;
  const product = PRODUCTS.find((p) => p.id === id);
  const currentValue = type === "price" ? String(product.price) : product.weight;

  fieldEl.classList.add("editing");
  fieldEl.innerHTML = "";
  const input = document.createElement("input");
  input.className = "field-input";
  input.value = currentValue;
  input.inputMode = type === "price" ? "decimal" : "text";
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

function saveField(fieldEl, product, type, rawValue, fallback) {
  const value = rawValue.trim();
  let valid = true;
  let display;

  if (type === "price") {
    const num = parseFloat(value.replace(/[₹,]/g, ""));
    if (value === "" || isNaN(num) || num < 0) {
      valid = false;
      display = `₹${fallback}`;
    } else {
      product.price = num % 1 === 0 ? num : Math.round(num * 100) / 100;
      display = `₹${product.price}`;
    }
  } else {
    const match = value.match(/^(\d+(\.\d+)?)\s*([a-zA-Zঀ-\u09FF]*)$/);
    if (value === "" || !match) {
      valid = false;
      display = fallback;
    } else {
      const unit = match[3] || "gm";
      product.weight = `${match[1]}${unit}`;
      display = product.weight;
    }
  }

  fieldEl.classList.remove("editing");
  fieldEl.textContent = display;

  if (!valid) {
    fieldEl.classList.add("invalid");
    setTimeout(() => fieldEl.classList.remove("invalid"), 350);
    showToast(
      type === "price"
        ? "দাম অবশ্যই একটি বৈধ সংখ্যা হতে হবে (০ বা তার বেশি)"
        : "ওজন অবশ্যই সংখ্যা দিয়ে শুরু হতে হবে, যেমন 100gm"
    );
  }
}

/* =========================================================
   RESPONSIVE SCALING
   The brochure is built at one fixed, generous design width
   so product photos and names always have enough room. On
   narrow phones we visually scale the whole thing down with
   a CSS transform instead of reflowing its typography.
   ========================================================= */

const BROCHURE_WIDTH = 720;

function fitToViewport() {
  const stage = document.getElementById("stage");
  const wrapper = document.getElementById("editorBrochure");
  if (!stage || !wrapper) return;

  const available = stage.parentElement.clientWidth;
  const scale = Math.min(1, available / BROCHURE_WIDTH);
  const naturalHeight = wrapper.offsetHeight;

  wrapper.style.transform = `scale(${scale})`;
  wrapper.style.transformOrigin = "top left";

  stage.style.width = `${BROCHURE_WIDTH * scale}px`;
  stage.style.height = `${naturalHeight * scale}px`;
  stage.style.margin = "0 auto";
}

document.addEventListener("DOMContentLoaded", () => {
  const editorHost = document.getElementById("editorBrochure");
  editorHost.appendChild(buildBrochure(true));

  fitToViewport();
  window.addEventListener("resize", fitToViewport);

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(fitToViewport);
  }
  // images loading can change the natural height — refit once they're in
  const imgs = editorHost.querySelectorAll("img");
  let remaining = imgs.length;
  if (remaining === 0) fitToViewport();
  imgs.forEach((img) => {
    if (img.complete) { remaining--; if (remaining === 0) fitToViewport(); }
    else img.addEventListener("load", () => { remaining--; if (remaining <= 0) fitToViewport(); });
  });
});

function showToast(msg, ms = 2400) {
  const toastEl = document.getElementById("toast");
  toastEl.textContent = msg;
  toastEl.classList.add("show");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toastEl.classList.remove("show"), ms);
}
