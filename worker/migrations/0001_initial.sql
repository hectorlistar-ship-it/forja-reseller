-- Forja Reseller - Initial Schema
-- Multi-tenant: resellers -> stores -> clients/accounts/orders

-- Enable foreign keys
PRAGMA foreign_keys = ON;

-- ============================================
-- MASTER TABLES (global, single DB)
-- ============================================

-- Resellers (SuperAdmin creates these)
CREATE TABLE resellers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    plan TEXT NOT NULL DEFAULT 'basic', -- basic, pro, enterprise
    max_stores INTEGER NOT NULL DEFAULT 1,
    max_accounts_per_store INTEGER NOT NULL DEFAULT 1000,
    status TEXT NOT NULL DEFAULT 'active', -- active, suspended, expired
    expires_at INTEGER, -- unix timestamp
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

-- Plans configuration
CREATE TABLE plans (
    key TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    max_stores INTEGER NOT NULL,
    max_accounts_per_store INTEGER NOT NULL,
    price_usd_monthly REAL NOT NULL DEFAULT 0,
    features TEXT NOT NULL DEFAULT '{}' -- JSON
);

INSERT INTO plans (key, name, max_stores, max_accounts_per_store, price_usd_monthly, features) VALUES
('basic', 'Básico', 1, 1000, 0, '{"inventory": true, "orders": true, "binance": true, "telegram": true}'),
('pro', 'Profesional', 3, 5000, 29, '{"inventory": true, "orders": true, "binance": true, "telegram": true, "analytics": true, "webhooks": true}'),
('enterprise', 'Enterprise', 10, 20000, 99, '{"inventory": true, "orders": true, "binance": true, "telegram": true, "analytics": true, "webhooks": true, "api_access": true, "custom_domain": true}');

-- Global platforms catalog (SuperAdmin manages)
CREATE TABLE platforms (
    key TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL, -- streaming, software, gaming, etc.
    icon TEXT, -- lucide icon name
    cost_price_usd REAL NOT NULL DEFAULT 0, -- what reseller pays
    sale_price_usd REAL NOT NULL DEFAULT 0, -- what client pays
    is_active INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

INSERT INTO platforms (key, name, type, icon, cost_price_usd, sale_price_usd, sort_order) VALUES
('netflix', 'Netflix', 'streaming', 'tv', 3.5, 7, 1),
('hbo', 'HBO Max', 'streaming', 'film', 2, 5, 2),
('disney', 'Disney+', 'streaming', 'sparkles', 2.5, 6, 3),
('vix', 'Vix', 'streaming', 'tv', 1.5, 4, 4),
('spotify', 'Spotify Premium', 'music', 'music', 1.5, 4, 5),
('youtube', 'YouTube Premium', 'video', 'youtube', 2, 5, 6);

-- Global settings
CREATE TABLE global_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT
);

INSERT INTO global_settings (key, value, description) VALUES
('binance_wallet', 'TU_WALLET_BINANCE_AQUI', 'Wallet Binance donde reciben USDT los resellers'),
('credit_rate_usdt', '1', '1 USDT = X créditos'),
('maintenance_mode', 'false', 'Modo mantenimiento global');

-- ============================================
-- PER-STORE TABLES (prefixed by store_id in queries)
-- Using single DB with store_id column for simplicity
-- (D1 doesn't support multiple DBs per worker easily)
-- ============================================

-- Stores (each reseller can have multiple stores)
CREATE TABLE stores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reseller_id INTEGER NOT NULL,
    slug TEXT UNIQUE NOT NULL, -- URL: /tienda/:slug
    name TEXT NOT NULL,
    wallet_binance TEXT, -- wallet específica de la tienda
    config_json TEXT NOT NULL DEFAULT '{}', -- JSON: theme, messages, etc.
    status TEXT NOT NULL DEFAULT 'active',
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (reseller_id) REFERENCES resellers(id) ON DELETE CASCADE
);

-- Store platforms (override global prices per store)
CREATE TABLE store_platforms (
    store_id INTEGER NOT NULL,
    platform_key TEXT NOT NULL,
    cost_price_usd REAL, -- NULL = use global
    sale_price_usd REAL, -- NULL = use global
    is_active INTEGER NOT NULL DEFAULT 1,
    PRIMARY KEY (store_id, platform_key),
    FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
    FOREIGN KEY (platform_key) REFERENCES platforms(key) ON DELETE CASCADE
);

-- Inventory accounts (email:password per platform)
CREATE TABLE accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    store_id INTEGER NOT NULL,
    platform_key TEXT NOT NULL,
    email TEXT NOT NULL,
    password TEXT NOT NULL,
    notes TEXT, -- extra info (perfil, pin, etc.)
    sold INTEGER NOT NULL DEFAULT 0,
    sold_at INTEGER,
    client_id INTEGER, -- FK to clients
    order_id INTEGER, -- FK to orders
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    sold_by INTEGER, -- client_id who bought
    FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
);

