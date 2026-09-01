// Ma'lumotlar doimiy saqlanishi uchun PostgreSQL (Neon.tech bepul tarifi) ishlatiladi.
// DATABASE_URL muhit o'zgaruvchisi .env faylida yoki Render'da sozlanishi shart.
require('dotenv').config();
const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  console.warn('[db] OGOHLANTIRISH: DATABASE_URL topilmadi. .env faylida sozlang (Neon.tech connection string).');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('localhost')
    ? false
    : { rejectUnauthorized: false },
});

async function init() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      login TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      password_plain TEXT,
      role TEXT NOT NULL DEFAULT 'viewer',
      allowed_spots TEXT NOT NULL DEFAULT '[]',
      allowed_sections TEXT NOT NULL DEFAULT '["kpi","daily_sales","bonus_table","cash"]',
      is_active INTEGER NOT NULL DEFAULT 1,
      last_login_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS daily_bonus (
      id SERIAL PRIMARY KEY,
      date TEXT NOT NULL,
      spot_id INTEGER NOT NULL,
      category TEXT NOT NULL,
      quantity REAL NOT NULL,
      bonus INTEGER NOT NULL,
      cash_diff_ok INTEGER NOT NULL DEFAULT 1,
      updated_at TIMESTAMP DEFAULT now(),
      UNIQUE(date, spot_id, category)
    );

    CREATE TABLE IF NOT EXISTS cash_entries (
      id SERIAL PRIMARY KEY,
      date TEXT NOT NULL,
      spot_id INTEGER NOT NULL,
      entered_amount INTEGER NOT NULL DEFAULT 0,
      poster_total INTEGER NOT NULL DEFAULT 0,
      diff_percent REAL NOT NULL DEFAULT 0,
      ok INTEGER NOT NULL DEFAULT 1,
      entered_by INTEGER,
      created_at TIMESTAMP DEFAULT now(),
      UNIQUE(date, spot_id)
    );

    CREATE TABLE IF NOT EXISTS bonus_config_overrides (
      category TEXT NOT NULL,
      tier_index INTEGER NOT NULL,
      bonus INTEGER NOT NULL,
      updated_at TIMESTAMP DEFAULT now(),
      PRIMARY KEY (category, tier_index)
    );

    CREATE TABLE IF NOT EXISTS spot_category_config (
      spot_id INTEGER NOT NULL,
      category TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      updated_at TIMESTAMP DEFAULT now(),
      PRIMARY KEY (spot_id, category)
    );

    CREATE TABLE IF NOT EXISTS poster_client_mapping (
      spot_id INTEGER NOT NULL,
      channel_key TEXT NOT NULL,
      poster_client_id TEXT NOT NULL,
      updated_at TIMESTAMP DEFAULT now(),
      PRIMARY KEY (spot_id, channel_key)
    );
  `);

  // Eski bazalarda yangi ustunlar bo'lmasligi mumkin - xavfsiz migratsiya
  await pool.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active INTEGER NOT NULL DEFAULT 1;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS password_plain TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS allowed_sections TEXT NOT NULL DEFAULT '["kpi","daily_sales","bonus_table","cash"]';
    ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP;

    ALTER TABLE cash_entries ADD COLUMN IF NOT EXISTS expenses TEXT NOT NULL DEFAULT '[]';
    ALTER TABLE cash_entries ADD COLUMN IF NOT EXISTS banknotes TEXT NOT NULL DEFAULT '{}';
    ALTER TABLE cash_entries ADD COLUMN IF NOT EXISTS payment_types TEXT NOT NULL DEFAULT '{}';
    ALTER TABLE cash_entries ADD COLUMN IF NOT EXISTS toza INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE cash_entries ADD COLUMN IF NOT EXISTS total_expense INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE cash_entries ADD COLUMN IF NOT EXISTS total_paytypes INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE cash_entries ADD COLUMN IF NOT EXISTS total_amount INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE cash_entries ADD COLUMN IF NOT EXISTS poster_snapshot TEXT;
    ALTER TABLE cash_entries ADD COLUMN IF NOT EXISTS poster_synced_at TIMESTAMP;
  `);
}

const ready = init().catch((e) => {
  console.error('[db] Jadvallarni yaratishda xato:', e.message);
});

module.exports = { pool, ready };
