const path = require("node:path");
const fs = require("node:fs");
const Database = require("better-sqlite3");

const dataDir = path.join(process.cwd(), "data");
const dbPath = path.join(dataDir, "anime_shop.sqlite");
const schemaPath = path.join(__dirname, "schema.sql");

function ensureDataDir() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
}

let _db;

function getDb() {
  if (_db) return _db;
  ensureDataDir();
  _db = new Database(dbPath);
  _db.pragma("journal_mode = WAL");
  _db.pragma("foreign_keys = ON");
  if (fs.existsSync(schemaPath)) {
    // Ensure schema exists even if seed was not run yet.
    const schemaSql = fs.readFileSync(schemaPath, "utf8");
    _db.exec(schemaSql);
  }
  return _db;
}

module.exports = { getDb, dbPath };

