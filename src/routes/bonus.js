const express = require('express');
const { pool } = require('../db/db');
const { authRequired } = require('../middleware/auth');
const { getEffectiveCategories } = require('../services/configService');

const router = express.Router();

// GET /api/bonus/tiers - barcha kategoriyalarning pog'ona jadvalini qaytaradi
// (admin bo'lmagan foydalanuvchilar uchun ham - "keyingi pog'onagacha qoldi" ko'rsatish uchun)
router.get('/tiers', authRequired, async (req, res) => {
  res.json({ categories: await getEffectiveCategories() });
});

// GET /api/bonus/journal?spot_id=6&date_from=2026-08-01&date_to=2026-08-23
// Har bir kun uchun jami bonusni (kategoriyalar yig'indisi) va kunlik holatni qaytaradi.
router.get('/journal', authRequired, async (req, res) => {
  const { spot_id, date_from, date_to } = req.query;
  if (!spot_id || !date_from || !date_to) {
    return res.status(400).json({ error: 'spot_id, date_from, date_to kerak' });
  }

  const allowedSpots = req.user.allowed_spots || [];
  if (allowedSpots.length > 0 && !allowedSpots.includes(Number(spot_id))) {
    return res.status(403).json({ error: 'Bu filialga ruxsatingiz yo\'q' });
  }

  const result = await pool.query(
    `SELECT date,
            SUM(CASE WHEN cash_diff_ok = 1 THEN bonus ELSE 0 END) AS calc_bonus,
            MIN(cash_diff_ok) AS ok
     FROM daily_bonus
     WHERE spot_id = $1 AND date >= $2 AND date <= $3
     GROUP BY date
     ORDER BY date DESC`,
    [Number(spot_id), date_from, date_to]
  );

  const entries = result.rows.map((r) => ({
    date: r.date,
    bonus: r.ok ? Number(r.calc_bonus) : 0,
    calc_bonus: Number(r.calc_bonus),
    ok: !!r.ok,
  }));

  const total = entries.reduce((sum, e) => sum + e.bonus, 0);

  res.json({ entries, total });
});

// GET /api/bonus?date_from=2026-08-01&date_to=2026-08-23&spot_id=6&category=Лимонады
router.get('/', authRequired, async (req, res) => {
  const { date_from, date_to, spot_id, category } = req.query;

  if (!date_from || !date_to) {
    return res.status(400).json({ error: 'date_from va date_to kerak' });
  }

  const conditions = [];
  const params = [];
  let i = 1;

  conditions.push(`date >= $${i++}`);
  params.push(date_from);
  conditions.push(`date <= $${i++}`);
  params.push(date_to);

  // Foydalanuvchining ruxsat etilgan filiallari (bo'sh = hammasi)
  const allowedSpots = req.user.allowed_spots || [];
  if (allowedSpots.length > 0) {
    const placeholders = allowedSpots.map(() => `$${i++}`).join(',');
    conditions.push(`spot_id IN (${placeholders})`);
    params.push(...allowedSpots);
  }

  if (spot_id) {
    conditions.push(`spot_id = $${i++}`);
    params.push(Number(spot_id));
  }
  if (category) {
    conditions.push(`category = $${i++}`);
    params.push(category);
  }

  const sql = `
    SELECT date, spot_id, category, quantity, bonus, cash_diff_ok
    FROM daily_bonus
    WHERE ${conditions.join(' AND ')}
    ORDER BY date DESC, spot_id ASC, category ASC
  `;

  const result = await pool.query(sql, params);
  const rows = result.rows.map((r) => ({ ...r, quantity: Number(r.quantity), bonus: Number(r.bonus) }));

  const totalBonus = rows.reduce((sum, r) => sum + (r.cash_diff_ok ? r.bonus : 0), 0);

  res.json({ rows, total_bonus: totalBonus, count: rows.length });
});

module.exports = router;
