const API_BASE_URL = window.API_BASE_URL || (window.location.origin.startsWith("http") ? window.location.origin : "http://localhost:3001");

const LOCAL_PRODUCTS = [];
const LOCAL_GALLERIES = {};

const DEFAULT_CATEGORIES = [
  { id: 1, name: "Laptop Gaming", slug: "gaming-laptop", parent_id: null, sort_order: 1, is_active: 1 },
  { id: 2, name: "Laptop Văn Phòng", slug: "office-laptop", parent_id: null, sort_order: 2, is_active: 1 },
  { id: 3, name: "Máy Tính Gaming", slug: "gaming-pc", parent_id: null, sort_order: 3, is_active: 1 },
  { id: 4, name: "Phụ Kiện", slug: "accessory", parent_id: null, sort_order: 4, is_active: 1 },
];

const els = {
  navLinks: [...document.querySelectorAll(".admin-nav__link")],
  hero: document.querySelector(".admin-hero"),
  panels: {
    dashboard: document.getElementById("panel-dashboard"),
    categories: document.getElementById("panel-categories"),
    products: document.getElementById("panel-products"),
    orders: document.getElementById("panel-orders"),
    users: document.getElementById("panel-users"),
    coupons: document.getElementById("panel-coupons"),
    banners: document.getElementById("panel-banners"),
    reviews: document.getElementById("panel-reviews"),
    warranties: document.getElementById("panel-warranties"),
  },
  refreshAdminData: document.getElementById("refreshAdminData"),
  openAddProductForm: document.getElementById("openAddProductForm"),
  openAddCategoryForm: document.getElementById("openAddCategoryForm"),
  openAddOrderForm: document.getElementById("openAddOrderForm"),
  categoryModal: document.getElementById("adminCategoryModal"),
  categoryForm: document.getElementById("adminCategoryForm"),
  categoryIdInput: document.getElementById("adminCategoryId"),
  categoryName: document.getElementById("adminCategoryName"),
  categorySlug: document.getElementById("adminCategorySlug"),
  categoryParent: document.getElementById("adminCategoryParent"),
  categorySort: document.getElementById("adminCategorySort"),
  categoryActive: document.getElementById("adminCategoryActive"),
  categoryStatus: document.getElementById("adminCategoryStatus"),
  productSearch: document.getElementById("productSearch"),
  productCategoryFilter: document.getElementById("productCategoryFilter"),
  orderSearch: document.getElementById("orderSearch"),
  globalBackdrop: document.getElementById("globalBackdrop"),

  statProducts: document.getElementById("statProducts"),
  statOrders: document.getElementById("statOrders"),
  statUsers: document.getElementById("statUsers"),
  statCoupons: document.getElementById("statCoupons"),
  statTopCategory: document.getElementById("statTopCategory"),
  statActiveProducts: document.getElementById("statActiveProducts"),
  statPendingOrders: document.getElementById("statPendingOrders"),
  statActiveBanners: document.getElementById("statActiveBanners"),
  countGamingLaptop: document.getElementById("countGamingLaptop"),
  countOfficeLaptop: document.getElementById("countOfficeLaptop"),
  countGamingPc: document.getElementById("countGamingPc"),
  countAccessory: document.getElementById("countAccessory"),
  dashboardProductsTable: document.getElementById("dashboardProductsTable"),
  productsTable: document.getElementById("productsTable"),
  categoriesTable: document.getElementById("categoriesTable"),
  ordersTable: document.getElementById("ordersTable"),
  usersTable: document.getElementById("usersTable"),
  couponsTable: document.getElementById("couponsTable"),
  bannersTable: document.getElementById("bannersTable"),
  reviewsTable: document.getElementById("reviewsTable"),
  warrantiesTable: document.getElementById("warrantiesTable"),
  categoryModal: document.getElementById("adminCategoryModal"),
  categoryForm: document.getElementById("adminCategoryForm"),
  categoryName: document.getElementById("adminCategoryName"),
  categorySlug: document.getElementById("adminCategorySlug"),
  categoryParent: document.getElementById("adminCategoryParent"),
  categorySort: document.getElementById("adminCategorySort"),
  categoryActive: document.getElementById("adminCategoryActive"),
  categoryStatus: document.getElementById("adminCategoryStatus"),
  productModal: document.getElementById("adminProductModal"),
  productForm: document.getElementById("adminProductForm"),
  productName: document.getElementById("adminProductName"),
  productBrand: document.getElementById("adminProductBrand"),
  productCategory: document.getElementById("adminProductCategory"),
  productPrice: document.getElementById("adminProductPrice"),
  productSalePrice: document.getElementById("adminProductSalePrice"),
  productImage: document.getElementById("adminProductImage"),
  productImagePreview: document.getElementById("adminProductImagePreview"),
  productShortDescription: document.getElementById("adminProductShortDescription"),
  productDescription: document.getElementById("adminProductDescription"),
  productFeatured: document.getElementById("adminProductFeatured"),
  productActive: document.getElementById("adminProductActive"),
  productStatus: document.getElementById("adminProductStatus"),
  productImageFile: document.getElementById("adminProductImageFile"),
  productImageCategory: document.getElementById("adminProductImageCategory"),
  productImageFolder: document.getElementById("adminProductImageFolder"),

  orderModal: document.getElementById("adminOrderModal"),
  orderForm: document.getElementById("adminOrderForm"),
  orderCode: document.getElementById("adminOrderCode"),
  orderCustomer: document.getElementById("adminOrderCustomer"),
  orderPhone: document.getElementById("adminOrderPhone"),
  orderAddress: document.getElementById("adminOrderAddress"),
  orderNote: document.getElementById("adminOrderNote"),
  orderProducts: document.getElementById("adminOrderProducts"),
  orderTotal: document.getElementById("adminOrderTotal"),
  orderStatus: document.getElementById("adminOrderStatus"),
  orderPaymentStatus: document.getElementById("adminOrderPaymentStatus"),
  orderPaymentMethod: document.getElementById("adminOrderPaymentMethod"),
  orderStatusText: document.getElementById("adminOrderStatusText"),


  userModal: document.getElementById("adminUserModal"),
  userForm: document.getElementById("adminUserForm"),
  userName: document.getElementById("adminUserName"),
  userEmail: document.getElementById("adminUserEmail"),
  userRole: document.getElementById("adminUserRole"),
  userPhone: document.getElementById("adminUserPhone"),
  userStatus: document.getElementById("adminUserStatus"),
};

