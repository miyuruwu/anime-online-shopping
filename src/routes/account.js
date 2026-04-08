const express = require("express");
const multer = require("multer");
const path = require("path");
const crypto = require("crypto");
const { getDb } = require("../db/db");
const { requireAuth, requireRole } = require("../lib/auth");

const router = express.Router();

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, "..", "..", "public", "images"));
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const uniqueSuffix = crypto.randomBytes(6).toString("hex");
    cb(null, 'upload-' + uniqueSuffix + ext);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

function buildFormFromBody(body) {
  return {
    name: String(body.name || "").trim().slice(0, 120),
    slug: String(body.slug || "").trim().toLowerCase().slice(0, 80),
    description: String(body.description || "").trim().slice(0, 800),
    price_cents: Number(body.price_cents),
    stock: Number(body.stock),
    image_url: String(body.image_url || "").trim().slice(0, 10000),
    category_id: Number(body.category_id),
    is_featured: body.is_featured ? 1 : 0
  };
}

function isValidImageUrl(url) {
  return url.startsWith("/images/") || url.startsWith("data:image/");
}

router.get("/", requireAuth, (req, res) => {
  res.render("account/index", {
    title: "Account",
    user: req.session.user
  });
});

router.get("/orders", requireAuth, requireRole("admin"), (req, res) => {
  const db = getDb();
  const orders = db
    .prepare(
      `SELECT id, created_at, email, total_cents
       FROM orders
       ORDER BY id DESC
       LIMIT 100`
    )
    .all();

  res.render("account/orders", {
    title: "All orders",
    user: req.session.user,
    orders
  });
});

router.get("/products", requireAuth, requireRole("seller", "admin"), (req, res) => {
  const db = getDb();
  const products = db
    .prepare(
      `SELECT p.id, p.slug, p.name, p.price_cents, p.stock, p.category_id, p.image_url, p.is_featured, c.name AS category_name
       FROM products p
       JOIN categories c ON c.id = p.category_id
       ORDER BY p.id DESC
       LIMIT 200`
    )
    .all();

  const categories = db
    .prepare("SELECT id, slug, name FROM categories ORDER BY name ASC")
    .all();

  res.render("account/products", {
    title: "Manage products",
    user: req.session.user,
    products,
    categories,
    error: null,
    form: {
      name: "",
      slug: "",
      description: "",
      price_cents: 1999,
      stock: 10,
      image_url: "/images/",
      category_id: categories[0]?.id || null,
      is_featured: 0
    },
    formAction: "/account/products",
    submitLabel: "Create product",
    editing: false
  });
});

router.get("/products/:id/edit", requireAuth, requireRole("seller", "admin"), (req, res) => {
  const db = getDb();
  const id = Number(req.params.id);

  const product = db
    .prepare(
      `SELECT p.id, p.slug, p.name, p.description, p.price_cents, p.stock, p.category_id, p.image_url, p.is_featured, c.name AS category_name
       FROM products p
       JOIN categories c ON c.id = p.category_id
       WHERE p.id = ?`
    )
    .get(id);

  if (!product) {
    return res.status(404).render("404", {
      title: "Product not found",
      subtitle: "This item sold out across all parallel worlds."
    });
  }

  const products = db
    .prepare(
      `SELECT p.id, p.slug, p.name, p.price_cents, p.stock, p.category_id, p.image_url, p.is_featured, c.name AS category_name
       FROM products p
       JOIN categories c ON c.id = p.category_id
       ORDER BY p.id DESC
       LIMIT 200`
    )
    .all();

  const categories = db
    .prepare("SELECT id, slug, name FROM categories ORDER BY name ASC")
    .all();

  res.render("account/products", {
    title: "Edit product",
    user: req.session.user,
    products,
    categories,
    error: null,
    form: {
      name: product.name,
      slug: product.slug,
      description: product.description,
      price_cents: product.price_cents,
      stock: product.stock,
      image_url: product.image_url,
      category_id: product.category_id,
      is_featured: product.is_featured
    },
    formAction: `/account/products/${product.id}`,
    submitLabel: "Save changes",
    editing: true
  });
});

