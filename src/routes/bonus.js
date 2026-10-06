const express = require('express');
const { pool } = require('../db/db');
const { authRequired, requireAnySection } = require('../middleware/auth');
const { getEffectiveCategories } = require('../services/configService');
const { getSettingNumber } = require('../services/appSettings');

/**
 * Bitta (kun + filial) uchun bonus holatini aniqlaydi - butun saytda YAGONA qoida:
 *   given   - kassa Poster bilan solishtirilgan va farq chegara ichida  -> BERILDI
 *   held    - kassa solishtirilgan va farq chegaradan oshgan             -> BERILMADI
 *   pending - tekshirilmagan: kassa kiritilmagan YOKI hali solishtirilmagan -> TEKSHIRILMAGAN
 * Manba: cash_entries.check_ok. (Eski yozuvlarda u bo'sh, lekin keshi bor bo'lsa, daily_bonus
 * belgisiga tayaniladi - fon vazifasi ularni bir necha daqiqada yangilab chiqadi.)
 */
function classifyDay(r) {
  if (r.cash_id === null || r.cash_id === undefined) return { status: 'pending', reason: 'no_entry' };
  let check = r.check_ok;
  if (check === null || check === undefined) {
    check = r.has_snapshot ? r.cash_diff_ok : null;
  }
  if (check === null || check === undefined) return { status: 'pending', reason: 'waiting' };
  return check ? { status: 'given', reason: null } : { status: 'held', reason: 'diff' };
}

const router = express.Router();

// GET /api/bonus/tiers - barcha kategoriyalarning pog'ona jadvalini qaytaradi.
// Har qanday login qilgan foydalanuvchi ko'ra oladi (maxfiy emas, xodimlar uchun
// ham "Bonus jadvali" sahifasida ko'rsatiladi).
router.get('/tiers', authRequired, async (req, res) => {
  res.json({ categories: await getEffectiveCategories() });
});

// GET /api/bonus/journal?spot_id=6&date_from=2026-08-01&date_to=2026-08-23&category=Лимонады
router.get('/journal', authRequired, requireAnySection('kpi'), async (req, res) => {
  const { spot_id, date_from, date_to, category } = req.query;
  if (!spot_id || !date_from || !date_to) {
    return res.status(400).json({ error: 'spot_id, date_from, date_to kerak' });
  }

  const allowedSpots = req.user.allowed_spots || [];
  if (allowedSpots.length > 0 && !allowedSpots.includes(Number(spot_id))) {
    return res.status(403).json({ error: 'Bu filialga ruxsatingiz yo\'q' });
  }

  const params = [Number(spot_id), date_from, date_to];
  let categoryClause = '';
  if (category) {
    params.push(category);
    categoryClause = `AND d.category = $${params.length}`;
  }

  const result = await pool.query(
    `SELECT d.date,
            SUM(d.bonus) AS calc_bonus,
            MIN(d.cash_diff_ok) AS cash_diff_ok,
            c.id AS cash_id, c.check_ok, c.check_diff_percent,
            (c.poster_snapshot IS NOT NULL) AS has_snapshot
     FROM daily_bonus d
     LEFT JOIN cash_entries c ON c.date = d.date AND c.spot_id = d.spot_id
     WHERE d.spot_id = $1 AND d.date >= $2 AND d.date <= $3 ${categoryClause}
     GROUP BY d.date, c.id, c.check_ok, c.check_diff_percent, c.poster_snapshot
     ORDER BY d.date DESC`,
    params
  );

  const entries = result.rows.map((r) => {
    const { status, reason } = classifyDay(r);
    const calc = Number(r.calc_bonus);
    return {
      date: r.date,
      bonus: status === 'given' ? calc : 0,
      calc_bonus: calc,
      status,
      reason,
      diff_percent: r.check_diff_percent === null ? null : Math.round(Number(r.check_diff_percent) * 100) / 100,
      ok: status === 'given',
    };
  });

  const total = entries.reduce((sum, e) => sum + e.bonus, 0);

  res.json({ entries, total });
});