const state = {
  token: localStorage.getItem("authToken") || sessionStorage.getItem("authToken") || "",
  products: [],
  categories: [],
  orders: [],
  users: [],
  coupons: [],
  banners: [],
  reviews: [],
  warranties: [],
  filteredProducts: [],
  editingCategoryId: null,
  editingProductId: null,
  editingOrderId: null,
  editingUserId: null,
};

function slugify(value = "") {
  return String(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function getToken() {
  return localStorage.getItem("authToken") || sessionStorage.getItem("authToken") || state.token || "";
}

async function apiFetch(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
      ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
    },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message || `Request failed (${response.status})`);
  return payload;
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString("vi-VN") + "₫";
}

function labelCategory(category) {
  return {
    "gaming-laptop": "Gaming Laptop",
    "office-laptop": "Office Laptop",
    "gaming-pc": "Gaming PC",
    accessory: "Accessory",
  }[category] || category || "---";
}

function fixText(text) {
  if (typeof text !== "string") return text || "";
  const normalized = text.normalize("NFC");

  try {
    const repaired = decodeURIComponent(escape(normalized));
    return repaired.normalize("NFC");
  } catch {
    return normalized;
  }
}

function openModal(modal) {
  if (!modal) return;
  modal.classList.add("is-open");
  modal.style.display = "block";
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("is-locked");
  if (els.globalBackdrop) els.globalBackdrop.hidden = false;
}

function closeModal(modal) {
  if (!modal) return;
  modal.classList.remove("is-open");
  modal.style.display = "none";
  modal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("is-locked");
  if (els.globalBackdrop) els.globalBackdrop.hidden = true;
}

