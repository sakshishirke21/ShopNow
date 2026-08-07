/* Admin coupon and review moderation console. */
(() => {
  const API = "http://localhost:5000/api",
    token = () => localStorage.getItem("adminToken") || "";
  const auth = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token()}`,
  };

  const esc = (v) =>
    String(v || "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  async function coupons() {
    if (!token()) return;
    const r = await fetch(`${API}/coupons`);
    const list = await r.json();
    const root = document.getElementById("couponsSection");
    if (!root) return;
    root.innerHTML = `
      <div class="section-header"><div>
      <h2>Coupons</h2>
      <small>Create Amazon-style cart discounts.</small>
      </div>
      </div>
      <div class="content-card">
      <form id="couponForm" class="commerce-form">
      <input name="code" required placeholder="Code e.g. SAVE10"
      ><select name="type">
      <option value="percent">Percentage %</option>
      <option value="fixed">Fixed ₹</option>
      </select>
      <input name="value" type="number" min="1" required placeholder="Discount">
      <input name="minimumOrder" type="number" min="0" placeholder="Minimum order">
      <input name="expiresAt" type="date">
      <button class="button-primary">Create coupon</button>
      </form>
      </div>
      <div class="content-card table-wrap">
      <table>
      <thead>
      <tr>
      <th>Code</th>
      <th>Discount</th>
      <th>Min. order</th>
      <th>Expires</th>
      <th>Actions</th>
      </tr></thead>
      <tbody>${
        list
          .map(
            (c) => `<tr><td><strong>${esc(c.code)}</strong>
      </td>
      <td>${c.type === "percent" ? `${c.value}%` : `₹${c.value}`}</td>
      <td>₹${c.minimumOrder || 0}</td>
      <td>${c.expiresAt ? new Date(c.expiresAt).toLocaleDateString() : "Never"}</td>
      <td>
      <button class="delete coupon-delete" data-id="${c.id}">Delete</button>
      </td>
      </tr>`,
          )
          .join("") || '<tr><td colspan="5">No coupons yet.</td></tr>'
      }
    </tbody>
    </table>
    </div>`;
  }
  async function reviews() {
    if (!token()) return;
    const r = await fetch(`${API}/reviews`, {
      headers: { Authorization: `Bearer ${token()}` },
    });
    const data = await r.json();
    const root = document.getElementById("reviewsSection");
    if (!root) return;
    root.innerHTML = `<div class="section-header"><div>
  <h2>Customer Reviews</h2>
  <small>Reviews submitted by customers on product pages.</small>
  </div>
  </div>
  <div class="content-card table-wrap">
  <table>
  <thead>
  <tr>
  <th>Customer</th>
  <th>Product</th>
  <th>Order</th>
  <th>Rating</th>
  <th>Review</th>
  <th>Status</th>
  <th>Action</th>
  </tr>
  </thead>
  <tbody>${
    (data.reviews || [])
      .map(
        (x) => `<tr>
    <td>${esc(x.customerName)}</td>
    <td>${esc(x.productName)}</td>
    <td>${esc(x.orderNumber)}</td>
    <td>${"★".repeat(x.rating)}</td>
    <td>${esc(x.comment)}</td>
    <td>${esc(x.status || "published")}</td>
    <td>
    <button class="review-status" data-id="${x.id}" 
    data-status="${x.status === `hidden` ? `published` : `hidden`}">${x.status === `hidden` ? `Publish` : `Hide`}</button>
    </td>
    </tr>`,
      )
      .join("") || '<tr><td colspan="7">No customer reviews yet.</td></tr>'
  }
</tbody>
</table>
</div>`;
  }
  document.addEventListener("submit", async (e) => {
    if (e.target.id !== "couponForm") return;
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.target));
    const r = await fetch(`${API}/coupons`, {
      method: "POST",
      headers: auth,
      body: JSON.stringify(body),
    });
    const data = await r.json();
    if (!r.ok) return;
    alert(data.message || "Could not create coupon");
    e.target.reset();
    coupons();
  });

  document.addEventListener("click", async (e) => {
    if (e.target.classList.contains("coupon-delete")) {
      await fetch(`${API}/coupons/${e.target.dataset.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token()}` },
      });
      coupons();
    }
    if (e.target.classList.contains("review-status")) {
      await fetch(`${API}/reviews/${e.target.dataset.id}`, {
        method: "PUT",
        headers: auth,
        body: JSON.stringify({ status: e.target.dataset.status }),
      });
      reviews();
    }
  });

  window.addEventListener("load", () => {
    const style = document.createElement("style");
    style.textContent = `
    .commerce-form{
    display:grid;
    grid-template-columns:repeat(auto-fit,minmax(130px,1fr));
    gap:10px
    }
    .commerce-form input,
    .commerce-form select{
    padding:10px;
    border:1px solid #d5dbe8;
    border-radius:7px
    }`;

    document.head.append(style);
    if (token()) { coupons(); reviews(); }
  });
})();
