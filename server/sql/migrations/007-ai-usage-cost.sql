SET @sproutkin_ddl = IF(
  EXISTS(SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ai_usage' AND COLUMN_NAME = 'cached_input_tokens'),
  'DO 0',
  'ALTER TABLE ai_usage ADD COLUMN cached_input_tokens INT UNSIGNED NULL'
);
PREPARE sproutkin_statement FROM @sproutkin_ddl;
EXECUTE sproutkin_statement;
DEALLOCATE PREPARE sproutkin_statement;

SET @sproutkin_ddl = IF(
  EXISTS(SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ai_usage' AND COLUMN_NAME = 'generated_images'),
  'DO 0',
  'ALTER TABLE ai_usage ADD COLUMN generated_images INT UNSIGNED NULL'
);
PREPARE sproutkin_statement FROM @sproutkin_ddl;
EXECUTE sproutkin_statement;
DEALLOCATE PREPARE sproutkin_statement;
SET @sproutkin_ddl = NULL;
