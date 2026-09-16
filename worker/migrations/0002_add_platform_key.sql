-- Add platform_key to binance_payments so a pending order knows which
-- platform the client bought (needed by the callback to assign an account).
ALTER TABLE binance_payments ADD COLUMN platform_key TEXT;
