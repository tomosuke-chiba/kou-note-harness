-- Note Harness — D1 Schema
-- Content gating tables for static blog platform

CREATE TABLE IF NOT EXISTS content_gates (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL,
  gate_type TEXT NOT NULL CHECK (gate_type IN ('x_engagement', 'line_friend', 'token', 'stripe', 'compound')),
  x_harness_url TEXT,
  x_harness_api_key TEXT,
  x_gate_id TEXT,
  line_harness_url TEXT,
  line_harness_api_key TEXT,
  line_tracked_link_id TEXT,
  stripe_price_cents INTEGER,
  stripe_currency TEXT DEFAULT 'JPY',
  compound_steps TEXT,              -- JSON array: ["line_friend", "stripe"] — gates to complete in order
  preview_paragraphs INTEGER DEFAULT 3,
  cta_text TEXT DEFAULT 'Unlock full article',
  cta_url TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_content_gates_slug ON content_gates(slug);

CREATE TABLE IF NOT EXISTS gate_unlocks (
  id TEXT PRIMARY KEY,
  gate_id TEXT NOT NULL REFERENCES content_gates(id) ON DELETE CASCADE,
  unlock_token TEXT NOT NULL UNIQUE,
  source_type TEXT NOT NULL CHECK (source_type IN ('x_harness', 'line_harness', 'token', 'stripe', 'manual')),
  source_user_id TEXT,
  source_username TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_gate_unlocks_gate ON gate_unlocks(gate_id);
CREATE INDEX IF NOT EXISTS idx_gate_unlocks_token ON gate_unlocks(unlock_token);

CREATE TABLE IF NOT EXISTS page_views (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL,
  referrer TEXT,
  user_agent TEXT,
  country TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_page_views_slug ON page_views(slug);
CREATE INDEX IF NOT EXISTS idx_page_views_created ON page_views(created_at);

CREATE TABLE IF NOT EXISTS gated_content (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  html TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now'))
);
