const express = require('express');
const XLSX = require('xlsx');
const { pool } = require('../db/db');
const { authRequired, requireSection } = require('../middleware/auth');
const { getComparison } = require('../services/cashReconcile');

const router = express.Router();

function computeTotals(expenses, banknotes, paymentTypes) {
  const totalExpense = (expenses || []).reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const toza = Object.entries(banknotes || {}).reduce(
    (s, [denom, count]) => s + Number(denom) * (Number(count) || 0), 0
  );
  const totalPaytypes = Object.values(paymentTypes || {}).reduce((s, v) => s + (Number(v) || 0), 0);
  const totalAmount = toza + totalExpense + totalPaytypes;
  return { totalExpense, toza, totalPaytypes, totalAmount };
}

// POST /api/cash/entry - xodim kunlik kassa ma'lumotlarini kiritadi/yangilaydi
// body: { date, spot_id, expenses: [{name,amount}], banknotes: {"1000":5,...}, payment_types: {"UZCARD":100000,...} }
router.post('/entry', authRequired, requireSection('cash'), async (req, res) => {
  const { date, spot_id, expenses = [], banknotes = {}, payment_types = {} } = req.body || {};
  if (!date || !spot_id) {
    return res.status(400).json({ error: 'date, spot_id kerak' });
  }

  const { totalExpense, toza, totalPaytypes, totalAmount } = computeTotals(expenses, banknotes, payment_types);

  try {
    await pool.query(
      `INSERT INTO cash_entries (date, spot_id, expenses, banknotes, payment_types, toza, total_expense, total_paytypes, total_amount, entered_amount, entered_by, created_at, poster_synced_at, poster_snapshot)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9, $10, now(), NULL, NULL)
       ON CONFLICT (date, spot_id) DO UPDATE SET
         expenses = EXCLUDED.expenses,
         banknotes = EXCLUDED.banknotes,
         payment_types = EXCLUDED.payment_types,
         toza = EXCLUDED.toza,
         total_expense = EXCLUDED.total_expense,
         total_paytypes = EXCLUDED.total_paytypes,
         total_amount = EXCLUDED.total_amount,
         entered_amount = EXCLUDED.entered_amount,
         entered_by = EXCLUDED.entered_by,
         created_at = now(),
         poster_synced_at = NULL,
         poster_snapshot = NULL`,
      [date, spot_id, JSON.stringify(expenses), JSON.stringify(banknotes), JSON.stringify(payment_types),
       toza, totalExpense, totalPaytypes, totalAmount, req.user.id]
    );

    res.json({
      ok: true,
      toza, total_expense: totalExpense, total_paytypes: totalPaytypes, total_amount: totalAmount,
      message: 'Ma\'lumotlar saqlandi. Poster bilan solishtirish 6 soatdan keyin ko\'rinadi.',
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/cash/entry?date=&spot_id= - kiritilgan (Fakt) ma'lumotni o'qish
router.get('/entry', authRequired, requireSection('cash'), async (req, res) => {
  const { date, spot_id } = req.query;
  if (!date || !spot_id) return res.status(400).json({ error: 'date va spot_id kerak' });

  const result = await pool.query('SELECT * FROM cash_entries WHERE date = $1 AND spot_id = $2', [
    date, Number(spot_id),
  ]);
  const row = result.rows[0];
  if (!row) return res.json({ entry: null });

  res.json({
    entry: {
      ...row,
      expenses: JSON.parse(row.expenses || '[]'),
      banknotes: JSON.parse(row.banknotes || '{}'),
      payment_types: JSON.parse(row.payment_types || '{}'),
    },
  });
});

// GET /api/cash/compare?date=&spot_id= - Poster bilan solishtirish (6 soatdan keyin ochiladi)
router.get('/compare', authRequired, requireSection('cash'), async (req, res) => {
  const { date, spot_id } = req.query;
  if (!date || !spot_id) return res.status(400).json({ error: 'date va spot_id kerak' });

  const result = await pool.query('SELECT * FROM cash_entries WHERE date = $1 AND spot_id = $2', [
    date, Number(spot_id),
  ]);
  const row = result.rows[0];
  if (!row) return res.status(404).json({ error: 'Bu kun uchun kassa yozuvi topilmadi' });

  try {
    const comparison = await getComparison(row);
    res.json(comparison);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/cash/journal?spot_id=&date_from=&date_to= - kunlik kassa jurnali
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
    `SELECT id, date, toza, total_expense, total_paytypes, total_amount, created_at
     FROM cash_entries
     WHERE spot_id = $1 AND date >= $2 AND date <= $3
     ORDER BY date DESC`,
    [Number(spot_id), date_from, date_to]
  );

  res.json({ entries: result.rows });
});

// GET /api/cash/export?spot_id=&date_from=&date_to= - Excel (.xlsx) formatida yuklab olish
router.get('/export', authRequired, requireSection('cash'), async (req, res) => {
  const { spot_id, date_from, date_to } = req.query;
  if (!date_from || !date_to) {
    return res.status(400).json({ error: 'date_from va date_to kerak' });
  }

  const conditions = ['date >= $1', 'date <= $2'];
  const params = [date_from, date_to];
  if (spot_id) {
    conditions.push('spot_id = $3');
    params.push(Number(spot_id));
  }

  const result = await pool.query(
    `SELECT * FROM cash_entries WHERE ${conditions.join(' AND ')} ORDER BY date ASC, spot_id ASC`,
    params
  );

  const rows = result.rows.map((r) => ({
    'Sana': r.date,
    'Filial ID': r.spot_id,
    'Тоза (naqd)': r.toza,
    'Umumiy rasxod': r.total_expense,
    'To\'lov turlari yig\'indisi': r.total_paytypes,
    'Umumiy kassa': r.total_amount,
    'Kiritilgan vaqt': r.created_at,
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Kassa');

  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="kassa-${date_from}_${date_to}.xlsx"`);
  res.send(buffer);
});

module.exports = router;