function setPanel(name) {
  if (els.hero) {
    const showHero = name === "dashboard";
    els.hero.hidden = !showHero;
    els.hero.style.display = showHero ? "block" : "none";
  }

  Object.entries(els.panels).forEach(([key, panel]) => {
    if (!panel) return;
    const isActive = key === name;
    panel.hidden = !isActive;
    panel.style.display = isActive ? "block" : "none";
    panel.classList.toggle("is-active", isActive);
  });

  if (els.panels.dashboard) {
    els.panels.dashboard.hidden = name !== "dashboard";
    els.panels.dashboard.style.display = name === "dashboard" ? "block" : "none";
  }

  els.navLinks.forEach((link) => link.classList.toggle("is-active", link.dataset.adminTab === name));
}

function renderEmpty(table, colspan, message) {
  if (!table) return;
  table.innerHTML = `<tr><td colspan="${colspan}" class="admin-table__empty">${message}</td></tr>`;
}

function normalizeProduct(item) {
  return {
    ...item,
    name: item.name || "",
    category: item.category || "",
    image: item.image || "",
    is_active: item.is_active !== false,
  };
}

function topCategory(products) {
  const counts = products.reduce((acc, product) => {
    acc[product.category] = (acc[product.category] || 0) + 1;
    return acc;
  }, {});
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
}

function renderProductCategoryOptions() {
  const categoryOptions = state.categories.length
    ? state.categories.map((category) => `<option value="${category.id}">${fixText(category.name || "")}</option>`).join("")
    : `
      <option value="1">Gaming Laptop</option>
      <option value="2">Office Laptop</option>
      <option value="3">Gaming PC</option>
      <option value="4">Accessory</option>
    `;

  if (els.productCategory) {
    els.productCategory.innerHTML = categoryOptions;
  }

  if (els.productCategoryFilter) {
    const currentFilter = els.productCategoryFilter.value || "all";
    const filterOptions = state.categories.length
      ? state.categories.map((category) => `<option value="${category.slug}">${category.name}</option>`).join("")
      : `
        <option value="gaming-laptop">Gaming Laptop</option>
        <option value="office-laptop">Office Laptop</option>
        <option value="gaming-pc">Gaming PC</option>
        <option value="accessory">Accessory</option>
      `;
    els.productCategoryFilter.innerHTML = `<option value="all">Tất cả danh mục</option>${filterOptions}`;
    els.productCategoryFilter.value = currentFilter;
  }
}

