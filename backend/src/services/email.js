const nodemailer = require("nodemailer");
const configured = () =>
  Boolean(
    process.env.SMTP_HOST &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASSWORD &&
    process.env.SMTP_FROM,
  );
let transport;
function client() {
  if (!configured()) return null;
  if (!transport)
    transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === "true",
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
      tls: { minVersion: "TLSv1.2" },
    });
  return transport;
}

async function send({ to, subject, text, html }) {
  const smtp = client();
  if (!smtp) {
    console.warn("Email skipped: SMTP is not configured.");
    return { skipped: true };
  }
  return smtp.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject,
    text,
    html,
    textEncoding: "base64",
    disableFileAccess: true,
    disableUrlAccess: true,
  });
}

const escape = (x) =>
  String(x || "").replace(
    /[&<>'"]/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[
        c
      ],
  );
async function template(type, to, data = {}) {
  const title =
    {
      registration: "Welcome to ShopNow",
      order: "Your ShopNow order is confirmed",
      shipping: "Your ShopNow order has shipped",
      delivered: "Your ShopNow order was delivered",
      cancelled: "Your ShopNow order was cancelled",
      refund: "Your ShopNow refund is being processed",
      contact: "We received your message",
    }[type] || "ShopNow";
  const message =
    data.message || `Hello ${data.name || "Customer"}, ${title.toLowerCase()}.`;
  return send({
    to,
    subject: title,
    text: message,
    html: `<h1>ShopNow</h1><p>${escape(message)}</p>${data.orderNumber ? `<p>Order: ${escape(data.orderNumber)}</p>` : ""}`,
  });
}
module.exports = { send, template, configured };
