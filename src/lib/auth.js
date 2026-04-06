const bcrypt = require("bcryptjs");

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase().slice(0, 160);
}

function normalizeName(name) {
  return String(name || "").trim().slice(0, 80);
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidRole(role) {
  return role === "buyer" || role === "seller" || role === "admin";
}

async function hashPassword(password) {
  const pw = String(password || "");
  // bcrypt has an input limit; keep it sane.
  if (pw.length < 8 || pw.length > 72) {
    throw new Error("Password must be 8–72 characters.");
  }
  return bcrypt.hash(pw, 12);
}

async function verifyPassword(password, hash) {
  return bcrypt.compare(String(password || ""), String(hash || ""));
}

function requireAuth(req, res, next) {
  if (req.session?.user?.id) return next();
  const nextUrl = encodeURIComponent(req.originalUrl || "/shop");
  return res.redirect(`/auth/sign-in?next=${nextUrl}`);
}

function requireRole(...roles) {
  return (req, res, next) => {
    const role = req.session?.user?.role;
    if (role && roles.includes(role)) return next();
    return res.status(403).render("403", {
      title: "Forbidden",
      subtitle: "You don’t have permission to access this area."
    });
  };
}

module.exports = {
  normalizeEmail,
  normalizeName,
  isValidEmail,
  isValidRole,
  hashPassword,
  verifyPassword,
  requireAuth,
  requireRole
};