function renderAll() {
  renderProductCategoryOptions();

  const products = state.filteredProducts.length ? state.filteredProducts : state.products;
  const categoryCounts = state.products.reduce((acc, product) => {
    acc[product.category] = (acc[product.category] || 0) + 1;
    return acc;
  }, {});

  if (els.statProducts) els.statProducts.textContent = String(state.products.length);
  if (els.statOrders) els.statOrders.textContent = String(state.orders.length);
  if (els.statUsers) els.statUsers.textContent = String(state.users.length);
  if (els.statCoupons) els.statCoupons.textContent = String(state.coupons.length);
  if (els.statTopCategory) els.statTopCategory.textContent = labelCategory(topCategory(state.products));
  if (els.statActiveProducts) els.statActiveProducts.textContent = String(state.products.filter((p) => p.is_active !== false).length);
  if (els.statPendingOrders) els.statPendingOrders.textContent = String(state.orders.filter((o) => o.status === "pending").length);
  if (els.statActiveBanners) els.statActiveBanners.textContent = String(state.banners.filter((b) => b.is_active !== false).length);

  if (els.countGamingLaptop) els.countGamingLaptop.textContent = `${categoryCounts["gaming-laptop"] || 0} sản phẩm`;
  if (els.countOfficeLaptop) els.countOfficeLaptop.textContent = `${categoryCounts["office-laptop"] || 0} sản phẩm`;
  if (els.countGamingPc) els.countGamingPc.textContent = `${categoryCounts["gaming-pc"] || 0} sản phẩm`;
  if (els.countAccessory) els.countAccessory.textContent = `${categoryCounts["accessory"] || 0} sản phẩm`;

  if (els.dashboardProductsTable) {
    if (!state.products.length) {
      renderEmpty(els.dashboardProductsTable, 4, "Chưa có dữ liệu.");
    } else {
      els.dashboardProductsTable.innerHTML = state.products.slice(0, 5).map((product) => `
        <tr>
          <td>${product.name}</td>
          <td>${labelCategory(product.category)}</td>
          <td>${formatMoney(product.price)}</td>
          <td>${product.stock || 0}</td>
        </tr>
      `).join("");
    }
  }

  if (els.productsTable) {
    if (!products.length) {
      renderEmpty(els.productsTable, 9, "Không tìm thấy sản phẩm.");
    } else {
      els.productsTable.innerHTML = products.map((product) => `
        <tr>
          <td>
            <div class="admin-table__product">
              <img src="${product.image || ""}" alt="${product.name || ""}" />
              <strong>${product.name || "---"}</strong>
            </div>
          </td>
          <td>${labelCategory(product.category)}</td>
          <td>${product.brand || "---"}</td>
          <td>${formatMoney(product.price)}</td>
          <td>${product.sale_price ? formatMoney(product.sale_price) : "---"}</td>
          <td>${product.is_active ? "Active" : "Hidden"}</td>
          <td>
            <button type="button" class="btn btn--light" data-action="edit-product" data-id="${product.id}">Sửa</button>
            <button type="button" class="btn btn--light" data-action="delete-product" data-id="${product.id}">Xoá</button>
          </td>
        </tr>
      `).join("");
    }
  }

  if (els.categoriesTable) {
    if (!state.categories.length) renderEmpty(els.categoriesTable, 7, "Chưa có dữ liệu.");
    else els.categoriesTable.innerHTML = state.categories.map((category) => `
      <tr>
        <td>${category.id ?? "---"}</td>
        <td>${fixText(category.name || "")}</td>
        <td>${fixText(category.slug || "")}</td>
        <td>${category.parent_id || "---"}</td>
        <td>${category.sort_order || 0}</td>
        <td>${category.is_active ? "Active" : "Hidden"}</td>
        <td>
          <button type="button" class="btn btn--light" data-action="edit-category" data-id="${category.id}">Sửa</button>
          <button type="button" class="btn btn--light" data-action="delete-category" data-id="${category.id}">Xoá</button>
        </td>
      </tr>
    `).join("");
  }

  if (els.ordersTable) {
    const search = (els.orderSearch?.value || "").trim().toLowerCase();
    const rows = state.orders.filter((order) => `${order.code || ""} ${order.customer_name || ""} ${order.customer_phone || ""}`.toLowerCase().includes(search));
    if (!rows.length) renderEmpty(els.ordersTable, 8, "Không tìm thấy đơn hàng.");
    else els.ordersTable.innerHTML = rows.map((order) => `
      <tr>
        <td>${order.code || "---"}</td>
        <td>${order.customer_name || "---"}</td>
        <td>${order.customer_phone || "---"}</td>
        <td>${formatMoney(order.total)}</td>
        <td>${order.status || "---"}</td>
        <td>${order.payment_status || "---"}</td>
        <td>${order.created_at || "---"}</td>
        <td><button type="button" class="btn btn--light" data-action="edit-order" data-id="${order.id}">Sửa</button></td>
      </tr>
    `).join("");
  }

  if (els.usersTable) {
    if (!state.users.length) renderEmpty(els.usersTable, 6, "Chưa có dữ liệu.");
    else els.usersTable.innerHTML = state.users.map((user) => `
      <tr>
        <td>${user.name || "---"}</td>
        <td>${user.email || "---"}</td>
        <td>${user.role || "user"}</td>
        <td>${user.phone || "---"}</td>
        <td>${user.is_active === false ? "Hidden" : "Active"}</td>
        <td><button type="button" class="btn btn--light" data-action="edit-user" data-id="${user.id}">Sửa</button></td>
      </tr>
    `).join("");
  }

  if (els.couponsTable) {
    if (!state.coupons.length) renderEmpty(els.couponsTable, 7, "Chưa có dữ liệu.");
    else els.couponsTable.innerHTML = state.coupons.map((coupon) => `
      <tr><td>${coupon.code || "---"}</td><td>${coupon.name || "---"}</td><td>${coupon.discount_type || "---"}</td><td>${coupon.discount_value || 0}</td><td>${coupon.usage_limit || "---"}</td><td>${coupon.used_count || 0}</td><td>${coupon.is_active ? "Active" : "Hidden"}</td></tr>
    `).join("");
  }

  if (els.bannersTable) {
    if (!state.banners.length) renderEmpty(els.bannersTable, 5, "Chưa có dữ liệu.");
    else els.bannersTable.innerHTML = state.banners.map((banner) => `
      <tr><td>${banner.title || "---"}</td><td>${banner.position || "---"}</td><td>${banner.sort_order || 0}</td><td>${banner.is_active ? "Active" : "Hidden"}</td><td>${banner.link_url || "---"}</td></tr>
    `).join("");
  }

  if (els.reviewsTable) {
    if (!state.reviews.length) renderEmpty(els.reviewsTable, 5, "Chưa có dữ liệu.");
    else els.reviewsTable.innerHTML = state.reviews.map((review) => `
      <tr><td>${review.user_id || "---"}</td><td>${review.product_id || "---"}</td><td>${review.rating || 0}</td><td>${review.is_visible ? "Yes" : "No"}</td><td>${review.comment || "---"}</td></tr>
    `).join("");
  }

  if (els.warrantiesTable) {
    if (!state.warranties.length) renderEmpty(els.warrantiesTable, 5, "Chưa có dữ liệu.");
    else els.warrantiesTable.innerHTML = state.warranties.map((row) => `
      <tr><td>${row.warranty_code || "---"}</td><td>${row.order_item_id || "---"}</td><td>${row.start_date || "---"}</td><td>${row.end_date || "---"}</td><td>${row.status || "---"}</td></tr>
    `).join("");
  }
}

