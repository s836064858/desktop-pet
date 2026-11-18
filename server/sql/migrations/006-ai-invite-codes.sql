SET @sproutkin_ddl = IF(
  EXISTS(SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ai_invites' AND COLUMN_NAME = 'code_cipher'),
  'DO 0',
  'ALTER TABLE ai_invites ADD COLUMN code_cipher VARBINARY(96) NULL'
);
PREPARE sproutkin_statement FROM @sproutkin_ddl;
EXECUTE sproutkin_statement;
DEALLOCATE PREPARE sproutkin_statement;
SET @sproutkin_ddl = NULL;
