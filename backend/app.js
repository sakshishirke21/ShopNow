require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const rateLimit = require("express-rate-limit");
const mongoSanitize = require("express-mongo-sanitize");
const cookieParser = require("cookie-parser");
const multer = require("multer");
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { body, validationResult } = require("express-validator");
const { v4: uuid } = require("uuid");
const Models = require("./src/models");
const email = require("./src/services/email");
const app = express();
const port = Number(process.env.PORT || 5000);
// Files already committed to backend/uploads (existing product images etc.)
// ship with the deployment and are readable everywhere, including Vercel.
const bundledUploads = path.join(__dirname, "uploads");
// Vercel's filesystem is read-only except /tmp, and /tmp is wiped between
// invocations, so NEW uploads can't go into bundledUploads there. This keeps
// uploads from crashing the request on Vercel, but they won't persist across
// deploys/cold starts - move to Vercel Blob/S3/Cloudinary before relying on
// admin-uploaded images in production.
const uploads = process.env.VERCEL
  ? path.join(os.tmpdir(), "uploads")
  : bundledUploads;
fs.mkdirSync(uploads, { recursive: true });
const allowedOrigins = (process.env.CLIENT_ORIGIN || "http://localhost:5000")
  .split(",")
  .map((x) => x.trim())
  .filter(Boolean);
app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://cdnjs.cloudflare.com",
          "https://maps.googleapis.com",
        ],
        scriptSrcAttr: ["'unsafe-inline'"],
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://fonts.googleapis.com",
          "https://cdnjs.cloudflare.com",
        ],
        fontSrc: [
          "'self'",
          "https://fonts.gstatic.com",
          "https://cdnjs.cloudflare.com",
        ],
        imgSrc: [
          "'self'",
          "data:",
          "https://images.unsplash.com",
          "https://maps.gstatic.com",
          "https://maps.googleapis.com",
        ],
        connectSrc: [
          "'self'",
          "https://nominatim.openstreetmap.org",
          "https://maps.googleapis.com",
        ],
        frameSrc: [
          "https://www.google.com",
        ],
      },
    },
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);
app.use(compression());
app.use(
  cors({
    origin(origin, cb) {
      const localDevelopmentOrigin =
        process.env.NODE_ENV !== "production" &&
        /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin || "");
      if (!origin || allowedOrigins.includes(origin) || localDevelopmentOrigin)
        return cb(null, true);
      return cb(new Error("Origin not allowed by CORS"));
    },
    credentials: true,
  }),
);
app.use(express.json({ limit: "2mb" }));
app.use(cookieParser(process.env.COOKIE_SECRET));
app.use(mongoSanitize());
app.use("/uploads", express.static(uploads, { maxAge: "7d", immutable: true }));
if (uploads !== bundledUploads) {
  // Fallback for images that shipped with the deployment (existing product
  // photos etc.) when the writable dir above is the ephemeral /tmp one.
  app.use(
    "/uploads",
    express.static(bundledUploads, { maxAge: "7d", immutable: true }),
  );
}
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 500,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);
app.get("/favicon.ico", (_req, res) =>
  res.sendFile(path.join(__dirname, "..", "frontend", "favicon.ico")),
);
function deployedStatic(prefix, folder) {
  return (req, res, next) => {
    if (!/\.(html|js)$/i.test(req.path))
      return express.static(folder)(req, res, next);
    const safe = path.normalize(req.path).replace(/^([/\\])+/, "");
    const file = path.join(folder, safe);
    if (!file.startsWith(folder)) return fail(res, 403, "Forbidden.");
    fs.readFile(file, "utf8", (error, text) => {
      if (error) return next();
      res
        .type(path.extname(file))
        .send(
          text
            .replaceAll("http://localhost:5000/api", "/api")
            .replaceAll("http://localhost:4000/api", "/api")
            .replaceAll("http://localhost:5000/uploads/", "/uploads/"),
        );
    });
  };
}
app.use(
  "/frontend",
  deployedStatic("/frontend", path.join(__dirname, "..", "frontend")),
);
app.use(
  "/admin",
  deployedStatic("/admin", path.join(__dirname, "..", "admin")),
);
const storage = multer.diskStorage({
  destination: uploads,
  filename: (_r, f, cb) =>
    cb(
      null,
      `${Date.now()}-${crypto.randomUUID()}${path.extname(f.originalname).toLowerCase()}`,
    ),
});
const upload = multer({
  storage,
  limits: {
    fileSize: Number(process.env.UPLOAD_MAX_MB || 10) * 1024 * 1024,
    files: 30,
  },
  fileFilter: (_r, f, cb) =>
    cb(
      null,
      /^image\/(jpeg|png|webp|avif|gif)$|^video\/(mp4|webm)$/.test(f.mimetype),
    ),
});
const fail = (res, status, message) =>
  res.status(status).json({ success: false, message });
