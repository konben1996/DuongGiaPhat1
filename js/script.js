const API_BASE_URL = window.API_BASE_URL || window.location.origin;
const localProductDataSources = Object.values(window.DuongGiaStoreProducts || {});
const localProducts = localProductDataSources.flatMap((source) => source.products || []);
const localProductGalleries = localProductDataSources.reduce(
  (acc, source) => Object.assign(acc, source.productGalleries || {}),
  {}
);

const defaultProductImage =
  "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80";
const imagePlaceholder =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 300'%3E%3C/svg%3E";

let products = [];
let productGalleries = {};
let dataSource = "local";

const state = {
  currentSlide: 0,
  currentTab: "bestSeller",
  currentNewProductsTab: "newArrival",
  currentPromoProductsTab: "discount",
  currentCategory: "all",
};

const elements = {
  body: document.body,
  tabProductGrid: document.getElementById("tabProductGrid"),
  productTabs: document.getElementById("productTabs"),
  newProductsTabs: document.getElementById("newProductsTabs"),
  promoProductsTabs: document.querySelector("#promo-products .tabs"),
  categoryButtons: [...document.querySelectorAll("[data-category-filter]")],
  laptopGrid: document.getElementById("laptopGrid"),
  desktopGrid: document.getElementById("desktopGrid"),
  gamingGrid: document.getElementById("gamingGrid"),
  openMobileMenu: document.getElementById("openMobileMenu"),
  mobileDrawer: document.getElementById("mobileDrawer"),
  globalBackdrop: document.getElementById("globalBackdrop"),
  productModal: document.getElementById("productModal"),
  productModalContent: document.getElementById("productModalContent"),
  loginModal: document.getElementById("loginModal"),
  openLoginModal: document.getElementById("openLoginModal"),
  openRegisterModal: document.getElementById("openRegisterModal"),
  userChip: document.getElementById("userChip"),
  userChipName: document.getElementById("userChipName"),
  logoutBtn: document.getElementById("logoutBtn"),
  loginForm: document.getElementById("loginForm"),
  loginStatus: document.getElementById("loginStatus"),
  loginIdentity: document.getElementById("loginIdentity"),
  loginPassword: document.getElementById("loginPassword"),
  rememberLogin: document.getElementById("rememberLogin"),
  registerModal: document.getElementById("registerModal"),
  registerForm: document.getElementById("registerForm"),
  registerStatus: document.getElementById("registerStatus"),
  registerName: document.getElementById("registerName"),
  registerEmail: document.getElementById("registerEmail"),
  registerPassword: document.getElementById("registerPassword"),
  toast: document.getElementById("toast"),
  backToTop: document.getElementById("backToTop"),
  themeToggle: document.getElementById("themeToggle"),
  themeToggleMobile: document.getElementById("themeToggleMobile"),
  heroSlides: [...document.querySelectorAll(".hero-slide")],
  heroDots: document.getElementById("heroDots"),
  prevSlide: document.getElementById("prevSlide"),
  nextSlide: document.getElementById("nextSlide"),
};

let toastTimer = null;
let sliderTimer = null;
let imageObserver = null;

function formatCurrency(value) {
  return value.toLocaleString("vi-VN") + "₫";
}

function getSystemTheme() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function updateThemeToggle(theme) {
  const toggleButtons = [elements.themeToggle, elements.themeToggleMobile].filter(Boolean);

  toggleButtons.forEach((button) => {
    const icon = button.querySelector(".theme-toggle__icon");
    const text = button.querySelector(".theme-toggle__text");

    if (icon) icon.textContent = theme === "dark" ? "☀️" : "🌙";
    if (text) text.textContent = theme === "dark" ? "Giao diện sáng" : "Giao diện tối";

    button.setAttribute(
      "aria-label",
      theme === "dark" ? "Chuyển sang giao diện sáng" : "Chuyển sang giao diện tối"
    );
  });
}

function applyTheme(theme) {
  elements.body.dataset.theme = theme;
  updateThemeToggle(theme);
}

function initTheme() {
  const savedTheme = localStorage.getItem("theme");
  const initialTheme = savedTheme === "dark" || savedTheme === "light" ? savedTheme : getSystemTheme();

  applyTheme(initialTheme);

  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  mediaQuery.addEventListener?.("change", (event) => {
    const userSavedTheme = localStorage.getItem("theme");
    if (userSavedTheme === "dark" || userSavedTheme === "light") return;
    applyTheme(event.matches ? "dark" : "light");
  });
}

