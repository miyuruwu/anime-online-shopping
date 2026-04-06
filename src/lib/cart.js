function getCart(req) {
  if (!req.session.cart) req.session.cart = { items: {} };
  return req.session.cart;
}

function addToCart(req, productId, qty) {
  const cart = getCart(req);
  const id = String(productId);
  const current = cart.items[id]?.qty || 0;
  const next = Math.max(0, current + qty);
  if (next <= 0) {
    delete cart.items[id];
  } else {
    cart.items[id] = { qty: next };
  }
}

function setQty(req, productId, qty) {
  const cart = getCart(req);
  const id = String(productId);
  const next = Math.max(0, qty);
  if (next <= 0) delete cart.items[id];
  else cart.items[id] = { qty: next };
}

function clearCart(req) {
  req.session.cart = { items: {} };
}

module.exports = { getCart, addToCart, setQty, clearCart };

