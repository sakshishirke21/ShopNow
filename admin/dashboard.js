const API = "/api";
const UPLOAD_ORIGIN = new URL(API, window.location.href).origin;
const imageUrl = (value) => {
  const image = String(value || "").trim();
  if (!image) return "https://placehold.co/150x150?text=No+image";
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(?::\d+)?\/uploads\//i.test(image))
    return `${UPLOAD_ORIGIN}${new URL(image).pathname}`;
  if (/^(https?:)?\/\//i.test(image)) return image;
  if (image.startsWith("/uploads/")) return `${UPLOAD_ORIGIN}${image}`;
  return `${UPLOAD_ORIGIN}/uploads/${encodeURIComponent(image.replace(/^\/+/, ""))}`;
};

// ✅ MOVE FUNCTION HERE
function toggleForm() {
  const form = document.getElementById("productForm");

  if (!form) {
    console.error("productForm not found");
    return;
  }

  if (form.classList.contains("hidden")) openProductForm();
  else closeProductForm();
}

function openProductForm() {
  mountProductForm();
  resetProductForm();
  document.getElementById("productForm")?.classList.remove("hidden");
  document.getElementById("productName")?.focus();
}

function closeProductForm() {
  document.getElementById("productForm")?.classList.add("hidden");
}

function mountProductForm() {
  const form = document.getElementById("productForm");
  const app = document.getElementById("dashboardApp");
  if (form && app && form.parentElement !== app) app.appendChild(form);
}

// ================= TOKEN =================
function getToken() {
  const token = localStorage.getItem("adminToken");
  console.log("TOKEN =", token);
  return token;
}

// ================= DATA =================
let products = [];
let categories = [];
let orders = [];
let users = [];
let navigationNodes = [];
let categoryPageProducts = [];
let activeCategory = "all";
let activeProductCategoryId = "";
let selectedProductIds = new Set();
let currentProductPage = 1;
const PRODUCTS_PER_PAGE = 12;
let categoryNameById = new Map();
const hierarchyName = (value) => categoryNameById.get(String(value || "")) || value || "-";

const escapeHtml = (text) =>
  String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const nodesByType = (type) =>
  navigationNodes.filter((node) => node.type === type && node.enabled !== false);

const childrenOf = (type, parentId) =>
  navigationNodes.filter(
    (node) => node.type === type && node.parentId === parentId && node.enabled !== false,
  );

const setSelectOptions = (id, items, placeholder) => {
  const select = document.getElementById(id);
  if (!select) return;
  const previous = select.value;
  select.innerHTML = "";
  const defaultOption = document.createElement("option");
  defaultOption.value = "";
  defaultOption.textContent = placeholder;
  select.appendChild(defaultOption);
  items.forEach((item) => {
    const option = document.createElement("option");
    option.value = item.id;
    option.textContent = item.name;
    select.appendChild(option);
  });
  if (previous && Array.from(select.options).some((option) => option.value === previous)) {
    select.value = previous;
  }
};

// One attribute template per storefront Main Category. This is the single
// source of truth for which fields the Product form shows, which fields get
// saved to Product.attributes, and therefore what the Product Details page
// and product cards can display (they both read from Product.attributes).
// To support a brand-new Main Category, add one entry here (and, if its name
// won't match automatically, one line in resolveProductTemplateKey below) --
// nothing else needs to change.
const productTemplates = {
  electronics: {
    label: "Electronics",
    variantFields: ["color", "ram", "storage", "sku", "price", "stock"],
    specFields: [
      "Brand",
      "Model Number",
      "Color",
      "RAM",
      "Storage",
      "Processor",
      "Display Size",
      "Refresh Rate",
      "Battery Capacity",
      "Camera",
      "Operating System",
      "Connectivity",
      "Warranty",
      "SKU",
      "Weight",
    ],
    featureFields: [],
  },
  fashion: {
    label: "Fashion",
    variantFields: ["color", "size", "sku", "price", "stock"],
    specFields: [
      "Brand",
      "Gender",
      "Color",
      "Size",
      "Material",
      "Fabric",
      "Sleeve Type",
      "Neck Type",
      "Pattern",
      "Fit",
      "Occasion",
      "Wash Care",
      "Country of Origin",
    ],
    featureFields: [],
  },
  footwear: {
    label: "Footwear",
    variantFields: ["color", "size", "sku", "price", "stock"],
    specFields: [
      "Brand",
      "Size",
      "Color",
      "Material",
      "Sole Type",
      "Heel Height",
      "Closure Type",
    ],
    featureFields: [],
  },
  furniture: {
    label: "Furniture",
    variantFields: ["color", "material", "sku", "price", "stock"],
    specFields: [
      "Material",
      "Dimensions",
      "Weight",
      "Finish",
      "Assembly Required",
      "Seating Capacity",
    ],
    featureFields: [],
  },
  beauty: {
    label: "Beauty",
    variantFields: ["shade", "size", "sku", "price", "stock"],
    specFields: [
      "Brand",
      "Skin Type",
      "Hair Type",
      "Shade",
      "Ingredients",
      "Expiry Date",
      "Net Quantity",
    ],
    featureFields: [],
  },
  books: {
    label: "Books",
    variantFields: ["sku", "price", "stock"],
    specFields: [
      "Author",
      "Publisher",
      "Language",
      "ISBN",
      "Number of Pages",
      "Edition",
    ],
    featureFields: [],
  },
  default: {
    label: "Default",
    variantFields: ["color", "sku", "price", "stock"],
    specFields: ["Brand", "Model", "Warranty", "Description"],
    featureFields: [],
  },
};

function attributeKey(label) {
  return String(label || "").trim().toLowerCase().replace(/[^a-z0-9]+(.)/g, (_m, char) => char.toUpperCase());
}

function getNodeName(id) {
  const node = navigationNodes.find((item) => String(item.id || item._id) === String(id));
  return node?.name || "";
}

function getSelectedTaxonomyNames() {
  const selectedText = (id) => document.getElementById(id)?.selectedOptions?.[0]?.text?.trim() || "";
  // productCategory is the visible selector; categoryId is the canonical
  // taxonomy selector inserted by taxonomy-manager. Use either during the
  // short interval while cascading selectors are being synchronised.
  const mainId = document.getElementById("categoryId")?.value || document.getElementById("productCategory")?.value;
  return {
    main: getNodeName(mainId) || selectedText("productCategory"),
    section: getNodeName(document.getElementById("sectionId")?.value) || selectedText("sectionId"),
    group: getNodeName(document.getElementById("groupId")?.value) || selectedText("groupId"),
    item: getNodeName(document.getElementById("itemId")?.value) || selectedText("itemId"),
  };
}

function resolveProductTemplateKey() {
  // Resolve purely from the Main Category the admin picked. Section/Group/Item
  // stay available in getSelectedTaxonomyNames() for anything else that needs
  // them, but the attribute template itself only ever depends on the Main
  // Category, matching the storefront's Category -> Section -> Group -> Item
  // hierarchy exactly one level up.
  const { main } = getSelectedTaxonomyNames();
  const key = String(main || "").trim().toLowerCase();
  if (productTemplates[key]) return key;
  if (/electronic/.test(key)) return "electronics";
  if (/fashion|clothing|apparel/.test(key)) return "fashion";
  if (/footwear|shoe|sandal|sneaker/.test(key)) return "footwear";
  if (/furniture/.test(key)) return "furniture";
  if (/beauty|cosmetic|skincare|makeup/.test(key)) return "beauty";
  if (/book/.test(key)) return "books";
  return "default";
}

function getCurrentProductTemplate() {
  return productTemplates[resolveProductTemplateKey()] || productTemplates.default;
}

function renderFunctionSection() {
  const template = getCurrentProductTemplate();
  const specContainer = document.getElementById("specTemplate");
  const variantContainer = document.getElementById("variantRows");
  const featureContainer = document.getElementById("featureSection");
  if (!specContainer || !variantContainer || !featureContainer) return;

  const variantFields = template.variantFields || productTemplates.default.variantFields;
  const featureFields = template.featureFields || productTemplates.default.featureFields;

  specContainer.innerHTML = template.specFields
    .map((key) => {
      const value = selectedSpecifications[attributeKey(key)] || selectedSpecifications[key] || "";
      return `
        <div class="form-row spec-row">
          <label>${escapeHtml(key)}</label>
          <input data-key="${escapeHtml(key)}" type="text" value="${escapeHtml(value)}" placeholder="${escapeHtml(key)}" />
        </div>
      `;
    })
    .join("");

  selectedVariants = selectedVariants.map((variant) => ({
    ...variant,
    fields: variant.fields || variantFields,
  }));
  renderVariantRows();

  featureContainer.innerHTML = featureFields
    .map((label) => {
      const value = selectedFeatures.find((value) => value.startsWith(label + ": "))?.split(": ")[1] || "";
      return `
        <div class="form-row feature-row">
          <label>${escapeHtml(label)}</label>
          <input type="text" data-feature="${escapeHtml(label)}" value="${escapeHtml(value)}" placeholder="${escapeHtml(label)}" />
        </div>
      `;
    })
    .join("");
}

function renderProductRows(tableId, items) {
  return items
    .map(
      (p) => `
        <tr>
            <td><input type="checkbox" class="product-select" value="${p._id || p.id}" ${selectedProductIds.has(String(p._id || p.id)) ? "checked" : ""}></td>
            <td>
                <img 
                    src="${imageUrl(p.images?.[0] || p.thumbnail || "")}" 
                    class="image-preview"
                    onerror="this.onerror=null;this.src='https://placehold.co/150x150?text=No+image';"
                />
            </td>
            <td>${escapeHtml(p.name || "-")}</td>
            <td>${escapeHtml(hierarchyName(p.category || p.mainCategory))}</td>
            <td>${escapeHtml(hierarchyName(p.section))}</td>
            <td>${escapeHtml(hierarchyName(p.group))}</td>
            <td>${escapeHtml(hierarchyName(p.item || p.brand))}</td>
            <td>₹${p.price || 0}</td>
            <td>${p.stock || 0}</td>
            <td><span class="badge">${escapeHtml(p.status || "Active")}</span></td>
            <td>${p.createdAt ? new Date(p.createdAt).toLocaleDateString() : "-"}</td>
            <td class="actions">
                <button onclick="editProduct('${p._id || p.id}')">Edit</button>
                <button class="delete" onclick="deleteProd('${p._id || p.id}')">Delete</button>
            </td>
        </tr>
      `,
    )
    .join("");
}

function renderProductTable(tableId, items) {
  const table = document.getElementById(tableId);
  if (!table) return;
  if (!items.length) {
    table.innerHTML = `<tr>
    <td colspan="12" style="text-align:center">No products found.</td>
    </tr>`;
    return; 
  }
  table.innerHTML = renderProductRows(tableId, items);
}

// ================= AUTH =================
async function checkAuth() {
  const token = getToken();

  if (!token) {
    document.getElementById("loginScreen").style.display = "flex";
    document.getElementById("dashboardApp").style.display = "none";
    return;
  }
  try {
    const response = await fetch(API + "/admin/users", {
      headers: { Authorization: "Bearer " + token },
    });
    if (response.ok) return showDashboard();
    if (response.status === 401 || response.status === 403) {
      document.getElementById("loginScreen").style.display = "flex";
      document.getElementById("dashboardApp").style.display = "none";
      document.getElementById("loginError").innerText = "Your admin session is invalid. Please sign in again.";
      document.getElementById("loginError").style.display = "block";
    }
  } catch (error) {
    // A temporary server/network failure must never log an admin out.
    console.error("Admin session check failed:", error);
    showDashboard();
  }
}

function showDashboard() {
  document.getElementById("loginScreen").style.display = "none";
  document.getElementById("dashboardApp").style.display = "block";
  loadData();
}

// ================= LOAD DATA =================
function loadData() {
  getNavigationNames();
  getProducts();
  getCategories();
  getOrders();
  getUsers();
}

function getNavigationNames() {
  fetch(API + "/navigation")
    .then((response) => response.json())
    .then((data) => {
      navigationNodes = Array.isArray(data.nodes) ? data.nodes : [];
      categoryNameById = new Map((navigationNodes || []).map((node) => [String(node.id || node._id), node.name]));
      renderProducts();
      renderFilterSelectors();
    })
    .catch((error) => console.error("Could not load category names:", error));
}

// ================= API CALLS =================
function getProducts() {
  fetch(API + "/products", {
    headers: {
      Authorization: "Bearer " + getToken(),
    },
  })
    .then((res) => res.json())
    .then((data) => {
      console.log("Products API =", data);

      if (Array.isArray(data)) {
        products = data;
      } else if (data.success && Array.isArray(data.products)) {
        products = data.products;
      } else {
        products = [];
      }

      // Category Products is a filtered view of this same collection. Start
      // with all products, then let loadCategoryProducts narrow it by Item.
      categoryPageProducts = products.slice();
      renderProducts();
      renderCategoryProducts();
      updateStats();
    })
    .catch((err) => console.error(err));
}
// ================= CATEGORIES =================

function getCategories() {
  fetch(API + "/categories", {
    headers: {
      Authorization: "Bearer " + getToken(),
    },
  })
    .then((res) => res.json())
    .then((data) => {
      categories = Array.isArray(data) ? data : data.categories || [];
      renderCategories();
    })
    .catch((err) => console.error(err));
}

function openMainCategoryForm() {
  document.getElementById("mainCategoryForm").classList.toggle("hidden");
}

function renderCategories() {
  const table = document.getElementById("mainCategoryTable");
  // taxonomy-manager owns this screen after it renders the hierarchy.
  // Do not treat the replaced legacy table as an application error.
  if (!table) return;

  table.innerHTML = categories
    .map(
      (cat) => `

<tr>

<td>
<img
src="${imageUrl(cat.image)}"
class="image-preview">
</td>
 
<td>${cat.name}</td>

<td>${cat.status || "Active"}</td>

<td class="actions">

<button onclick="editCategory('${cat._id}')">
Edit
</button>

<button class="delete"
onclick="deleteCategory('${cat._id}')">
Delete
</button>

</td>

</tr>

`,
    )
    .join("");
}

async function deleteCategory(id) {
  if (!confirm("Delete this category?")) return;

  try {
    await fetch(API + "/categories/" + id, {
      method: "DELETE",
      headers: {
        Authorization: "Bearer " + getToken(),
      },
    });

    getCategories();
  } catch (err) {
    console.error(err);
  }
}

function getOrders() {
  fetch(API + "/orders", {
    headers: {
      Authorization: "Bearer " + getToken(),
    },
  })
    .then((res) => res.json())
    .then((data) => {
      // The API wraps the list as { success, orders: [...] } (same shape as
      // /api/navigation's { nodes }), not a bare array -- unwrap it so real
      // orders placed on the website actually reach the admin dashboard.
      orders = Array.isArray(data?.orders) ? data.orders : Array.isArray(data) ? data : [];
      renderOrders();
      updateStats();
      renderRevenueChart();
    })
    .catch((err) => {
      console.error("Orders API error:", err);
      orders = [];
    });
}

function getUsers() {
  fetch(API + "/users", {
    headers: {
      Authorization: "Bearer " + getToken(),
    },
  })
    .then((res) => res.json())
    .then((data) => {
      users = Array.isArray(data) ? data : [];
      renderUsers();
    })
    .catch((err) => {
      console.error("Users API error:", err);
      users = [];
    });
}
// ================= RENDER =================
//====products====

function renderProducts() {
  const searchValue = (document.getElementById("productSearch")?.value || "").trim().toLowerCase();
  const filtered = products.filter((p) => {
    const text = [p.name, p.shortDescription, p.description, p.sku, p.item, p.group, p.section, p.category, p.brand]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    const matchesSearch = !searchValue || text.includes(searchValue);
    const matchesCategory = !activeProductCategoryId || String(p.category) === activeProductCategoryId;
    return matchesSearch && matchesCategory;
  });
  const total = filtered.length;
  const pages = Math.max(1, Math.ceil(total / PRODUCTS_PER_PAGE));
  currentProductPage = Math.min(Math.max(1, currentProductPage), pages);
  const pageItems = filtered.slice((currentProductPage - 1) * PRODUCTS_PER_PAGE, currentProductPage * PRODUCTS_PER_PAGE);
  renderProductTable("productTable", pageItems);
  renderProductPagination(total);
  renderProductCategorySidebar();
}

function renderProductCategorySidebar() {
  const root = document.getElementById("productCategorySidebar");
  if (!root) return;
  const mainCategories = navigationNodes.filter((node) => node.type === "main");
  const button = (id, name, count) => `<button type="button" class="${activeProductCategoryId === id ? "active" : ""}" data-product-category="${id}"><span>${escapeHtml(name)}</span><b>${count}</b></button>`;
  root.innerHTML = button("", "All products", products.length) + mainCategories.map((node) => button(String(node.id || node._id), node.name, products.filter((product) => String(product.category) === String(node.id || node._id)).length)).join("");
}

function renderProductPagination(total) {
  const container = document.getElementById("productPagination");
  if (!container) return;
  const pages = Math.max(1, Math.ceil(total / PRODUCTS_PER_PAGE));
  container.innerHTML = "";
  const prev = document.createElement("button");
  prev.type = "button";
  prev.className = "button-secondary";
  prev.disabled = currentProductPage <= 1;
  prev.textContent = "Previous";
  prev.onclick = () => {
    if (currentProductPage > 1) {
      currentProductPage -= 1;
      renderProducts();
    }
  };
  const next = document.createElement("button");
  next.type = "button";
  next.className = "button-secondary";
  next.disabled = currentProductPage >= pages;
  next.textContent = "Next";
  next.onclick = () => {
    if (currentProductPage < pages) {
      currentProductPage += 1;
      renderProducts();
    }
  };
  const info = document.createElement("span");
  info.textContent = ` Page ${currentProductPage} of ${pages} `;
  container.appendChild(prev);
  container.appendChild(info);
  container.appendChild(next);
}

function editProduct(id) {
  console.log("Editing:", id);

  const product = products.find((p) => String(p._id || p.id) === String(id));

  if (!product) {
    console.error("Product not found");
    return;
  }

  editProductId = product._id || product.id;

  document.getElementById("productName").value = product.name || "";
  document.getElementById("productShortDescription").value = product.shortDescription || "";
  document.getElementById("productDescription").value = product.description || "";
  document.getElementById("productBrand").value = product.brand || "";
  document.getElementById("productSKU").value = product.sku || "";
  document.getElementById("productMRP").value = product.mrp || "";
  document.getElementById("productPrice").value = product.price || "";
  document.getElementById("productDiscount").value = product.discount || "";
  document.getElementById("productStock").value = product.stock || "";
  document.getElementById("productStatus").value = product.status || "Active";
  document.getElementById("productDeliveryTime").value = product.shipping?.deliveryTime || "";
  document.getElementById("productWeight").value = product.shipping?.weight || "";
  document.getElementById("productLength").value = product.shipping?.length || "";
  document.getElementById("productWidth").value = product.shipping?.width || "";
  document.getElementById("productHeight").value = product.shipping?.height || "";
  document.getElementById("inventorySKU").value = product.inventory?.sku || product.sku || "";
  document.getElementById("inventoryStock").value = product.inventory?.stock || product.stock || "";
  document.getElementById("inventoryLowStock").value = product.inventory?.lowStockAlert || "";
  document.getElementById("inventoryWarehouse").value = product.inventory?.warehouse || "";
  document.getElementById("productMetaTitle").value = product.seo?.title || "";
  document.getElementById("productMetaDescription").value = product.seo?.description || "";
  document.getElementById("productSlug").value = product.seo?.slug || product.slug || "";
  document.getElementById("productKeywords").value = Array.isArray(product.seo?.keywords) ? product.seo.keywords.join(", ") : product.seo?.keywords || "";

  selectedFeatures = Array.isArray(product.features) ? product.features.slice() : [];
  selectedSpecifications = product.attributes || product.specifications || {};
  selectedVariants = Array.isArray(product.variants) ? product.variants.slice() : [];
  selectedMediaItems = (product.images || []).map((image) => ({ type: "image", preview: image }))
    .concat((product.videos || []).map((video) => ({ type: "video", preview: video })));
  renderFunctionSection();
  renderMediaPreview();

  const categoryField = document.getElementById("categoryId");
  const sectionField = document.getElementById("sectionId");
  const groupField = document.getElementById("groupId");
  const itemField = document.getElementById("itemId");

  if (categoryField) {
    categoryField.value = product.category || "";
    categoryField.dispatchEvent(new Event("change", { bubbles: true }));
  }
  if (sectionField) {
    sectionField.value = product.section || "";
    sectionField.dispatchEvent(new Event("change", { bubbles: true }));
  }
  if (groupField) {
    groupField.value = product.group || "";
    groupField.dispatchEvent(new Event("change", { bubbles: true }));
  }
  if (itemField) {
    itemField.value = product.item || "";
    itemField.dispatchEvent(new Event("change", { bubbles: true }));
  }

  document.getElementById("productFormTitle").innerText = "Edit Product";
  mountProductForm();
  document.getElementById("productForm").classList.remove("hidden");
}
let editCategoryId = null;

//==== category products ====
function renderCategoryProducts() {
  // Never fall back to the full catalog here: an Item with no products must
  // show an empty state, otherwise users see unrelated products.
  renderProductTable("categoryProductsTable", categoryPageProducts);
}

function editCategory(id) {
  const cat = categories.find((c) => c._id == id);
  if (!cat) return;

  editCategoryId = id;

  document.getElementById("mainCategoryName").value = cat.name;

  const form = document.getElementById("mainCategoryForm");
  console.log("categoryForm =", form);

  if (!form) {
    console.error("categoryForm not found");
    return;
  }

  form.classList.remove("hidden");
}

function renderOrders() {
  const table = document.getElementById("ordersTable");
  if (!table) return;

  table.innerHTML = orders
    .map((order) => {
      // Real Order documents (see backend Order model) store the buyer as a
      // populated `customer` ref and the line items as `items`, not the
      // `user`/`userId`/`products` placeholders this used to look for.
      const customerName =
        order.customerName ||
        order.customer?.name ||
        (typeof order.customer === "string" ? order.customer : "") ||
        "User";
      const customerEmail = order.customerEmail || order.customer?.email || "";
      const itemsList = (order.items || order.products || [])
        .map((item) => `${item.name || item.title || "Item"}${item.quantity > 1 ? ` x${item.quantity}` : ""}`)
        .join("<br>");

      return `
            <tr>
                <td>${order.number || order._id || "-"}</td>
                <td>${customerName}${customerEmail ? `<br><small>${customerEmail}</small>` : ""}</td>
                <td>${itemsList}</td>
                <td>₹${order.total || 0}</td>
                <td><span class="badge">${order.status || "Placed"}</span></td>
            </tr>
        `;
    })
    .join("");
}

function renderUsers() {
  const table = document.getElementById("usersTable");
  if (!table) return;
  table.innerHTML = users
    .map(
      (user) => `
                <tr>
                    <td>${user.name}</td>
                    <td>${user.email}</td>
                    <td>${user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "-"}
</td>
                    <td><span class="badge">User</span></td>
                </tr>
            `,
    )
    .join("");
}

// ================= STATS =================
function updateStats() {
  products = Array.isArray(products) ? products : [];
  orders = Array.isArray(orders) ? orders : [];
  users = Array.isArray(users) ? users : [];

  document.getElementById("ordersCount").innerText = orders.length;
  document.getElementById("usersCount").innerText = users.length;
  document.getElementById("productsCount").innerText = products.length;

  let revenue = orders.reduce((sum, o) => {
    return sum + (Number(o.total) || 0);
  }, 0);

  document.getElementById("revenueValue").innerText = "₹" + revenue.toFixed(2);
}

function renderRevenueChart() {
  if (typeof Chart === "undefined") return;
  const canvas = document.getElementById("revenueChart");
  if (!canvas) return;
  const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const data = labels.map((_, index) => {
    return orders
      .filter((order) => {
        const created = new Date(
          order.createdAt || order.created || Date.now(),
        );
        const day = created.getDay();
        return day === (index + 1) % 7;
      })
      .reduce((sum, order) => sum + (Number(order.total) || 0), 0);
  });

  if (window.revenueChartInstance) {
    window.revenueChartInstance.destroy();
  }

  window.revenueChartInstance = new Chart(canvas, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Revenue",
          data,
          borderColor: "#6366f1",
          backgroundColor: "rgba(99, 102, 241, 0.2)",
          tension: 0.3,
          fill: true,
        },
      ],
    },
    options: { responsive: true, maintainAspectRatio: false },
  });
}

