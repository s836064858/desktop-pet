export const BASE_SCHEMA = [
  `CREATE TABLE IF NOT EXISTS plant (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      species_code TEXT NOT NULL,
      nickname TEXT NOT NULL,
      adopted_at INTEGER NOT NULL,
      water_interval_h INTEGER NOT NULL,
      sun_interval_h INTEGER NOT NULL
    )`,
  `CREATE TABLE IF NOT EXISTS care_task (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plant_id INTEGER NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('water','sun')),
      scheduled_at INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending'
        CHECK(status IN ('pending','reminded','overdue','done','done_late')),
      snooze_count INTEGER NOT NULL DEFAULT 0,
      completed_at INTEGER,
      UNIQUE(plant_id, type, scheduled_at)
    )`,
  `CREATE TABLE IF NOT EXISTS points_ledger (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      delta INTEGER NOT NULL,
      reason TEXT NOT NULL,
      ref_task_id INTEGER,
      created_at INTEGER NOT NULL
    )`,
  `CREATE TABLE IF NOT EXISTS streak (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      current_count INTEGER NOT NULL DEFAULT 0,
      longest_count INTEGER NOT NULL DEFAULT 0,
      last_done_date TEXT
    )`,
] as const

export const POINTS_ONTIME = 10
export const POINTS_EARLY = 8
export const POINTS_LATE = 5
export const DAILY_POINTS_CAP = 20

// 独立表按 plant_id 初始化一次。保留植物、已完成养护及全部积分历史。
export const GROWTH_SCHEMA = [
  `CREATE TABLE IF NOT EXISTS plant_growth (
    plant_id INTEGER PRIMARY KEY,
    started_at INTEGER NOT NULL,
    care_profile TEXT,
    confirmed_at INTEGER
  )`,
  `CREATE TABLE IF NOT EXISTS daily_inspection (
    plant_id INTEGER NOT NULL,
    day_key TEXT NOT NULL,
    water TEXT NOT NULL CHECK(water IN ('moist','watered','needs-water','unknown')),
    light TEXT NOT NULL CHECK(light IN ('suitable','adjusted','needs-adjustment','unknown')),
    is_complete INTEGER NOT NULL CHECK(is_complete IN (0,1)),
    created_at INTEGER NOT NULL,
    PRIMARY KEY(plant_id, day_key)
  )`,
  `CREATE TABLE IF NOT EXISTS care_result (
    task_id INTEGER PRIMARY KEY,
    observation TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )`,
  `CREATE TRIGGER IF NOT EXISTS init_plant_growth AFTER INSERT ON plant
    BEGIN INSERT OR IGNORE INTO plant_growth (plant_id, started_at) VALUES (NEW.id, NEW.adopted_at); END`,
  `INSERT OR IGNORE INTO plant_growth (plant_id, started_at)
    SELECT id, CAST(strftime('%s','now') AS INTEGER) * 1000 FROM plant`,
  `CREATE TABLE IF NOT EXISTS simplified_care_schedule (
    plant_id INTEGER PRIMARY KEY,
    converted_at INTEGER NOT NULL
  )`,
  `CREATE TRIGGER IF NOT EXISTS reset_legacy_care_schedule AFTER INSERT ON simplified_care_schedule
    BEGIN DELETE FROM care_task WHERE plant_id = NEW.plant_id AND status IN ('pending','reminded','overdue'); END`,
  `CREATE TRIGGER IF NOT EXISTS init_simple_care_schedule AFTER INSERT ON plant
    BEGIN INSERT OR IGNORE INTO simplified_care_schedule (plant_id, converted_at) VALUES (NEW.id, NEW.adopted_at); END`,
  `INSERT OR IGNORE INTO simplified_care_schedule (plant_id, converted_at)
    SELECT id, CAST(strftime('%s','now') AS INTEGER) * 1000 FROM plant`,
  // 与任务状态、积分处于同一次 SQLite 更新；任一步失败，整次完成自动回滚。
  `CREATE TRIGGER IF NOT EXISTS care_task_daily_growth_v1
    AFTER UPDATE OF status ON care_task
    WHEN OLD.status IN ('pending','reminded','overdue') AND NEW.status IN ('done','done_late')
    BEGIN
      INSERT INTO daily_inspection (plant_id, day_key, water, light, is_complete, created_at)
      SELECT NEW.plant_id, date(NEW.completed_at / 1000, 'unixepoch', 'localtime'),
        'unknown', 'unknown', 1, NEW.completed_at FROM plant_growth
      WHERE plant_id = NEW.plant_id AND plant_id = (SELECT id FROM plant ORDER BY id LIMIT 1)
      ON CONFLICT(plant_id, day_key) DO UPDATE SET is_complete = 1
        WHERE daily_inspection.is_complete = 0;
    END`,
] as const

// 完成任务与积分入账在同一 SQLite 语句中提交，跨窗完成不同任务也不能突破日上限。
export const CARE_POINTS_TRIGGER = `CREATE TRIGGER IF NOT EXISTS care_task_points_v2
  AFTER UPDATE OF status ON care_task
  WHEN OLD.status IN ('pending','reminded','overdue') AND NEW.status IN ('done','done_late')
  BEGIN
    INSERT INTO points_ledger (delta, reason, ref_task_id, created_at)
    SELECT MAX(0, MIN(
      CASE OLD.status WHEN 'pending' THEN ${POINTS_EARLY} WHEN 'overdue' THEN ${POINTS_LATE} ELSE ${POINTS_ONTIME} END,
      ${DAILY_POINTS_CAP} - COALESCE((SELECT SUM(delta) FROM points_ledger
        WHERE created_at >= CAST(strftime('%s', NEW.completed_at / 1000, 'unixepoch',
          'localtime', 'start of day', 'utc') AS INTEGER) * 1000
        AND created_at < CAST(strftime('%s', NEW.completed_at / 1000, 'unixepoch',
          'localtime', 'start of day', '+1 day', 'utc') AS INTEGER) * 1000), 0)
    )),
    (CASE OLD.status WHEN 'pending' THEN '提前·' WHEN 'overdue' THEN '补做·' ELSE '按时·' END) || NEW.type,
    NEW.id, NEW.completed_at;
    INSERT INTO streak (id, current_count, longest_count, last_done_date)
      VALUES (1, 1, 1, date(NEW.completed_at / 1000, 'unixepoch', 'localtime'))
      ON CONFLICT(id) DO UPDATE SET
        current_count = CASE
          WHEN last_done_date = excluded.last_done_date THEN current_count
          WHEN last_done_date = date(NEW.completed_at / 1000, 'unixepoch', 'localtime', '-1 day') THEN current_count + 1
          ELSE 1 END,
        longest_count = MAX(longest_count, CASE
          WHEN last_done_date = excluded.last_done_date THEN current_count
          WHEN last_done_date = date(NEW.completed_at / 1000, 'unixepoch', 'localtime', '-1 day') THEN current_count + 1
          ELSE 1 END),
        last_done_date = excluded.last_done_date;
  END`
