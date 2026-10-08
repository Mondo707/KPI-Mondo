// Filiallar ro'yxati (Poster'dan, saytdagi kabi keshlanadi; Poster javob bermasa - bazadagi oxirgi nusxa).
const poster = require('../services/posterClient');
const { pool } = require('../db/db');

let cache = { data: null, ts: 0 };
const TTL = 5 * 60 * 1000;

async function getSpots() {
  const now = Date.now();
  if (cache.data && now - cache.ts < TTL) return cache.data;
  try {
    cache.data = await poster.call('spots.getSpots');
    cache.ts = now;
  } catch (e) {
    if (!cache.data) {
      try {
        const r = await pool.query('SELECT value FROM app_settings WHERE key = $1', ['spots_cache']);
        if (r.rows[0]) cache.data = JSON.parse(r.rows[0].value);
      } catch (_) { /* e'tiborsiz */ }
    }
    if (!cache.data) throw e;
    cache.ts = now - TTL + 60 * 1000;
  }
  return cache.data;
}

// Foydalanuvchiga ruxsat etilgan filiallar: [{ id, name }]
async function getAllowedSpots(user) {
  const all = await getSpots();
  const allowed = user.allowed_spots || [];
  return all
    .filter((s) => allowed.length === 0 || allowed.includes(Number(s.spot_id)))
    .map((s) => ({ id: Number(s.spot_id), name: s.name || s.spot_name || ('#' + s.spot_id) }));
}

module.exports = { getSpots, getAllowedSpots };
