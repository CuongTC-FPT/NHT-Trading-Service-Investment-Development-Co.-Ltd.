-- PostgreSQL schema used by the NHT website
CREATE TABLE IF NOT EXISTS legal_documents (
  id UUID PRIMARY KEY,
  title VARCHAR(250) NOT NULL,
  summary VARCHAR(600) NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  document_number VARCHAR(100) NOT NULL DEFAULT '',
  issuing_body VARCHAR(200) NOT NULL DEFAULT '',
  issued_date DATE,
  effective_date DATE,
  source_url VARCHAR(2000) NOT NULL DEFAULT '',
  image_url VARCHAR(500) NOT NULL DEFAULT '',
  image_public_id VARCHAR(300) NOT NULL DEFAULT '',
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  created_by VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_legal_documents_public
  ON legal_documents(status, published_at DESC, created_at DESC);