function normalizeProduct(product) {
  const price = Number(product.price || 0);
  const oldPrice = Number(product.oldPrice || product.original_price || 0);
  const discount = Number(product.discount || (oldPrice > price && oldPrice > 0 ? Math.round(((oldPrice - price) / oldPrice) * 100) : 0));
  const category = String(product.category || "accessory").trim();
  const tags = Array.isArray(product.tags) ? product.tags : [];

  return {
    id: String(product.id ?? product.slug ?? product.name),
    name: product.name || "Sản phẩm",
    price,
    oldPrice: oldPrice > price ? oldPrice : null,
    discount: Number.isFinite(discount) ? discount : 0,
    category,
    label: product.label || product.category_name || product.categoryLabel || "Phụ kiện",
    image: product.image || defaultProductImage,
    stock: typeof product.stock === "number" ? (product.stock > 0 ? "Còn hàng" : "Hết hàng") : (product.stock || "Còn hàng"),
    brand: product.brand || "",
    summary: product.summary || product.short_description || product.description || "",
    specs: Array.isArray(product.specs) ? product.specs : [],
    tags: tags.length ? tags : [product.sale_price ? "discount" : "newArrival"],
  };
}

function findProductById(productId) {
  return products.find((product) => String(product.id) === String(productId));
}

function getProductImage(product) {
  return product.image || defaultProductImage;
}

function getProductGallery(product) {
  const extraImages = productGalleries[String(product.id)] || productGalleries[product.id] || [];

  return [getProductImage(product), ...extraImages]
    .filter(Boolean)
    .filter((image, index, list) => list.indexOf(image) === index)
    .slice(0, 4);
}

function getFilteredProducts(baseList = products) {
  return baseList.filter((product) => {
    return state.currentCategory === "all" || product.category === state.currentCategory;
  });
}

function getProductsByTag(tagName) {
  return getFilteredProducts().filter((product) => Array.isArray(product.tags) && product.tags.includes(tagName));
}

function getTabProducts() {
  return getProductsByTag(state.currentTab);
}

function createProductCard(product) {
  return `
    <article class="product-card">
      <div class="product-card__discount">-${product.discount || 0}%</div>
      <div class="product-card__media">
        <img
          src="${imagePlaceholder}"
          data-src="${getProductImage(product)}"
          alt="${product.name}"
          loading="lazy"
          decoding="async"
          fetchpriority="low"
          referrerpolicy="no-referrer"
          class="lazy-product-image"
        />
      </div>
      <span class="product-card__category">${product.label}</span>
      <h3 class="product-card__title">${product.name}</h3>
      <div class="product-card__pricing">
        <span class="product-card__current">Liên Hệ</span>
      </div>
      <div class="product-card__actions">
        <button type="button" class="btn-quick" data-action="quick-view" data-id="${product.id}">
          Xem nhanh
        </button>
      </div>
    </article>
  `;
}

function initLazyImages() {
  const lazyImages = [...document.querySelectorAll(".lazy-product-image[data-src]")];

  if (!lazyImages.length) return;

  if (!("IntersectionObserver" in window)) {
    lazyImages.forEach((image) => {
      image.src = image.dataset.src;
      image.removeAttribute("data-src");
    });
    return;
  }

  if (imageObserver) imageObserver.disconnect();

  imageObserver = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;

        const image = entry.target;
        const source = image.dataset.src;

        if (source) {
          image.src = source;
          image.removeAttribute("data-src");
        }

        observer.unobserve(image);
      });
    },
    {
      rootMargin: "250px 0px",
    }
  );

  lazyImages.forEach((image) => imageObserver.observe(image));
}

function renderGrid(target, list) {
  if (!target) return;

  if (!list.length) {
    target.innerHTML = `
      <div class="empty-state">
        Không tìm thấy sản phẩm phù hợp. Hãy thử đổi từ khóa hoặc danh mục khác.
      </div>
    `;
    return;
  }

  target.innerHTML = list.map(createProductCard).join("");
  initLazyImages();
}

function renderTabProducts() {
  renderGrid(elements.tabProductGrid, getTabProducts());
}