// ================= DELETE =================
function deleteProd(id) {
  if (!id) {
    alert("Cannot delete static product!");
    return;
  }

  if (!confirm("Delete this product?")) return;

  fetch(API + "/products/" + id, {
    method: "DELETE",
    headers: {
      Authorization: "Bearer " + getToken(),
    },
  })
    .then(async (res) => {
      const data = await res.json();

      if (data.success) {
        alert("Product deleted");

        getProducts();
      } else {
        alert(data.message);
      }
    })
    .catch((err) => console.error(err));
}

// ================= LOGIN =================

async function handleLogin(e) {
  e.preventDefault();

  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;

  const errorBox = document.getElementById("loginError");

  try {
    const res = await fetch("/api/login"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username, password }), // ✅ correct
    });

    const data = await res.json();

    if (!data.success || !data.isAdmin) {
      errorBox.innerText = data.message || "Administrator access is required.";
      errorBox.style.display = "block";
      return;
    }

    // ✅ Save token
    localStorage.setItem("adminToken", data.token);

    // ✅ Switch screen
    document.getElementById("loginScreen").style.display = "none";
    document.getElementById("dashboardApp").style.display = "block";

    loadData(); // call your data loading
  } catch (err) {
    console.error(err);
    errorBox.innerText = "Server error";
    errorBox.style.display = "block";
  }
}
// ================= PRODUCT FORM =================
let editProductId = null;
let selectedFeatures = [];
let selectedVariants = [];

