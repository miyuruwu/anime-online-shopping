const express = require("express");
const { getDb } = require("../db/db");
const { getCart, clearCart } = require("../lib/cart");
const { requireAuth } = require("../lib/auth");

const router = express.Router();

function computeShipping(subtotalCents) {
  if (subtotalCents <= 0) return 0;
  if (subtotalCents >= 7500) return 0;
  return 599;
}

function cartSummary(db, cart) {
  const ids = Object.keys(cart.items);
  if (ids.length === 0) return { lines: [], subtotal_cents: 0, count: 0 };

  const placeholders = ids.map(() => "?").join(", ");
  const products = db
    .prepare(
      `SELECT id, name, price_cents, stock
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
      product_id: p.id,
      name: p.name,
      unit_price_cents: p.price_cents,
      qty: safeQty,
      line_total_cents: lineTotal
    });
  }

  return { lines, subtotal_cents: subtotal, count };
}

router.get("/", requireAuth, (req, res) => {
  const db = getDb();
  const cart = getCart(req);
  const summary = cartSummary(db, cart);

  if (summary.count === 0) return res.redirect("/cart");

  const shipping = computeShipping(summary.subtotal_cents);
  res.render("checkout/index", {
    title: "Checkout",
    ...summary,
    shipping_cents: shipping,
    total_cents: summary.subtotal_cents + shipping,
    error: null,
    form: {
      email: "",
      shipping_name: "",
      shipping_address1: "",
      shipping_city: "",
      shipping_country: "Japan"
    }
  });
});

router.post("/", requireAuth, (req, res) => {
  const db = getDb();
  const cart = getCart(req);
  const summary = cartSummary(db, cart);
  if (summary.count === 0) return res.redirect("/cart");

  const form = {
    email: String(req.body.email || "").trim().slice(0, 120),
    shipping_name: String(req.body.shipping_name || "").trim().slice(0, 120),
    shipping_address1: String(req.body.shipping_address1 || "").trim().slice(0, 200),
    shipping_city: String(req.body.shipping_city || "").trim().slice(0, 80),
    shipping_country: String(req.body.shipping_country || "").trim().slice(0, 80)
  };

  const missing =
    !form.email ||
    !form.shipping_name ||
    !form.shipping_address1 ||
    !form.shipping_city ||
    !form.shipping_country;

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email);
  if (missing || !emailOk) {
    const shipping = computeShipping(summary.subtotal_cents);
    return res.status(400).render("checkout/index", {
      title: "Checkout",
      ...summary,
      shipping_cents: shipping,
      total_cents: summary.subtotal_cents + shipping,
      error: missing ? "Please fill in all fields." : "Please enter a valid email.",
      form
    });
  }

  const shipping = computeShipping(summary.subtotal_cents);
  const total = summary.subtotal_cents + shipping;

  const createOrder = db.transaction(() => {
    const order = db
      .prepare(
        `INSERT INTO orders
         (email, shipping_name, shipping_address1, shipping_city, shipping_country,
          subtotal_cents, shipping_cents, total_cents)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        form.email,
        form.shipping_name,
        form.shipping_address1,
        form.shipping_city,
        form.shipping_country,
        summary.subtotal_cents,
        shipping,
        total
      );

    const orderId = order.lastInsertRowid;

    const insertItem = db.prepare(
      `INSERT INTO order_items
       (order_id, product_id, name, unit_price_cents, qty, line_total_cents)
       VALUES (?, ?, ?, ?, ?, ?)`
    );

    const decStock = db.prepare(
      `UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?`
    );

    for (const line of summary.lines) {
      const updated = decStock.run(line.qty, line.product_id, line.qty);
      if (updated.changes !== 1) {
        throw new Error("Insufficient stock for an item in your cart.");
      }
      insertItem.run(
        orderId,
        line.product_id,
        line.name,
        line.unit_price_cents,
        line.qty,
        line.line_total_cents
      );
    }

    return Number(orderId);
  });

  try {
    const orderId = createOrder();
    clearCart(req);
    res.redirect(`/checkout/success/${orderId}`);
  } catch (e) {
    const shipping2 = computeShipping(summary.subtotal_cents);
    res.status(409).render("checkout/index", {
      title: "Checkout",
      ...summary,
      shipping_cents: shipping2,
      total_cents: summary.subtotal_cents + shipping2,
      error: e?.message || "Checkout failed. Please try again.",
      form
    });
  }
});

router.get("/success/:id", (req, res) => {
  const db = getDb();
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) return res.redirect("/shop");

  const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(id);
  if (!order) return res.redirect("/shop");

  const items = db
    .prepare(
      `SELECT name, unit_price_cents, qty, line_total_cents
       FROM order_items
       WHERE order_id = ?
       ORDER BY id ASC`
    )
    .all(id);

  res.render("checkout/success", {
    title: "Order confirmed",
    order,
    items
  });
});

module.exports = router;

