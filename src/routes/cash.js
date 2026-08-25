const express = require('express');
const { pool } = require('../db/db');
const poster = require('../services/posterClient');
const { authRequired, requireSection } = require('../middleware/auth');
const { sumCashCard, checkCashDiff } = require('../services/bonusCalculator');
const { getBusinessDayWindow } = require('../services/businessDay');

const router = express.Router();

const CASH_DIFF_LIMIT_PERCENT = Number(process.env.CASH_DIFF_LIMIT_PERCENT || 0.3);

async function fetchTransactionsForBusinessDay(dateStr, spotId) {
  const { startStr, endStr, fetchDates } = getBusinessDayWindow(dateStr);

  let allTx = [];
  for (const calendarDate of fetchDates) {
    let page = 1;
    while (true) {
      const result = await poster.call('transactions.getTransactions', {
        date_from: calendarDate,
        date_to: calendarDate,
        per_page: 100,
        page,
      });
      const filtered = result.data.filter((t) => Number(t.spot_id) === Number(spotId));
      allTx = allTx.concat(filtered);
      if (result.data.length < 100) break;
      page += 1;
    }
  }

  return allTx.filter((tx) => tx.date_close >= startStr && tx.date_close < endStr);
}

// POST /api/cash/entry
// body: { date: "2026-08-23", spot_id: 6, entered_amount: 3100000 }
// Xodim "bugungi umumiy kassa" summasini kiritganda chaqiriladi.
// "date" - ish kuni (05:00 dan keyingi kun 05:00 gacha).
router.post('/entry', authRequired, requireSection('cash'), async (req, res) => {
  const { date, spot_id, entered_amount } = req.body || {};
  if (!date || !spot_id || entered_amount === undefined) {
    return res.status(400).json({ error: 'date, spot_id, entered_amount kerak' });
  }

  try {
    const allTx = await fetchTransactionsForBusinessDay(date, spot_id);

    const { total: posterTotal } = sumCashCard(allTx);
    const { ok, diffPercent } = checkCashDiff(Number(entered_amount), posterTotal, CASH_DIFF_LIMIT_PERCENT);

    await pool.query(
      `INSERT INTO cash_entries (date, spot_id, entered_amount, poster_total, diff_percent, ok, entered_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (date, spot_id) DO UPDATE SET
         entered_amount = EXCLUDED.entered_amount,
         poster_total = EXCLUDED.poster_total,
         diff_percent = EXCLUDED.diff_percent,
         ok = EXCLUDED.ok,
         entered_by = EXCLUDED.entered_by`,
      [date, spot_id, entered_amount, posterTotal, diffPercent, ok ? 1 : 0, req.user.id]
    );

    await pool.query('UPDATE daily_bonus SET cash_diff_ok = $1 WHERE date = $2 AND spot_id = $3', [
      ok ? 1 : 0,
      date,
      spot_id,
    ]);

    res.json({
      ok,
      diff_percent: diffPercent,
      diff_amount: Number(entered_amount) - posterTotal,
      poster_total: posterTotal,
      entered_amount: Number(entered_amount),
      message: ok
        ? 'Farq chegarada, bonus saqlanadi.'
        : `Farq katta - shu kunlik bonus bekor qilindi.`,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/cash/entry?date=2026-08-23&spot_id=6
router.get('/entry', authRequired, requireSection('cash'), async (req, res) => {
  const { date, spot_id } = req.query;
  if (!date || !spot_id) return res.status(400).json({ error: 'date va spot_id kerak' });

  const result = await pool.query('SELECT * FROM cash_entries WHERE date = $1 AND spot_id = $2', [
    date,
    Number(spot_id),
  ]);

  res.json({ entry: result.rows[0] || null });
});

// GET /api/cash/journal?spot_id=6&date_from=2026-08-01&date_to=2026-08-23
// Har bir kun uchun Poster fakt summasi, xodim kiritgan summa va farqni ko'rsatadi.
router.get('/journal', authRequired, requireSection('cash'), async (req, res) => {
  const { spot_id, date_from, date_to } = req.query;
  if (!spot_id || !date_from || !date_to) {
    return res.status(400).json({ error: 'spot_id, date_from, date_to kerak' });
  }

  const allowedSpots = req.user.allowed_spots || [];
  if (allowedSpots.length > 0 && !allowedSpots.includes(Number(spot_id))) {
    return res.status(403).json({ error: 'Bu filialga ruxsatingiz yo\'q' });
  }

  const result = await pool.query(
    `SELECT date, entered_amount, poster_total, diff_percent, ok, created_at
     FROM cash_entries
     WHERE spot_id = $1 AND date >= $2 AND date <= $3
     ORDER BY date DESC`,
    [Number(spot_id), date_from, date_to]
  );

  const entries = result.rows.map((r) => ({
    date: r.date,
    entered_amount: Number(r.entered_amount),
    poster_total: Number(r.poster_total),
    diff_amount: Number(r.entered_amount) - Number(r.poster_total),
    diff_percent: Number(r.diff_percent),
    ok: !!r.ok,
    created_at: r.created_at,
  }));

  res.json({ entries });
});

module.exports = router;
