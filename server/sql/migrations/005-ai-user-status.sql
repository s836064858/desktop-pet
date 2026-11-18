SET @sproutkin_ddl = IF(
  EXISTS(SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ai_users' AND COLUMN_NAME = 'is_ai_disabled'),
  'DO 0',
  'ALTER TABLE ai_users ADD COLUMN is_ai_disabled TINYINT UNSIGNED NOT NULL DEFAULT 0'
);
PREPARE sproutkin_statement FROM @sproutkin_ddl;
EXECUTE sproutkin_statement;
DEALLOCATE PREPARE sproutkin_statement;
SET @sproutkin_ddl = NULL;
