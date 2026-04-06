const express = require("express");
const { getDb } = require("../db/db");
const {
  normalizeEmail,
  normalizeName,
  isValidEmail,
  isValidRole,
  hashPassword,
  verifyPassword
} = require("../lib/auth");

const router = express.Router();

function safeNext(nextUrl) {
  const n = String(nextUrl || "");
  if (!n.startsWith("/")) return "/shop";
  if (n.startsWith("//")) return "/shop";
  return n;
}

router.get("/sign-up", (req, res) => {
  res.render("auth/sign-up", {
    title: "Sign up",
    error: null,
    next: safeNext(req.query.next),
    form: { email: "", display_name: "", role: "buyer" }
  });
});

router.post("/sign-up", async (req, res) => {
  const db = getDb();
  const next = safeNext(req.body.next);

  const email = normalizeEmail(req.body.email);
  const displayName = normalizeName(req.body.display_name);
  const role = String(req.body.role || "buyer");
  const password = String(req.body.password || "");

  const form = { email, display_name: displayName, role };

  if (!email || !displayName || !password) {
    return res.status(400).render("auth/sign-up", {
      title: "Sign up",
      error: "Please fill in all fields.",
      next,
      form
    });
  }
  if (!isValidEmail(email)) {
    return res.status(400).render("auth/sign-up", {
      title: "Sign up",
      error: "Please enter a valid email.",
      next,
      form
    });
  }
  if (!isValidRole(role) || role === "admin") {
    return res.status(400).render("auth/sign-up", {
      title: "Sign up",
      error: "Invalid account type.",
      next,
      form
    });
  }

  let passwordHash;
  try {
    passwordHash = await hashPassword(password);
  } catch (e) {
    return res.status(400).render("auth/sign-up", {
      title: "Sign up",
      error: e?.message || "Invalid password.",
      next,
      form
    });
  }

  try {
    const result = db
      .prepare(
        `INSERT INTO users (email, display_name, password_hash, role)
         VALUES (?, ?, ?, ?)`
      )
      .run(email, displayName, passwordHash, role);

    req.session.user = {
      id: Number(result.lastInsertRowid),
      email,
      display_name: displayName,
      role
    };
    res.redirect(next);
  } catch (e) {
    const isUnique = String(e?.message || "").toLowerCase().includes("unique");
    return res.status(409).render("auth/sign-up", {
      title: "Sign up",
      error: isUnique ? "That email is already in use." : "Sign up failed.",
      next,
      form
    });
  }
});

router.get("/sign-in", (req, res) => {
  res.render("auth/sign-in", {
    title: "Sign in",
    error: null,
    next: safeNext(req.query.next),
    form: { email: "" }
  });
});

router.post("/sign-in", async (req, res) => {
  const db = getDb();
  const next = safeNext(req.body.next);

  const email = normalizeEmail(req.body.email);
  const password = String(req.body.password || "");

  const form = { email };

  if (!email || !password) {
    return res.status(400).render("auth/sign-in", {
      title: "Sign in",
      error: "Please enter email and password.",
      next,
      form
    });
  }

  const user = db
    .prepare(
      `SELECT id, email, display_name, password_hash, role
       FROM users
       WHERE email = ?`
    )
    .get(email);

  if (!user) {
    return res.status(401).render("auth/sign-in", {
      title: "Sign in",
      error: "Invalid email or password.",
      next,
      form
    });
  }

  const ok = await verifyPassword(password, user.password_hash);
  if (!ok) {
    return res.status(401).render("auth/sign-in", {
      title: "Sign in",
      error: "Invalid email or password.",
      next,
      form
    });
  }

  req.session.user = {
    id: Number(user.id),
    email: user.email,
    display_name: user.display_name,
    role: user.role
  };
  res.redirect(next);
});

router.post("/sign-out", (req, res) => {
  const next = safeNext(req.body.next);
  req.session.user = null;
  res.redirect(next);
});

module.exports = router;

