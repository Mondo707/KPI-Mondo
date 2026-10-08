// Ish kuni chegarasi (05:00) diagnostikasi: bonus manbasi va kassa manbasi cheklarini solishtiradi.
// FAQAT O'QISH: Poster'ga yozmaydi, bazaga tegmaydi. Admin paneldan va diagBoundaryCheques.js dan ishlatiladi.

const poster = require('./posterClient');
const { getBusinessDayWindow, getBusinessDayWindowEpoch } = require('./businessDay');

const TZ_OFFSET_H = Number(process.env.TIMEZONE_OFFSET_HOURS || 5);
const START_H = 5;
const NEAR_MIN = 30; // chegaradan necha daqiqa ichidagi cheklar "chegaraviy" hisoblanadi

function pad(n) { return String(n).padStart(2, '0'); }
function shift(dateStr, days) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}
function epochToTashkentStr(ms) {
  const dt = new Date(Number(ms) + TZ_OFFSET_H * 3600 * 1000);
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())} ${pad(dt.getUTCHours())}:${pad(dt.getUTCMinutes())}:${pad(dt.getUTCSeconds())}`;
}
function strToPseudoMs(str) { // "YYYY-MM-DD HH:MM:SS" ni UTC deb o'qib ms (faqat farqni hisoblash uchun)
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(str || '');
  return m ? Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) : NaN;
}
function businessDayOfStr(str) { // matn vaqtidan ish kunini aniqlaydi
  const ms = strToPseudoMs(str);
  if (Number.isNaN(ms)) return null;
  const dt = new Date(ms - START_H * 3600 * 1000);
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

async function fetchBonusSource(date) { // transactions.getTransactions (so'mda, matn vaqti)
  let all = [];
  for (const d of [date, shift(date, 1)]) {
    let page = 1;
    while (true) {
      const r = await poster.call('transactions.getTransactions', { date_from: d, date_to: d, per_page: 100, page });
      const list = Array.isArray(r) ? r : (r.data || []);
      all = all.concat(list);
      if (list.length < 100) break;
      page += 1;
    }
  }
  const map = new Map();
  all.forEach((t) => { if (!map.has(String(t.transaction_id))) map.set(String(t.transaction_id), t); });
  return map;
}

async function fetchCashSource(date) { // dash.getTransactions (tiyinda, epoch vaqti)
  let all = [];
  for (const d of [date, shift(date, 1)]) {
    const r = await poster.call('dash.getTransactions', { date_from: d, date_to: d });
    all = all.concat(Array.isArray(r) ? r : (r.data || []));
  }
  const map = new Map();
  all.forEach((t) => { if (!map.has(String(t.transaction_id))) map.set(String(t.transaction_id), t); });
  return map;
}

function previousBusinessDate() {
  return shift(new Date(Date.now() + TZ_OFFSET_H * 3600 * 1000 - START_H * 3600 * 1000).toISOString().slice(0, 10), -1);
}

// Natijani matn qatorlari (massiv) sifatida qaytaradi.
async function runBoundaryCheck(dateArg, spotArg) {
  const out = [];
  const log = (s = '') => out.push(s);
  const date = dateArg || previousBusinessDate();
  const onlySpot = spotArg ? Number(spotArg) : null;
  const win = getBusinessDayWindow(date);
  const winEpoch = getBusinessDayWindowEpoch(date);
  log(`Ish kuni: ${date}   oyna: ${win.startStr}  ->  ${win.endStr}${onlySpot ? `   filial: ${onlySpot}` : ''}\n`);

  const [bonusMap, cashMap] = await Promise.all([fetchBonusSource(date), fetchCashSource(date)]);
  log(`Bonus manbasi (transactions.getTransactions): ${bonusMap.size} ta chek`);
  log(`Kassa manbasi (dash.getTransactions):        ${cashMap.size} ta chek\n`);

  const inBonusDay = (t) => t.date_close >= win.startStr && t.date_close < win.endStr;
  const inCashDay = (t) => Number(t.date_close) >= winEpoch.startMs && Number(t.date_close) < winEpoch.endMs;

  const ids = new Set([...bonusMap.keys(), ...cashMap.keys()]);
  const rows = [];
  let bonusDaySum = 0; let cashDaySum = 0;
  for (const id of ids) {
    const b = bonusMap.get(id); const c = cashMap.get(id);
    const spot = Number((b || c).spot_id);
    if (onlySpot && spot !== onlySpot) continue;
    const bIn = b ? inBonusDay(b) : null;
    const cIn = c ? inCashDay(c) : null;
    if (b && bIn) bonusDaySum += Number(b.sum) || 0;
    if (c && cIn) cashDaySum += (Number(c.sum) || 0) / 100;
    const bStr = b ? String(b.date_close) : null;
    const cStr = c ? epochToTashkentStr(c.date_close) : null;
    const nearMs = (s) => { const ms = strToPseudoMs(s); if (Number.isNaN(ms)) return Infinity; const dt = new Date(ms); const base = Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate(), START_H, 0, 0); return Math.abs(ms - base) / 60000; };
    const near = Math.min(bStr ? nearMs(bStr) : Infinity, cStr ? nearMs(cStr) : Infinity);
    const diffSec = (b && c) ? Math.round((strToPseudoMs(cStr) - strToPseudoMs(bStr)) / 1000) : null;
    rows.push({ id, spot, bStr, cStr, bIn, cIn, near, diffSec, bSum: b ? Number(b.sum) || 0 : null, cSum: c ? (Number(c.sum) || 0) / 100 : null });
  }

  // 1) Faqat bitta manbada bor cheklar (ish kuni oynasi ichida)
  const onlyOne = rows.filter((r) => (r.bIn === true && r.cStr === null) || (r.cIn === true && r.bStr === null));
  // 2) Ikkalasida ham bor, lekin turli kunga tushayotganlar
  const mismatch = rows.filter((r) => r.bStr && r.cStr && r.bIn !== r.cIn && (r.bIn || r.cIn));
  // 3) Vaqt farqi katta (> 60 soniya) bo'lganlar
  const timeDiff = rows.filter((r) => r.diffSec !== null && Math.abs(r.diffSec) > 60);
  // 4) Chegaraviy cheklar (05:00 ga yaqin)
  const nearBoundary = rows.filter((r) => r.near <= NEAR_MIN && (r.bIn || r.cIn || r.near <= 5)).sort((a, b) => String(a.bStr || a.cStr).localeCompare(String(b.bStr || b.cStr)));

  const line = (r) => `  chek ${r.id} | filial ${r.spot} | bonus vaqti: ${r.bStr || '—'} (${r.bIn === null ? 'yo\'q' : r.bIn ? 'shu kunda' : 'boshqa kun'}) | kassa vaqti: ${r.cStr || '—'} (${r.cIn === null ? 'yo\'q' : r.cIn ? 'shu kunda' : 'boshqa kun'}) | summa: ${r.bSum ?? '—'} / ${r.cSum ?? '—'}`;

  log(`=== 1) Faqat bitta manbada bor cheklar: ${onlyOne.length} ta`);
  onlyOne.slice(0, 40).forEach((r) => log(line(r)));
  log(`\n=== 2) Ikkala manbada bor, lekin TURLI ish kuniga tushayotganlar: ${mismatch.length} ta`);
  mismatch.slice(0, 40).forEach((r) => log(line(r)));
  log(`\n=== 3) Vaqt farqi > 60 soniya bo'lgan cheklar: ${timeDiff.length} ta`);
  timeDiff.slice(0, 20).forEach((r) => log(line(r) + ` | farq: ${r.diffSec} s`));
  log(`\n=== 4) 05:00 chegarasiga ${NEAR_MIN} daqiqa ichidagi cheklar: ${nearBoundary.length} ta`);
  nearBoundary.slice(0, 60).forEach((r) => log(line(r)));

  log('\n=== Umumiy summalar (shu ish kuni oynasi ichida, so\'m)');
  log(`  Bonus manbasi (sum): ${Math.round(bonusDaySum).toLocaleString('ru-RU')}`);
  log(`  Kassa manbasi (sum): ${Math.round(cashDaySum).toLocaleString('ru-RU')}`);
  log(`  Farq: ${Math.round(bonusDaySum - cashDaySum).toLocaleString('ru-RU')}`);
  log('\nTUGADI. Natijani to\'liq nusxalab yuboring.');
  return out.join('\n');
}

module.exports = { runBoundaryCheck, previousBusinessDate };
