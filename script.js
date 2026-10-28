const products = {
  hoodie: { name: "Signal hoodie", price: 89 },
  cap: { name: "Frequency cap", price: 39 },
  tee: { name: "Static tee", price: 45 },
};

const palette = {
  "#ECFFE1": "Signal paper",
  "#0A0A0A": "Static black",
  "#00AB2E": "Forest signal",
  "#2A3400": "Deep frequency",
  "#75FF5B": "Electric lime",
  "#8AFF3E": "Acid green",
  "#F9F608": "Signal yellow",
};

const bag = new Map();
const bagCounts = document.querySelectorAll(".bag-count");
const bagButton = document.querySelector(".bag-button");
const cartDialog = document.querySelector(".cart-dialog");
const cartItems = document.querySelector(".cart-items");
const cartEmpty = document.querySelector(".cart-empty");
const cartTotal = document.querySelector(".cart-total strong");
const toast = document.querySelector(".toast");
const menuToggle = document.querySelector(".menu-toggle");
const primaryNav = document.querySelector(".primary-nav");
const garmentMasks = new Map();
let toastTimeout;

function loadGarmentMask(source) {
  if (!garmentMasks.has(source)) {
    const image = new Image();
    const loadedImage = new Promise((resolve, reject) => {
      image.addEventListener("load", () => resolve(image), { once: true });
      image.addEventListener("error", () => reject(new Error(`Unable to load garment photo: ${source}`)), { once: true });
      image.src = source;
    });
    garmentMasks.set(source, loadedImage);
  }

  return garmentMasks.get(source);
}

async function recolorGarmentPhoto(photo, color) {
  if (photo.dataset.displayColor === color) return;

  const mask = await loadGarmentMask(photo.dataset.mask);
  if (photo.dataset.color !== color) return;

  const canvas = document.createElement("canvas");
  canvas.width = mask.naturalWidth;
  canvas.height = mask.naturalHeight;

  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Unable to create a canvas for the garment color preview.");

  context.drawImage(mask, 0, 0);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  const colorChannels = color.match(/[0-9a-f]{2}/gi).map((channel) => Number.parseInt(channel, 16));

  for (let index = 0; index < pixels.data.length; index += 4) {
    if (pixels.data[index + 3] === 0) continue;

    const shade = pixels.data[index] / 255;
    if (shade >= 0.78) {
      pixels.data[index] = 255;
      pixels.data[index + 1] = 255;
      pixels.data[index + 2] = 255;
      continue;
    }

    const fabricShade = Math.min(1.05, 0.42 + shade * 1.6);
    pixels.data[index] = Math.round(colorChannels[0] * fabricShade);
    pixels.data[index + 1] = Math.round(colorChannels[1] * fabricShade);
    pixels.data[index + 2] = Math.round(colorChannels[2] * fabricShade);
  }

  context.putImageData(pixels, 0, 0);
  if (photo.dataset.color !== color) return;

  photo.src = canvas.toDataURL("image/png");
  photo.dataset.displayColor = color;
}

function updateBag() {
  const count = [...bag.values()].reduce((sum, quantity) => sum + quantity, 0);
  bagCounts.forEach((element) => {
    element.textContent = String(count);
  });

  cartItems.replaceChildren();
  let total = 0;

  bag.forEach((quantity, variant) => {
    const [sku, color] = variant.split(":");
    const product = products[sku];
    total += product.price * quantity;

    const row = document.createElement("div");
    row.className = "cart-item";

    const details = document.createElement("div");
    const name = document.createElement("h3");
    name.textContent = `${product.name} — ${palette[color]}`;
    const price = document.createElement("p");
    price.textContent = `${quantity} × € ${product.price}`;
    details.append(name, price);

    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "Remove";
    remove.setAttribute("aria-label", `Remove ${product.name} in ${palette[color]} from bag`);
    remove.addEventListener("click", () => {
      bag.delete(variant);
      updateBag();
    });

    row.append(details, remove);
    cartItems.append(row);
  });

  cartEmpty.hidden = bag.size > 0;
  cartTotal.textContent = `€ ${total}`;
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("is-visible");
  window.clearTimeout(toastTimeout);
  toastTimeout = window.setTimeout(() => {
    toast.classList.remove("is-visible");
  }, 2400);
}

