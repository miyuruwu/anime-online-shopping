# Anime Shop (Node.js)

Anime-themed online shopping demo built with **Node.js + Express + SQLite + EJS**.

## Features
- Home page with anime-goods sections (Figures, Mousepads, Manga, Light Novels, etc.)
- Category browsing + search
- Product detail page
- Cart (session-based) + quantity updates
- Checkout (mock) that creates an order record

## Requirements
- Node.js 20+ recommended

## Run locally
From `anime-shop-js/`:

```bash
npm install
npm run db:seed
npm run dev
```

Then open `http://localhost:3000`.

## Notes
- This is a starter/demo shop (no real payments).
- Data is stored in `data/anime_shop.sqlite`.

