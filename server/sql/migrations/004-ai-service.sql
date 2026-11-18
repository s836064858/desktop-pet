CREATE TABLE IF NOT EXISTS ai_settings (
  id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
  is_paused TINYINT UNSIGNED NOT NULL DEFAULT 0,
  credentials VARBINARY(1024) NULL,
  version INT UNSIGNED NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO ai_settings (id) VALUES (1) ON DUPLICATE KEY UPDATE id = id;

CREATE TABLE IF NOT EXISTS ai_storage_targets (
  version INT UNSIGNED NOT NULL PRIMARY KEY,
  bucket VARCHAR(63) CHARACTER SET ascii NOT NULL,
  region VARCHAR(32) CHARACTER SET ascii NOT NULL,
  credentials VARBINARY(1024) NOT NULL
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ai_users (
  id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
  label VARCHAR(48) NOT NULL,
  token_hash BINARY(32) NOT NULL UNIQUE,
  revoked_at DATETIME(3) NULL
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ai_invites (
  id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
  code_hash BINARY(32) NOT NULL UNIQUE,
  label VARCHAR(48) NOT NULL,
  user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  redeemed_token_hash BINARY(32) NULL,
  created_at DATETIME(3) NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  redeemed_at DATETIME(3) NULL,
  revoked_at DATETIME(3) NULL,
  INDEX idx_ai_invites_created (created_at, id),
  FOREIGN KEY (user_id) REFERENCES ai_users(id)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ai_drafts (
  user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
  id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL UNIQUE,
  state JSON NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  INDEX idx_ai_drafts_expiry (expires_at),
  FOREIGN KEY (user_id) REFERENCES ai_users(id)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ai_jobs (
  id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
  operation_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  draft_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  type ENUM('chat', 'image') NOT NULL,
  target VARCHAR(24) CHARACTER SET ascii NOT NULL,
  payload JSON NULL,
  status ENUM('queued', 'running', 'done', 'failed', 'unknown') NOT NULL,
  image_blob LONGBLOB NULL,
  error_message VARCHAR(240) NULL,
  created_at DATETIME(3) NOT NULL,
  started_at DATETIME(3) NULL,
  finished_at DATETIME(3) NULL,
  INDEX idx_ai_jobs_worker (status, created_at, id),
  INDEX idx_ai_jobs_draft (draft_id, status),
  INDEX idx_ai_jobs_expiry (finished_at),
  UNIQUE KEY uq_ai_operation_target (user_id, operation_id, target),
  FOREIGN KEY (user_id) REFERENCES ai_users(id)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ai_assets (
  id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
  user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  target_version INT UNSIGNED NOT NULL,
  object_key VARCHAR(160) CHARACTER SET ascii NOT NULL,
  download_url VARCHAR(120) CHARACTER SET ascii NOT NULL,
  version_id VARCHAR(256) CHARACTER SET ascii NULL,
  byte_length INT UNSIGNED NOT NULL,
  is_ready TINYINT UNSIGNED NOT NULL DEFAULT 0,
  expires_at DATETIME(3) NOT NULL,
  INDEX idx_ai_assets_expiry (expires_at),
  FOREIGN KEY (user_id) REFERENCES ai_users(id),
  FOREIGN KEY (target_version) REFERENCES ai_storage_targets(version)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ai_usage (
  job_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
  user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  model VARCHAR(96) CHARACTER SET ascii NOT NULL,
  type ENUM('chat', 'image') NOT NULL,
  result ENUM('running', 'success', 'failed', 'unknown') NOT NULL,
  input_tokens INT UNSIGNED NULL,
  output_tokens INT UNSIGNED NULL,
  started_at DATETIME(3) NOT NULL,
  finished_at DATETIME(3) NULL,
  INDEX idx_ai_usage_time (started_at, job_id),
  FOREIGN KEY (user_id) REFERENCES ai_users(id)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
