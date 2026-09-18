-- Vendor self-service: Mi negocio settings
ALTER TABLE stores ADD COLUMN trc20_address TEXT;
ALTER TABLE stores ADD COLUMN bot_token TEXT;          -- encrypted
ALTER TABLE stores ADD COLUMN business_name TEXT;
ALTER TABLE stores ADD COLUMN gmail_user TEXT;
ALTER TABLE stores ADD COLUMN gmail_app_password TEXT; -- encrypted