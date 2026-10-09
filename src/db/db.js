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
  // Neon "uxlab" turgan bazani uyg'otish bir necha soniya olishi mumkin - cheksiz kutmaymiz
  connectionTimeoutMillis: 20000,
});

// MUHIM: bo'sh turgan ulanish bazadan uzilsa (Neon qayta ishga tushganda/yangilanganda,
// tarmoq uzilishida) pg "error" hodisasi chiqaradi. Unga tinglovchi bo'lmasa, Node butun
// serverni to'xtatib qo'yadi. Biz uni faqat yozib qo'yamiz - pool uzilgan ulanishni o'zi
// chiqarib tashlab, keyingi so'rovda yangisini ochadi.
pool.on('error', (err) => {
  console.error('[db] Bo\'sh ulanishda xato (server ishlashda davom etadi):', err.message);
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
      allowed_sections TEXT NOT NULL DEFAULT '["kpi","daily_sales","bonus_table","cash","savdo","login_history","portsiya"]',
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
      min_override INTEGER,
      max_override INTEGER,
      updated_at TIMESTAMP DEFAULT now(),
      PRIMARY KEY (category, tier_index)
    );

    -- Tarif versiyalari: har bir yozuv "shu sanadan boshlab amal qiladigan to'liq tarif"
    CREATE TABLE IF NOT EXISTS bonus_config_versions (
      effective_from TEXT PRIMARY KEY,
      snapshot TEXT NOT NULL,
      updated_at TIMESTAMP DEFAULT now()
    );

    -- Tarif o'zgarishlari tarixi (admin ko'radi)
    CREATE TABLE IF NOT EXISTS bonus_config_changes (
      id SERIAL PRIMARY KEY,
      created_at TIMESTAMP DEFAULT now(),
      user_login TEXT,
      category TEXT NOT NULL,
      effective_from TEXT NOT NULL,
      effective_to TEXT,
      summary TEXT NOT NULL,
      recalculated_days INTEGER NOT NULL DEFAULT 0
    );

    -- Poster'dagi kassa ma'lumoti keyin o'zgarganda (masalan chek o'chirilsa) yozib boriladi (faqat admin ko'radi)
    CREATE TABLE IF NOT EXISTS poster_change_log (
      id SERIAL PRIMARY KEY,
      detected_at TIMESTAMP DEFAULT now(),
      date TEXT NOT NULL,
      spot_id INTEGER NOT NULL,
      old_total DOUBLE PRECISION NOT NULL,
      new_total DOUBLE PRECISION NOT NULL,
      details TEXT,
      status_before INTEGER,
      status_after INTEGER
    );

    -- Telegram bot: guruhlar (admin /guruh buyrug'i bilan ulaydi) va avtomatik hisobotlar
    CREATE TABLE IF NOT EXISTS bot_groups (
      chat_id BIGINT PRIMARY KEY,
      title TEXT,
      registered_by TEXT,
      registered_at TIMESTAMP DEFAULT now(),
      is_active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS auto_reports (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      report_key TEXT NOT NULL DEFAULT 'k',
      send_time TEXT NOT NULL DEFAULT '08:00',
      period TEXT NOT NULL DEFAULT 'yesterday',
      lang TEXT NOT NULL DEFAULT 'uz',
      spot_ids TEXT NOT NULL DEFAULT '[]',
      user_ids TEXT NOT NULL DEFAULT '[]',
      group_ids TEXT NOT NULL DEFAULT '[]',
      enabled INTEGER NOT NULL DEFAULT 1,
      last_sent_date TEXT,
      created_by TEXT,
      created_at TIMESTAMP DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS auto_report_log (
      id SERIAL PRIMARY KEY,
      created_at TIMESTAMP DEFAULT now(),
      auto_id INTEGER,
      report_name TEXT,
      target_type TEXT,
      target_label TEXT,
      status TEXT NOT NULL,
      detail TEXT,
      manual INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS login_history (
      id SERIAL PRIMARY KEY,
      user_id INTEGER,
      login TEXT NOT NULL,
      role TEXT,
      logged_in_at TIMESTAMP DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS portion_ingredients (
      id SERIAL PRIMARY KEY,
      display_name TEXT NOT NULL,
      poster_ingredient_id TEXT NOT NULL,
      poster_ingredient_name TEXT,
      created_at TIMESTAMP DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS portion_entries (
      id SERIAL PRIMARY KEY,
      date TEXT NOT NULL,
      spot_id INTEGER NOT NULL,
      values_json TEXT NOT NULL,
      poster_snapshot TEXT,
      poster_synced_at TIMESTAMP,
      entered_by TEXT,
      created_at TIMESTAMP DEFAULT now(),
      UNIQUE (date, spot_id)
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

    CREATE TABLE IF NOT EXISTS poster_payment_methods (
      payment_method_id TEXT PRIMARY KEY,
      channel_key TEXT NOT NULL,
      label TEXT,
      updated_at TIMESTAMP DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TIMESTAMP DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS product_category_overrides (
      poster_product_id TEXT PRIMARY KEY,
      product_name TEXT,
      category TEXT NOT NULL,
      updated_at TIMESTAMP DEFAULT now()
    );
  `);

  // Eski bazalarda yangi ustunlar bo'lmasligi mumkin - xavfsiz migratsiya
  await pool.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active INTEGER NOT NULL DEFAULT 1;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS password_plain TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS allowed_sections TEXT NOT NULL DEFAULT '["kpi","daily_sales","bonus_table","cash","savdo","login_history","portsiya"]';
    ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_username TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_id BIGINT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_lang TEXT NOT NULL DEFAULT 'uz';
    ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_linked_at TIMESTAMP;

    ALTER TABLE cash_entries ADD COLUMN IF NOT EXISTS expenses TEXT NOT NULL DEFAULT '[]';
    ALTER TABLE cash_entries ADD COLUMN IF NOT EXISTS banknotes TEXT NOT NULL DEFAULT '{}';
    ALTER TABLE cash_entries ADD COLUMN IF NOT EXISTS payment_types TEXT NOT NULL DEFAULT '{}';
    ALTER TABLE cash_entries ADD COLUMN IF NOT EXISTS toza INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE cash_entries ADD COLUMN IF NOT EXISTS total_expense INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE cash_entries ADD COLUMN IF NOT EXISTS total_paytypes INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE cash_entries ADD COLUMN IF NOT EXISTS total_amount INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE cash_entries ADD COLUMN IF NOT EXISTS poster_snapshot TEXT;
    ALTER TABLE cash_entries ADD COLUMN IF NOT EXISTS poster_synced_at TIMESTAMP;

    ALTER TABLE bonus_config_overrides ADD COLUMN IF NOT EXISTS min_override INTEGER;
    ALTER TABLE bonus_config_overrides ADD COLUMN IF NOT EXISTS max_override INTEGER;

    -- Kassa solishtirish natijasi (bonus holati uchun yagona manba)
    ALTER TABLE cash_entries ADD COLUMN IF NOT EXISTS check_ok INTEGER;
    ALTER TABLE cash_entries ADD COLUMN IF NOT EXISTS check_diff_percent DOUBLE PRECISION;
    ALTER TABLE cash_entries ADD COLUMN IF NOT EXISTS checked_at TIMESTAMP;

    -- Sessiya davomiyligi (kirish tarixi): oxirgi signal, faol/fonda soniyalari
    ALTER TABLE login_history ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMP;
    ALTER TABLE login_history ADD COLUMN IF NOT EXISTS visible_seconds INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE login_history ADD COLUMN IF NOT EXISTS hidden_seconds INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE login_history ADD COLUMN IF NOT EXISTS last_state TEXT;
  `);

  // portion_entries.date avval DATE turida edi (API'da "2026-09-30T00:00:00.000Z" bo'lib
  // chiqardi). Boshqa jadvallar bilan bir xil bo'lishi uchun matnga ('YYYY-MM-DD') o'tkazamiz.
  // Faqat hali DATE bo'lsa ishlaydi - qayta ishga tushirganda hech narsa o'zgarmaydi.
  await pool.query(`
    ALTER TABLE auto_reports ADD COLUMN IF NOT EXISTS category_names TEXT NOT NULL DEFAULT '[]';
    ALTER TABLE auto_reports ADD COLUMN IF NOT EXISTS hide_amounts INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE auto_reports ADD COLUMN IF NOT EXISTS output_format TEXT NOT NULL DEFAULT 'pdf';

    CREATE UNIQUE INDEX IF NOT EXISTS users_telegram_id_uq ON users (telegram_id) WHERE telegram_id IS NOT NULL;

    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'portion_entries' AND column_name = 'date' AND data_type = 'date'
      ) THEN
        ALTER TABLE portion_entries ALTER COLUMN date TYPE TEXT USING to_char(date, 'YYYY-MM-DD');
        -- Eski keshlangan Poster qoldiqlari noto'g'ri sana (hisoblangan kun) bilan olingan edi -
        -- bir martalik tozalash: keyingi ochilishda kiritilgan kun sanasi bilan qayta hisoblanadi.
        UPDATE portion_entries SET poster_snapshot = NULL, poster_synced_at = NULL;
      END IF;
    END $$;
  `);
}

const ready = init().catch((e) => {
  console.error('[db] Jadvallarni yaratishda xato:', e.message);
});

module.exports = { pool, ready };
