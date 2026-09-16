-- ============================================================
-- Forja Reseller - Datos ficticios de demo (EDITABLE)
-- Ejecutar con:
--   npx wrangler d1 execute forja-reseller --remote --file=./seed/demo.sql
-- Usuarios de prueba:
--   Reseller (admin) : reseller_demo / Demo1234!
--   Cliente (tienda) : cliente_demo  / Cliente123!
--   Tienda           : http://.../tienda/default
-- ============================================================

PRAGMA foreign_keys = ON;

-- Limpieza idempotente (re-ejecutable)
DELETE FROM orders;
DELETE FROM binance_payments;
DELETE FROM accounts;
DELETE FROM store_platforms;
DELETE FROM clients;
DELETE FROM stores;
DELETE FROM resellers;

-- 1) Reseller (admin)
INSERT INTO resellers (id, username, password_hash, plan, max_stores, max_accounts_per_store, status)
VALUES (1, 'reseller_demo', 'pbkdf2$100000$fc18c21a9e44c95d488cd075c1418c3a$5dfe4d9dcbe18203c7c09a8f9e6ecf0120b88545312fb3915d7bbbb0aa263d98', 'pro', 3, 5000, 'active');

-- 2) Tienda (slug "default" = el que usa el storefront por defecto)
INSERT INTO stores (id, reseller_id, slug, name, wallet_binance, config_json, status)
VALUES (1, 1, 'default', 'Tienda Demo', 'TU_WALLET_BINANCE_AQUI', '{"theme":"dark","welcome":"Bienvenido a la tienda demo"}', 'active');

-- 3) Plataformas activas de la tienda
INSERT INTO store_platforms (store_id, platform_key, cost_price_usd, sale_price_usd, is_active) VALUES
(1, 'netflix', 3.5, 7,   1),
(1, 'hbo',     2.0, 5,   1),
(1, 'disney',  2.5, 6,   1),
(1, 'vix',     1.5, 4,   1),
(1, 'spotify', 1.5, 4,   1),
(1, 'youtube', 2.0, 5,   1);

-- 4) Cliente de la tienda
INSERT INTO clients (id, store_id, username, password_hash, email, status)
VALUES (1, 1, 'cliente_demo', 'pbkdf2$100000$42e4deeb6a17ccffbd2b60361baa6599$5b80c13fd0f6006c3f66b98aeb6bff8ac4ba7b9cb5a2e1a3952a591c7afda2b3', 'cliente@demo.com', 'active');

-- 5) Inventario ficticio (email / password en claro; decryptSecret lo devuelve tal cual)
INSERT INTO accounts (store_id, platform_key, email, password, notes, sold) VALUES
(1, 'netflix', 'netflix01@demo.com', 'Net#Pass01', 'Perfil 1 - 4K', 0),
(1, 'netflix', 'netflix02@demo.com', 'Net#Pass02', 'Perfil 2 - 4K', 0),
(1, 'netflix', 'netflix03@demo.com', 'Net#Pass03', 'Perfil 3 - 4K', 0),
(1, 'netflix', 'netflix04@demo.com', 'Net#Pass04', 'Perfil 4 - 4K', 0),
(1, 'netflix', 'netflix05@demo.com', 'Net#Pass05', 'Perfil 5 - 4K', 0),
(1, 'hbo',     'hbo01@demo.com',     'Hbo#Pass01', 'Cuenta completa', 0),
(1, 'hbo',     'hbo02@demo.com',     'Hbo#Pass02', 'Cuenta completa', 0),
(1, 'disney',  'disney01@demo.com',  'Dis#Pass01', 'Perfil A', 0),
(1, 'disney',  'disney02@demo.com',  'Dis#Pass02', 'Perfil B', 0),
(1, 'vix',     'vix01@demo.com',     'Vix#Pass01', 'Perfil unico', 0),
(1, 'spotify', 'spotify01@demo.com', 'Spo#Pass01', 'Premium individual', 0),
(1, 'spotify', 'spotify02@demo.com', 'Spo#Pass02', 'Premium individual', 0),
(1, 'youtube', 'youtube01@demo.com', 'You#Pass01', 'Premium individual', 0),
(1, 'youtube', 'youtube02@demo.com', 'You#Pass02', 'Premium individual', 0);

-- 6) Orden pendiente de prueba que debe casar con el pago REAL de Binance
--    (remitente del correo: Gabo_AMR, monto: 374.1 USDT)
INSERT INTO binance_payments (store_id, client_id, binance_user, usdt_amount, expected_amount, platform_key, status)
VALUES (1, 1, 'Gabo_AMR', 374.1, 374.1, 'netflix', 'pending');

-- 7) Wallet de recepción (editar por la wallet real)
UPDATE global_settings SET value = 'TU_WALLET_BINANCE_AQUI' WHERE key = 'binance_wallet';
