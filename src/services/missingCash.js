// Kassa kiritilmagan kunlar: filial bo'yicha, kiritilishi kerak bo'lgan (bugungi ish kunidan oldingi)
// kunlar ichida cash_entries yozuvi yo'q kunlar. Sayt eslatmasi va bot eslatmasi shundan foydalanadi
// (Kassa farqi hisobotidagi "Kassa kiritilmagan" bilan bir xil qoida).
const { pool } = require('../db/db');
const { getCurrentBusinessDate } = require('./businessDay');
const { getAllowedSpots } = require('../bot/spotNames');
const { listDates } = require('../bot/dates');

/**
 * @param {object} o { user, from, to, spotIds? (ixtiyoriy filtr) }
 * @returns {Promise<Array<{spot_id:number, name:string, dates:string[]}>>}
 */
async function getMissingCash({ user, from, to, spotIds }) {
  const today = getCurrentBusinessDate();
  const dates = listDates(from, to).filter((d) => d < today);
  if (!dates.length) return [];
  let spots = await getAllowedSpots(user);
  if (spotIds && spotIds.length) spots = spots.filter((s) => spotIds.includes(s.id));
  if (!spots.length) return [];
  const res = await pool.query(
    'SELECT spot_id, date FROM cash_entries WHERE spot_id = ANY($1) AND date >= $2 AND date <= $3',
    [spots.map((s) => s.id), dates[0], dates[dates.length - 1]]
  );
  const have = new Set(res.rows.map((r) => `${r.spot_id}|${r.date}`));
  const out = [];
  for (const s of spots) {
    const miss = dates.filter((d) => !have.has(`${s.id}|${d}`));
    if (miss.length) out.push({ spot_id: s.id, name: s.name, dates: miss });
  }
  return out;
}

module.exports = { getMissingCash };