function parseCommaValues(value) {
  return String(value || "")
    .split(/\n|,|;/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function resetProductForm() {
  const form = document.getElementById("productForm");
  if (!form) return;
  form.querySelectorAll("input,textarea,select").forEach((field) => {
    if (field.type === "checkbox") {
      field.checked = false;
    } else {
      field.value = "";
    }
  });
  document.getElementById("productStatus").value = "Active";
  document.getElementById("productFormTitle").innerText = "Add Product";
  document.getElementById("productMediaPreview").innerHTML = "";
  selectedFeatures = [];
  selectedSpecifications = {};
  selectedVariants = [];
  selectedMediaItems = [];
  renderFunctionSection();
  renderMediaPreview();
  setActiveProductTab("basic");
  editProductId = null;
}

function setActiveProductTab(tabName) {
  document.querySelectorAll(".product-form-tabs .tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.tab === tabName);
  });
  document.querySelectorAll(".product-form-step").forEach((step) => {
    const specifications = ["tab-specs", "tab-variants", "tab-features"];
    step.classList.toggle("active", step.id === `tab-${tabName}` || (tabName === "specifications" && specifications.includes(step.id)));
  });
}

function determineVariantFields() {
  const selectedCategory = document.getElementById("productCategory")?.selectedOptions[0]?.text || "";
  if (/electronics/i.test(selectedCategory)) {
    return ["color", "ram", "storage", "sku", "price", "stock"];
  }
  if (/fashion/i.test(selectedCategory) && !/shoes/i.test(selectedCategory)) {
    return ["color", "size", "sku", "price", "stock"];
  }
  if (/shoes/i.test(selectedCategory)) {
    return ["color", "ukSize", "sku", "price", "stock"];
  }
  return ["color", "sku", "price", "stock"];
}

function addVariantRow(variant = {}) {
  const currentTemplate = getCurrentProductTemplate();
  const fields = variant.fields || currentTemplate.variantFields || determineVariantFields();
  selectedVariants.push({ ...variant, fields });
  renderVariantRows();
}

function removeVariantRow(index) {
  selectedVariants.splice(index, 1);
  renderVariantRows();
}

function renderVariantRows() {
  const container = document.getElementById("variantRows");
  if (!container) return;
  const templateFields = getCurrentProductTemplate().variantFields || determineVariantFields();
  container.innerHTML = selectedVariants
    .map((variant, index) => {
      const fields = variant.fields || templateFields;
      return `<div class="variant-row" data-index="${index}">
        ${fields
          .map((field) => {
            const label = field
              .replace(/([A-Z])/g, " $1")
              .replace(/^./, (m) => m.toUpperCase());
            const value = escapeHtml(variant[field] || "");
            return `<input type="text" data-field="${field}" placeholder="${label}" value="${value}" />`;
          })
          .join("")}
        <button type="button" class="button-secondary" onclick="removeVariantRow(${index})">Remove</button>
      </div>`;
    })
    .join("");
  if (!selectedVariants.length) {
    addVariantRow({ fields: templateFields });
  }
}

function collectVariants() {
  return selectedVariants.map((variant, index) => {
    const row = document.querySelector(`.variant-row[data-index="${index}"]`);
    if (!row) return variant;
    const result = { fields: variant.fields };
    row.querySelectorAll("input[data-field]").forEach((input) => {
      result[input.dataset.field] = input.value.trim();
    });
    return result;
  });
}

function collectFeatureFields() {
  const container = document.getElementById("featureSection");
  if (!container) return [];
  return Array.from(container.querySelectorAll("input[data-feature]"))
    .map((input) => ({ label: input.dataset.feature, value: input.value.trim() }))
    .filter((item) => item.value)
    .map((item) => `${item.label}: ${item.value}`);
}

function renderMediaPreview() {
  const target = document.getElementById("productMediaPreview");
  if (!target) return;
  target.innerHTML = selectedMediaItems
    .map((item, index) => {
      const label = item.type === "video" ? "Video" : "Image";
      return `
        <div class="media-thumb" draggable="true" data-index="${index}">
          <div class="media-thumb-top">
            <span class="media-label">${escapeHtml(label)}</span>
            <button type="button" class="media-delete" data-index="${index}">×</button>
          </div>
          ${item.type === "video"
            ? `<video src="${escapeHtml(item.preview)}" controls muted></video>`
            : `<img src="${escapeHtml(item.preview)}" alt="${escapeHtml(label)}" />`}
          <div class="media-handle">⠿</div>
        </div>
      `;
    })
    .join("");
}

function addMediaFiles(files, type) {
  Array.from(files).forEach((file) => {
    selectedMediaItems.push({ type, file, preview: URL.createObjectURL(file) });
  });
  renderMediaPreview();
}

function removeMediaItem(index) {
  selectedMediaItems.splice(index, 1);
  renderMediaPreview();
}

function moveMediaItem(fromIndex, toIndex) {
  if (toIndex < 0 || toIndex >= selectedMediaItems.length) return;
  const [item] = selectedMediaItems.splice(fromIndex, 1);
  selectedMediaItems.splice(toIndex, 0, item);
  renderMediaPreview();
}

function initMediaDragDrop() {
  const preview = document.getElementById("productMediaPreview");
  if (!preview) return;

  preview.addEventListener("click", (event) => {
    const deleteButton = event.target.closest(".media-delete");
    if (!deleteButton) return;
    const index = Number(deleteButton.dataset.index);
    removeMediaItem(index);
  });

  preview.addEventListener("dragstart", (event) => {
    const thumb = event.target.closest(".media-thumb");
    if (!thumb) return;
    event.dataTransfer.setData("text/plain", thumb.dataset.index);
    event.dataTransfer.effectAllowed = "move";
  });

  preview.addEventListener("dragover", (event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  });

  preview.addEventListener("drop", (event) => {
    event.preventDefault();
    const fromIndex = Number(event.dataTransfer.getData("text/plain"));
    const dropTarget = event.target.closest(".media-thumb");
    if (!dropTarget || Number.isNaN(fromIndex)) return;
    const toIndex = Number(dropTarget.dataset.index);
    if (fromIndex !== toIndex) moveMediaItem(fromIndex, toIndex);
  });
}

function collectSpecifications() {
  const specContainer = document.getElementById("specTemplate");
  if (!specContainer) return {};
  return Array.from(specContainer.querySelectorAll("input[data-key]")).reduce((acc, input) => {
    const key = input.dataset.key;
    const value = input.value.trim();
    if (key && value) acc[key] = value;
    return acc;
  }, {});
}

function collectAttributes() {
  return Object.entries(collectSpecifications()).reduce((attributes, [label, value]) => {
    attributes[attributeKey(label)] = value;
    return attributes;
  }, {});
}

function updateFilterSelects(target) {
  if (target.id === "filterCategory") {
    setSelectOptions("filterSection", childrenOf("section", target.value), "Section");
    setSelectOptions("filterGroup", [], "Group");
    setSelectOptions("filterItem", [], "Item");
  }
  if (target.id === "filterSection") {
    setSelectOptions("filterGroup", childrenOf("group", target.value), "Group");
    setSelectOptions("filterItem", [], "Item");
  }
  if (target.id === "filterGroup") {
    setSelectOptions("filterItem", childrenOf("item", target.value), "Item");
  }
}

function renderFilterSelectors() {
  setSelectOptions("filterCategory", nodesByType("main"), "Main Category");
  setSelectOptions("filterSection", [], "Section");
  setSelectOptions("filterGroup", [], "Group");
  setSelectOptions("filterItem", [], "Item");
  setSelectOptions("productCategory", nodesByType("main"), "Main Category");
}

function loadCategoryProducts() {
  const category = document.getElementById("filterCategory").value;
  const section = document.getElementById("filterSection").value;
  const group = document.getElementById("filterGroup").value;
  const item = document.getElementById("filterItem").value;
  const search = (document.getElementById("categoryProductSearch")?.value || "").trim().toLowerCase();
  categoryPageProducts = products.filter((p) => {
    return (
      (!category || String(p.category) === String(category)) &&
      (!section || String(p.section) === String(section)) &&
      (!group || String(p.group) === String(group)) &&
      (!item || String(p.item) === String(item)) &&
      (!search || [p.name, p.sku, p.brand, p.description].filter(Boolean).join(" ").toLowerCase().includes(search))
    );
  });
  renderCategoryProducts();
}

function saveProduct() {
  const name = document.getElementById("productName").value.trim();
  const categoryId = document.getElementById("categoryId")?.value || "";
  const sectionId = document.getElementById("sectionId")?.value || "";
  const groupId = document.getElementById("groupId")?.value || "";
  const itemId = document.getElementById("itemId")?.value || "";
  const price = document.getElementById("productPrice").value.trim();

  if (!name || !categoryId || !sectionId || !groupId || !itemId || !price) {
    alert("Please fill required fields and complete the category hierarchy.");
    return;
  }
  if (!selectedMediaItems.some((item) => item.type === "image")) {
    alert("A main image is required.");
    return;
  }

  const method = editProductId ? "PUT" : "POST";
  const url = editProductId ? API + "/products/" + editProductId : API + "/products";
  const formData = new FormData();
  formData.append("name", name);
  formData.append("brand", document.getElementById("productBrand").value.trim());
  formData.append("sku", document.getElementById("productSKU").value.trim());
  formData.append("categoryId", categoryId);
  formData.append("sectionId", sectionId);
  formData.append("groupId", groupId);
  formData.append("itemId", itemId);
  formData.append("price", price);
  formData.append("mrp", document.getElementById("productMRP").value.trim());
  formData.append("discount", document.getElementById("productDiscount").value.trim());
  formData.append("stock", document.getElementById("productStock").value.trim());
  formData.append("status", document.getElementById("productStatus").value);
  formData.append("shortDescription", document.getElementById("productShortDescription").value.trim());
  formData.append("description", document.getElementById("productDescription").value.trim());
  formData.append("features", JSON.stringify(collectFeatureFields()));
  formData.append("variants", JSON.stringify(collectVariants()));
  formData.append("specifications", JSON.stringify(collectSpecifications()));
  formData.append("attributes", JSON.stringify(collectAttributes()));
  formData.append("metaTitle", document.getElementById("productMetaTitle").value.trim());
  formData.append("metaDescription", document.getElementById("productMetaDescription").value.trim());
  formData.append("slug", document.getElementById("productSlug").value.trim());
  formData.append("keywords", document.getElementById("productKeywords").value.trim());
  formData.append("weight", document.getElementById("productWeight").value.trim());
  formData.append("length", document.getElementById("productLength").value.trim());
  formData.append("width", document.getElementById("productWidth").value.trim());
  formData.append("height", document.getElementById("productHeight").value.trim());
  formData.append("deliveryTime", document.getElementById("productDeliveryTime").value.trim());
  formData.append("inventorySKU", document.getElementById("inventorySKU").value.trim());
  formData.append("inventoryStock", document.getElementById("inventoryStock").value.trim());
  formData.append("inventoryLowStock", document.getElementById("inventoryLowStock").value.trim());
  formData.append("inventoryWarehouse", document.getElementById("inventoryWarehouse").value.trim());
  formData.append("featured", document.getElementById("productFeatured").checked);
  formData.append("trending", document.getElementById("productTrending").checked);
  formData.append("newArrival", document.getElementById("productNewArrival").checked);
  formData.append("bestSeller", document.getElementById("productBestSeller").checked);

  formData.append("retainedImages", JSON.stringify(selectedMediaItems.filter((item) => item.type === "image" && !item.file).map((item) => item.preview)));
  formData.append("retainedVideos", JSON.stringify(selectedMediaItems.filter((item) => item.type === "video" && !item.file).map((item) => item.preview)));
  const firstImage = selectedMediaItems.find((item) => item.type === "image");
  if (firstImage && !firstImage.file) formData.append("mainImage", firstImage.preview);
  selectedMediaItems.forEach((item) => {
    if (item.file) {
      formData.append("images", item.file);
    }
  });

  fetch(url, {
    method,
    headers: {
      Authorization: "Bearer " + getToken(),
    },
    body: formData,
  })
    .then((res) => res.json())
    .then((data) => {
      if (data.success) {
        alert(editProductId ? "Product updated" : "Product added");
        resetProductForm();
        getProducts();
      } else {
        alert(data.message || "Unable to save product");
      }
    })
    .catch((err) => console.error(err));
}

function handleMediaInputChange(event) {
  const input = event.target;
  if (!input || !input.files?.length) return;
  const type = input.id === "productVideos" ? "video" : "image";
  addMediaFiles(input.files, type);
  input.value = "";
}

window.addEventListener("load", () => {
  const style = document.createElement("style");
  style.textContent =
    ".product-image-preview{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}.product-image-preview img{width:62px;height:62px;object-fit:cover;border:1px solid #d5be8;border-radius:6px}";
  document.head.appendChild(style);
});

async function addCategory() {
  const name = document.getElementById("mainCategoryName").value.trim();
  const image = document.getElementById("mainCategoryImage").files[0];

  if (!name) {
    alert("Fill required fields");
    return;
  }

  const formData = new FormData();
  formData.append("name", name);

  if (image) {
    formData.append("image", image);
  }

  const method = editCategoryId ? "PUT" : "POST";
  const url = editCategoryId
    ? API + "/categories/" + editCategoryId
    : API + "/categories";

  try {
    const res = await fetch(url, {
      method: method,
      headers: {
        Authorization: "Bearer " + getToken(),
      },
      body: formData,
    });

    const data = await res.json();

    if (data.success) {
      alert(editCategoryId ? "Category updated" : "Category added");
      editCategoryId = null;
      document.getElementById("mainCategoryName").value = "";
      document.getElementById("mainCategoryImage").value = "";
      getCategories();
    } else {
      alert(data.message || "Unable to save category");
    }
  } catch (err) {
    console.error(err);
  }
}

function setCategory(cat) {
  console.log("Clicked category =", cat);
  activeCategory = cat;
  renderProducts();
}

function logout() {
  localStorage.removeItem("adminToken");
  location.reload();
}

function exportProducts() {
  const fields = ["name", "sku", "brand", "price", "mrp", "discount", "stock", "category", "section", "group", "item"];
  const quote = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const csv = [fields.join(","), ...products.map((product) => fields.map((field) => quote(product[field])).join(","))].join("\n");
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  link.download = `shopnow-products-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click(); URL.revokeObjectURL(link.href);
}

function injectProductAdminStyles() {
  if (document.getElementById("product-admin-redesign-styles")) return;
  const style = document.createElement("style"); style.id = "product-admin-redesign-styles";
  style.textContent = `
    .product-catalog-layout{display:grid;grid-template-columns:220px minmax(0,1fr);gap:18px}.product-category-sidebar{background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:14px;height:max-content}.product-category-sidebar h4{margin:0 0 10px}.product-category-sidebar button{width:100%;display:flex;justify-content:space-between;border:0;background:transparent;padding:10px;border-radius:7px;text-align:left;cursor:pointer}.product-category-sidebar button:hover,.product-category-sidebar button.active{background:#edf6ff;color:#075985}.product-category-sidebar b{font-size:12px;background:#eef2f7;border-radius:12px;padding:1px 7px}.catalog-toolbar{display:flex;gap:10px;align-items:center;padding:0 0 13px}.catalog-toolbar select{padding:8px;border:1px solid #d7dee8;border-radius:6px}.product-drawer{position:fixed;z-index:1000;right:0;top:0;bottom:0;width:min(860px,100vw);margin:0;overflow-y:auto;border-radius:0;box-shadow:-12px 0 30px rgba(15,23,42,.18);padding:24px;background:#fff}.product-form-header{display:flex;align-items:center;justify-content:space-between}.drawer-close{border:0;background:#f1f5f9;border-radius:50%;width:32px;height:32px;font-size:24px;cursor:pointer}.product-form-tabs{display:flex;gap:5px;overflow-x:auto;border-bottom:1px solid #e5e7eb;margin:16px 0}.product-form-tabs .tab{border:0;background:transparent;padding:12px 10px;color:#64748b;white-space:nowrap;cursor:pointer}.product-form-tabs .tab.active{color:#0f766e;border-bottom:3px solid #0f766e;font-weight:700}.product-form-step{display:none}.product-form-step.active{display:block}.product-drawer .form-row{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.product-drawer .form-row textarea{grid-column:1/-1;min-height:100px}.product-drawer .taxonomy-row,.product-drawer .checkbox-row{grid-template-columns:1fr}.product-drawer input,.product-drawer select,.product-drawer textarea{padding:10px;border:1px solid #d5dbe8;border-radius:7px}.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)}@media(max-width:780px){.product-catalog-layout{grid-template-columns:1fr}.product-category-sidebar{display:flex;gap:5px;overflow:auto}.product-category-sidebar h4{display:none}.product-category-sidebar button{min-width:150px}.product-drawer .form-row{grid-template-columns:1fr}}
  `; document.head.appendChild(style);
}

// ================= UI =================
function switchPage(page) {
  console.log("Switching to:", page);

  document
    .querySelectorAll(".nav-btn,.sub-nav-btn")
    .forEach((b) => b.classList.remove("active"));

  const active = document.querySelector(`[data-page="${page}"]`);
  if (active) active.classList.add("active");

  document
    .querySelectorAll(".page-section")
    .forEach((s) => s.classList.add("hidden"));

  const section = document.getElementById(page + "Section");

  console.log("Section found:", section);

  if (section) section.classList.remove("hidden");

  if (page === "products") {
    renderProducts();
  }

  if (page === "categoryProducts") {
    renderFilterSelectors();
    loadCategoryProducts();
  }

  if (page === "mainCategories") {
    renderCategories();
  }
}
// ================= INIT =================

window.onload = function () {
  const settingsToggle = document.getElementById("settingsToggle");
  const settingsSubMenu = document.getElementById("settingsSubMenu");

  settingsToggle.addEventListener("click", () => {
    settingsSubMenu.classList.toggle("hidden");
  });

  const categoryToggle = document.getElementById("categoryToggle");
  const categorySubMenu = document.getElementById("categorySubMenu");

  categoryToggle.addEventListener("click", () => {
    categorySubMenu.classList.toggle("hidden");
  });

  // The database-backed taxonomy manager replaces these legacy panels after it
  // loads. These guards prevent old inline controls from crashing during load.
  window.toggleSectionForm = () =>
    document.getElementById("sectionForm")?.classList.toggle("hidden");
  window.saveSection =
    window.saveSection ||
    (() =>
      alert("Use the Save Section form once the Categories panel has loaded."));
  window.saveGroup =
    window.saveGroup ||
    (() =>
      alert("Use the Save Group form once the Categories panel has loaded."));
  window.saveBrand =
    window.saveBrand ||
    (() =>
      alert("Use the Save Brand form once the Categories panel has loaded."));
  window.saveItem =
    window.saveItem ||
    (() =>
      alert("Use the Save Item form once the Categories panel has loaded."));

  document.getElementById("loginForm").onsubmit = handleLogin;

  document.querySelectorAll("[data-page]").forEach((btn) => {
    btn.addEventListener("click", function () {
      switchPage(this.dataset.page);
    });
  });

  document.getElementById("showProductFormBtn").onclick = openProductForm;
  document.getElementById("categoryProductAddBtn")?.addEventListener("click", openProductForm);
  document.getElementById("closeProductFormBtn")?.addEventListener("click", closeProductForm);
  document.getElementById("logoutBtn").onclick = logout;

  const productSearch = document.getElementById("productSearch");
  if (productSearch) {
    productSearch.addEventListener("input", renderProducts);
  }

  document.getElementById("applyCategoryFiltersBtn")?.addEventListener("click", loadCategoryProducts);
  document.getElementById("categoryProductSearch")?.addEventListener("input", loadCategoryProducts);
  document.getElementById("resetCategoryFiltersBtn")?.addEventListener("click", () => {
    ["filterCategory", "filterSection", "filterGroup", "filterItem", "categoryProductSearch"].forEach((id) => { const field = document.getElementById(id); if (field) field.value = ""; });
    renderFilterSelectors(); loadCategoryProducts();
  });
  document.getElementById("productCategorySidebar")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-product-category]"); if (!button) return;
    activeProductCategoryId = button.dataset.productCategory; currentProductPage = 1; renderProducts();
  });
  document.getElementById("selectAllProducts")?.addEventListener("change", (event) => {
    document.querySelectorAll(".product-select").forEach((box) => { box.checked = event.target.checked; if (box.checked) selectedProductIds.add(box.value); else selectedProductIds.delete(box.value); });
  });
  document.addEventListener("change", (event) => {
    if (!event.target.matches(".product-select")) return;
    if (event.target.checked) selectedProductIds.add(event.target.value); else selectedProductIds.delete(event.target.value);
  });
  document.getElementById("applyBulkActionBtn")?.addEventListener("click", async () => {
    if (document.getElementById("productBulkAction")?.value !== "delete" || !selectedProductIds.size) return alert("Choose products and a bulk action first.");
    if (!confirm(`Delete ${selectedProductIds.size} selected product(s)?`)) return;
    await Promise.all([...selectedProductIds].map((id) => fetch(`${API}/products/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${getToken()}` } })));
    selectedProductIds.clear(); getProducts();
  });
  document.getElementById("productExportBtn")?.addEventListener("click", exportProducts);
  document.getElementById("productImportBtn")?.addEventListener("click", () => alert("Import uses the existing product workflow so required media and taxonomy validation remain intact. Add products with the shared form."));

  document.querySelectorAll(".product-form-tabs .tab").forEach((tab) => {
    tab.addEventListener("click", () => setActiveProductTab(tab.dataset.tab));
  });

  const categorySelect = document.getElementById("productCategory");
  if (categorySelect) {
    categorySelect.addEventListener("change", () => {
      renderFunctionSection();
      renderVariantRows();
    });
  }

  document.addEventListener("change", (event) => {
    if (!event.target.matches("[data-product-tax]")) return;
    renderFunctionSection();
    renderVariantRows();
  });

  ["filterCategory", "filterSection", "filterGroup", "filterItem"].forEach((id) => {
    const select = document.getElementById(id);
    if (!select) return;
    select.addEventListener("change", (event) => {
      updateFilterSelects(event.target);
    });
  });

  ["productMainImage", "productAdditionalImages", "productVideos"].forEach((id) => {
    const input = document.getElementById(id);
    if (!input) return;
    input.addEventListener("change", handleMediaInputChange);
  });

  initMediaDragDrop();
  injectProductAdminStyles();
  checkAuth();
  switchPage("overview");
  window.showSetting?.(
    "general",
    document.querySelector(".settings-sidebar button"),
  );

  // DARK MODE
  const themeToggle = document.getElementById("themeToggle");

  if (localStorage.getItem("theme") === "dark") {
    document.body.classList.add("dark-mode");
  }

  themeToggle.onclick = function () {
    document.body.classList.toggle("dark-mode");

    if (document.body.classList.contains("dark-mode")) {
      localStorage.setItem("theme", "dark");
    } else {
      localStorage.setItem("theme", "light");
    }
  };
};

function getAverageRating(product) {
  if (!product.ratings || product.ratings.length === 0) {
    return "No Rating";
  }

  const total = product.ratings.reduce((a, b) => a + b, 0);
  return (total / product.ratings.length).toFixed(1);
}

function legacyShowSetting(page, btn) {
  document.querySelectorAll(".setting-page").forEach((p) => {
    p.classList.remove("active");
    p.classList.add("hidden");
  });

  const current = document.getElementById(page);

  if (current) {
    current.classList.remove("hidden");
    current.classList.add("active");
  }

  document
    .querySelectorAll(".settings-sidebar button")
    .forEach((b) => b.classList.remove("active"));

  if (btn) {
    btn.classList.add("active");
  }
}