function fillCategoryForm(category = null) {
  state.editingCategoryId = category?.id || null;
  els.categoryForm?.reset();

  if (els.categoryIdInput) els.categoryIdInput.value = category?.id || "";
  els.categoryName.value = category?.name || "";
  els.categorySlug.value = category?.slug || "";
  els.categoryParent.value = category?.parent_id || "";
  els.categorySort.value = category?.sort_order ?? 0;
  els.categoryActive.checked = category?.is_active !== false;
  els.categoryStatus.textContent = category ? "Đang chỉnh sửa danh mục." : "";

  openModal(els.categoryModal);
}

function applyProductFilter() {
  const search = (els.productSearch?.value || "").trim().toLowerCase();
  const category = els.productCategoryFilter?.value || "all";
  state.filteredProducts = state.products.filter((product) => {
    const matchSearch = !search || `${product.name || ""}`.toLowerCase().includes(search);
    const matchCategory = category === "all" || product.category === category;
    return matchSearch && matchCategory;
  });
  renderAll();
}

async function loadData() {
  const [dashboard, products, users, orders, categories, coupons, banners, reviews, warranties] = await Promise.all([
    apiFetch("/api/admin/dashboard"),
    apiFetch("/api/admin/products"),
    apiFetch("/api/admin/users"),
    apiFetch("/api/admin/orders"),
    apiFetch("/api/admin/categories").catch(() => ({ categories: [] })),
    apiFetch("/api/admin/coupons").catch(() => ({ coupons: [] })),
    apiFetch("/api/admin/banners").catch(() => ({ banners: [] })),
    apiFetch("/api/admin/reviews").catch(() => ({ reviews: [] })),
    apiFetch("/api/admin/warranties").catch(() => ({ warranties: [] })),
  ]);

  state.products = (products.products || []).map(normalizeProduct);
  state.users = users.users || [];
  state.orders = orders.orders || [];
  state.categories = (categories.categories || []).length ? categories.categories : [...DEFAULT_CATEGORIES];
  state.coupons = coupons.coupons || [];
  state.banners = banners.banners || [];
  state.reviews = reviews.reviews || [];
  state.warranties = warranties.warranties || [];
  state.filteredProducts = [...state.products];

  if (dashboard?.topCategory && els.statTopCategory) {
    els.statTopCategory.textContent = labelCategory(dashboard.topCategory);
  }

  renderAll();
}

