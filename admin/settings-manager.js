/* Backend-persisted settings console. Values are always loaded from settings.json. */
(() => {
  const API = "http://localhost:5000/api";
  const auth = () => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${localStorage.getItem("adminToken") || ""}`,
  });
  const hasAdminToken = () => Boolean(localStorage.getItem("adminToken"));

  const escapeHtml = (value) =>
    String(value ?? "").replace(
      /[&<>'"]/g,
      (char) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          "'": "&#39;",
          '"': "&quot;",
        })[char],
    );

  const fields = {
    general: [
      ["storeName", "Store Name", "text", true],
      ["storeTagline", "Store Tagline", "text"],
      ["storeEmail", "Store Email", "email", true],
      ["supportEmail", "Support Email", "email"],
      ["phoneNumber", "Phone Number", "tel"],
      ["websiteUrl", "Website URL", "url"],
      ["storeLogo", "Store Logo Upload", "file"],
      ["favicon", "Favicon Upload", "file"],
      ["businessAddress", "Business Address", "textarea"],
      ["city", "City", "text"],
      ["state", "State", "text"],
      ["country", "Country", "text"],
      ["pincode", "Pincode", "text"],
      ["timezone", "Timezone", "text"],
      ["currency", "Currency", "text"],
      ["dateFormat", "Date Format", "text"],
      ["timeFormat", "Time Format", "text"],
    ],

    payment: [
      ["cashOnDelivery", "Cash on Delivery", "checkbox"],
      ["upi", "UPI", "checkbox"],
      ["razorpay", "Razorpay", "checkbox"],
      ["stripe", "Stripe", "checkbox"],
      ["paypal", "PayPal", "checkbox"],
      ["creditCard", "Credit Card", "checkbox"],
      ["debitCard", "Debit Card", "checkbox"],
      ["razorpayKeyId", "Razorpay Key ID", "text"],
      ["razorpayKeySecret", "Razorpay Key Secret", "password"],
      ["razorpayMode", "Razorpay Mode", "select", false, "test,live"],
      ["stripePublishableKey", "Stripe Publishable Key", "text"],
      ["stripeSecretKey", "Stripe Secret Key", "password"],
      ["stripeMode", "Stripe Mode", "select", false, "test,live"],
      ["paypalClientId", "PayPal Client ID", "text"],
      ["paypalSecret", "PayPal Secret", "password"],
      ["paypalSandbox", "PayPal Sandbox", "checkbox"],
    ],

    shipping: [
      ["defaultShippingCharge", "Default Shipping Charge", "number"],
      ["freeShippingAbove", "Free Shipping Above", "number"],
      ["packagingCharge", "Packaging Charge", "number"],
      ["estimatedDeliveryTime", "Estimated Delivery Time", "text"],
      ["expressDelivery", "Express Delivery", "checkbox"],
      ["returnPeriod", "Return Period (days)", "number"],
      ["deliveryInstructions", "Delivery Instructions", "textarea"],
      ["delivery", "Delivery", "checkbox"],
      ["blueDart", "Blue Dart", "checkbox"],
      ["dtdc", "DTDC", "checkbox"],
      ["xpressBees", "XpressBees", "checkbox"],
      ["indiaPost", "India Post", "checkbox"],
    ],

    security: [
      ["currentPassword", "Current Password", "password"],
      ["newPassword", "New Password", "password"],
      ["confirmPassword", "Confirm Password", "password"],
      [
        "twoFactorAuthentication",
        "Enable Two Factor Authentication",
        "checkbox",
      ],
      ["googleAuthenticator", "Google Authenticator", "checkbox"],
      ["sessionTimeout", "Session Timeout (minutes)", "number"],
      ["loginAttemptLimit", "Login Attempt Limit", "number"],
      ["passwordExpiry", "Password Expiry (days)", "number"],
      ["recaptchaSiteKey", "Google reCAPTCHA Site Key", "text"],
      ["recaptchaSecretKey", "Google reCAPTCHA Secret Key", "password"],
    ],

    notifications: [
      ["emailNotifications", "Email Notifications", "checkbox"],
      ["smsNotifications", "SMS Notifications", "checkbox"],
      ["pushNotifications", "Push Notifications", "checkbox"],
      ["whatsappNotifications", "WhatsApp Notifications", "checkbox"],
      ["newOrder", "New Order", "checkbox"],
      ["cancelledOrder", "Cancelled Order", "checkbox"],
      ["refund", "Refund", "checkbox"],
      ["review", "Review", "checkbox"],
      ["lowStock", "Low Stock", "checkbox"],
      ["newUser", "New User", "checkbox"],
      ["coupon", "Coupon", "checkbox"],
      ["newsletter", "Newsletter", "checkbox"],
    ],

    appearance: [
      ["theme", "Theme", "select", false, "light,dark,system"],
      ["primaryColor", "Primary Color", "color"],
      ["sidebarColor", "Sidebar Color", "color"],
      ["dashboardColor", "Dashboard Color", "color"],
      ["logo", "Logo Upload", "file"],
      ["favicon", "Favicon Upload", "file"],
      ["fontFamily", "Font Family", "text"],
      [
        "dashboardLayout",
        "Dashboard Layout",
        "select",
        false,
        "compact,default,wide",
      ],
    ],

    localization: [
      ["defaultLanguage", "Default Language", "text"],
      ["availableLanguages", "Available Languages (comma-separated)", "text"],
      ["currency", "Currency", "text"],
      ["timezone", "Timezone", "text"],
      ["dateFormat", "Date Format", "text"],
      ["timeFormat", "Time Format", "text"],
      ["numberFormat", "Number Format", "text"],
    ],

    inventory: [
      ["inventoryTracking", "Enable Inventory Tracking", "checkbox"],
      ["skuPrefix", "SKU Prefix", "text"],
      ["autoGenerateSku", "Auto Generate SKU", "checkbox"],
      ["barcode", "Barcode", "checkbox"],
      ["batchTracking", "Batch Tracking", "checkbox"],
      ["expiryDateTracking", "Expiry Date Tracking", "checkbox"],
      ["stockReservation", "Stock Reservation", "checkbox"],
      ["lowStockAlert", "Low Stock Alert", "checkbox"],
      ["backorders", "Backorders", "checkbox"],
    ],

    invoice: [
      ["companyName", "Company Name", "text"],
      ["companyLogo", "Company Logo Upload", "file"],
      ["gstNumber", "GST Number", "text"],
      ["panNumber", "PAN Number", "text"],
      ["invoicePrefix", "Invoice Prefix", "text"],
      ["invoiceFooter", "Invoice Footer", "textarea"],
      ["signature", "Signature Upload", "file"],
      ["generatePdf", "Generate PDF", "checkbox"],
      ["emailInvoice", "Email Invoice", "checkbox"],
      ["showTax", "Show Tax", "checkbox"],
    ],
  };
  const titles = {
    general: "General Settings",
    payment: "Payment Settings",
    shipping: "Shipping Settings",
    roles: "Users & Roles",
    security: "Security Settings",
    notifications: "Notifications",
    appearance: "Appearance",
    localization: "Localization",
    inventory: "Inventory",
    invoice: "Invoice",
  };

  const control = ([key, label, type, required, choices], value) => {
    if (type === "checkbox")
      return `
    <label class="setting-check">
    <input data-key="${key}" type="checkbox" ${value === true || value === "true" ? "checked" : ""}> ${escapeHtml(label)}
    </label>`;
    if (type === "textarea")
      return `
    <label>${escapeHtml(label)}
    <textarea data-key="${key}" rows="3" ${required ? "required" : ""}>${escapeHtml(value)}</textarea>
    </label>`;
    if (type === "file")
      return `
    <label>${escapeHtml(label)}
    <input data-key="${key}" type="file" accept="image/*">${
      value ? `<small>Current: ${escapeHtml(value)}</small>` : ""
    }
      </label>`;
    if (type === "select") {
      return `
<label>
${escapeHtml(label)}
<select data-key="${key}">
${choices
  .split(",")
  .map(
    (option) => `
<option value="${option}" ${option === value ? "selected" : ""}>
${option}
</option>
`,
  )
  .join("")}
</select>
</label>`;
    }

    const safeValue =
      type === "color" && !/^#[0-9a-f]{6}$/i.test(String(value || ""))
        ? "#131921"
        : value || "";

    return `
<label>
${escapeHtml(label)}
<input
data-key="${key}"
type="${type}"
value="${escapeHtml(safeValue)}"
${required ? "required" : ""}>
</label>`;
  };

  const formData = (form) =>
    Object.fromEntries(
      [...form.querySelectorAll("[data-key]")]
        .filter((input) => input.type !== "file")
        .map((input) => [
          input.dataset.key,
          input.type === "checkbox" ? input.checked : input.value.trim(),
        ]),
    );

  const notice = (form, text, error = false) => {
    const status = form.querySelector(".save-status");
    status.textContent = text;
    status.classList.toggle("error", error);
  };

  async function saveSection(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const section = form.dataset.section;
    const data = formData(form);
    try {
      for (const input of form.querySelectorAll(
        'input[type="file"][data-key]',
      )) {
        if (input.files[0]) {
          const upload = new FormData();
          upload.append("asset", input.files[0]);
          const response = await fetch(`${API}/settings/upload`, {
            method: "POST",
            headers: { Authorization: auth().Authorization },
            body: upload,
          });
          const result = await response.json();
          if (!response.ok)
            throw new Error(result.message || "Could not upload file.");
          data[input.dataset.key] = result.url;
        }
      }
    } catch (error) {
      return notice(form, error.message, true);
    }
    if (
      section === "security" &&
      data.newPassword &&
      data.newPassword !== data.confirmPassword
    )
      return;
    notice(form, "New password and confirmation must match.", true);
    notice(form, "Saving…");
    try {
      const response = await fetch(`${API}/settings/${section}`, {
        method: "PUT",
        headers: auth(),
        body: JSON.stringify(data),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.message || "Could not save settings.");
      notice(form, "Saved successfully.");
    } catch (error) {
      notice(form, error.message, true);
    }
  }

  async function loadSection(section) {
    const response = await fetch(`${API}/settings/${section}`, {
      headers: auth(),
    });
    const result = await response.json();
    if (!response.ok)
      throw new Error(result.message || "Could not load settings.");
    return result.settings || {};
  }

  async function renderSettings(section) {
    const target = document.getElementById(section);
    if (!target || !fields[section]) return;
    target.innerHTML = `<p class="settings-loading">Loading settings…</p>`;
    try {
      const values = await loadSection(section);
      target.innerHTML = `<form class="settings-form" data-section="${section}">
      <h2>${titles[section]}</h2>
      <div class="settings-fields">${fields[section]
        .map((field) => control(field, values[field[0]]))
        .join("")}
        </div>
      <button class="button-primary" type="submit">Save Changes</button>
      <span class="save-status" role="status"></span>
      </form>`;
      target.querySelector("form").addEventListener("submit", saveSection);
    } catch (error) {
      target.innerHTML = `<p class="settings-error">${escapeHtml(error.message)}</p>`;
    }
  }

  function userForm() {
    return `
<form class="admin-user-form">
<label>Name<input name="name" required></label>

<label>Email
<input name="email" type="email" required>
</label>

<label>Role
<select name="role">
<option value="staff">Staff</option>
<option value="manager">Manager</option>
<option value="admin">Admin</option>
</select>
</label>

<label>Status
<select name="status">
<option value="active">Active</option>
<option value="inactive">Inactive</option>
</select>
</label>

<button class="button-primary">
Add User
</button>

<span class="save-status"></span>

</form>`;
  }

  async function renderUsers() {
    const target = document.getElementById("roles");
    if (!target) return;
    target.innerHTML = `<p class="settings-loading">Loading users…</p>`;
    try {
      const response = await fetch(`${API}/admin/users`, {
        headers: auth(),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.message || "Could not load users.");
      const users = result.users || [];
      target.innerHTML = `<section class="settings-form">
      <div class="settings-title">
      <h2>Users & Roles</h2>
      </div>${userForm()}
      <div class="table-wrap">
      <table>
      <thead>
      <tr>
      <th>Name</th>
      <th>Email</th>
      <th>Role</th>
      <th>Status</th>
      <th>Last Login</th>
      <th>Actions</th>
      </tr>
      </thead>
      <tbody>${
        users
          .map(
            (user) => `<tr>
        <td>${escapeHtml(user.name)}</td>
        <td>${escapeHtml(user.email)}</td>
        <td>
      <select data-role="${user.id || user._id}">
      <option ${user.role === "staff" ? "selected" : ""}>staff</option>
      <option ${user.role === "manager" ? "selected" : ""}>manager</option>
      <option ${user.role === "admin" ? "selected" : ""}>admin</option>
      </select>
      </td>
      <td>${escapeHtml(user.status || "active")}</td>
      <td>${user.lastLogin ? new Date(user.lastLogin).toLocaleString() : "Never"}</td>
      <td>
      <button class="tax-edit user-save" data-id="${user.id || user._id}">Save</button>
      <button class="delete user-delete" data-id="${user.id || user._id}">Delete</button>
      </td>
      </tr>
      `,
          )
          .join("") ||
        `
      <tr>
      <td colspan="6" class="tax-empty">No existing admin users.</td>
      </tr>`
      }
      </tbody>
      </table>
      </div>
      </section>`;
      target
        .querySelector(".admin-user-form")
        .addEventListener("submit", async (event) => {
          event.preventDefault();
          const form = event.currentTarget;
          try {
            const response = await fetch(`${API}/admin/users`, {
              method: "POST",
              headers: auth(),
              body: JSON.stringify(Object.fromEntries(new FormData(form))),
            });

            const result = await response.json();
            if (!response.ok) throw new Error(result.message);
            await renderUsers();
          } catch (error) {
            notice(form, error.message, true);
          }
        });
    } catch (error) {
      target.innerHTML = `<p class="settings-error">${escapeHtml(error.message)}</p>`;
    }
  }

  async function userAction(event) {
    const button = event.target.closest(".user-save,.user-delete");

    if (!button) return;

    const id = button.dataset.id;

    const deleting = button.classList.contains("user-delete");

    if (deleting && !confirm("Delete this user?")) return;

    const role = document.querySelector(`[data-role="${id}"]`)?.value;

    const response = await fetch(
      `${API}/admin/users/${encodeURIComponent(id)}`,
      {
        method: deleting ? "DELETE" : "PUT",

        headers: auth(),

        body: deleting ? undefined : JSON.stringify({ role }),
      },
    );

    const result = await response.json();

    if (!response.ok) {
      alert(result.message || "Action failed.");

      return;
    }

    renderUsers();
  }

  window.showSetting = (tab) => {
    if (!hasAdminToken()) return;
    document.querySelectorAll(".setting-page").forEach((page) => {
      page.classList.remove("active");
      page.classList.add("hidden");
    });

    const page = document.getElementById(tab);

    if (page) {
      page.classList.remove("hidden");
      page.classList.add("active");
    }

    document.querySelectorAll(".settings-sidebar button").forEach((btn) => {
      btn.classList.remove("active");
    });

    const activeButton = [
      ...document.querySelectorAll(".settings-sidebar button"),
    ].find((btn) =>
      btn.textContent
        .trim()
        .toLowerCase()
        .startsWith(tab === "roles" ? "users" : tab),
    );

    if (activeButton) {
      activeButton.classList.add("active");
    }

    if (tab === "roles") {
      renderUsers();
    } else {
      renderSettings(tab);
    }
  };

  window.addEventListener("load", () => {
    document.addEventListener("click", userAction);
    if (hasAdminToken()) window.showSetting("general");
  });
})();
