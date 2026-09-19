-- Promos automáticas diarias: chats de grupo donde el bot es admin (por tienda)
CREATE TABLE IF NOT EXISTS store_promo_chats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    store_id INTEGER NOT NULL,
    chat_id INTEGER NOT NULL,
    chat_title TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    last_sent_key TEXT,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    UNIQUE(store_id, chat_id),
    FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
);

-- Configuración de promos automáticas por tienda (zona horaria en minutos UTC, ej -180 = UTC-3):
ALTER TABLE stores ADD COLUMN promo_enabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE stores ADD COLUMN promo_timezone INTEGER NOT NULL DEFAULT -180;