const express = require('express');
const poster = require('../services/posterClient');
const { pool } = require('../db/db');
const { authRequired } = require('../middleware/auth');

const router = express.Router();

let cache = { data: null, ts: 0 };
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 daqiqa
const DB_KEY = 'spots_cache';

// Filiallar ro'yxatini bazada ham saqlaymiz: Poster vaqtincha javob bermasa (yoki server
// qayta ishga tushgan paytda Poster band bo'lsa) ham ilova ishlashda davom etadi.
async function saveSpotsToDb(data) {
  try {
    await pool.query(
      `INSERT INTO app_settings (key, value, updated_at) VALUES ($1, $2, now())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
      [DB_KEY, JSON.stringify(data)]
    );
  } catch (e) {
    console.warn('[spots] Ro\'yxatni bazaga saqlab bo\'lmadi:', e.message);
  }
}
async function loadSpotsFromDb() {
  try {
    const r = await pool.query('SELECT value FROM app_settings WHERE key = $1', [DB_KEY]);
    return r.rows[0] ? JSON.parse(r.rows[0].value) : null;
  } catch (e) {
    return null;
  }
}

router.get('/', authRequired, async (req, res) => {
  const now = Date.now();
  if (!cache.data || now - cache.ts > CACHE_TTL_MS) {
    try {
      cache.data = await poster.call('spots.getSpots');
      cache.ts = now;
      saveSpotsToDb(cache.data); // kutmaymiz - javobni kechiktirmaydi
    } catch (e) {
      const stale = cache.data || (await loadSpotsFromDb());
      if (!stale) return res.status(500).json({ error: e.message });
      console.warn('[spots] Poster javob bermadi, oxirgi saqlangan ro\'yxat ishlatildi:', e.message);
      cache.data = stale;
      cache.ts = now - CACHE_TTL_MS + 60 * 1000; // 1 daqiqadan keyin Poster'dan qayta urinib ko'ramiz
    }
  }

  let spots = cache.data;
  const allowed = req.user.allowed_spots || [];
  if (allowed.length > 0) {
    spots = spots.filter((s) => allowed.includes(Number(s.spot_id)));
  }
  res.json({ spots });
});

module.exports = router;