const valid = (req, res) => {
  const e = validationResult(req);
  if (!e.isEmpty()) {
    fail(res, 422, e.array()[0].msg);
    return false;
  }
  return true;
};
function sign(user) {
  return jwt.sign(
    { sub: String(user._id), role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "30d" },
  );
}
async function auth(req, res, next) {
  try {
    const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");

    if (!token) {
      return fail(res, 401, "Authentication required.");
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await Models.User.findById(payload.sub);

    if (!user || !user.isActive) {
      return fail(res, 401, "Session is no longer valid.");
    }

    req.user = user;
    next();

  } catch (err) {
    if (process.env.NODE_ENV !== "production")
      console.log("JWT ERROR:", err.message);
    return fail(res, 401, "Your session has expired. Please sign in again.");
  }
}

const admin = (req, res, next) =>
  ["admin", "manager"].includes(req.user?.role)
    ? next()
    : fail(res, 403, "Administrator access is required.");
const safeUser = (user) => ({
  id: String(user._id),
  _id: String(user._id),
  name: user.name,
  email: user.email,
  phone: user.phone,
  role: user.role,
  addresses: user.addresses,
  createdAt: user.createdAt,
});
const STATUS = [
  "Pending",
  "Confirmed",
  "Packed",
  "Shipped",
  "Out for Delivery",
  "Delivered",
  "Cancelled",
  "Returned",
  "Refunded",
];
async function settings() {
  return Models.Settings.findOneAndUpdate(
    { key: "store" },
    { $setOnInsert: { key: "store" } },
    { new: true, upsert: true },
  );
}
app.get("/api/health", (_q, res) =>
  res.json({
    success: true,
    database:
      mongoose.connection.readyState === 1 ? "connected" : "disconnected",
  }),
);
app.get("/api/config/public", (_q, res) =>
  res.json({
    success: true,
    googleMapsKey: process.env.GOOGLE_MAPS_BROWSER_KEY || "",
  }),
);
app.post(
  "/api/contact",
  rateLimit({ windowMs: 3600000, limit: 5 }),
  [
    body("name").trim().isLength({ min: 2, max: 120 }),
    body("email").isEmail().normalizeEmail(),
    body("message").trim().isLength({ min: 5, max: 3000 }),
  ],
  async (req, res, next) => {
    try {
      if (!valid(req, res)) return;
      await email.template("contact", req.body.email, {
        name: req.body.name,
        message: "We received your message and will respond shortly.",
      });
      if (process.env.CONTACT_EMAIL)
        await email.send({
          to: process.env.CONTACT_EMAIL,
          subject: "ShopNow contact request",
          text: `${req.body.name} <${req.body.email}>: ${req.body.message}`,
        });
      res.status(202).json({ success: true });
    } catch (e) {
      next(e);
    }
  },
);

app.post(
  "/api/register",
  rateLimit({ windowMs: 3600000, limit: 10 }),
  [
    body("name").trim().isLength({ min: 2 }),
    body("email").isEmail().normalizeEmail(),
    body("password").isLength({ min: 8 }),
  ],
  async (req, res, next) => {
    try {
      if (!valid(req, res)) return;
      if (await Models.User.exists({ email: req.body.email }))
        return fail(res, 409, "An account already uses this email.");
      const user = await Models.User.create({
        name: req.body.name,
        email: req.body.email,
        passwordHash: await bcrypt.hash(req.body.password, 12),
      });
      await email.template("registration", user.email, { name: user.name });
      res
        .status(201)
        .json({ success: true, token: sign(user), user: safeUser(user) });
    } catch (e) {
      next(e);
    }
  },
);
app.post(
  "/api/login",
  rateLimit({ windowMs: 15 * 60000, limit: 10 }),
  [
    body("password").notEmpty(),
    body().custom((value) => {
      if (!String(value.email || value.username || "").trim())
        throw new Error("Email or username is required.");
      return true;
    }),
  ],
  async (req, res, next) => {
    try {
      if (!valid(req, res)) return;
      const login = String(req.body.email || req.body.username)
        .trim()
        .toLowerCase();
      const user = await Models.User.findOne({
        $or: [{ email: login }, { name: req.body.username || req.body.email }],
      }).select("+passwordHash");
      if (
        !user ||
        !(await bcrypt.compare(req.body.password, user.passwordHash))
      )
        return fail(res, 401, "Invalid email or password.");
      if (!user.isActive) return fail(res, 403, "This account is inactive.");
      user.lastLoginAt = new Date();
      await user.save();
      const isAdmin = ["admin", "manager"].includes(user.role);
      res.json({
        success: true,
        token: sign(user),
        user: safeUser(user),
        isAdmin,
      });
    } catch (e) {
      next(e);
    }
  },
);
app.get("/api/me", auth, (req, res) =>
  res.json({ success: true, user: safeUser(req.user) }),
);
app.put("/api/me", auth, async (req, res, next) => {
  try {
    ["name", "phone", "addresses"].forEach((k) => {
      if (req.body[k] !== undefined) req.user[k] = req.body[k];
    });
    await req.user.save();
    res.json({ success: true, user: safeUser(req.user) });
  } catch (e) {
    next(e);
  }
});
const publicProduct = (p) => {
  const data = p.toObject ? p.toObject({ virtuals: true }) : p;
  return {
    ...data,
    id: String(data._id),
    image_url: data.thumbnail || data.images?.[0] || "",
  };
};

app.get("/api/products", async (req, res, next) => {
  try {
    const q = { isActive: true };
    if (req.query.category) q.category = req.query.category;
    if (req.query.mainCategory) q.mainCategory = req.query.mainCategory;
    if (req.query.section) q.section = req.query.section;
    if (req.query.group) q.group = req.query.group;
    if (req.query.item) q.item = req.query.item;
    if (req.query.minPrice || req.query.maxPrice)
      q.price = {
        ...(req.query.minPrice && { $gte: +req.query.minPrice }),
        ...(req.query.maxPrice && { $lte: +req.query.maxPrice }),
      };
    if (req.query.q) q.$text = { $search: req.query.q };
    const sort =
      {
        newest: "-createdAt",
        price_asc: "price",
        price_desc: "-price",
        rating: "-rating",
      }[req.query.sort] || "-createdAt";
    const page = Math.max(1, +req.query.page || 1),
      limit = Math.min(100, Math.max(1, +req.query.limit || 24));
    const [products, total] = await Promise.all([
      Models.Product.find(q)
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Models.Product.countDocuments(q),
    ]);
    const output = products.map(publicProduct);
    res.json({
      success: true,
      products: output,
      data: output,
      total,
      page,
      limit,
    });
  } catch (e) {
    next(e);
  }
});

app.get("/api/search/suggestions", async (req, res, next) => {
  try {
    const q = String(req.query.q || "").trim();
    if (!q) return res.json({ success: true, suggestions: [] });
    const suggestions = await Models.Product.find(
      { $text: { $search: q }, isActive: true },
      { score: { $meta: "textScore" }, name: 1, slug: 1, images: 1, price: 1 },
    )
      .sort({ score: { $meta: "textScore" } })
      .limit(8);
    res.json({ success: true, suggestions });
  } catch (e) {
    next(e);
  }
});
app.get("/api/products/:id", async (req, res, next) => {
  try {
    const p = await Models.Product.findOne({
      $or: [
        { _id: mongoose.isValidObjectId(req.params.id) ? req.params.id : null },
        { slug: req.params.id },
      ],
      isActive: true,
    });
    if (!p) return fail(res, 404, "Product not found.");
    res.json(publicProduct(p));
  } catch (e) {
    next(e);
  }
});

function parseArrayField(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  return String(value)
    .split(/\n|,|;/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseJsonField(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    return JSON.parse(value);
  } catch (err) {
    return parseArrayField(value);
  }
}

function parseObjectField(value) {
  if (!value) return {};
  if (typeof value === "object" && !Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch (_err) {
    return {};
  }
}

function productPayload(body) {
  return {
    name: body.name,
    brand: body.brand || body.productBrand || "",
    // A sparse unique index still treats an empty string as a real value.
    // Store blank SKUs as undefined so multiple products may omit SKU.
    sku: String(body.sku || body.productSKU || "").trim() || undefined,
    mainCategory: body.mainCategory || body.mainCategoryName || "",
    category: body.categoryId || body.category,
    section: body.sectionId || body.section,
    group: body.groupId || body.group,
    item: body.itemId || body.item,

    price: Number(body.price) || 0,
    mrp: Number(body.mrp) || 0,
    stock: Number(body.stock) || 0,
    discount: Number(body.discount || body.productDiscount) || 0,
    shortDescription: body.shortDescription || body.productShortDescription || "",

    description: body.description || "",
    deliveryInfo: body.deliveryInfo || "",
    colors: parseArrayField(body.colors),
    sizes: parseArrayField(body.sizes),
    ram: parseArrayField(body.ram),
    storage: parseArrayField(body.storage),
    processor: parseArrayField(body.processor),
    specifications:
      typeof body.specifications === "object"
        ? body.specifications
        : parseJsonField(body.specifications),
    attributes: parseObjectField(body.attributes || body.specifications),
    material: body.material || "",
    warranty: body.warranty || "",
    battery: body.battery || "",
    camera: body.camera || "",
    processor: body.processor || "",
    display: body.display || "",
    ingredients: body.ingredients || "",
    skinType: body.skinType || "",
    benefits: body.benefits || "",
    author: body.author || "",
    publisher: body.publisher || "",
    isbn: body.isbn || "",
    language: body.language || "",
    capacity: body.capacity || "",
    dimensions: body.dimensions || "",
    weight: body.weight || "",
    ageGroup: body.ageGroup || "",
    features: parseArrayField(body.features),
    variants: parseJsonField(body.variants),
    seo: {
      title: body.metaTitle || body.seoTitle || "",
      description: body.metaDescription || body.seoDescription || "",
      slug: body.slug || body.productSlug || "",
      keywords: parseArrayField(body.keywords || body.productKeywords),
    },
    shipping: {
      weight: body.weight || "",
      length: body.length || body.productLength || "",
      width: body.width || body.productWidth || "",
      height: body.height || body.productHeight || "",
      deliveryTime: body.deliveryTime || body.productDeliveryTime || "",
    },
    inventory: {
      sku: body.inventorySKU || body.sku || body.productSKU || "",
      stock: Number(body.inventoryStock) || Number(body.stock) || 0,
      lowStockAlert: Number(body.inventoryLowStock) || 0,
      warehouse: body.inventoryWarehouse || "",
    },
    featured: body.featured === "true" || body.featured === true || body.productFeatured === "true",
    trending: body.trending === "true" || body.productTrending === "true",
    newArrival: body.newArrival === "true" || body.productNewArrival === "true",
    bestSeller: body.bestSeller === "true" || body.productBestSeller === "true",
    status: body.status || body.productStatus || "Active",
  };
}

async function validHierarchy(data) {
  const section = await Models.Section.findById(data.section);
  const group = await Models.Group.findById(data.group);
  const item = await Models.Item.findById(data.item);

  if (!section || !group || !item) {
    return false;
  }

  return (
    String(section.category) === String(data.category) &&
    String(group.section) === String(section._id) &&
    String(item.group) === String(group._id)
  );
}

app.post(
  "/api/products",
  auth,
  admin,
  upload.array("images", 30),
  async (req, res, next) => {
    try {
      const payload = productPayload(req.body);

      if (process.env.NODE_ENV !== "production") {
        console.log("NEW PRODUCT REQUEST:", { body: req.body, payload, files: (req.files || []).length });
      }

      if (!(await validHierarchy(payload)))
        return fail(res, 422, "Choose a complete valid category hierarchy.");
      const files = req.files || [];
      const imagePaths = files
        .filter((f) => f.mimetype.startsWith("image/"))
        .map((f) => `/uploads/${f.filename}`);
      if (!imagePaths.length)
        return fail(res, 422, "A main image is required.");
      const product = await Models.Product.create({
        ...payload,
        isActive: true,
        images: imagePaths,
        thumbnail: req.body.thumbnail || imagePaths[0] || "",
        mainImage: req.body.mainImage || imagePaths[0] || "",
        videos: files
          .filter((f) => f.mimetype.startsWith("video/"))
          .map((f) => `/uploads/${f.filename}`),
      });
      res.status(201).json({ success: true, product });
    } catch (e) {
      next(e);
    }
  },
);

app.put(
  "/api/products/:id",
  auth,
  admin,
  upload.array("images", 30),
  async (req, res, next) => {
    try {
      const p = await Models.Product.findById(req.params.id);
      if (!p) return fail(res, 404, "Product not found.");
      const payload = productPayload(req.body),
        candidate = { ...p.toObject(), ...payload };
      if (
        req.body.category ||
        req.body.categoryId ||
        req.body.section ||
        req.body.sectionId ||
        req.body.group ||
        req.body.groupId ||
        req.body.brand ||
        req.body.brandId ||
        req.body.item ||
        req.body.itemId
      ) {
        if (!(await validHierarchy(candidate)))
          return fail(res, 422, "Choose a complete valid category hierarchy.");
      }
      Object.assign(p, payload);
      const files = req.files || [];
      const retainedImages = parseJsonField(req.body.retainedImages).filter(Boolean);
      const retainedVideos = parseJsonField(req.body.retainedVideos).filter(Boolean);
      const newImages = files.filter((f) => f.mimetype.startsWith("image/")).map((f) => `/uploads/${f.filename}`);
      const newVideos = files.filter((f) => f.mimetype.startsWith("video/")).map((f) => `/uploads/${f.filename}`);
      p.images = [...retainedImages, ...newImages];
      p.videos = [...retainedVideos, ...newVideos];
      if (!p.images.length) return fail(res, 422, "A main image is required.");
      p.thumbnail = req.body.thumbnail || p.images[0];
      p.mainImage = req.body.mainImage || p.images[0];
      await p.save();
      res.json({ success: true, product: p });
    } catch (e) {
      next(e);
    }
  },
);

app.delete("/api/products/:id", auth, admin, async (req, res, next) => {
  try {
    const p = await Models.Product.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true },
    );
    if (!p) return fail(res, 404, "Product not found.");
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
});

app.get("/api/categories", async (_q, res, next) => {
  try {
    res.json(
      await Models.Category.find({ isActive: { $ne: false } }).sort({
        sortOrder: 1,
        name: 1,
      }),
    );
  } catch (e) {
    next(e);
  }
});
app.post(
  "/api/categories",
  auth,
  admin,
  upload.single("image"),
  async (req, res, next) => {
    try {
      const data = await Models.Category.create({
        ...req.body,
        image: req.file ? `/uploads/${req.file.filename}` : req.body.image,
      });
      res.status(201).json({ success: true, category: data, data });
    } catch (e) {
      next(e);
    }
  },
);
app.put(
  "/api/categories/:id",
  auth,
  admin,
  upload.single("image"),
  async (req, res, next) => {
    try {
      const body = { ...req.body };
      if (req.file) body.image = `/uploads/${req.file.filename}`;
      const data = await Models.Category.findByIdAndUpdate(
        req.params.id,
        body,
        { new: true, runValidators: true },
      );
      if (!data) return fail(res, 404, "Not found.");
      res.json({ success: true, category: data, data });
    } catch (e) {
      next(e);
    }
  },
);
app.delete("/api/categories/:id", auth, admin, async (req, res, next) => {
  try {
    const data = await Models.Category.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true },
    );
    if (!data) return fail(res, 404, "Not found.");
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
});
for (const [path, Model] of Object.entries({
  sections: Models.Section,
  groups: Models.Group,
  brands: Models.Brand,
  items: Models.Item,
  coupons: Models.Coupon,
})) {
  app.get(`/api/${path}`, async (_q, res, next) => {
    try {
      const data = await Model.find({ isActive: { $ne: false } }).sort({
        sortOrder: 1,
        name: 1,
      });
      res.json(data);
    } catch (e) {
      next(e);
    }
  });
  app.post(`/api/${path}`, auth, admin, async (req, res, next) => {
    try {
      res
        .status(201)
        .json({ success: true, data: await Model.create(req.body) });
    } catch (e) {
      next(e);
    }
  });
  app.put(`/api/${path}/:id`, auth, admin, async (req, res, next) => {
    try {
      const data = await Model.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true,
      });
      if (!data) return fail(res, 404, "Not found.");
      res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  });
  app.delete(`/api/${path}/:id`, auth, admin, async (req, res, next) => {
    try {
      await Model.findByIdAndUpdate(req.params.id, { isActive: false });
      res.json({ success: true });
    } catch (e) {
      next(e);
    }
  });
}
app.get("/api/navigation", async (_q, res, next) => {
  try {
    const [categories, sections, groups, items] = await Promise.all([
      Models.Category.find({ isActive: true }),
      Models.Section.find({ isActive: true }),
      Models.Group.find({ isActive: true }),
      Models.Item.find({ isActive: true }),
    ]);
    res.json({
      success: true,
      nodes: [
        ...categories.map((x) => ({
          ...x.toObject(),
          id: String(x._id),
          type: "main",
        })),
        ...sections.map((x) => ({
          ...x.toObject(),
          id: String(x._id),
          type: "section",
          parentId: String(x.category),
        })),
        ...groups.map((x) => ({
          ...x.toObject(),
          id: String(x._id),
          type: "group",
          parentId: String(x.section),
        })),
        ...items.map((x) => ({
          ...x.toObject(),
          id: String(x._id),
          type: "item",
          parentId: String(x.group),
        })),
      ],
    });
  } catch (e) {
    next(e);
  }
});