function renderCategorySections() {
  const laptopProducts = getFilteredProducts().filter((product) =>
    ["gaming-laptop", "workstation", "office-laptop"].includes(product.category)
  );
  const desktopProducts = getFilteredProducts().filter((product) => product.category === "gaming-pc");
  const gamingProducts = getFilteredProducts().filter((product) =>
    ["gaming-laptop", "workstation", "gaming-pc"].includes(product.category)
  );

  renderGrid(elements.laptopGrid, laptopProducts.slice(0, 10));
  renderGrid(elements.desktopGrid, desktopProducts.slice(0, 10));
  renderGrid(elements.gamingGrid, gamingProducts.slice(0, 10));
}

async function fetchProductsFromApi() {
  const response = await fetch(`${API_BASE_URL}/api/products?limit=500`);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Không thể tải sản phẩm");
  }

  return Array.isArray(data.products) ? data.products.map(normalizeProduct) : [];
}

function seedLocalProducts() {
  products = localProducts.map(normalizeProduct);
  productGalleries = localProductGalleries;
  dataSource = "local";
}

async function loadProducts() {
  try {
    const apiProducts = await fetchProductsFromApi();
    if (apiProducts.length) {
      products = apiProducts;
      productGalleries = {};
      dataSource = "api";
      return;
    }
    seedLocalProducts();
  } catch (error) {
    seedLocalProducts();
  }
}

function renderNewProductsSection() {
  const newProductsGrid = document.getElementById("newProductsGrid");
  if (!newProductsGrid) return;

  renderGrid(newProductsGrid, getProductsByTag(state.currentNewProductsTab).slice(0, 12));
}

function renderPromoProductsSection() {
  const promoProductsGrid = document.getElementById("promoProductsGrid");
  if (!promoProductsGrid) return;

  renderGrid(promoProductsGrid, getProductsByTag(state.currentPromoProductsTab).slice(0, 12));
}

function showToast(message) {
  elements.toast.setAttribute("role", "status");
  elements.toast.setAttribute("aria-live", "polite");
  elements.toast.textContent = message;
  elements.toast.classList.add("is-visible");

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    elements.toast.classList.remove("is-visible");
  }, 2400);
}

function setOverlayVisibility() {
  const hasDrawerOpen = elements.mobileDrawer.classList.contains("is-open");
  const hasProductModalOpen = elements.productModal.classList.contains("is-open");
  const hasLoginModalOpen = elements.loginModal?.classList.contains("is-open");

  elements.globalBackdrop.hidden = !(hasDrawerOpen || hasLoginModalOpen);
  elements.body.classList.toggle("is-locked", hasDrawerOpen || hasProductModalOpen || hasLoginModalOpen);
}

function openDrawer(drawer) {
  drawer.classList.add("is-open");
  drawer.setAttribute("aria-hidden", "false");
  setOverlayVisibility();
}

function closeDrawer(drawer) {
  drawer.classList.remove("is-open");
  drawer.setAttribute("aria-hidden", "true");
  setOverlayVisibility();
}

function closeAllDrawers() {
  closeDrawer(elements.mobileDrawer);
}

function openLoginModal() {
  if (!elements.loginModal) return;

  openModal(elements.loginModal);
  clearTimeout(toastTimer);

  if (elements.loginStatus) elements.loginStatus.textContent = "";

  window.setTimeout(() => {
    elements.loginIdentity?.focus();
  }, 0);
}

function getStoredAuth() {
  const storedUser =
    JSON.parse(localStorage.getItem("authUser") || "null") ||
    JSON.parse(sessionStorage.getItem("authUser") || "null");
  const storedToken = localStorage.getItem("authToken") || sessionStorage.getItem("authToken");

  return { user: storedUser, token: storedToken };
}

function clearAuthStorage() {
  localStorage.removeItem("authToken");
  localStorage.removeItem("authUser");
  sessionStorage.removeItem("authToken");
  sessionStorage.removeItem("authUser");
}

async function fetchCurrentUser(token) {
  const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Không thể xác thực phiên đăng nhập");
  }

  return data.user;
}

function openRegisterModal() {
  if (!elements.registerModal) return;

  openModal(elements.registerModal);

  if (elements.registerStatus) elements.registerStatus.textContent = "";

  window.setTimeout(() => {
    elements.registerName?.focus();
  }, 0);
}

function closeRegisterModal() {
  if (!elements.registerModal) return;

  closeModal(elements.registerModal);
  if (elements.registerStatus) elements.registerStatus.textContent = "";
  if (elements.registerForm) elements.registerForm.reset();
}

