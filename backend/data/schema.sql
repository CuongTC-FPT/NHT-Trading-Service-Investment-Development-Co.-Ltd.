-- SQLite schema used by the NHT website
CREATE TABLE legal_documents (
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

CREATE INDEX idx_legal_documents_public
  ON legal_documents(status, published_at DESC, created_at DESC);
