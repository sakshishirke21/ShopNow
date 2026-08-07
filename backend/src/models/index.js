const mongoose = require("mongoose");
const { Schema } = mongoose;
const base = { timestamps: true, versionKey: false };
const slug = (v) =>
  String(v || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
const navigation = (name, refs = {}) =>
  mongoose.model(
    name,
    new Schema(
      {
        name: { type: String, required: true, trim: true },
        slug: { type: String, unique: true, sparse: true },
        description: String,
        image: String,
        icon: String,
        bannerDesktop: String,
        bannerMobile: String,
        seoTitle: String,
        seoDescription: String,
        featured: { type: Boolean, default: false },
        isActive: { type: Boolean, default: true },
        sortOrder: { type: Number, default: 0 },
        ...refs,
      },
      base,
    ),
  );
const Category = navigation("Category"),
  Section = navigation("Section", {
    category: { type: Schema.Types.ObjectId, ref: "Category", required: true },
  }),
  Group = navigation("Group", {
    category: { type: Schema.Types.ObjectId, ref: "Category", required: true },
    section: { type: Schema.Types.ObjectId, ref: "Section", required: true },
  }),
  Item = navigation("Item", {
    category: { type: Schema.Types.ObjectId, ref: "Category", required: true },
    section: { type: Schema.Types.ObjectId, ref: "Section", required: true },
    group: { type: Schema.Types.ObjectId, ref: "Group", required: true },
  });
for (const M of [Category, Section, Group, Item])
  M.schema.pre("validate", function (n) {
    if (!this.slug)
      this.slug = `${slug(this.name)}-${String(this._id).slice(-6)}`;
    n();
  });
const Product = mongoose.model(
  "Product",
  new Schema(
    {
      name: { type: String, required: true, trim: true },
      slug: { type: String, unique: true, sparse: true },
      description: String,
      features: [String],
      highlights: [String],
      tags: [String],
      specifications: { type: Map, of: String },
      // Canonical category-specific data. `specifications` remains available for
      // older clients, while new clients render this object without hardcoding.
      attributes: { type: Map, of: Schema.Types.Mixed, default: {} },
      category: {
        type: Schema.Types.ObjectId,
        ref: "Category",
        required: true,
      },
      section: { type: Schema.Types.ObjectId, ref: "Section", required: true },
      group: { type: Schema.Types.ObjectId, ref: "Group", required: true },
      item: { type: Schema.Types.ObjectId, ref: "Item", default: null },
      brand: String,
      sku: { type: String, unique: true, sparse: true },
      barcode: String,
      shortDescription: String,
      price: { type: Number, required: true, min: 0 },
      mrp: { type: Number, min: 0 },
      discount: { type: Number, default: 0, min: 0, max: 100 },
      tax: { type: Number, default: 0 },
      stock: { type: Number, default: 0, min: 0 },
      images: [String],
      thumbnail: String,
      mainImage: String,
      videos: [String],
      seo: Schema.Types.Mixed,
      shipping: Schema.Types.Mixed,
      inventory: Schema.Types.Mixed,
      variants: [
        {
          color: String,
          size: String,
          ram: String,
          storage: String,
          processor: String,
          price: Number,
          stock: Number,
          sku: String,
        },
      ],
      warranty: String,
      weight: String,
      dimensions: String,
      color: [String],
      size: [String],
      ram: [String],
      storage: [String],
      processor: [String],
      screenSize: [String],
      featured: { type: Boolean, default: false },
      trending: { type: Boolean, default: false },
      bestSeller: { type: Boolean, default: false },
      newArrival: { type: Boolean, default: false },
      isActive: { type: Boolean, default: true },
      rating: { type: Number, default: 0 },
      reviewCount: { type: Number, default: 0 },
    },
    base,
  ),
);
Product.schema.virtual("salePrice").get(function () {
  return this.price * (1 - this.discount / 100);
});
Product.schema.pre("validate", function (n) {
  if (!this.slug)
    this.slug = `${slug(this.name)}-${String(this._id).slice(-6)}`;
  n();
});
Product.schema.index({
  name: "text",
  description: "text",
  sku: "text",
  tags: "text",
});
const User = mongoose.model(
  "User",
  new Schema(
    {
      name: { type: String, required: true },
      email: { type: String, required: true, unique: true, lowercase: true },
      phone: String,
      passwordHash: { type: String, required: true, select: false },
      role: {
        type: String,
        enum: ["admin", "manager", "staff", "customer"],
        default: "customer",
      },
      isActive: { type: Boolean, default: true },
      addresses: [
        {
          label: String,
          name: String,
          phone: String,
          line1: String,
          line2: String,
          city: String,
          state: String,
          postalCode: String,
          country: String,
          latitude: Number,
          longitude: Number,
          isDefault: Boolean,
        },
      ],
      wishlist: [{ type: Schema.Types.ObjectId, ref: "Product" }],
      lastLoginAt: Date,
    },
    base,
  ),
);
const Order = mongoose.model(
  "Order",
  new Schema(
    {
      number: { type: String, unique: true, required: true },
      customer: { type: Schema.Types.ObjectId, ref: "User", required: true },
      items: [
        {
          product: { type: Schema.Types.ObjectId, ref: "Product" },
          name: String,
          sku: String,
          quantity: { type: Number, min: 1 },
          price: Number,
        },
      ],
      subtotal: Number,
      shipping: Number,
      tax: Number,
      total: Number,
      status: { type: String, default: "Pending" },
      payment: { method: String, status: String, transactionId: String },
      shippingAddress: Schema.Types.Mixed,
      tracking: {
        carrier: String,
        id: String,
        dispatchDate: Date,
        estimate: Date,
      },
      timeline: [{ status: String, note: String, at: Date }],
    },
    base,
  ),
);
const Coupon = mongoose.model(
  "Coupon",
  new Schema(
    {
      code: { type: String, required: true, unique: true, uppercase: true },
      type: { type: String, enum: ["percent", "fixed"], default: "percent" },
      value: { type: Number, required: true },
      minimumOrder: { type: Number, default: 0 },
      startsAt: Date,
      expiresAt: Date,
      isActive: { type: Boolean, default: true },
    },
    base,
  ),
);
const Review = mongoose.model(
  "Review",
  new Schema(
    {
      product: { type: Schema.Types.ObjectId, ref: "Product", required: true },
      customer: { type: Schema.Types.ObjectId, ref: "User", required: true },
      order: { type: Schema.Types.ObjectId, ref: "Order", default: null },
      rating: { type: Number, required: true, min: 1, max: 5 },
      comment: { type: String, required: true, maxlength: 1000 },
      isVisible: { type: Boolean, default: true },
    },
    base,
  ),
);
const Settings = mongoose.model(
  "Settings",
  new Schema(
    {
      key: { type: String, unique: true, default: "store" },
      general: Schema.Types.Mixed,
      payment: Schema.Types.Mixed,
      shipping: Schema.Types.Mixed,
      users: Schema.Types.Mixed,
      security: Schema.Types.Mixed,
      notifications: Schema.Types.Mixed,
      appearance: Schema.Types.Mixed,
      localization: Schema.Types.Mixed,
      inventory: Schema.Types.Mixed,
      invoice: Schema.Types.Mixed,
    },
    base,
  ),
);
const CmsBlock = mongoose.model(
  "CmsBlock",
  new Schema(
    {
      key: { type: String, unique: true },
      title: String,
      items: [Schema.Types.Mixed],
      isActive: { type: Boolean, default: true },
    },
    base,
  ),
);
module.exports = {
  Category,
  Section,
  Group,
  Item,
  Product,
  User,
  Order,
  Coupon,
  Review,
  Settings,
  CmsBlock,
};
