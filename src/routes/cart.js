const express = require("express");
const { getDb } = require("../db/db");
const { getCart, addToCart, setQty, clearCart } = require("../lib/cart");

const router = express.Router();

function cartSummary(db, cart) {
  const ids = Object.keys(cart.items);
  if (ids.length === 0) return { lines: [], subtotal_cents: 0, count: 0 };

  const placeholders = ids.map(() => "?").join(", ");
  const products = db
    .prepare(
      `SELECT id, slug, name, price_cents, image_url, stock
       FROM products
       WHERE id IN (${placeholders})`
    )
    .all(...ids.map((x) => Number(x)));

  const byId = new Map(products.map((p) => [String(p.id), p]));

  const lines = [];
  let subtotal = 0;
  let count = 0;

  for (const id of ids) {
    const p = byId.get(String(id));
    if (!p) continue;
    const qty = Math.max(1, cart.items[id].qty);
    const safeQty = Math.min(qty, p.stock);
    const lineTotal = safeQty * p.price_cents;
    subtotal += lineTotal;
    count += safeQty;
    lines.push({
      product: p,
      qty: safeQty,
      line_total_cents: lineTotal
    });
  }

  return { lines, subtotal_cents: subtotal, count };
}

router.get("/", (req, res) => {
  const db = getDb();
  const cart = getCart(req);
  const summary = cartSummary(db, cart);

  res.render("cart/index", {
    title: "Your Cart",
    ...summary
  });
});

router.post("/add", (req, res) => {
  const productId = Number(req.body.product_id);
  const qty = Number(req.body.qty || 1);
  if (!Number.isFinite(productId) || productId <= 0) return res.redirect("/cart");
  addToCart(req, productId, Number.isFinite(qty) ? qty : 1);
  res.redirect("/cart");
});

router.post("/set", (req, res) => {
  const productId = Number(req.body.product_id);
  const qty = Number(req.body.qty || 0);
  if (!Number.isFinite(productId) || productId <= 0) return res.redirect("/cart");
  setQty(req, productId, Number.isFinite(qty) ? qty : 0);
  res.redirect("/cart");
});

router.post("/clear", (req, res) => {
  clearCart(req);
  res.redirect("/cart");
});

module.exports = router;