function updateAuthUI(user) {
  const isLoggedIn = Boolean(user);

  if (elements.userChip) {
    elements.userChip.hidden = !isLoggedIn;
  }

  if (elements.userChipName) {
    elements.userChipName.textContent = user?.name || "Khách";
  }

  if (elements.openLoginModal) {
    elements.openLoginModal.style.display = isLoggedIn ? "none" : "";
    elements.openLoginModal.hidden = isLoggedIn;
  }

  document.body.dataset.userRole = user?.role || "guest";
  document.querySelectorAll("[data-requires-role]").forEach((element) => {
    const requiredRole = element.dataset.requiresRole;
    const canSee = isLoggedIn && (requiredRole === "any" || requiredRole === user?.role);
    element.hidden = !canSee;
  });
}

function handleLogout() {
  clearAuthStorage();
  updateAuthUI(null);
  showToast("Đã đăng xuất");
}

async function handleRegisterSubmit(event) {
  event.preventDefault();

  const name = elements.registerName?.value.trim() || "";
  const email = elements.registerEmail?.value.trim() || "";
  const password = elements.registerPassword?.value || "";

  if (!name || !email || !password) {
    if (elements.registerStatus) {
      elements.registerStatus.textContent = "Vui lòng nhập đầy đủ họ tên, email và mật khẩu.";
    }
    return;
  }

  if (elements.registerStatus) {
    elements.registerStatus.textContent = "Đang tạo tài khoản...";
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        email,
        password,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Đăng ký thất bại");
    }

    if (elements.registerStatus) {
      elements.registerStatus.textContent = "Đăng ký thành công, bạn có thể đăng nhập ngay.";
    }

    showToast("Đăng ký thành công");
    closeRegisterModal();
    openLoginModal();

    if (elements.loginIdentity) {
      elements.loginIdentity.value = email;
    }
  } catch (error) {
    if (elements.registerStatus) {
      elements.registerStatus.textContent = error.message || "Không thể đăng ký. Vui lòng thử lại.";
    }
    showToast("Đăng ký thất bại");
  }
}

function closeLoginModal() {
  if (!elements.loginModal) return;

  closeModal(elements.loginModal);
  if (elements.loginStatus) elements.loginStatus.textContent = "";
  if (elements.loginForm) elements.loginForm.reset();
}

async function handleLoginSubmit(event) {
  event.preventDefault();

  const identity = elements.loginIdentity?.value.trim() || "";
  const password = elements.loginPassword?.value || "";
  const remember = Boolean(elements.rememberLogin?.checked);

  if (!identity || !password) {
    if (elements.loginStatus) {
      elements.loginStatus.textContent = "Vui lòng nhập đầy đủ email/số điện thoại và mật khẩu.";
    }
    return;
  }

  if (elements.loginStatus) {
    elements.loginStatus.textContent = "Đang đăng nhập...";
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: identity,
        password,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Đăng nhập thất bại");
    }

    const storage = remember ? localStorage : sessionStorage;
    storage.setItem("authToken", data.token);
    storage.setItem("authUser", JSON.stringify(data.user));

    updateAuthUI(data.user);

    if (elements.loginStatus) {
      elements.loginStatus.textContent = `Xin chào ${data.user.name}, đăng nhập thành công.`;
    }

    showToast("Đăng nhập thành công");
    closeLoginModal();
  } catch (error) {
    if (elements.loginStatus) {
      elements.loginStatus.textContent = error.message || "Không thể đăng nhập. Vui lòng thử lại.";
    }
    showToast("Đăng nhập thất bại");
  }
}

function openModal(modal) {
  modal.classList.add("is-open");
  modal.setAttribute("aria-hidden", "false");
  setOverlayVisibility();
}

function closeModal(modal) {
  modal.classList.remove("is-open");
  modal.setAttribute("aria-hidden", "true");
  setOverlayVisibility();
}