async function ensureAdminSession() {
  const existingToken = getToken();
  if (existingToken) {
    const me = await apiFetch("/api/auth/me").catch(() => null);
    if (me?.user?.role === "admin") {
      state.user = me.user;
      return true;
    }
  }

  const login = await apiFetch("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({
      email: "admin@dgstore.local",
      password: "admin123456",
    }),
  }).catch(() => null);

  if (!login?.token) {
    state.user = null;
    return false;
  }

  localStorage.setItem("authToken", login.token);
  sessionStorage.setItem("authToken", login.token);
  state.token = login.token;
  state.user = login.user || null;
  return true;
}

function populateOrderProducts(selected = "") {
  if (!els.orderProducts) return;
  els.orderProducts.innerHTML = `<option value="">-- Chọn sản phẩm --</option>${state.products.map((product) => `<option value="${product.name}">${product.name} (${labelCategory(product.category)})</option>`).join("")}`;
  if (selected) els.orderProducts.value = selected;
}

function syncProductImageTarget() {
  const categoryId = Number(els.productCategory?.value || 4);
  const category = state.categories.find((item) => Number(item.id) === categoryId);
  const imageCategory = category?.slug || "accessory";

  if (els.productImageCategory) els.productImageCategory.value = imageCategory;
  if (els.productImageFolder) {
    const name = els.productName?.value || "";
    els.productImageFolder.value = slugify(name || "san-pham-moi");
  }
}

function updateProductImagePreview(src = "", alt = "Ảnh sản phẩm") {
  if (!els.productImagePreview) return;
  const value = String(src || "").trim();
  if (!value) {
    els.productImagePreview.innerHTML = "Chưa có ảnh";
    return;
  }
  els.productImagePreview.innerHTML = `<img src="${value}" alt="${alt}" />`;
}

function openProductForm(product = null) {
  state.editingProductId = product?.id || null;
  els.productForm?.reset();

  els.productName.value = product?.name || "";
  if (els.productBrand) els.productBrand.value = product?.brand || "";

  const categoryId = product?.category_id || state.categories.find((item) => item.slug === product?.category)?.id || 4;
  const categorySlug = state.categories.find((item) => Number(item.id) === Number(categoryId))?.slug || "accessory";
  els.productCategory.value = String(categoryId);

  els.productPrice.value = product?.price || 0;
  els.productSalePrice.value = product?.sale_price || "";
  els.productImage.value = product?.image || "";
  updateProductImagePreview(product?.image || "");
  els.productShortDescription.value = product?.short_description || "";
  els.productDescription.value = product?.description || "";
  els.productFeatured.checked = Boolean(product?.is_featured);
  els.productActive.checked = product?.is_active !== false;
  if (els.productImageFolder) els.productImageFolder.value = slugify(product?.name || "san-pham-moi");
  if (els.productImageCategory) {
    els.productImageCategory.value = categorySlug;
  }
  if (els.productImageFile) els.productImageFile.value = "";
  els.productStatus.textContent = product ? "Đang chỉnh sửa sản phẩm." : "";
  openModal(els.productModal);
}

function fillOrderForm(order = null) {
  state.editingOrderId = order?.id || null;
  els.orderForm?.reset();

  els.orderCode.value = order?.code || "";
  els.orderCustomer.value = order?.customer_name || "";
  els.orderPhone.value = order?.customer_phone || "";
  els.orderAddress.value = order?.shipping_address || "";
  els.orderNote.value = order?.shipping_note || "";
  populateOrderProducts(order?.products || "");
  els.orderTotal.value = order?.total || 0;
  els.orderStatus.value = order?.status || "pending";
  els.orderPaymentStatus.value = order?.payment_status || "pending";
  els.orderPaymentMethod.value = order?.payment_method || "cod";
  els.orderStatusText.textContent = order ? "Đang chỉnh sửa đơn hàng." : "";

  openModal(els.orderModal);
}

