// "Kirish tarixi" bo'limi - endi to'liq ruxsat tizimiga (allowed_sections)
// bog'langan, faqat admin uchun emas. Lekin oddiy foydalanuvchilarga (viewer)
// admin'ning qachon kirgani ko'rsatilmaydi - bu backend darajasida filtrlanadi.

const express = require('express');
const { pool } = require('../db/db');
const { authRequired, requireSection } = require('../middleware/auth');

const router = express.Router();

router.use(authRequired, requireSection('login_history'));

// GET /api/login-history/users - filtr uchun foydalanuvchilar ro'yxati.
// Oddiy foydalanuvchiga faqat boshqa (admin bo'lmagan) foydalanuvchilar ko'rsatiladi.
router.get('/users', async (req, res) => {
  const isAdmin = req.user.role === 'admin';
  const query = isAdmin
    ? 'SELECT id, login FROM users ORDER BY login'
    : "SELECT id, login FROM users WHERE role != 'admin' ORDER BY login";
  const result = await pool.query(query);
  res.json({ users: result.rows });
});

const TIMEZONE_OFFSET_HOURS = Number(process.env.TIMEZONE_OFFSET_HOURS || 5);

// Toshkent kalendar kunining (00:00) boshlanishini UTC vaqtiga o'giradi
// ('YYYY-MM-DD HH:MM:SS' ko'rinishida; baza vaqtlari UTC'da saqlanadi).
// addDays=1 - keyingi kun 00:00 (kunning OXIRGI chegarasi, o'zi kirmaydi).
function tashkentDayStartUtc(dateStr, addDays = 0) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr || '');
  if (!m) return null;
  const ms = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + addDays, 0, 0, 0)
    - TIMEZONE_OFFSET_HOURS * 60 * 60 * 1000;
  return new Date(ms).toISOString().slice(0, 19).replace('T', ' ');
}

// Sessiya holati: oxirgi signal qachon kelgani va sahifa ko'rinib turganiga qarab.
//   online     - sahifa ochiq va ekranda ko'rinib turibdi (oxirgi signal <= 4 daqiqa)
//   background - sahifa ochiq, lekin fonda (boshqa ilova/ekran o'chgan), oxirgi signal <= 30 daqiqa
//   closed     - uzoq vaqt signal yo'q (yopilgan yoki telefon uxlagan)
//   unknown    - eski yozuv (signal tizimi qo'shilishidan oldingi)
const ONLINE_MAX_AGE_SEC = 4 * 60;
const BACKGROUND_MAX_AGE_SEC = 30 * 60;

function computeSessionStatus(row, nowMs) {
  if (!row.last_seen_at) return 'unknown';
  const ageSec = (nowMs - new Date(row.last_seen_at).getTime()) / 1000;
  if (row.last_state === 'hidden') return ageSec <= BACKGROUND_MAX_AGE_SEC ? 'background' : 'closed';
  return ageSec <= ONLINE_MAX_AGE_SEC ? 'online' : 'closed';
}

// GET /api/login-history?user_id=&date_from=&date_to=
// Sana filtri TOSHKENT kalendar kuni bo'yicha: date_from 00:00 dan date_to 24:00 gacha.
// Bitta kun tanlansa (date_from = date_to) - faqat shu kunning o'zi.
router.get('/', async (req, res) => {
  const { user_id, date_from, date_to } = req.query;
  const isAdmin = req.user.role === 'admin';

  const conditions = [];
  const params = [];
  let i = 1;

  if (!isAdmin) {
    // Oddiy foydalanuvchiga admin'ning kirishlari umuman ko'rsatilmaydi
    conditions.push(`role != 'admin'`);
  }
  if (user_id) { conditions.push(`user_id = $${i++}`); params.push(Number(user_id)); }
  if (date_from) {
    const from = tashkentDayStartUtc(date_from);
    if (!from) return res.status(400).json({ error: 'date_from formati noto\'g\'ri (YYYY-MM-DD)' });
    conditions.push(`logged_in_at >= $${i++}`);
    params.push(from);
  }
  if (date_to) {
    const toExclusive = tashkentDayStartUtc(date_to, 1);
    if (!toExclusive) return res.status(400).json({ error: 'date_to formati noto\'g\'ri (YYYY-MM-DD)' });
    conditions.push(`logged_in_at < $${i++}`);
    params.push(toExclusive);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await pool.query(
    `SELECT id, user_id, login, role, logged_in_at, last_seen_at, visible_seconds, hidden_seconds, last_state
     FROM login_history ${where} ORDER BY logged_in_at DESC LIMIT 500`,
    params
  );

  const nowMs = Date.now();
  const entries = result.rows.map((r) => {
    const loggedMs = new Date(r.logged_in_at).getTime();
    const lastMs = r.last_seen_at ? new Date(r.last_seen_at).getTime() : null;
    return {
      id: r.id,
      user_id: r.user_id,
      login: r.login,
      role: r.role,
      logged_in_at: r.logged_in_at,
      last_seen_at: r.last_seen_at,
      duration_seconds: lastMs ? Math.max(0, Math.round((lastMs - loggedMs) / 1000)) : null,
      visible_seconds: r.last_seen_at ? r.visible_seconds : null,
      hidden_seconds: r.last_seen_at ? r.hidden_seconds : null,
      status: computeSessionStatus(r, nowMs),
    };
  });

  res.json({ entries });
});

module.exports = router;
module.exports.tashkentDayStartUtc = tashkentDayStartUtc;
module.exports.computeSessionStatus = computeSessionStatus;
