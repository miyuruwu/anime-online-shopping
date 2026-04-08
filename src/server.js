require("dotenv").config();
const path = require("node:path");
const express = require("express");
const session = require("express-session");
const SQLiteStore = require("connect-sqlite3")(session);
const { csrfSync } = require("csrf-sync");
const helmet = require("helmet");
const morgan = require("morgan");

const { csrfSynchronisedProtection } = csrfSync({
  getTokenFromRequest: (req) => req.body.CSRFToken
});
const { formatMoney } = require("./lib/money");
const shopRoutes = require("./routes/shop");
const cartRoutes = require("./routes/cart");
const checkoutRoutes = require("./routes/checkout");
const authRoutes = require("./routes/auth");
const accountRoutes = require("./routes/account");

const app = express();

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(
  helmet({
    contentSecurityPolicy: false
  })
);
app.use(morgan("dev"));
app.use(express.urlencoded({ extended: true, limit: "5mb" }));
app.use(express.static(path.join(__dirname, "..", "public")));

app.use(
  session({
    store: new SQLiteStore({ dir: path.join(__dirname, '..', 'data'), db: 'sessions.sqlite' }),
    secret: process.env.SESSION_SECRET || "dev-secret-change-me",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 24 * 14
    }
  })
);

app.use(csrfSynchronisedProtection);

app.use((req, res, next) => {
  res.locals.formatMoney = formatMoney;
  res.locals.currentPath = req.path;
  res.locals.user = req.session?.user || null;
  res.locals.csrfToken = req.csrfToken();
  next();
});

app.get("/", (req, res) => res.redirect("/shop"));

app.use("/shop", shopRoutes);
app.use("/cart", cartRoutes);
app.use("/checkout", checkoutRoutes);
app.use("/auth", authRoutes);
app.use("/account", accountRoutes);

app.use((req, res) => {
  res.status(404).render("404", {
    title: "Not found",
    subtitle: "This page got isekai’d."
  });
});

app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).render("404", {
    title: "Server error",
    subtitle: err.message || "An unexpected error occurred."
  });
});

const port = Number(process.env.PORT || 3000);
app.listen(port, () => {
  console.log(`Anime Shop running on http://localhost:${port}`);
});
