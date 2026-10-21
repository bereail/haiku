CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  author TEXT,
  cover TEXT,
  publisher TEXT,
  genre TEXT,
  isbn TEXT,
  pages INTEGER,
  year INTEGER,
  score INTEGER,
  notes TEXT,
  start_date DATE,
  end_date DATE,
  color TEXT,
  total_pages INTEGER,
  current_page INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  would_reread BOOLEAN DEFAULT FALSE
);

-- Migración: agregar would_reread a bases existentes
ALTER TABLE books ADD COLUMN IF NOT EXISTS would_reread BOOLEAN DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS user_settings (
  user_id     UUID        PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  goal_count  INTEGER     DEFAULT 0,
  goal_year   INTEGER     DEFAULT EXTRACT(YEAR FROM NOW())::int,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Migración: alias público de usuario para la comunidad
ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name TEXT;

CREATE TABLE IF NOT EXISTS community_posts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  book_id     UUID REFERENCES books(id) ON DELETE SET NULL,
  book_title  TEXT NOT NULL,
  book_author TEXT,
  book_cover  TEXT,
  book_score  INTEGER,
  reflection  TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, book_id)
);

CREATE TABLE IF NOT EXISTS community_comments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    UUID NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body       TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS community_likes (
  post_id    UUID NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (post_id, user_id)
);

-- Migración: catálogo bibliográfico público (Fase 2).
-- Aditiva por completo: no modifica ni elimina ninguna columna existente de `books`
-- ni de `community_posts`. El ejemplar personal (notas, fechas, puntaje) se sigue
-- guardando únicamente en `books`; estas tablas solo agregan un catálogo compartido
-- opcional al que un libro puede o no estar vinculado.

CREATE TABLE IF NOT EXISTS obras (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_title    TEXT NOT NULL,
  subjects           TEXT[],
  first_publish_year INTEGER,
  ol_work_key        TEXT,
  source             TEXT NOT NULL DEFAULT 'manual',
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS obras_ol_work_key_uq ON obras (ol_work_key) WHERE ol_work_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS autores (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  ol_author_key TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS autores_ol_key_uq ON autores (ol_author_key) WHERE ol_author_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS obra_autores (
  obra_id  UUID NOT NULL REFERENCES obras(id) ON DELETE CASCADE,
  autor_id UUID NOT NULL REFERENCES autores(id) ON DELETE CASCADE,
  PRIMARY KEY (obra_id, autor_id)
);
CREATE INDEX IF NOT EXISTS obra_autores_autor_idx ON obra_autores (autor_id);

CREATE TABLE IF NOT EXISTS ediciones (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id        UUID NOT NULL REFERENCES obras(id) ON DELETE CASCADE,
  title          TEXT,
  isbn_13        TEXT,
  isbn_10        TEXT,
  publisher      TEXT,
  publish_year   INTEGER,
  language       TEXT,
  pages          INTEGER,
  cover_url      TEXT,
  ol_edition_key TEXT,
  source         TEXT NOT NULL DEFAULT 'manual',
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS ediciones_ol_key_uq ON ediciones (ol_edition_key) WHERE ol_edition_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ediciones_isbn13_uq ON ediciones (isbn_13) WHERE isbn_13 IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ediciones_isbn10_uq ON ediciones (isbn_10) WHERE isbn_10 IS NOT NULL;
CREATE INDEX IF NOT EXISTS ediciones_obra_idx ON ediciones (obra_id);

ALTER TABLE books ADD COLUMN IF NOT EXISTS edition_id UUID REFERENCES ediciones(id);
CREATE INDEX IF NOT EXISTS books_edition_idx ON books (edition_id);

ALTER TABLE community_posts ADD COLUMN IF NOT EXISTS obra_id UUID REFERENCES obras(id);
CREATE INDEX IF NOT EXISTS community_posts_obra_idx ON community_posts (obra_id);
