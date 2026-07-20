-- Create expo_push_tokens table for mobile push notifications
CREATE TABLE IF NOT EXISTS expo_push_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token TEXT NOT NULL UNIQUE,
  customer_id TEXT REFERENCES customer_profile(id_customer),
  order_session_id TEXT,
  platform TEXT NOT NULL DEFAULT 'android' CHECK(platform IN ('android', 'ios')),
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
  last_active_at TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
);

CREATE INDEX IF NOT EXISTS idx_expo_push_customer ON expo_push_tokens(customer_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_expo_push_token ON expo_push_tokens(token);
