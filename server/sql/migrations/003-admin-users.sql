SET @sproutkin_ddl = IF(
  EXISTS(SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'admins' AND COLUMN_NAME = 'is_enabled'),
  'DO 0',
  'ALTER TABLE admins ADD COLUMN is_enabled TINYINT UNSIGNED NOT NULL DEFAULT 1'
);
PREPARE sproutkin_statement FROM @sproutkin_ddl;
EXECUTE sproutkin_statement;
DEALLOCATE PREPARE sproutkin_statement;

SET @sproutkin_ddl = IF(
  EXISTS(SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'admins' AND COLUMN_NAME = 'must_change_password'),
  'DO 0',
  'ALTER TABLE admins ADD COLUMN must_change_password TINYINT UNSIGNED NOT NULL DEFAULT 0'
);
PREPARE sproutkin_statement FROM @sproutkin_ddl;
EXECUTE sproutkin_statement;
DEALLOCATE PREPARE sproutkin_statement;

SET @sproutkin_ddl = IF(
  EXISTS(SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'admins' AND COLUMN_NAME = 'auth_version'),
  'DO 0',
  'ALTER TABLE admins ADD COLUMN auth_version INT UNSIGNED NOT NULL DEFAULT 1'
);
PREPARE sproutkin_statement FROM @sproutkin_ddl;
EXECUTE sproutkin_statement;
DEALLOCATE PREPARE sproutkin_statement;

SET @sproutkin_ddl = IF(
  EXISTS(SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'admin_sessions' AND COLUMN_NAME = 'auth_version'),
  'DO 0',
  'ALTER TABLE admin_sessions ADD COLUMN auth_version INT UNSIGNED NOT NULL DEFAULT 1'
);
PREPARE sproutkin_statement FROM @sproutkin_ddl;
EXECUTE sproutkin_statement;
DEALLOCATE PREPARE sproutkin_statement;

SET @sproutkin_ddl = NULL;

INSERT INTO admins (username, password_hash) VALUES ('admin', '')
ON DUPLICATE KEY UPDATE id = id;
