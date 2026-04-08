const fs = require("node:fs");
const path = require("node:path");
const { getDb } = require("./db");

function runSqlFile(db, filePath) {
  const sql = fs.readFileSync(filePath, "utf8");
  db.exec(sql);
}

function seed() {
  const db = getDb();
  const schemaPath = path.join(__dirname, "schema.sql");
  runSqlFile(db, schemaPath);

  const insertCategory = db.prepare(
    "INSERT OR IGNORE INTO categories (slug, name, emoji) VALUES (?, ?, ?)"
  );
  const categories = [
    ["figures", "Figures", "🧍"],
    ["mousepads", "Mousepads", "🖱️"],
    ["manga", "Manga", "📚"],
    ["light-novels", "Light Novels", "📖"],
    ["apparel", "Apparel", "👕"],
    ["keychains", "Keychains", "🔑"],
    ["plushies", "Plushies", "🧸"]
  ];
  const txCategories = db.transaction(() => {
    for (const c of categories) insertCategory.run(...c);
  });
  txCategories();

  const catBySlug = db
    .prepare("SELECT id, slug FROM categories")
    .all()
    .reduce((acc, row) => {
      acc[row.slug] = row.id;
      return acc;
    }, {});

  const upsertProduct = db.prepare(
    `INSERT INTO products
      (slug, name, description, price_cents, image_url, category_id, stock, is_featured)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(slug) DO UPDATE SET
       name = excluded.name,
       description = excluded.description,
       price_cents = excluded.price_cents,
       image_url = excluded.image_url,
       category_id = excluded.category_id,
       stock = excluded.stock,
       is_featured = excluded.is_featured`
  );

  function imageUrl(filename) {
    // Express static will serve these; encode to handle spaces safely.
    return `/images/${encodeURIComponent(filename)}`;
  }

  // Use local images (always load, no hotlink/CSP issues).
  const products = [
    [
      "seele-figure",
      "Seele figure",
      "A display-ready figure with vibrant colors and a solid base—perfect for any collector shelf.",
      16999,
      imageUrl("Seele figure.jpeg"),
      catBySlug["figures"],
      10,
      1
    ],
    [
      "hot-figure",
      "HoT figure",
      "Premium figure with crisp details and a glossy finish. Great as a centerpiece or gift.",
      14999,
      imageUrl("HoT figure.jpeg"),
      catBySlug["figures"],
      12,
      1
    ],
    [
      "dreamseeking-voyage-mouse-pad",
      "Dreamseeking Voyage Mouse Pad (Official)",
      "Smooth glide surface, stitched edges, and a premium print—desk setup instantly levels up.",
      3499,
      imageUrl("Dreamseeking-Voyage-mouse-pad-official-honkai-1.webp"),
      catBySlug["mousepads"],
      35,
      1
    ],
    [
      "bloom-into-you-manga",
      "Bloom Into You (Manga)",
      "A beloved romance manga with gorgeous art and a story that hits right in the heart.",
      1399,
      imageUrl("Bloom into you manga.jpeg"),
      catBySlug["manga"],
      90,
      1
    ],
    [
      "kimishinu-manga",
      "KimiShinu (Manga)",
      "A page-turner with stylish panels and a story that keeps pulling you forward.",
      1299,
      imageUrl("KimiShinu manga.jpg"),
      catBySlug["manga"],
      85,
      0
    ],
    [
      "shuukura-light-novel",
      "Shuukura (Light Novel)",
      "Light novel edition with crisp print and cozy pacing—perfect for late-night reading sessions.",
      1599,
      imageUrl("Shuukura light novel.png"),
      catBySlug["light-novels"],
      70,
      0
    ],
    [
      "watanare-light-novel",
      "Watanare (Light Novel)",
      "A fun light novel pick with charming characters and bingeable chapters.",
      1599,
      imageUrl("Watanare light novel.webp"),
      catBySlug["light-novels"],
      65,
      0
    ],
    [
      "hi3-key-chains",
      "HI3 key chains",
      "Acrylic keychains with bright colors—great for bags, keys, and gifting.",
      1499,
      imageUrl("HI3 key chains.webp"),
      catBySlug["keychains"],
      120,
      0
    ],
    [
      "kiana-hof-cosplay",
      "Kiana Herrscher of Finality Cosplay",
      "A full cosplay set for conventions and photoshoots. Looks amazing under neon lights.",
      8999,
      imageUrl("Kiana Herrscher of Finality cosplay.webp"),
      catBySlug["apparel"],
      15,
      1
    ],
    [
      "fumo-plush",
      "Fumo plush",
      "Soft plush with a cute expression—perfect desk buddy and photo prop.",
      2799,
      imageUrl("Fumo plush.jpg"),
      catBySlug["plushies"],
      40,
      1
    ]
  ];

  const txProducts = db.transaction(() => {
    const keepSlugs = products.map((p) => p[0]);
    // We purposely do NOT delete custom products to allow users to keep their own added items!
    for (const p of products) upsertProduct.run(...p);
  });
  txProducts();

  console.log("Seed complete.");
}

seed();

