const express = require('express');
const { pool } = require('../db/db');
const poster = require('../services/posterClient');
const { authRequired } = require('../middleware/auth');
const { sumCashCard, checkCashDiff } = require('../services/bonusCalculator');

const router = express.Router();

const CASH_DIFF_LIMIT_PERCENT = Number(process.env.CASH_DIFF_LIMIT_PERCENT || 0.3);

// POST /api/cash/entry
// body: { date: "2026-08-23", spot_id: 6, entered_amount: 3100000 }
// Xodim "bugungi umumiy kassa" summasini kiritganda chaqiriladi.
router.post('/entry', authRequired, async (req, res) => {
  const { date, spot_id, entered_amount } = req.body || {};
  if (!date || !spot_id || entered_amount === undefined) {
    return res.status(400).json({ error: 'date, spot_id, entered_amount kerak' });
  }

  try {
    // Poster'dan shu kun + shu filial uchun barcha tranzaksiyalarni yig'ish
    let allTx = [];
    let page = 1;
    while (true) {
      const result = await poster.call('transactions.getTransactions', {
        date_from: date,
        date_to: date,
        per_page: 100,
        page,
      });
      const filtered = result.data.filter((t) => Number(t.spot_id) === Number(spot_id));
      allTx = allTx.concat(filtered);
      if (result.data.length < 100) break;
      page += 1;
    }

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
      poster_total: posterTotal,
      entered_amount: Number(entered_amount),
      message: ok
        ? 'Farq chegarada, bonus saqlanadi.'
        : `Farq ${diffPercent}% (limit ${CASH_DIFF_LIMIT_PERCENT}%) - shu kunlik bonus bekor qilindi.`,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/cash/entry?date=2026-08-23&spot_id=6
router.get('/entry', authRequired, async (req, res) => {
  const { date, spot_id } = req.query;
  if (!date || !spot_id) return res.status(400).json({ error: 'date va spot_id kerak' });

  const result = await pool.query('SELECT * FROM cash_entries WHERE date = $1 AND spot_id = $2', [
    date,
    Number(spot_id),
  ]);

  res.json({ entry: result.rows[0] || null });
});

module.exports = router;
