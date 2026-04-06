const express = require("express");
const { getDb } = require("../db/db");
const { requireAuth, requireRole } = require("../lib/auth");

const router = express.Router();

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
      `SELECT p.id, p.slug, p.name, p.price_cents, p.stock, c.name AS category_name
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
    }
  });
});

router.post("/products", requireAuth, requireRole("seller", "admin"), (req, res) => {
  const db = getDb();

  const categories = db
    .prepare("SELECT id, slug, name FROM categories ORDER BY name ASC")
    .all();

  const form = {
    name: String(req.body.name || "").trim().slice(0, 120),
    slug: String(req.body.slug || "").trim().toLowerCase().slice(0, 80),
    description: String(req.body.description || "").trim().slice(0, 800),
    price_cents: Number(req.body.price_cents),
    stock: Number(req.body.stock),
    image_url: String(req.body.image_url || "").trim().slice(0, 220),
    category_id: Number(req.body.category_id),
    is_featured: req.body.is_featured ? 1 : 0
  };

  const products = db
    .prepare(
      `SELECT p.id, p.slug, p.name, p.price_cents, p.stock, c.name AS category_name
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
    form.image_url.startsWith("/images/");

  if (!valid) {
    return res.status(400).render("account/products", {
      title: "Manage products",
      user: req.session.user,
      products,
      categories,
      error:
        "Please enter valid fields. Slug must be lowercase (a-z, 0-9, dash). Image URL must start with /images/.",
      form
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
      form
    });
  }

  return res.redirect("/account/products");
});

module.exports = router;