router.post("/products", requireAuth, requireRole("seller", "admin"), upload.single("image_file"), (req, res) => {
  const db = getDb();

  const categories = db
    .prepare("SELECT id, slug, name FROM categories ORDER BY name ASC")
    .all();

  const form = buildFormFromBody(req.body);
  if (req.file) {
    form.image_url = '/images/' + req.file.filename;
  }

  const products = db
    .prepare(
      `SELECT p.id, p.slug, p.name, p.price_cents, p.stock, p.category_id, p.image_url, p.is_featured, c.name AS category_name
       FROM products p
       JOIN categories c ON c.id = p.category_id
       ORDER BY p.id DESC
       LIMIT 200`
    )
    .all();

  const valid =
    form.name &&
    form.slug &&
    /^[a-z0-9-]+$/.test(form.slug) &&
    form.description &&
    Number.isFinite(form.price_cents) &&
    form.price_cents >= 0 &&
    Number.isFinite(form.stock) &&
    form.stock >= 0 &&
    Number.isFinite(form.category_id) &&
    categories.some((c) => c.id === form.category_id) &&
    isValidImageUrl(form.image_url);

  if (!valid) {
    return res.status(400).render("account/products", {
      title: "Manage products",
      user: req.session.user,
      products,
      categories,
      error:
        "Please enter valid fields. Slug must be lowercase (a-z, 0-9, dash). Image URL must start with /images/ or data:image/.",
      form,
      formAction: "/account/products",
      submitLabel: "Create product",
      editing: false
    });
  }

  try {
    db.prepare(
      `INSERT INTO products (slug, name, description, price_cents, image_url, category_id, stock, is_featured)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      form.slug,
      form.name,
      form.description,
      form.price_cents,
      form.image_url,
      form.category_id,
      form.stock,
      form.is_featured
    );
  } catch (e) {
    return res.status(409).render("account/products", {
      title: "Manage products",
      user: req.session.user,
      products,
      categories,
      error: "Could not create product (slug might already exist).",
      form,
      formAction: "/account/products",
      submitLabel: "Create product",
      editing: false
    });
  }

  return res.redirect("/account/products");
});

router.post("/products/:id", requireAuth, requireRole("seller", "admin"), upload.single("image_file"), (req, res) => {
  const db = getDb();
  const id = Number(req.params.id);

  const categories = db
    .prepare("SELECT id, slug, name FROM categories ORDER BY name ASC")
    .all();

  const form = buildFormFromBody(req.body);
  if (req.file) {
    form.image_url = '/images/' + req.file.filename;
  }

  const products = db
    .prepare(
      `SELECT p.id, p.slug, p.name, p.price_cents, p.stock, p.category_id, p.image_url, p.is_featured, c.name AS category_name
       FROM products p
       JOIN categories c ON c.id = p.category_id
       ORDER BY p.id DESC
       LIMIT 200`
    )
    .all();

  const valid =
    form.name &&
    form.slug &&
    /^[a-z0-9-]+$/.test(form.slug) &&
    form.description &&
    Number.isFinite(form.price_cents) &&
    form.price_cents >= 0 &&
    Number.isFinite(form.stock) &&
    form.stock >= 0 &&
    Number.isFinite(form.category_id) &&
    categories.some((c) => c.id === form.category_id) &&
    isValidImageUrl(form.image_url);

  if (!valid) {
    return res.status(400).render("account/products", {
      title: "Edit product",
      user: req.session.user,
      products,
      categories,
      error:
        "Please enter valid fields. Slug must be lowercase (a-z, 0-9, dash). Image URL must start with /images/ or data:image/.",
      form,
      formAction: `/account/products/${id}`,
      submitLabel: "Save changes",
      editing: true
    });
  }

  try {
    const result = db.prepare(
      `UPDATE products
       SET slug = ?, name = ?, description = ?, price_cents = ?, image_url = ?, category_id = ?, stock = ?, is_featured = ?
       WHERE id = ?`
    ).run(
      form.slug,
      form.name,
      form.description,
      form.price_cents,
      form.image_url,
      form.category_id,
      form.stock,
      form.is_featured,
      id
    );

    if (result.changes === 0) {
      return res.status(404).render("404", {
        title: "Product not found",
        subtitle: "This item sold out across all parallel worlds."
      });
    }
  } catch (e) {
    return res.status(409).render("account/products", {
      title: "Edit product",
      user: req.session.user,
      products,
      categories,
      error: "Could not update product (slug might already exist).",
      form,
      formAction: `/account/products/${id}`,
      submitLabel: "Save changes",
      editing: true
    });
  }

  return res.redirect("/account/products");
});

router.post("/products/:id/delete", requireAuth, requireRole("seller", "admin"), (req, res) => {
  const db = getDb();
  const id = Number(req.params.id);

  try {
    const result = db.prepare("DELETE FROM products WHERE id = ?").run(id);

    if (result.changes === 0) {
      return res.status(404).render("404", {
        title: "Product not found",
        subtitle: "This item sold out across all parallel worlds."
      });
    }
  } catch (e) {
    const products = db
      .prepare(
        `SELECT p.id, p.slug, p.name, p.price_cents, p.stock, p.category_id, p.image_url, p.is_featured, c.name AS category_name
         FROM products p
         JOIN categories c ON c.id = p.category_id
         ORDER BY p.id DESC
         LIMIT 200`
      )
      .all();

    const categories = db
      .prepare("SELECT id, slug, name FROM categories ORDER BY name ASC")
      .all();

    return res.status(409).render("account/products", {
      title: "Manage products",
      user: req.session.user,
      products,
      categories,
      error: "Could not delete product. It may be referenced by existing orders.",
      form: {
        name: "",
        slug: "",
        description: "",
        price_cents: 1999,
        stock: 10,
        image_url: "/images/",
        category_id: categories[0]?.id || null,
        is_featured: 0
      },
      formAction: "/account/products",
      submitLabel: "Create product",
      editing: false
    });
  }

  return res.redirect("/account/products");
});

module.exports = router;