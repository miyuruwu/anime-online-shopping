const path = require("node:path");
const express = require("express");
const session = require("express-session");
const helmet = require("helmet");
const morgan = require("morgan");

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
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "..", "public")));

app.use(
  session({
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

app.use((req, res, next) => {
  res.locals.formatMoney = formatMoney;
  res.locals.currentPath = req.path;
  res.locals.user = req.session?.user || null;
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

const port = Number(process.env.PORT || 3000);
app.listen(port, () => {
  console.log(`Anime Shop running on http://localhost:${port}`);
});

