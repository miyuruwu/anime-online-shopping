const express = require("express");
const { getDb } = require("../db/db");
const { getCart } = require("../lib/cart");

const router = express.Router();

function normalizeQuery(q) {
  if (!q) return "";
  return String(q).trim().slice(0, 80);
}

router.get("/", (req, res) => {
  const db = getDb();
  const q = normalizeQuery(req.query.q);
  const category = normalizeQuery(req.query.category);
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = 48;
  const offset = (page - 1) * limit;

  const categories = db
    .prepare("SELECT id, slug, name, emoji FROM categories ORDER BY name ASC")
    .all();

  const featured = db
    .prepare(
      `SELECT p.*, c.slug AS category_slug, c.name AS category_name, c.emoji AS category_emoji
       FROM products p
       JOIN categories c ON c.id = p.category_id
       WHERE p.is_featured = 1
       ORDER BY p.created_at DESC
       LIMIT 6`
    )
    .all();

  let products = [];
  if (q || category) {
    const where = [];
    const params = {};
    if (q) {
      where.push("(p.name LIKE @q OR p.description LIKE @q)");
      params.q = `%${q}%`;
    }
    if (category) {
      where.push("c.slug = @category");
      params.category = category;
    }

    const sql = `
      SELECT p.*, c.slug AS category_slug, c.name AS category_name, c.emoji AS category_emoji
      FROM products p
      JOIN categories c ON c.id = p.category_id
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY p.created_at DESC
      LIMIT ? OFFSET ?
    `;
    products = db.prepare(sql).all(params, limit, offset);
  }

  const cart = getCart(req);
  const cartCount = Object.values(cart.items).reduce((sum, it) => sum + it.qty, 0);

  res.render("shop/index", {
    title: "Anime Shop",
    q,
    category,
    categories,
    featured,
    products,
    cartCount,
    page
  });
});

router.get("/c/:slug", (req, res) => {
  const db = getDb();
  const slug = String(req.params.slug || "");
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = 48;
  const offset = (page - 1) * limit;

  const cat = db
    .prepare("SELECT id, slug, name, emoji FROM categories WHERE slug = ?")
    .get(slug);

  if (!cat) {
    return res.status(404).render("404", {
      title: "Category not found",
      subtitle: "That aisle doesn’t exist in this timeline."
    });
  }

  const products = db
    .prepare(
      `SELECT p.*, c.slug AS category_slug, c.name AS category_name, c.emoji AS category_emoji
       FROM products p
       JOIN categories c ON c.id = p.category_id
       WHERE c.id = ?
       ORDER BY p.created_at DESC
       LIMIT ? OFFSET ?`
    )
    .all(cat.id, limit, offset);

  const cart = getCart(req);
  const cartCount = Object.values(cart.items).reduce((sum, it) => sum + it.qty, 0);

  res.render("shop/category", {
    title: `${cat.name}`,
    category: cat,
    products,
    cartCount,
    page
  });
});

router.get("/p/:slug", (req, res) => {
  const db = getDb();
  const slug = String(req.params.slug || "");

  const product = db
    .prepare(
      `SELECT p.*, c.slug AS category_slug, c.name AS category_name, c.emoji AS category_emoji
       FROM products p
       JOIN categories c ON c.id = p.category_id
       WHERE p.slug = ?`
    )
    .get(slug);

  if (!product) {
    return res.status(404).render("404", {
      title: "Product not found",
      subtitle: "This item sold out across all parallel worlds."
    });
  }

  const related = db
    .prepare(
      `SELECT p.slug, p.name, p.price_cents, p.image_url
       FROM products p
       WHERE p.category_id = ? AND p.id != ?
       ORDER BY p.created_at DESC
       LIMIT 4`
    )
    .all(product.category_id, product.id);

  const cart = getCart(req);
  const cartCount = Object.values(cart.items).reduce((sum, it) => sum + it.qty, 0);

  res.render("shop/product", {
    title: product.name,
    product,
    related,
    cartCount
  });
});

module.exports = router;