CREATE INDEX idx_accounts_store_platform ON accounts(store_id, platform_key);
CREATE INDEX idx_accounts_sold ON accounts(sold);
CREATE INDEX idx_accounts_client ON accounts(client_id);

-- Clients (buyers)
CREATE TABLE clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    store_id INTEGER NOT NULL,
    username TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    status TEXT NOT NULL DEFAULT 'active', -- active, blocked
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    last_login_at INTEGER,
    FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
    UNIQUE(store_id, username)
);

CREATE INDEX idx_clients_store ON clients(store_id);

-- Orders (completed purchases)
CREATE TABLE orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    store_id INTEGER NOT NULL,
    client_id INTEGER NOT NULL,
    platform_key TEXT NOT NULL,
    account_id INTEGER NOT NULL,
    price_usd REAL NOT NULL, -- price paid by client
    cost_usd REAL NOT NULL, -- cost to reseller
    profit_usd REAL NOT NULL, -- price - cost
    status TEXT NOT NULL DEFAULT 'completed', -- completed, refunded, disputed
    binance_payment_id INTEGER, -- FK to binance_payments
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);

CREATE INDEX idx_orders_store ON orders(store_id);
CREATE INDEX idx_orders_client ON orders(client_id);
CREATE INDEX idx_orders_created ON orders(created_at);

-- Binance payments tracking
CREATE TABLE binance_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    store_id INTEGER NOT NULL,
    client_id INTEGER,
    binance_user TEXT NOT NULL, -- @username que pagó
    usdt_amount REAL NOT NULL,
    expected_amount REAL, -- lo que debía pagar
    status TEXT NOT NULL DEFAULT 'pending', -- pending, verified, failed, refunded
    raw_email TEXT, -- email original de Binance
    verified_at INTEGER,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
);

CREATE INDEX idx_binance_store ON binance_payments(store_id);
CREATE INDEX idx_binance_status ON binance_payments(status);
CREATE INDEX idx_binance_user ON binance_payments(binance_user);

-- Sessions (JWT tokens stored for revocation)
CREATE TABLE sessions (
    id TEXT PRIMARY KEY, -- jti
    store_id INTEGER, -- NULL for superadmin/reseller sessions (not store-scoped)
    user_type TEXT NOT NULL, -- 'superadmin', 'reseller', 'client'
    user_id INTEGER NOT NULL, -- superadmin id (0), reseller_id, or client_id
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    revoked INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_sessions_expires ON sessions(expires_at);
CREATE INDEX idx_sessions_user ON sessions(user_type, user_id);

-- Rate limiting
CREATE TABLE rate_limits (
    key TEXT PRIMARY KEY, -- IP or user_id
    count INTEGER NOT NULL DEFAULT 1,
    window_start INTEGER NOT NULL,
    blocked_until INTEGER DEFAULT 0
);

-- ============================================
-- VIEWS FOR COMMON QUERIES
-- ============================================

-- Store summary for SuperAdmin
CREATE VIEW v_store_summary AS
SELECT 
    s.id,
    s.slug,
    s.name,
    r.username as reseller_username,
    s.status,
    (SELECT COUNT(*) FROM accounts WHERE store_id = s.id AND sold = 0) as stock_available,
    (SELECT COUNT(*) FROM accounts WHERE store_id = s.id AND sold = 1) as stock_sold,
    (SELECT COUNT(*) FROM clients WHERE store_id = s.id) as total_clients,
    (SELECT COUNT(*) FROM orders WHERE store_id = s.id) as total_orders,
    (SELECT COALESCE(SUM(profit_usd), 0) FROM orders WHERE store_id = s.id) as total_profit,
    s.created_at
FROM stores s
JOIN resellers r ON s.reseller_id = r.id;

-- Client summary for ResellerAdmin
CREATE VIEW v_client_summary AS
SELECT 
    c.id,
    c.store_id,
    c.username,
    c.email,
    c.status,
    (SELECT COUNT(*) FROM orders WHERE client_id = c.id) as total_orders,
    (SELECT COALESCE(SUM(price_usd), 0) FROM orders WHERE client_id = c.id) as total_spent,
    c.created_at,
    c.last_login_at
FROM clients c;

-- Order details with relations
CREATE VIEW v_order_details AS
SELECT 
    o.*,
    c.username as client_username,
    c.email as client_email,
    p.name as platform_name,
    p.icon as platform_icon,
    a.email as account_email
FROM orders o
JOIN clients c ON o.client_id = c.id
JOIN platforms p ON o.platform_key = p.key
JOIN accounts a ON o.account_id = a.id;