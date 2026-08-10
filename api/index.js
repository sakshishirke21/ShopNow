// Vercel entry point. Vercel auto-detects any file under /api as a
// serverless function and calls it per-request; it just needs the Express
// app itself (not a listening server), which backend/app.js now exports
// when process.env.VERCEL is set.
module.exports = require("../backend/app");
