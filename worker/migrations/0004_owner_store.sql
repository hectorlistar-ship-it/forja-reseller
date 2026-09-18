-- Owner (dueño/superadmin) owns the default store so he can sell with
-- his own accounts and stock. reseller_id = 0 = owner (no reseller row).
UPDATE stores SET reseller_id = 0 WHERE slug = 'default';