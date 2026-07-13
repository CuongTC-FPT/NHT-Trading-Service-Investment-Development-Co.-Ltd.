const fs = require("fs");
const path = require("path");
const initSqlJs = require("sql.js");

const DATABASE_FILE = path.join(__dirname, "data", "nht.sqlite");

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS legal_documents (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    summary TEXT NOT NULL DEFAULT '',
    content TEXT NOT NULL DEFAULT '',
    document_number TEXT NOT NULL DEFAULT '',
    issuing_body TEXT NOT NULL DEFAULT '',
    issued_date TEXT,
    effective_date TEXT,
    source_url TEXT NOT NULL DEFAULT '',
    image_url TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'published')),
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    published_at TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_legal_documents_public
    ON legal_documents(status, published_at DESC, created_at DESC);
`;

async function createDatabase() {
  const SQL = await initSqlJs({
    locateFile: (file) => path.join(__dirname, "node_modules", "sql.js", "dist", file),
  });
  const database = fs.existsSync(DATABASE_FILE)
    ? new SQL.Database(fs.readFileSync(DATABASE_FILE))
    : new SQL.Database();

  database.run(SCHEMA);
  const columns = database.exec("PRAGMA table_info(legal_documents)")[0]?.values || [];
  const hasImageUrl = columns.some((column) => column[1] === "image_url");
  if (!hasImageUrl) {
    database.run("ALTER TABLE legal_documents ADD COLUMN image_url TEXT NOT NULL DEFAULT ''");
  }

  function save() {
    const directory = path.dirname(DATABASE_FILE);
    if (!fs.existsSync(directory)) fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(DATABASE_FILE, Buffer.from(database.export()));
  }

  save();
  return { database, save, databaseFile: DATABASE_FILE };
}

module.exports = { createDatabase };