function getContrastColor(hex) {
  const channels = hex.match(/[0-9a-f]{2}/gi).map((value) => {
    const channel = Number.parseInt(value, 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  return luminance > 0.179 ? "#0A0A0A" : "#ECFFE1";
}

function selectColor(card, swatch) {
  const color = swatch.dataset.color;
  const name = swatch.dataset.colorName;
  const garment = card.querySelector(".garment");
  const logoColor = getContrastColor(color);

  card.dataset.color = color;
  card.dataset.colorName = name;
  garment.dataset.color = color;
  card.querySelector(".selected-color").textContent = name;
  card.querySelector(".color-name").textContent = name;
  card.querySelector(".color-chip i").style.backgroundColor = color;
  garment.style.setProperty("--garment-color", color);
  garment.style.setProperty("--garment-edge", logoColor);
  garment.style.setProperty("--garment-detail-color", logoColor);
  garment.style.setProperty("--garment-logo-color", logoColor);
  garment.classList.toggle("logo-light", logoColor === "#ECFFE1");
  const garmentDescription = `${name} ${products[card.querySelector(".add-button").dataset.product].name.toLowerCase()}`;
  garment.setAttribute("aria-label", garmentDescription);
  if (garment instanceof HTMLImageElement) {
    garment.alt = garmentDescription;
    recolorGarmentPhoto(garment, color).catch((error) => {
      console.error(error);
      showToast("The garment color preview could not be updated.");
    });
  }

  card.querySelectorAll(".color-swatch").forEach((option) => {
    const isSelected = option === swatch;
    option.classList.toggle("is-selected", isSelected);
    option.setAttribute("aria-checked", String(isSelected));
  });
}

function applyPageColor(swatch) {
  const color = swatch.dataset.color;
  const page = document.documentElement;
  const contrast = getContrastColor(color);
  document.querySelector(".ticker").classList.toggle("logo-light", contrast === "#ECFFE1");
  page.style.setProperty("--theme-color", color);
  page.style.setProperty("--theme-ink", contrast);
  page.style.setProperty("--page-tint", `color-mix(in srgb, ${color} 30%, #ECFFE1)`);
  document.querySelector('meta[name="theme-color"]').setAttribute("content", color);

  const heroGarment = document.querySelector(".hero-hoodie");
  heroGarment.dataset.color = color;
  heroGarment.alt = `${swatch.dataset.colorName} heavyweight STATIC hoodie from the brandbook`;
  recolorGarmentPhoto(heroGarment, color).catch((error) => {
    console.error(error);
    showToast("The hero hoodie color preview could not be updated.");
  });

  document.querySelectorAll(".palette-card").forEach((option) => {
    option.setAttribute("aria-pressed", String(option === swatch));
  });

  document.querySelectorAll(".product-card").forEach((card) => {
    const garmentSwatch = [...card.querySelectorAll(".color-swatch")]
      .find((option) => option.dataset.color === color);
    if (garmentSwatch) selectColor(card, garmentSwatch);
  });
}

document.querySelectorAll(".palette-card").forEach((swatch) => {
  swatch.addEventListener("click", () => applyPageColor(swatch));
});

document.querySelectorAll(".product-card").forEach((card) => {
  const swatches = [...card.querySelectorAll(".color-swatch")];
  const initialSelection = swatches.find((swatch) => swatch.getAttribute("aria-checked") === "true");
  if (initialSelection) selectColor(card, initialSelection);

  swatches.forEach((swatch, index) => {
    swatch.addEventListener("click", () => selectColor(card, swatch));
    swatch.addEventListener("keydown", (event) => {
      const direction = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1
        : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1
          : event.key === "Home" ? -index
            : event.key === "End" ? swatches.length - index
              : 0;
      if (!direction) return;

      event.preventDefault();
      const next = swatches[(index + direction + swatches.length) % swatches.length];
      next.focus();
      selectColor(card, next);
    });
  });
});

const heroGarment = document.querySelector(".hero-hoodie");
recolorGarmentPhoto(heroGarment, heroGarment.dataset.color).catch((error) => {
  console.error(error);
  showToast("The hero hoodie photo could not be loaded.");
});

document.querySelectorAll(".add-button").forEach((button) => {
  button.addEventListener("click", () => {
    const sku = button.dataset.product;
    if (!products[sku]) return;

    const card = button.closest(".product-card");
    const color = card.dataset.color;
    const variant = `${sku}:${color}`;
    bag.set(variant, (bag.get(variant) || 0) + 1);
    updateBag();
    showToast(`${products[sku].name} in ${palette[color]} added to your bag.`);
  });
});

bagButton.addEventListener("click", () => {
  cartDialog.showModal();
});

document.querySelector(".cart-close").addEventListener("click", () => {
  cartDialog.close();
});

document.querySelector(".cart-continue").addEventListener("click", () => {
  cartDialog.close();
});

cartDialog.addEventListener("click", (event) => {
  if (event.target === cartDialog) cartDialog.close();
});

menuToggle.addEventListener("click", () => {
  const isOpen = menuToggle.getAttribute("aria-expanded") === "true";
  menuToggle.setAttribute("aria-expanded", String(!isOpen));
  primaryNav.classList.toggle("is-open", !isOpen);
});

primaryNav.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => {
    menuToggle.setAttribute("aria-expanded", "false");
    primaryNav.classList.remove("is-open");
  });
});

updateBag();