function openProductModal(productId) {
  const product = findProductById(productId);
  if (!product) return;

  const gallery = getProductGallery(product);
  const featuredImage = gallery[0];

  elements.productModalContent.innerHTML = `
    <div class="product-modal__gallery">
      <div class="product-modal__visual">
        <img
          src="${featuredImage}"
          alt="${product.name}"
          loading="lazy"
          decoding="async"
          referrerpolicy="no-referrer"
          id="productModalMainImage"
        />
      </div>
      <div class="product-modal__thumbs">
        ${gallery
          .map(
            (image, index) => `
              <button
                type="button"
                class="product-modal__thumb ${index === 0 ? "is-active" : ""}"
                data-gallery-image="${image}"
                aria-label="Xem ảnh ${index + 1} của ${product.name}"
              >
                <img
                  src="${image}"
                  alt="${product.name} - ảnh ${index + 1}"
                  loading="lazy"
                  decoding="async"
                  referrerpolicy="no-referrer"
                />
              </button>
            `
          )
          .join("")}
      </div>
    </div>
    <div class="product-modal__info">
      <span class="section-kicker">${product.label}</span>
      <h3>${product.name}</h3>
      <p>${product.summary}</p>
      <div class="product-modal__price">Liên Hệ</div>
      <div class="product-modal__meta">
        <span><strong>Thương hiệu:</strong> ${product.brand}</span>
        <span><strong>Tình trạng:</strong> ${product.stock}</span>
        <span><strong>Ưu đãi:</strong> Giảm ${product.discount}% so với giá niêm yết</span>
      </div>
      <ul class="support-list">
        ${product.specs.map((spec) => `<li>${spec}</li>`).join("")}
      </ul>
      <div class="hero-slide__actions">
        <button type="button" class="btn btn--light" data-close-modal="productModal">
          Đóng
        </button>
      </div>
    </div>
  `;

  openModal(elements.productModal);
}

function activateTab(tabName) {
  state.currentTab = tabName;
  elements.productTabs?.querySelectorAll(".tab-btn").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.tab === tabName);
  });
  renderTabProducts();
}

function activateNewProductsTab(tabName) {
  state.currentNewProductsTab = tabName;
  elements.newProductsTabs?.querySelectorAll(".tab-btn").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.tab === tabName);
  });
  renderNewProductsSection();
}

function activatePromoProductsTab(tabName) {
  state.currentPromoProductsTab = tabName;
  elements.promoProductsTabs?.querySelectorAll(".tab-btn").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.tab === tabName);
  });
  renderPromoProductsSection();
}

function setCategory(category) {
  state.currentCategory = category;
  elements.categoryButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.categoryFilter === category);
  });

  renderTabProducts();
  renderCategorySections();
  renderNewProductsSection();
  renderPromoProductsSection();
}

function setSlide(index) {
  const total = elements.heroSlides.length;
  if (!total) return;

  state.currentSlide = (index + total) % total;

  elements.heroSlides.forEach((slide, slideIndex) => {
    slide.classList.toggle("is-active", slideIndex === state.currentSlide);
  });

  [...elements.heroDots.querySelectorAll(".hero-dot")].forEach((dot, dotIndex) => {
    dot.classList.toggle("is-active", dotIndex === state.currentSlide);
  });
}

function buildHeroDots() {
  if (!elements.heroSlides.length) return;

  elements.heroDots.innerHTML = elements.heroSlides
    .map(
      (_, index) =>
        `<button type="button" class="hero-dot ${index === 0 ? "is-active" : ""}" data-slide="${index}" aria-label="Đi tới slide ${index + 1}"></button>`
    )
    .join("");
}

function startAutoSlide() {
  if (elements.heroSlides.length < 2) return;

  stopAutoSlide();
  sliderTimer = setInterval(() => {
    setSlide(state.currentSlide + 1);
  }, 4500);
}

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    stopAutoSlide();
  } else {
    startAutoSlide();
  }
});

function stopAutoSlide() {
  if (sliderTimer) {
    clearInterval(sliderTimer);
    sliderTimer = null;
  }
}

function handleSpecialNav(targetId, anchor) {
  if (!targetId) return false;

  const target = document.getElementById(targetId);
  if (!target) return false;

  const headerOffset = window.innerWidth <= 768 ? 96 : 128;
  const targetTop = target.getBoundingClientRect().top + window.scrollY - headerOffset;

  document.querySelectorAll(".drawer__nav a").forEach((link) => {
    link.classList.toggle("is-active", link === anchor);
  });

  window.scrollTo({
    top: Math.max(targetTop, 0),
    behavior: "smooth",
  });

  return true;
}

