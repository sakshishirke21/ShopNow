/* Four-column Amazon-style category manager; all records come from /api/navigation. */
(() => {
  const API = "http://localhost:5000/api";
  const levels = ["main", "section", "group", "item"];
  const labels = {
    main: "Main Categories",
    section: "Sections",
    group: "Groups",
    item: "Items",
  };
  const singular = {
    main: "Main Category",
    section: "Section",
    group: "Group",
    item: "Item",
  };
  let nodes = [],
    selected = { main: "", section: "", group: "" },
    search = {};
  const token = () => localStorage.getItem("adminToken") || "";
  const esc = (value) =>
    String(value || "").replace(
      /[&<>"']/g,
      (char) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[char],
    );
  const of = (type) => nodes.filter((node) => node.type === type);
  const node = (id) => nodes.find((item) => item.id === id);
  const parent = (item) => node(item.parentId);
  const recordsFor = (type) => {
    if (type === "main") return of(type);
    const parentType = levels[levels.indexOf(type) - 1];
    const parentId = selected[parentType];
    return of(type).filter((item) => !parentId || item.parentId === parentId);
  };
  const status = (item) =>
    `<button type="button" class="tax-status ${item.enabled !== false ? "active" : "hidden-status"}" 
  data-status="${item.id}">${item.enabled !== false ? "Active" : "Hidden"}</button>`;

  function parentSelect(type) {
    const parentType = levels[levels.indexOf(type) - 1];
    if (!parentType) return "";
    const options = of(parentType)
      .map(
        (item) =>
          `<option value="${item.id}" ${selected[parentType] === item.id ? "selected" : ""}>${esc(item.name)}</option>`,
      )
      .join("");
    return `<select class="tax-parent-filter" data-parent-type="${parentType}">
    <option value="">All ${singular[parentType]}s</option>${options}</select>`;
  }

  function addForm(type) {
    const parentType = levels[levels.indexOf(type) - 1];
    const options = parentType
      ? `<select name="parentId" required><option value="">Choose ${singular[parentType]}</option>${of(
          parentType,
        )
          .map(
            (item) =>
              `<option value="${item.id}" ${selected[parentType] === item.id ? "selected" : ""}>${esc(item.name)}</option>`,
          )
          .join("")}</select>`
      : "";
    return `<form class="tax-add-form hidden" data-type="${type}">
    <input name="name" required placeholder="${singular[type]} name">${options}
    <label>Image <input name="image" type="file" accept="image/jpeg,image/png,image/webp,image/avif"></label>
    <label>Desktop Banner <input name="bannerDesktop" type="file" accept="image/jpeg,image/png,image/webp,image/avif"></label>
    <label>Mobile Banner <input name="bannerMobile" type="file" accept="image/jpeg,image/png,image/webp,image/avif"></label>
    <label>Icon <input name="icon" type="file" accept="image/jpeg,image/png,image/webp,image/avif"></label>
    <input name="sortOrder" type="number" min="0" value="0" placeholder="Sort order">
    <select name="enabled">
    <option value="true">Active</option>
    <option value="false">Hidden</option>
    </select>
    <button class="button-primary" type="submit">Save</button>
    </form>`;
  }

  function column(type) {
    const query = (search[type] || "").toLowerCase();
    const list = recordsFor(type).filter((item) =>
      item.name.toLowerCase().includes(query),
    );
    return `
    <section class="amazon-tax-column">
    <div class="amazon-tax-step step-${type}">${levels.indexOf(type) + 1}. ${labels[type]}</div>
    <div class="amazon-tax-head">
    <strong>${labels[type]}</strong>
    <button type="button" class="button-primary tax-add" data-type="${type}">+ Add</button>
    </div>
    <div class="amazon-tax-filters">${parentSelect(type)}
    <input class="tax-search" data-type="${type}" 
    value="${esc(search[type])}" 
    placeholder="Search...">
    </div>${addForm(type)}
    <div class="amazon-tax-table">
    <table>
    <thead>
    <tr>
    <th>#</th>
    <th>Name</th>
    <th>Parent</th>
    <th>Status</th>
    <th>Actions</th>
    </tr>
    </thead>
    <tbody>${
      list
        .map(
          (item, index) => `
      <tr>
      <td>${index + 1}</td>
      <td>${esc(item.name)}</td>
      <td>${esc(parent(item)?.name || "—")}</td>
      <td>${status(item)}</td>
      <td>
      <button type="button" class="tax-edit" data-id="${item.id}">✎</button>
      <button type="button" class="tax-delete" data-id="${item.id}">🗑</button>
      </td>
      </tr>
      `,
        )
        .join("") ||
      `
      <tr>
      <td colspan="5" class="tax-empty">No records found</td>
      </tr>
      `
    }
      </tbody>
      </table>
      </div>
      <div class="tax-count">Showing ${list.length} item${list.length === 1 ? "" : "s"}</div>
      </section>`;
  }

  function renderProductSelectors() {
    const category = document.getElementById("productCategory");
    if (!category) return;
    const selectorRoot = document.getElementById("taxonomySelectors");
    if (selectorRoot && !document.getElementById("categoryId")) {
      selectorRoot.innerHTML = `<select id="categoryId" data-product-tax>
        <option value="">Main Category</option>
        </select><select id="sectionId" data-product-tax>
      <option value="">Section</option>
      </select><select id="groupId" data-product-tax><option value="">Group</option>
      </select><select id="itemId" data-product-tax><option value="">Item</option>
      </select>`;
    } else if (!document.getElementById("categoryId")) {
      category.closest(".form-row").insertAdjacentHTML(
        "afterend",
        `<div class="form-row taxonomy-selectors">
        <select id="categoryId" data-product-tax>
        <option value="">Main Category</option>
        </select><select id="sectionId" data-product-tax>
      <option value="">Section</option>
      </select><select id="groupId" data-product-tax><option value="">Group</option>
      </select><select id="itemId" data-product-tax><option value="">Item</option>
      </select></div>`,
      );
    }
    const fill = (id, items) => {
      const field = document.getElementById(id);
      const old = field.value;
      field.innerHTML = `<option value="">${field.options[0]?.text || "Select"}</option>${items
        .map((item) => `<option value="${item.id}">${esc(item.name)}</option>`)
        .join("")}`;
      field.value = old;
    };
    fill("categoryId", of("main"));
    fill(
      "sectionId",
      of("section").filter(
        (item) => item.parentId === document.getElementById("categoryId").value,
      ),
    );
    fill(
      "groupId",
      of("group").filter(
        (item) => item.parentId === document.getElementById("sectionId").value,
      ),
    );
    fill(
      "itemId",
      of("item").filter(
        (item) => item.parentId === document.getElementById("groupId").value,
      ),
    );
  }

  function syncProduct() {
    renderProductSelectors();
    const main = node(document.getElementById("categoryId")?.value);
    const item = node(document.getElementById("itemId")?.value);
    if (main && document.getElementById("productCategory")) {
      document.getElementById("productCategory").value = main.id;
    }
    if (item && document.getElementById("productItem")) {
      document.getElementById("productItem").value = item.id;
    }
  }

  function render() {
    const root = document.getElementById("mainCategoriesSection");
    if (!root) return;
    root.innerHTML = `<div class="amazon-tax-grid">${levels.map(column).join("")}</div>`;
    renderProductSelectors();
    installTaxonomyScrollSpy();
  }

  function setActiveTaxonomyNav(level) {
    document.querySelectorAll(".taxonomy-nav").forEach((button) =>
      button.classList.toggle("active", button.dataset.taxonomyLevel === level),
    );
  }

  function installTaxonomyScrollSpy() {
    const root = document.getElementById("mainCategoriesSection");
    if (!root || !window.IntersectionObserver) return;
    if (root._taxonomyObserver) root._taxonomyObserver.disconnect();
    root._taxonomyObserver = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!visible) return;
        const level = levels.find((type) => visible.target.querySelector(`.step-${type}`));
        if (level) setActiveTaxonomyNav(level);
      },
      { root: null, threshold: [0.25, 0.6] },
    );
    root.querySelectorAll(".amazon-tax-column").forEach((column) => root._taxonomyObserver.observe(column));
  }

  async function request(url, options = {}) {
    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${token()}`,
        ...(options.headers || {}),
      },
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || "Request failed.");
    return result;
  }

  async function load() {
    const result = await fetch(`${API}/navigation`).then((response) =>
      response.json(),
    );
    nodes = Array.isArray(result.nodes) ? result.nodes : [];
    render();
  }

  async function save(form) {
    const body = new FormData(form);
    body.set("type", form.dataset.type);
    await request(`${API}/navigation`, { method: "POST", body });
    await load();
  }

  document.addEventListener("submit", async (event) => {
    if (!event.target.matches(".tax-add-form")) return;
    event.preventDefault();
    try {
      await save(event.target);
    } catch (error) {
      alert(error.message);
    }
  });

  document.addEventListener("input", (event) => {
    if (!event.target.matches(".tax-search")) return;
    search[event.target.dataset.type] = event.target.value;
    render();
  });

  document.addEventListener("change", (event) => {
    if (event.target.matches(".tax-parent-filter")) {
      selected[event.target.dataset.parentType] = event.target.value;
      const level = levels.indexOf(event.target.dataset.parentType);
      levels.slice(level + 1).forEach((type) => {
        if (type !== "item") selected[type] = "";
      });
      render();
    }
    if (event.target.id === "productCategory") {
      renderProductSelectors();
      const categoryId = event.target.value;
      const categoryField = document.getElementById("categoryId");
      if (categoryField) {
        categoryField.value = categoryId;
        categoryField.dispatchEvent(new Event("change", { bubbles: true }));
      }
    }
    if (event.target.matches("[data-product-tax]")) syncProduct();
  });

  document.addEventListener("click", async (event) => {
    const taxonomyNav = event.target.closest(".taxonomy-nav");
    if (taxonomyNav) {
      const level = taxonomyNav.dataset.taxonomyLevel;
      setActiveTaxonomyNav(level);
      // The manager is a single vertical hierarchy: scroll directly to the
      // requested Main Category / Section / Group / Item column.
      setTimeout(() => document.querySelector(`.step-${level}`)?.closest(".amazon-tax-column")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
      return;
    }
    const add = event.target.closest(".tax-add");
    if (add)
      return event.target
        .closest(".amazon-tax-column")
        .querySelector(".tax-add-form")
        .classList.toggle("hidden");
    const id = event.target.dataset.id;
    if (!id) return;
    const item = node(id);
    if (!item) return;
    try {
      if (event.target.classList.contains("tax-delete")) {
        if (!confirm(`Delete ${item.name} and its children?`)) return;
        await request(`${API}/navigation/${id}`, { method: "DELETE" });
      }

      if (event.target.classList.contains("tax-edit")) {
        const name = prompt(`Rename ${singular[item.type]}`, item.name);
        if (!name?.trim()) return;
        const body = new FormData();
        body.append("name", name.trim());
        body.append("enabled", String(item.enabled !== false));
        await request(`${API}/navigation/${id}`, { method: "PUT", body });
      }
      if (event.target.matches("[data-status]")) {
        const body = new FormData();
        body.append("enabled", String(item.enabled === false));
        await request(`${API}/navigation/${id}`, { method: "PUT", body });
      }
      await load();
    } catch (error) {
      alert(error.message);
    }
  });
  window.addEventListener("load", () => {
    const style = document.createElement("style");
    style.textContent = `.amazon-tax-title{
    text-align:center;
    margin-bottom:14px
    }
    .amazon-tax-title 
    h2{margin:0;
    color:#172b4d
    }
    .amazon-tax-title 
    p{margin:5px 0;
    color:#52606d;
    font-weight:600
    }
.amazon-tax-grid{
display:grid;
grid-template-columns:1fr;
gap:8px;
padding:0;
align-items:flex-start;
}
    .amazon-tax-column{
border:1px solid #e1e7ef;
border-radius:10px;
background:#fff;
overflow:hidden;
padding:10px 14px 14px;
box-shadow:0 3px 12px rgba(0,0,0,.08);
}
    .amazon-tax-step{
margin:12px auto 28px;
    width:max-content;
    padding:5px 13px;
    border-radius:4px;
    color:#fff;
    font-weight:700;
    font-size:13px
    }
    .step-main{
    background:#6545ad
    }
    .step-section{
    background:#49a533
    }
    .step-group{
    background:#ff9700
    }
    .step-item{
    background:#e7387b
    }
.amazon-tax-head{
    padding:0 0 18px;
    display:flex;
    justify-content:space-between;
    align-items:center;
    border-bottom:1px solid #edf0f4
    }
.amazon-tax-head 
.button-primary{
    font-size:11px;
    padding:7px 12px;
    background:#ffc107;
    border-color:#ffc107;
    color:#172b4d
    }
.amazon-tax-filters,
.tax-add-form{
display:grid;
grid-template-columns:1fr 1fr;
gap:14px;
padding:0 4px 14px;
margin-bottom:0;
}
    .amazon-tax-filters input,
    .amazon-tax-filters select,
    .tax-add-form input,
    .tax-add-form select{
    min-width:0;
    padding:7px;
    border:1px solid #d9e0ea;
    border-radius:4px
    }
    .tax-add-form{
    grid-template-columns:1fr
    }
    .amazon-tax-table{
overflow:auto;
padding:12px;
}
    .amazon-tax-table table{
    width:100%;
    border-collapse:collapse;
    font-size:11px
    }
    .amazon-tax-table th,
    .amazon-tax-table td{
    padding:7px 5px;
    border:1px solid #e7ebf1;
    text-align:left;
    white-space:nowrap
    }
    .tax-status{
    border:1px solid #9ae4b2;
    background:#effcf2;
    color:#138a42;
    border-radius:3px;
    padding:2px 5px;
    font-size:10px
    }
    .tax-status.hidden-status{
    background:#fff4dc;
    color:#905c00;
    border-color:#f4d49b
    }
    .tax-edit,
    .tax-delete{
    border:0;
    border-radius:3px;
    padding:4px 5px;
    cursor:pointer
    }
    .tax-edit{
    background:#1769d6;
    color:#fff
    }
    .tax-delete{
    background:#e74747;
    color:#fff
    }
    .tax-count{
    padding:9px;
    font-size:11px;
    color:#667085
    }
    .taxonomy-selectors{
    display:grid;
    grid-template-columns:repeat(4,minmax(140px,1fr));
    gap:9px}
    .taxonomy-selectors select{
    padding:10px;
    border:1px solid #d5dbe8;
    border-radius:7px
    }
    .taxonomy-nav.active,.item-product-link{
    background:#e6f4ff!important;
    color:#075985!important;
    border-left:3px solid #0284c7
    }
    #mainCategoriesSection{
    padding:25px;
    background:#f7f8fb;
}
    @media(max-width:600px){
    .amazon-tax-grid{
    grid-template-columns:1fr
    }
    .taxonomy-selectors{
    grid-template-columns:1fr
    }
  }`;

    document.head.append(style);
    load().catch((error) => console.error("Taxonomy loading failed", error));
  });
})();