const navModels = {
  main: Models.Category,
  section: Models.Section,
  group: Models.Group,
  item: Models.Item,
};
const navParent = {
  section: "category",
  group: "section",
  item: "group",
};

async function navigationBody(req) {
  let type = req.body.type,
    Model = navModels[type];
  if (!Model && req.params.id) {
    for (const [candidate, CandidateModel] of Object.entries(navModels)) {
      if (await CandidateModel.exists({ _id: req.params.id })) {
        type = candidate;
        Model = CandidateModel;
        break;
      }
    }
  }
  if (!Model) throw new Error("Invalid navigation type.");
  const body = { ...req.body };
  delete body.type;
  const parentField = navParent[type];
  if (parentField && req.body.parentId) {

    const Parent = navModels[
        {
            section: "main",
            group: "section",
            item: "group"
        }[type]
    ];

    const parent = await Parent.findById(req.body.parentId);

    if (!parent) {
        throw new Error("Selected parent does not exist.");
    }

    body[parentField] = parent._id;

    // SECTION
    if (type === "section") {
        body.category = parent._id;
    }

    // GROUP
    if (type === "group") {
        body.section = parent._id;
        body.category = parent.category;
    }

    // ITEM
    if (type === "item") {
        body.group = parent._id;
        body.section = parent.section;
        body.category = parent.category;
    }
}
  delete body.parentId;
  const allFiles = Array.isArray(req.files)
    ? req.files
    : Object.values(req.files || {}).flat();
  for (const key of ["image", "icon", "bannerDesktop", "bannerMobile"]) {
    const file = allFiles.find((f) => f.fieldname === key);
    if (file) body[key] = `/uploads/${file.filename}`;
  }
  return { Model, body, type };
}
app.post(
  "/api/navigation",
  auth,
  admin,
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "icon", maxCount: 1 },
    { name: "bannerDesktop", maxCount: 1 },
    { name: "bannerMobile", maxCount: 1 },
  ]),
  async (req, res, next) => {
    try {
      const { Model, body, type } = await navigationBody(req);
      const data = await Model.create(body);
      res.status(201).json({
        success: true,
        node: {
          ...data.toObject(),
          id: String(data._id),
          type,
          parentId: body[navParent[type]]
            ? String(body[navParent[type]])
            : null,
        },
      });
    } catch (e) {
      next(e);
    }
  },
);
app.put(
  "/api/navigation/:id",
  auth,
  admin,
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "icon", maxCount: 1 },
    { name: "bannerDesktop", maxCount: 1 },
    { name: "bannerMobile", maxCount: 1 },
  ]),
  async (req, res, next) => {
    try {
      const { Model, body } = await navigationBody(req);
      const data = await Model.findByIdAndUpdate(req.params.id, body, {
        new: true,
        runValidators: true,
      });
      if (!data) return fail(res, 404, "Navigation record not found.");
      res.json({ success: true, node: data });
    } catch (e) {
      next(e);
    }
  },
);
app.delete("/api/navigation/:id", auth, admin, async (req, res, next) => {
  try {
    const { Model } = await navigationBody(req);
    await Model.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
});
app.get("/api/wishlist", auth, async (req, res, next) => {
  try {
    await req.user.populate("wishlist");
    res.json({ success: true, items: req.user.wishlist.filter(Boolean) });
  } catch (e) {
    next(e);
  }
});
app.put("/api/wishlist/:productId", auth, async (req, res, next) => {
  try {
    if (
      !(await Models.Product.exists({
        _id: req.params.productId,
        isActive: true,
      }))
    )
      return fail(res, 404, "Product not found.");
    if (!req.user.wishlist.some((id) => String(id) === req.params.productId))
      req.user.wishlist.push(req.params.productId);
    await req.user.save();
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
});
app.delete("/api/wishlist/:productId", auth, async (req, res, next) => {
  try {
    req.user.wishlist = req.user.wishlist.filter(
      (id) => String(id) !== req.params.productId,
    );
    await req.user.save();
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
});
app.get("/api/cms/:key", async (req, res, next) => {
  try {
    const block = await Models.CmsBlock.findOne({
      key: req.params.key,
      isActive: true,
    });
    res.json({
      success: true,
      data: block || { key: req.params.key, items: [] },
    });
  } catch (e) {
    next(e);
  }
});
app.put("/api/cms/:key", auth, admin, async (req, res, next) => {
  try {
    const data = await Models.CmsBlock.findOneAndUpdate(
      { key: req.params.key },
      {
        key: req.params.key,
        title: req.body.title,
        items: req.body.items || [],
        isActive: req.body.isActive !== false,
      },
      { upsert: true, new: true, runValidators: true },
    );
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
});
app.get("/api/orders/:id/tracking", auth, async (req, res, next) => {
  try {
    const order = await Models.Order.findById(req.params.id);
    if (!order) return fail(res, 404, "Order not found.");
    if (
      String(order.customer) !== String(req.user._id) &&
      !["admin", "manager"].includes(req.user.role)
    )
      return fail(res, 403, "Forbidden.");
    res.json({
      success: true,
      number: order.number,
      status: order.status,
      tracking: order.tracking,
      timeline: order.timeline,
    });
  } catch (e) {
    next(e);
  }
});
app.put("/api/orders/:id/tracking", auth, admin, async (req, res, next) => {
  try {
    const order = await Models.Order.findByIdAndUpdate(
      req.params.id,
      { $set: { tracking: req.body } },
      { new: true },
    );
    if (!order) return fail(res, 404, "Order not found.");
    res.json({ success: true, order });
  } catch (e) {
    next(e);
  }
});
app.get("/robots.txt", (_q, res) =>
  res
    .type("text/plain")
    .send("User-agent: *\nAllow: /\nSitemap: /sitemap.xml\n"),
);
app.get("/sitemap.xml", async (_q, res, next) => {
  try {
    const products = await Models.Product.find({ isActive: true })
      .select("slug updatedAt")
      .lean();
    const base = String(
      process.env.PUBLIC_URL || "http://localhost:5000",
    ).replace(/\/$/, "");
    res
      .type("application/xml")
      .send(
        `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${products.map((p) => `<url><loc>${base}/frontend/product-details.html?id=${p.slug}</loc><lastmod>${p.updatedAt.toISOString()}</lastmod></url>`).join("")}</urlset>`,
      );
  } catch (e) {
    next(e);
  }
});
app.get("/api/settings", auth, admin, async (_q, res, next) => {
  try {
    res.json({ success: true, settings: await settings() });
  } catch (e) {
    next(e);
  }
});
app.get("/api/store-settings", async (_q, res, next) => {
  try {
    const s = await settings();
    res.json({
      success: true,
      settings: {
        general: s.general,
        appearance: s.appearance,
        localization: s.localization,
        shipping: s.shipping,
      },
    });
  } catch (e) {
    next(e);
  }
});
app.put("/api/settings/:section", auth, admin, async (req, res, next) => {
  try {
    const allowed = [
      "general",
      "payment",
      "shipping",
      "users",
      "security",
      "notifications",
      "appearance",
      "localization",
      "inventory",
      "invoice",
    ];
    if (!allowed.includes(req.params.section))
      return fail(res, 404, "Unknown settings section.");
    const s = await settings();
    s[req.params.section] = { ...(s[req.params.section] || {}), ...req.body };
    await s.save();
    res.json({ success: true, settings: s[req.params.section] });
  } catch (e) {
    next(e);
  }
});
app.get("/api/settings/:section", auth, admin, async (req, res, next) => {
  try {
    const allowed = [
      "general",
      "payment",
      "shipping",
      "users",
      "security",
      "notifications",
      "appearance",
      "localization",
      "inventory",
      "invoice",
    ];
    if (!allowed.includes(req.params.section))
      return fail(res, 404, "Unknown settings section.");
    const s = await settings();
    res.json({ success: true, settings: s[req.params.section] || {} });
  } catch (e) {
    next(e);
  }
});
app.get("/api/users", auth, admin, async (_q, res, next) => {
  try {
    const users = await Models.User.find()
      .select("name email phone role isActive createdAt lastLoginAt")
      .sort("-createdAt");
    res.json(users);
  } catch (e) {
    next(e);
  }
});
app.get("/api/admin/users", auth, admin, async (_q, res, next) => {
  try {
    const users = await Models.User.find({
      role: { $in: ["admin", "manager", "staff"] },
    })
      .select("name email role isActive createdAt lastLoginAt")
      .sort("-createdAt");
    res.json({ success: true, users });
  } catch (e) {
    next(e);
  }
});
app.get("/api/reviews", auth, admin, async (_q, res, next) => {
  try {
    const reviews = await Models.Review.find()
      .populate("product", "name")
      .populate("customer", "name email")
      .populate("order", "number status")
      .sort("-createdAt");
    res.json({
      success: true,
      reviews: reviews.map((review) => ({
        ...review.toObject(),
        id: String(review._id),
        customerName: review.customer?.name || "Customer",
        productName: review.product?.name || "Product",
        orderNumber: review.order?.number || "—",
        status: review.isVisible ? "published" : "hidden",
      })),
    });
  } catch (e) {
    next(e);
  }
});
app.put("/api/reviews/:id", auth, admin, async (req, res, next) => {
  try {
    const review = await Models.Review.findByIdAndUpdate(
      req.params.id,
      { isVisible: req.body.status !== "hidden" },
      { new: true },
    );
    if (!review) return fail(res, 404, "Review not found.");
    res.json({ success: true, review });
  } catch (e) {
    next(e);
  }
});
app.post("/api/coupons/apply", async (req, res, next) => {
  try {
    const coupon = await Models.Coupon.findOne({
      code: String(req.body.code || "")
        .trim()
        .toUpperCase(),
      isActive: true,
    });
    const subtotal = Number(req.body.subtotal || 0),
      now = new Date();
    if (!coupon || coupon.startsAt > now || coupon.expiresAt < now)
      return fail(res, 400, "This coupon is not available.");
    if (subtotal < coupon.minimumOrder)
      return fail(res, 400, `Minimum order is ₹${coupon.minimumOrder}.`);
    const discount = Math.min(
      subtotal,
      coupon.type === "percent"
        ? (subtotal * coupon.value) / 100
        : coupon.value,
    );
    res.json({ success: true, coupon, discount, total: subtotal - discount });
  } catch (e) {
    next(e);
  }
});
app.post("/api/orders", auth, async (req, res, next) => {
  try {
    const incoming = Array.isArray(req.body.items)
      ? req.body.items
      : (req.body.products || []).map((row) => ({
          productId: row.productId || row.id || row._id,
          quantity: row.quantity || row.qty || 1,
        }));
    if (!incoming.length)
      return fail(res, 422, "At least one item is required.");
    const products = await Models.Product.find({
      _id: { $in: incoming.map((i) => i.productId) },
      isActive: true,
    });
    let subtotal = 0;
    const lines = [];
    for (const row of incoming) {
      const quantity = Math.max(1, Number(row.quantity) || 1),
        p = products.find((x) => String(x._id) === String(row.productId));
      if (!p || p.stock < quantity)
        return fail(res, 409, `Unavailable: ${p?.name || "product"}`);
      const price = Number(p.salePrice ?? p.price ?? 0);

      if (isNaN(price)) {
        return fail(res, 422, `Invalid price for product: ${p.name}`);
      }

      subtotal += price * quantity;

      lines.push({
        product: p._id,
        name: p.name,
        sku: p.sku || "",
        quantity,
        price,
      });
    }
    for (const line of lines)
      await Models.Product.findByIdAndUpdate(line.product, {
        $inc: { stock: -line.quantity },
      });
    const s = await settings();

    const shipping = Number(s.shipping?.flatRate || 0);

    const taxRate = Number(s.general?.taxRate || 0);

    const tax = Number(Math.round(subtotal * (taxRate / 100)));
    const shippingAddress = req.body.shippingAddress || {
      name: req.body.customerName,
      phone: req.body.customerPhone,
      line1: req.body.customerAddress,
      city: req.body.customerCity,
      postalCode: req.body.customerPincode,
    };
    const paymentMethod = String(req.body.paymentMethod || "cod").toLowerCase();

    if (process.env.NODE_ENV !== "production") {
      console.log("ORDER CALCULATION:", { subtotal, shipping, tax, total: subtotal + shipping + tax });
    }

    if (isNaN(subtotal) || isNaN(shipping) || isNaN(tax)) {
      return fail(res, 422, "Order calculation failed. Invalid amount.");
    }

    const order = await Models.Order.create({
      number: `SN-${Date.now()}-${uuid().slice(0, 5).toUpperCase()}`,
      customer: req.user._id,
      items: lines,
      subtotal,
      shipping,
      tax,
      total: subtotal + shipping + tax,
      payment: {
        method: paymentMethod,
        status: paymentMethod === "cod" ? "pending" : "pending",
        transactionId: req.body.paymentId || "",
      },
      shippingAddress,
      status: "Pending",
      timeline: [{ status: "Pending", at: new Date(), note: "Order placed" }],
    });
    await email.template("order", req.user.email, {
      name: req.user.name,
      orderNumber: order.number,
    });
    res.status(201).json({ success: true, order });
  } catch (e) {
    next(e);
  }
});
app.get("/api/orders/me", auth, async (req, res, next) => {
  try {
    res.json({
      success: true,
      orders: await Models.Order.find({ customer: req.user._id }).sort(
        "-createdAt",
      ),
    });
  } catch (e) {
    next(e);
  }
});
app.get("/api/orders", auth, admin, async (_q, res, next) => {
  try {
    res.json({
      success: true,
      orders: await Models.Order.find()
        .populate("customer", "name email")
        .sort("-createdAt"),
    });
  } catch (e) {
    next(e);
  }
});
app.patch("/api/orders/:id/status", auth, admin, async (req, res, next) => {
  try {
    if (!STATUS.includes(req.body.status))
      return fail(res, 422, "Invalid order status.");
    const o = await Models.Order.findByIdAndUpdate(
      req.params.id,
      {
        $set: { status: req.body.status },
        $push: {
          timeline: {
            status: req.body.status,
            at: new Date(),
            note: req.body.note || "",
          },
        },
      },
      { new: true },
    );
    if (!o) return fail(res, 404, "Order not found.");
    res.json({ success: true, order: o });
  } catch (e) {
    next(e);
  }
});
app.get("/api/orders/:id", auth, async (req, res, next) => {
  try {
    const order = await Models.Order.findOne({
      $or: [
        { _id: mongoose.isValidObjectId(req.params.id) ? req.params.id : null },
        { number: req.params.id },
      ],
    });
    if (!order) return fail(res, 404, "Order not found.");
    if (
      String(order.customer) !== String(req.user._id) &&
      !["admin", "manager"].includes(req.user.role)
    )
      return fail(res, 403, "Forbidden.");
    res.json({ success: true, order });
  } catch (e) {
    next(e);
  }
});
app.post("/api/orders/:id/cancel", auth, async (req, res, next) => {
  try {
    const order = await Models.Order.findById(req.params.id);
    if (!order) return fail(res, 404, "Order not found.");
    if (
      String(order.customer) !== String(req.user._id) ||
      !["Pending", "Confirmed"].includes(order.status)
    )
      return fail(res, 409, "This order cannot be cancelled.");
    order.status = "Cancelled";
    order.timeline.push({
      status: "Cancelled",
      at: new Date(),
      note: "Cancelled by customer",
    });
    for (const line of order.items)
      await Models.Product.findByIdAndUpdate(line.product, {
        $inc: { stock: line.quantity },
      });
    await order.save();
    res.json({ success: true, order });
  } catch (e) {
    next(e);
  }
});
app.get("/api/products/:id/reviews", async (req, res, next) => {
  try {
    const reviews = await Models.Review.find({
      product: req.params.id,
      isVisible: true,
    })
      .populate("customer", "name")
      .sort("-createdAt")
      .lean();
    res.json({
      success: true,
      reviews: reviews.map((r) => ({
        ...r,
        customerName: r.customer?.name || "Customer",
      })),
    });
  } catch (e) {
    next(e);
  }
});
app.post(
  "/api/products/:id/reviews",
  auth,
  [
    body("rating").isInt({ min: 1, max: 5 }),
    body("comment").trim().isLength({ min: 3, max: 1000 }),
  ],
  async (req, res, next) => {
    try {
      if (!valid(req, res)) return;
      if (!(await Models.Product.exists({ _id: req.params.id })))
        return fail(res, 404, "Product not found.");

      const matchingOrder = await Models.Order.findOne({
        customer: req.user._id,
        "items.product": req.params.id,
      })
        .sort("-createdAt")
        .lean();

      const review = await Models.Review.create({
        product: req.params.id,
        customer: req.user._id,
        order: matchingOrder?._id || null,
        rating: req.body.rating,
        comment: req.body.comment,
      });
      const stats = await Models.Review.aggregate([
        { $match: { product: review.product, isVisible: true } },
        {
          $group: {
            _id: null,
            rating: { $avg: "$rating" },
            count: { $sum: 1 },
          },
        },
      ]);
      await Models.Product.findByIdAndUpdate(req.params.id, {
        rating: stats[0]?.rating || 0,
        reviewCount: stats[0]?.count || 0,
      });
      res.status(201).json({ success: true, review });
    } catch (e) {
      next(e);
    }
  },
);
app.get("/api/orders/:id/invoice", auth, async (req, res, next) => {
  try {
    const o = await Models.Order.findById(req.params.id);
    if (!o) return fail(res, 404, "Order not found.");
    if (
      String(o.customer) !== String(req.user._id) &&
      !["admin", "manager"].includes(req.user.role)
    )
      return fail(res, 403, "Forbidden.");
    res
      .type("html")
      .send(
        `<!doctype html><title>Invoice ${o.number}</title>
        <h1>ShopNow</h1>
        <h2>Invoice ${o.number}</h2>
        <p>Status: ${o.status}</p>
        <table border="1">
        <tr>
        <th>Item</th><th>Qty</th>
        <th>Price</th>
        </tr>${o.items.map((i) => `<tr>
          <td>${i.name}</td>
          <td>${i.quantity}</td>
          <td>₹${i.price}</td>
          </tr>`)
          .join("")}
          </table>
          <h3>Total: ₹${o.total}</h3>`,
      );
  } catch (e) {
    next(e);
  }
});
app.get("/api/reports/summary", auth, admin, async (_q, res, next) => {
  try {
    const x = await Models.Order.aggregate([
      { $match: { status: { $nin: ["Cancelled", "Refunded"] } } },
      {
        $group: {
          _id: null,
          revenue: { $sum: "$total" },
          orders: { $sum: 1 },
          average: { $avg: "$total" },
        },
      },
    ]);
    res.json({
      success: true,
      summary: x[0] || { revenue: 0, orders: 0, average: 0 },
    });
  } catch (e) {
    next(e);
  }
});
app.use((err, _req, res, _next) => {
  console.error(err);
  const status =
    err.name === "ValidationError" ? 422 : err.code === 11000 ? 409 : 500;
  res.status(status).json({
    success: false,
    message: status === 500 ? "Unexpected server error." : err.message,
  });
});
const mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/shopnow";

// Reuse one connection across warm serverless invocations instead of opening
// a new one per request, which would exhaust Atlas's connection limit.
let cached = global.__shopnowMongoose;
if (!cached) cached = global.__shopnowMongoose = { promise: null };
function connectToDatabase() {
  if (!cached.promise) {
    cached.promise = mongoose
      .connect(mongoUri, { serverSelectionTimeoutMS: 10000 })
      .catch((error) => {
        cached.promise = null; // allow the next invocation to retry
        throw error;
      });
  }
  return cached.promise;
}

if (process.env.VERCEL) {
  // Serverless: Vercel invokes the exported app per-request, so it must
  // never call app.listen(). Kick off the (cached) DB connection - mongoose
  // queues queries until it resolves - and export the app for api/index.js.
  connectToDatabase().catch((error) =>
    console.error("MongoDB connection failed:", error.message),
  );
  module.exports = app;
} else {
  // Traditional long-running server: local dev, a VPS, etc.
  connectToDatabase()
    .then(() =>
      app.listen(port, () => console.log(`ShopNow API listening on ${port}`)),
    )
    .catch((error) => {
      console.error("MongoDB connection failed:", error.message);
      process.exit(1);
    });
}