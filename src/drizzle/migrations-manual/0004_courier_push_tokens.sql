-- Migration 0004: Add courier_id to expo_push_tokens

ALTER TABLE expo_push_tokens ADD COLUMN courier_id INTEGER REFERENCES couriers(id);
CREATE INDEX IF NOT EXISTS idx_expo_push_courier ON expo_push_tokens(courier_id);
