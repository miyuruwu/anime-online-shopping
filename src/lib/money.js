function formatMoney(cents, currency = "USD") {
  const value = (cents || 0) / 100;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency
  }).format(value);
}

module.exports = { formatMoney };

