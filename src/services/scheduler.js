// Har 5 daqiqada bugungi (va agar kerak bo'lsa kechagi, smena kech tugagan holatlar uchun)
// tranzaksiyalarni Poster'dan olib, daily_bonus jadvalini yangilab turadi.

const cron = require('node-cron');
const { pool } = require('../db/db');
const poster = require('./posterClient');
const { calculateDailyBonus } = require('./bonusCalculator');

async function fetchAllTransactions(date) {
  let allTx = [];
  let page = 1;
  while (true) {
    const result = await poster.call('transactions.getTransactions', {
      date_from: date,
      date_to: date,
      per_page: 100,
      page,
    });
    allTx = allTx.concat(result.data);
    if (result.data.length < 100) break;
    page += 1;
  }
  return allTx;
}

async function upsertDailyBonus(date, spotId, breakdown) {
  const existingRes = await pool.query(
    'SELECT cash_diff_ok FROM daily_bonus WHERE date = $1 AND spot_id = $2 LIMIT 1',
    [date, spotId]
  );
  const cashDiffOk = existingRes.rows[0] ? existingRes.rows[0].cash_diff_ok : 1;

  for (const item of breakdown) {
    await pool.query(
      `INSERT INTO daily_bonus (date, spot_id, category, quantity, bonus, cash_diff_ok, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, now())
       ON CONFLICT (date, spot_id, category) DO UPDATE SET
         quantity = EXCLUDED.quantity,
         bonus = EXCLUDED.bonus,
         updated_at = EXCLUDED.updated_at`,
      [date, spotId, item.category, item.quantity, item.bonus, cashDiffOk]
    );
  }
}

async function syncDate(date) {
  const allTx = await fetchAllTransactions(date);

  const bySpot = new Map();
  for (const tx of allTx) {
    const arr = bySpot.get(tx.spot_id) || [];
    arr.push(tx);
    bySpot.set(tx.spot_id, arr);
  }

  for (const [spotId, txs] of bySpot.entries()) {
    const { breakdown } = await calculateDailyBonus(txs);
    await upsertDailyBonus(date, spotId, breakdown);
  }

  console.log(`[scheduler] ${date} uchun ${bySpot.size} ta filial yangilandi (${allTx.length} tranzaksiya)`);
}

async function runSync() {
  const today = new Date().toISOString().slice(0, 10);
  try {
    await syncDate(today);
  } catch (e) {
    console.error('[scheduler] Xato:', e.message);
  }
}

function startScheduler() {
  // Darhol bir marta ishga tushirish
  runSync();
  // Har 5 daqiqada
  cron.schedule('*/5 * * * *', runSync);
  console.log('[scheduler] Har 5 daqiqada avtomatik yangilanish yoqildi.');
}

module.exports = { startScheduler, syncDate };