function fillUserForm(user = null) {
  state.editingUserId = user?.id || null;
  els.userForm?.reset();

  els.userName.value = user?.name || "";
  els.userEmail.value = user?.email || "";
  els.userRole.value = user?.role || "user";
  els.userPhone.value = user?.phone || "";
  els.userStatus.textContent = user ? "Đang chỉnh sửa người dùng." : "";

  openModal(els.userModal);
}

function bindEvents() {
  els.navLinks.forEach((link) => link.addEventListener("click", (event) => {
    event.preventDefault();
    setPanel(link.dataset.adminTab);
  }));

  els.refreshAdminData?.addEventListener("click", loadData);
  els.openAddProductForm?.addEventListener("click", (event) => {
    event.preventDefault();
    openProductForm();
  });
  els.openAddCategoryForm?.addEventListener("click", (event) => {
    event.preventDefault();
    fillCategoryForm();
  });
  els.openAddOrderForm?.addEventListener("click", (event) => {
    event.preventDefault();
    fillOrderForm();
  });

  els.categoryForm?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const payload = {
      id: els.categoryIdInput?.value ? Number(els.categoryIdInput.value) : null,
      name: (els.categoryName?.value || "").trim(),
      slug: (els.categorySlug?.value || "").trim(),
      parent_id: els.categoryParent?.value === "" ? null : Number(els.categoryParent?.value || 0),
      sort_order: Number(els.categorySort?.value || 0),
      is_active: Boolean(els.categoryActive?.checked),
    };

    const method = state.editingCategoryId ? "PATCH" : "POST";
    const url = state.editingCategoryId ? `/api/admin/categories/${state.editingCategoryId}` : "/api/admin/categories";

    await apiFetch(url, { method, body: JSON.stringify(payload) });
    if (els.categoryStatus) els.categoryStatus.textContent = "Đã lưu danh mục.";
    closeModal(els.categoryModal);
    await loadData();
  });
  els.productSearch?.addEventListener("input", applyProductFilter);
  els.productCategoryFilter?.addEventListener("change", applyProductFilter);
  els.orderSearch?.addEventListener("input", renderAll);


  document.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-action]");
    if (!button) return;

    const action = button.dataset.action;
    const id = button.dataset.id;

    if (action === "edit-product") {
      const product = state.products.find((item) => String(item.id) === String(id));
      if (product) openProductForm(product);
    }

    if (action === "delete-product") {
      if (!window.confirm("Xoá sản phẩm này?")) return;
      await apiFetch(`/api/admin/products/${id}`, { method: "DELETE" });
      await loadData();
    }

    if (action === "edit-category") {
      const category = state.categories.find((item) => String(item.id) === String(id));
      if (category) fillCategoryForm(category);
    }

    if (action === "delete-category") {
      if (!window.confirm("Xoá danh mục này?")) return;
      await apiFetch(`/api/admin/categories/${id}`, { method: "DELETE" });
      await loadData();
    }

    if (action === "edit-order") {
      const order = state.orders.find((item) => String(item.id) === String(id));
      if (order) fillOrderForm(order);
    }

    if (action === "edit-user") {
      const user = state.users.find((item) => String(item.id) === String(id));
      if (user) fillUserForm(user);
    }
  });

  document.querySelectorAll("[data-close-modal]").forEach((button) => {
    button.addEventListener("click", () => closeModal(document.getElementById(button.dataset.closeModal)));
  });

  els.globalBackdrop?.addEventListener("click", () => {
    closeModal(els.productModal);
    closeModal(els.orderModal);
    closeModal(els.userModal);
  });

  function syncProductImageTarget() {
    const category = els.productCategory?.value || "accessory";
    if (els.productImageCategory) els.productImageCategory.value = category;
    if (els.productImageFolder) {
      const name = els.productName?.value || "";
      els.productImageFolder.value = slugify(name || "san-pham-moi");
    }
  }

  els.productCategory?.addEventListener("change", () => {
    syncProductImageTarget();
    updateProductImagePreview(els.productImage?.value || "");
  });

  els.productImageFile?.addEventListener("change", () => {
    const file = els.productImageFile.files?.[0];
    if (file && els.productImage) {
      els.productImage.value = "";
      els.productImage.placeholder = file.name;
      const previewUrl = URL.createObjectURL(file);
      updateProductImagePreview(previewUrl, file.name);
    } else {
      updateProductImagePreview(els.productImage?.value || "");
    }
    syncProductImageTarget();
  });

  els.categoryForm?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const payload = {
      name: els.categoryName.value.trim(),
      slug: els.categorySlug.value.trim(),
      parent_id: els.categoryParent.value === "" ? null : Number(els.categoryParent.value),
      sort_order: Number(els.categorySort.value || 0),
      is_active: els.categoryActive.checked,
    };

    const method = state.editingCategoryId ? "PATCH" : "POST";
    const url = state.editingCategoryId ? `/api/admin/categories/${state.editingCategoryId}` : "/api/admin/categories";
    await apiFetch(url, { method, body: JSON.stringify(payload) });
    closeModal(els.categoryModal);
    await loadData();
  });

  els.productForm?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const file = els.productImageFile.files?.[0] || null;
    const imageDataUrl = file ? await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Không thể đọc file ảnh"));
      reader.readAsDataURL(file);
    }) : "";

    const imageCategory = els.productImageCategory?.value || "";
    const imageFolder = (els.productImageFolder?.value?.trim() || slugify(els.productName.value || "san-pham-moi")).trim();
    const selectedCategoryId = Number(els.productCategory.value || 4);
    const categoryId = Number.isFinite(selectedCategoryId) ? selectedCategoryId : 4;
    const previewUrl = imageDataUrl || els.productImage.value.trim();
    updateProductImagePreview(previewUrl, file?.name || els.productName.value || "Ảnh sản phẩm");

    const payload = {
      name: els.productName.value.trim(),
      brand: els.productBrand?.value.trim() || "",
      category: state.categories.find((item) => Number(item.id) === Number(categoryId))?.slug || "accessory",
      category_id: categoryId,
      price: Number(els.productPrice.value || 0),
      sale_price: els.productSalePrice.value ? Number(els.productSalePrice.value) : null,
      image: els.productImage.value.trim(),
      short_description: els.productShortDescription.value.trim(),
      description: els.productDescription.value.trim(),
      is_featured: els.productFeatured.checked,
      is_active: els.productActive.checked,
      imageCategory,
      imageFolder,
      imageDataUrl,
      imageFileName: file?.name || "",
    };

    const method = state.editingProductId ? "PATCH" : "POST";
    const url = state.editingProductId ? `/api/admin/products/${state.editingProductId}` : "/api/admin/products";
    await apiFetch(url, { method, body: JSON.stringify(payload) });
    closeModal(els.productModal);
    await loadData();
  });

  els.orderForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = {
      code: els.orderCode.value.trim(),
      customer_name: els.orderCustomer.value.trim(),
      customer_phone: els.orderPhone.value.trim(),
      shipping_address: els.orderAddress.value.trim(),
      shipping_note: els.orderNote.value.trim(),
      products: els.orderProducts.value.trim(),
      subtotal: Number(els.orderTotal.value || 0),
      shipping_fee: 0,
      discount_amount: 0,
      total: Number(els.orderTotal.value || 0),
      status: els.orderStatus.value,
      payment_status: els.orderPaymentStatus.value,
      payment_method: els.orderPaymentMethod.value,
    };

    const method = state.editingOrderId ? "PATCH" : "POST";
    const url = state.editingOrderId ? `/api/admin/orders/${state.editingOrderId}` : "/api/admin/orders";
    await apiFetch(url, { method, body: JSON.stringify(payload) });
    closeModal(els.orderModal);
    await loadData();
  });

  els.userForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!state.editingUserId) return;
    const payload = {
      name: els.userName.value.trim(),
      email: els.userEmail.value.trim(),
      role: els.userRole.value,
      phone: els.userPhone.value.trim(),
    };

    await apiFetch(`/api/admin/users/${state.editingUserId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
    closeModal(els.userModal);
    await loadData();
  });
}

async function init() {
  setPanel("dashboard");
  bindEvents();
  const allowed = await ensureAdminSession();
  if (!allowed) {
    if (els.statTopCategory) els.statTopCategory.textContent = "Không thể đăng nhập admin";
    return;
  }
  await loadData();
}

init();