// GET /api/bonus?date_from=2026-08-01&date_to=2026-08-23&spot_id=6&category=Лимонады
// KPI sahifasi va Kunlik savdo sahifasi ikkalasi ham shu endpointdan foydalanadi.
router.get('/', authRequired, requireAnySection('kpi', 'daily_sales'), async (req, res) => {
  const { date_from, date_to, spot_id, category, categories } = req.query;

  if (!date_from || !date_to) {
    return res.status(400).json({ error: 'date_from va date_to kerak' });
  }

  const conditions = [];
  const params = [];
  let i = 1;

  conditions.push(`d.date >= $${i++}`);
  params.push(date_from);
  conditions.push(`d.date <= $${i++}`);
  params.push(date_to);

  const allowedSpots = req.user.allowed_spots || [];
  if (allowedSpots.length > 0) {
    const placeholders = allowedSpots.map(() => `$${i++}`).join(',');
    conditions.push(`d.spot_id IN (${placeholders})`);
    params.push(...allowedSpots);
  }

  if (spot_id) {
    conditions.push(`d.spot_id = $${i++}`);
    params.push(Number(spot_id));
  }
  if (categories) {
    // Bir nechta kategoriya (vergul bilan ajratilgan) - Kunlik savdo sahifasida ishlatiladi
    const categoryList = categories.split(',').map((c) => c.trim()).filter(Boolean);
    if (categoryList.length) {
      const placeholders = categoryList.map(() => `$${i++}`).join(',');
      conditions.push(`d.category IN (${placeholders})`);
      params.push(...categoryList);
    }
  } else if (category) {
    conditions.push(`d.category = $${i++}`);
    params.push(category);
  }

  const sql = `
    SELECT d.date, d.spot_id, d.category, d.quantity, d.bonus, d.cash_diff_ok,
           c.id AS cash_id, c.check_ok, c.check_diff_percent,
           (c.poster_snapshot IS NOT NULL) AS has_snapshot
    FROM daily_bonus d
    LEFT JOIN cash_entries c ON c.date = d.date AND c.spot_id = d.spot_id
    WHERE ${conditions.join(' AND ')}
    ORDER BY d.date DESC, d.spot_id ASC, d.category ASC
  `;

  const result = await pool.query(sql, params);

  const summary = { calculated: 0, given: 0, held: 0, pending: 0, pending_no_entry: 0, pending_waiting: 0 };
  const dayMap = new Map(); // "date|spot" -> kun bo'yicha yig'indi (berilmagan kunlar ro'yxati uchun)

  const rows = result.rows.map((r) => {
    const bonus = Number(r.bonus);
    const { status, reason } = classifyDay(r);

    summary.calculated += bonus;
    summary[status] += bonus;
    if (status === 'pending') summary[reason === 'no_entry' ? 'pending_no_entry' : 'pending_waiting'] += bonus;

    if (status !== 'given') {
      const key = `${r.date}|${r.spot_id}`;
      if (!dayMap.has(key)) {
        dayMap.set(key, {
          date: r.date, spot_id: r.spot_id, bonus: 0, status, reason,
          diff_percent: r.check_diff_percent === null ? null : Math.round(Number(r.check_diff_percent) * 100) / 100,
        });
      }
      dayMap.get(key).bonus += bonus;
    }

    return {
      date: r.date, spot_id: r.spot_id, category: r.category,
      quantity: Number(r.quantity), bonus, cash_diff_ok: r.cash_diff_ok,
      status, reason,
    };
  });

  // Faqat bonusi bor (0 dan katta) berilmagan/tekshirilmagan kunlar
  const days = [...dayMap.values()].filter((d) => d.bonus > 0);
  const limitPercent = await getSettingNumber('cash_diff_limit_percent', Number(process.env.CASH_DIFF_LIMIT_PERCENT || 0.3));

  res.json({
    rows,
    total_bonus: summary.given, // faqat BERILGAN (tekshirilgan va me'yordagi) bonus
    summary,
    days,
    limit_percent: limitPercent,
    count: rows.length,
  });
});

module.exports = router;