function initEvents() {
  elements.productTabs?.addEventListener("click", (event) => {
    const button = event.target.closest(".tab-btn");
    if (!button) return;
    activateTab(button.dataset.tab);
  });

  elements.newProductsTabs?.addEventListener("click", (event) => {
    const button = event.target.closest(".tab-btn");
    if (!button) return;
    activateNewProductsTab(button.dataset.tab);
  });

  elements.promoProductsTabs?.addEventListener("click", (event) => {
    const button = event.target.closest(".tab-btn");
    if (!button) return;
    activatePromoProductsTab(button.dataset.tab);
  });

  elements.categoryButtons.forEach((button) => {
    button.addEventListener("click", () => setCategory(button.dataset.categoryFilter));
  });

  elements.openMobileMenu?.addEventListener("click", () => openDrawer(elements.mobileDrawer));
  elements.openLoginModal?.addEventListener("click", openLoginModal);
  elements.openRegisterModal?.addEventListener("click", (event) => {
    event.preventDefault();
    openRegisterModal();
  });
  elements.logoutBtn?.addEventListener("click", handleLogout);

  elements.globalBackdrop?.addEventListener("click", () => {
    closeAllDrawers();
    closeLoginModal();
  });

  elements.loginForm?.addEventListener("submit", handleLoginSubmit);
  elements.registerForm?.addEventListener("submit", handleRegisterSubmit);

  document.querySelectorAll('[data-close-modal="loginModal"]').forEach((button) => {
    button.addEventListener("click", closeLoginModal);
  });
  document.querySelectorAll('[data-close-modal="registerModal"]').forEach((button) => {
    button.addEventListener("click", closeRegisterModal);
  });

  document.querySelectorAll("[data-close-drawer]").forEach((button) => {
    button.addEventListener("click", () => {
      const drawer = document.getElementById(button.dataset.closeDrawer);
      if (drawer) closeDrawer(drawer);
    });
  });

  document.querySelectorAll("[data-close-modal]").forEach((button) => {
    button.addEventListener("click", () => {
      const modal = document.getElementById(button.dataset.closeModal);
      if (modal) closeModal(modal);
    });
  });

  document.addEventListener("click", (event) => {
    const actionButton = event.target.closest("[data-action]");
    if (actionButton) {
      const { action, id } = actionButton.dataset;

      if (action === "quick-view") {
        openProductModal(id);
        return;
      }
    }

    const modalCloser = event.target.closest("[data-close-modal]");
    if (modalCloser) {
      const modal = document.getElementById(modalCloser.dataset.closeModal);
      if (modal) closeModal(modal);
    }

    const galleryThumb = event.target.closest("[data-gallery-image]");
    if (galleryThumb) {
      const mainImage = document.getElementById("productModalMainImage");
      const nextImage = galleryThumb.dataset.galleryImage;

      if (mainImage && nextImage) {
        mainImage.src = nextImage;
        document.querySelectorAll(".product-modal__thumb").forEach((thumb) => {
          thumb.classList.toggle("is-active", thumb === galleryThumb);
        });
      }

      return;
    }

    const anchor = event.target.closest('a[href^="#"]');
    if (anchor) {
      const targetId = anchor.getAttribute("href").slice(1);
      if (handleSpecialNav(targetId, anchor)) {
        event.preventDefault();
        closeDrawer(elements.mobileDrawer);
      }
    }
  });

  elements.prevSlide?.addEventListener("click", () => {
    setSlide(state.currentSlide - 1);
    startAutoSlide();
  });

  elements.nextSlide?.addEventListener("click", () => {
    setSlide(state.currentSlide + 1);
    startAutoSlide();
  });

  elements.heroDots?.addEventListener("click", (event) => {
    const dot = event.target.closest(".hero-dot");
    if (!dot) return;
    setSlide(Number(dot.dataset.slide));
    startAutoSlide();
  });



  elements.backToTop?.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeAllDrawers();
      closeModal(elements.productModal);
      closeLoginModal();
      closeRegisterModal();
    }
  });

  window.addEventListener("scroll", () => {
    const show = window.scrollY > 480;
    elements.backToTop.style.opacity = show ? "1" : "0.65";
  });
}

async function init() {
  initTheme();
  initEvents();

  await loadProducts();
  buildHeroDots();
  renderTabProducts();
  renderCategorySections();
  renderNewProductsSection();
  renderPromoProductsSection();

  const auth = getStoredAuth();

  if (auth.token) {
    try {
      const currentUser = await fetchCurrentUser(auth.token);
      updateAuthUI(currentUser);
      localStorage.setItem("authUser", JSON.stringify(currentUser));
      sessionStorage.setItem("authUser", JSON.stringify(currentUser));
    } catch (error) {
      clearAuthStorage();
      updateAuthUI(null);
    }
  } else {
    updateAuthUI(auth.user);
  }

  if (document.body.dataset.userRole === "admin") {
    document.querySelectorAll("[data-admin-only]").forEach((element) => {
      element.hidden = false;
    });
  }

  startAutoSlide();
}

init();
