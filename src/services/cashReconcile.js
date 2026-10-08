// Kassa kiritilgan "Fakt" ma'lumotlarni Poster'dagi haqiqiy to'lovlar bilan solishtiradi.
//
// MUHIM texnik eslatmalar:
//  - Ma'lumotlar "dash.getTransactions" orqali olinadi (faqat shu metod
//    payment_method_id va client_id'ni beradi - buni diagnostika tasdiqladi).
//  - dash.getTransactions summalarni TIYIN'da beradi (transactions.getTransactions
//    esa so'mda) - shuning uchun barcha summalar 100 ga bo'linadi.
//  - Vaqtni solishtirish uchun tx.date_close (raqamli epoch millisekund)
//    ishlatiladi - bu Poster metodlari orasidagi vaqt zonasi farqidan qochish
//    uchun eng ishonchli usul.
//
// Tuzilma:
//   Umumiy kassa
//     Наличные оплаты    = Тоза + Umumiy rasxod + Инкассация (Poster: payed_cash)
//     Безналичные оплаты = UZCARD+HUMO+Uz Qr Kod+Карточки+Click+Payme+Uzum+Alif+Paynet
//     Сертификат         = Yandex eats + Jiz-Biz restaurant (Poster'da bu ikkalasi
//                           "Сертификат" to'lov turi bilan yopiladi, shuning uchun
//                           Безналичныеga QO'SHILMAYDI - alohida ko'rsatiladi)

const poster = require('./posterClient');
const { pool } = require('../db/db');
const { getBusinessDayWindowEpoch, getCurrentBusinessDate } = require('./businessDay');
const { getMapping } = require('./posterPaymentMethods');
const { getSettingNumber } = require('./appSettings');

const RECONCILE_DELAY_HOURS = Number(process.env.CASH_RECONCILE_DELAY_HOURS || 6);
const CASH_DIFF_LIMIT_SETTING_KEY = 'cash_diff_limit_percent';
const DEFAULT_CASH_DIFF_LIMIT_PERCENT = Number(process.env.CASH_DIFF_LIMIT_PERCENT || 0.3);

// dash.getTransactions summalari tiyin'da keladi - so'mga o'tkazish uchun bo'linadi
const AMOUNT_DIVISOR = 100;

const NONCASH_CHANNEL_ORDER = ['uzcard', 'humo', 'uz_qr', 'karta_other', 'click', 'payme', 'uzum', 'alif', 'paynet'];

/**
 * Kassa smenasi ochilish/yopilish summalari orasidagi farqni hisoblaydi.
 * Nega kerak: xodim "Тоза" hisoblaganda kassada QOLDIRILGAN pulni (ertangi
 * kun uchun) hisobga olmaydi - lekin Poster kunlik savdoni to'liq ko'rsatadi.
 * Shuning uchun bu farqni Fakt tomonga qo'shib/ayirib qo'yish kerak:
 *   - Agar Yopilish > Ochilish bo'lsa: filialda pul QOLGAN (bugungi savdodan) -> QO'SHILADI
 *   - Agar Yopilish < Ochilish bo'lsa: pul SARFLANGAN (float'dan) -> AYIRILADI
 *
 * MUHIM: finance.getCashShifts summalari ham (boshqa Poster metodlari kabi)
 * TIYIN'da kelishi ehtimoli katta deb faraz qilinmoqda - shuning uchun 100'ga
 * bo'linadi. Agar natija 100 marta katta/kichik chiqsa, shu joyni sozlash kerak.
 */
async function getShiftDiff(spotId, dateStr) {
  const { startMs, endMs } = getBusinessDayWindowEpoch(dateStr);

  const [y, m, d] = dateStr.split('-').map(Number);
  const nextDt = new Date(Date.UTC(y, m - 1, d + 1));
  const d1 = dateStr;
  const d2 = `${nextDt.getUTCFullYear()}-${String(nextDt.getUTCMonth() + 1).padStart(2, '0')}-${String(nextDt.getUTCDate()).padStart(2, '0')}`;

  let allShifts = [];
  for (const calendarDate of [d1, d2]) {
    try {
      const result = await poster.call('finance.getCashShifts', {
        date_from: calendarDate,
        date_to: calendarDate,
        spot_id: spotId,
      });
      const list = Array.isArray(result) ? result : (result && result.response) || [];
      allShifts = allShifts.concat(list);
    } catch (e) {
      // Metod ishlamasa, smena ma'lumotisiz davom etamiz (formula eskichasiga qoladi)
    }
  }

  // Ikki kunlik so'rovda bitta smena ikkalasida ham qaytishi mumkin - cash_shift_id
  // bo'yicha dublikatlarni olib tashlaymiz (aks holda ikki marta hisoblanib qoladi)
  const uniqueShiftsMap = new Map();
  allShifts.forEach((s) => {
    const key = s.cash_shift_id ?? `${s.spot_id}_${s.timestart}`;
    if (!uniqueShiftsMap.has(key)) uniqueShiftsMap.set(key, s);
  });
  allShifts = Array.from(uniqueShiftsMap.values());

  const spotShifts = allShifts.filter((s) => {
    if (Number(s.spot_id) !== Number(spotId)) return false;
    const startTime = Number(s.timestart);
    return startTime >= startMs && startTime < endMs;
  });

  if (spotShifts.length === 0) {
    return { hasData: false, hasOpenShift: false, diff: 0, shifts: [] };
  }

  let hasOpenShift = false;
  let totalDiff = 0;
  const shiftsInfo = [];

  for (const s of spotShifts) {
    const isOpen = !s.timeend || Number(s.timeend) === 0 || !s.date_end || s.date_end === '0000-00-00 00:00:00';
    if (isOpen) {
      hasOpenShift = true;
      continue;
    }
    const startAmount = (Number(s.amount_start) || 0) / AMOUNT_DIVISOR;
    const endAmount = (Number(s.amount_end) || 0) / AMOUNT_DIVISOR;
    const diff = endAmount - startAmount;
    totalDiff += diff;
    shiftsInfo.push({ start: startAmount, end: endAmount, diff });
  }

  return { hasData: true, hasOpenShift, diff: totalDiff, shifts: shiftsInfo };
}

/**
 * dash.getTransactions orqali berilgan "ish kuni" uchun BARCHA filiallarning tranzaksiyalarini
 * oladi (Poster bitta so'rovda hamma filialni qaytaradi). Ish kuni oynasiga qarab filtrlanadi.
 */
async function fetchAllTransactionsForBusinessDay(dateStr) {
  const { startMs, endMs } = getBusinessDayWindowEpoch(dateStr);

  const [y, m, d] = dateStr.split('-').map(Number);
  const nextDt = new Date(Date.UTC(y, m - 1, d + 1));
  const d1 = dateStr;
  const d2 = `${nextDt.getUTCFullYear()}-${String(nextDt.getUTCMonth() + 1).padStart(2, '0')}-${String(nextDt.getUTCDate()).padStart(2, '0')}`;

  let allTx = [];
  for (const calendarDate of [d1, d2]) {
    const result = await poster.call('dash.getTransactions', {
      date_from: calendarDate,
      date_to: calendarDate,
    });
    const list = Array.isArray(result) ? result : (result.data || []);
    allTx = allTx.concat(list);
  }

  // Ikki kunlik so'rovda bitta tranzaksiya ikkalasida ham qaytishi mumkin -
  // transaction_id bo'yicha dublikatlarni olib tashlaymiz
  const uniqueTxMap = new Map();
  allTx.forEach((tx) => {
    const key = tx.transaction_id;
    if (!uniqueTxMap.has(key)) uniqueTxMap.set(key, tx);
  });
  allTx = Array.from(uniqueTxMap.values());

  return allTx.filter((tx) => {
    const closeMs = Number(tx.date_close);
    return closeMs >= startMs && closeMs < endMs;
  });
}

/**
 * dash.getTransactions orqali berilgan "ish kuni" va filial uchun tranzaksiyalarni oladi
 * (payment_method_id va client_id bilan birga).
 */
async function fetchTransactionsForBusinessDay(dateStr, spotId) {
  const all = await fetchAllTransactionsForBusinessDay(dateStr);
  return all.filter((tx) => Number(tx.spot_id) === Number(spotId));
}

function isLocked(entry) {
  const createdMs = new Date(entry.created_at).getTime();
  const unlockMs = createdMs + RECONCILE_DELAY_HOURS * 60 * 60 * 1000;
  return Date.now() < unlockMs;
}

function unlockTime(entry) {
  const createdMs = new Date(entry.created_at).getTime();
  return new Date(createdMs + RECONCILE_DELAY_HOURS * 60 * 60 * 1000).toISOString();
}

/**
 * Berilgan filial uchun Yandex eats / Jiz-Biz client_id xaritasini oladi.
 * Avval shu filialga xos sozlama qidiriladi, topilmasa "barchasi" (spot_id=0)
 * global sozlamasi ishlatiladi - chunki bu klientlar odatda butun akkauntda bir xil.
 */
async function getClientMapping(spotId) {
  const result = await pool.query(
    'SELECT channel_key, poster_client_id FROM poster_client_mapping WHERE spot_id = $1 OR spot_id = 0 ORDER BY (spot_id = 0) ASC',
    [spotId]
  );
  const mapping = {};
  result.rows.forEach((r) => {
    if (!(r.channel_key in mapping)) mapping[r.channel_key] = r.poster_client_id;
  });
  return mapping;
}

/**
 * Tranzaksiyalarni kanal bo'yicha guruhlaydi. Natijadagi barcha summalar
 * allaqachon so'mda (AMOUNT_DIVISOR orqali tiyin'dan o'girilgan).
 */
async function buildPosterSnapshot(transactions, spotId) {
  const clientMapping = await getClientMapping(spotId);
  const paymentMethodMapping = await getMapping(); // { payment_method_id: channel_key }

  const totals = { cash: 0, yandex_eats: 0, jizbiz: 0 };
  NONCASH_CHANNEL_ORDER.forEach((c) => { totals[c] = 0; });

  for (const tx of transactions) {
    const clientId = tx.client_id ? String(tx.client_id) : null;

    // Yandex eats / Jiz-Biz - Сертификат sifatida yopiladi, Безналичныега kirmaydi
    if (clientMapping.yandex_eats && clientId === String(clientMapping.yandex_eats)) {
      totals.yandex_eats += (Number(tx.sum) || 0) / AMOUNT_DIVISOR;
      continue;
    }
    if (clientMapping.jizbiz && clientId === String(clientMapping.jizbiz)) {
      totals.jizbiz += (Number(tx.sum) || 0) / AMOUNT_DIVISOR;
      continue;
    }

    totals.cash += (Number(tx.payed_cash) || 0) / AMOUNT_DIVISOR;

    const cardAmount = (Number(tx.payed_card) || 0) / AMOUNT_DIVISOR;
    if (cardAmount > 0) {
      const methodId = tx.payment_method_id;
      const channelKey = methodId !== undefined && methodId !== null ? paymentMethodMapping[String(methodId)] : undefined;
      if (channelKey && totals[channelKey] !== undefined) {
        totals[channelKey] += cardAmount;
      } else {
        totals.karta_other += cardAmount;
      }
    }

    // Aniqlanmagan elektron hamyon/uchinchi tomon to'lovlari - "Карточки" bandiga
    // (Сертификат bu yerga kirmaydi - u faqat client_id orqali yuqorida hisoblanadi)
    totals.karta_other += ((Number(tx.payed_third_party) || 0) + (Number(tx.payed_ewallet) || 0)) / AMOUNT_DIVISOR;
  }

  return totals;
}

/**
 * Berilgan kassa yozuvi uchun Poster bilan solishtirish natijasini hisoblaydi
 * (yoki keshdan qaytaradi, agar avval hisoblangan bo'lsa). Shu bilan birga
 * "Umumiy kassa" farqi admin belgilagan chegaradan oshsa, o'sha kunlik bonusni
 * avtomatik bekor qiladi (daily_bonus.cash_diff_ok orqali).
 * @param {object} entry cash_entries qatori
 * @param {object} options { forceUnlock: boolean }
 */
async function getComparison(entry, options = {}) {
  if (!options.forceUnlock && isLocked(entry)) {
    return { locked: true, unlock_at: unlockTime(entry) };
  }

  // "Faqat keshdan" rejimi: hisoblanmagan yozuv uchun Poster'ga MUROJAAT QILMAYDI
  // (Farq jurnali kabi uzoq ro'yxatlar uchun - sekin ishlamasligi va Poster'ni
  // ko'p so'rov bilan yuklamasligi uchun). Hisoblashni fon vazifasi bajaradi.
  if (options.cachedOnly && !entry.poster_snapshot) {
    return { locked: false, notComputed: true };
  }

  let snapshot;
  if (entry.poster_snapshot) {
    snapshot = JSON.parse(entry.poster_snapshot);
  } else {
    const transactions = await fetchTransactionsForBusinessDay(entry.date, entry.spot_id);
    snapshot = await buildPosterSnapshot(transactions, entry.spot_id);
    // Smena farqini ham shu paytda hisoblab, keshga (snapshot ichiga) saqlaymiz -
    // shunda keyingi safar bu yozuv ochilganda Poster'ga qayta murojaat shart bo'lmaydi.
    snapshot.shift_diff = await getShiftDiff(entry.spot_id, entry.date);
    snapshot.computed_at = new Date().toISOString();

    await pool.query(
      'UPDATE cash_entries SET poster_snapshot = $1, poster_synced_at = now() WHERE id = $2',
      [JSON.stringify(snapshot), entry.id]
    );
  }

  const paymentTypes = JSON.parse(entry.payment_types || '{}');
  const getFakt = (name) => Number(paymentTypes[name]) || 0;

  // Smena ochilish/yopilish farqi (keshdan, yoki yuqorida yangi hisoblangan)
  const shiftDiffInfo = snapshot.shift_diff || { hasData: false, hasOpenShift: false, diff: 0, shifts: [] };

  // Наличные = Тоза + Rasxod + Инкассация + Smena farqi (Poster tomonida payed_cash)
  const inkassatsiya = getFakt('Инкассация');
  const naличныеFakt = entry.toza + entry.total_expense + inkassatsiya + shiftDiffInfo.diff;
  const naличныеPoster = snapshot.cash;

  const nonCashRows = [
    { name: 'UZCARD', fakt: getFakt('UZCARD'), poster: snapshot.uzcard || 0 },
    { name: 'HUMO', fakt: getFakt('HUMO'), poster: snapshot.humo || 0 },
    { name: 'Uz Qr Kod', fakt: getFakt('Uz Qr Kod'), poster: snapshot.uz_qr || 0 },
    { name: 'Карточки (aniqlanmagan)', fakt: 0, poster: snapshot.karta_other || 0 },
    { name: 'Click', fakt: getFakt('Click'), poster: snapshot.click || 0 },
    { name: 'Payme', fakt: getFakt('Payme'), poster: snapshot.payme || 0 },
    { name: 'Uzum', fakt: getFakt('Uzum'), poster: snapshot.uzum || 0 },
    { name: 'Alif', fakt: getFakt('Alif'), poster: snapshot.alif || 0 },
    { name: 'Paynet', fakt: getFakt('Paynet'), poster: snapshot.paynet || 0 },
  ];
  const безналичныеFakt = nonCashRows.reduce((s, r) => s + r.fakt, 0);
  const безналичныеPoster = nonCashRows.reduce((s, r) => s + r.poster, 0);

  const certRows = [
    { name: 'Yandex eats', fakt: getFakt('Yandex eats'), poster: snapshot.yandex_eats || 0 },
    { name: 'Jiz-Biz restaurant', fakt: getFakt('Jiz-Biz restaurant'), poster: snapshot.jizbiz || 0 },
  ];
  const sertifikatFakt = certRows.reduce((s, r) => s + r.fakt, 0);
  const sertifikatPoster = certRows.reduce((s, r) => s + r.poster, 0);

  const umumiyFakt = naличныеFakt + безналичныеFakt + sertifikatFakt;
  const umumiyPoster = naличныеPoster + безналичныеPoster + sertifikatPoster;

  const rows = [
    { name: 'Umumiy kassa', fakt: umumiyFakt, poster: umumiyPoster, level: 'total' },
    { name: 'Наличные оплаты', fakt: naличныеFakt, poster: naличныеPoster, level: 'subtotal' },
    { name: 'Безналичные оплаты', fakt: безналичныеFakt, poster: безналичныеPoster, level: 'subtotal' },
    ...nonCashRows.map((r) => ({ ...r, level: 'detail' })),
    { name: 'Сертификат', fakt: sertifikatFakt, poster: sertifikatPoster, level: 'subtotal' },
    ...certRows.map((r) => ({ ...r, level: 'detail' })),
  ];

  // --- Bonus qoidasi: Umumiy kassa farqi chegaradan oshsa, shu kunlik bonus bekor qilinadi ---
  const limitPercent = await getSettingNumber(CASH_DIFF_LIMIT_SETTING_KEY, DEFAULT_CASH_DIFF_LIMIT_PERCENT);
  let diffPercent = 0;
  if (umumiyPoster !== 0) {
    diffPercent = Math.abs((umumiyFakt - umumiyPoster) / umumiyPoster) * 100;
  }
  const cashDiffOk = diffPercent <= limitPercent;

  await pool.query('UPDATE daily_bonus SET cash_diff_ok = $1 WHERE date = $2 AND spot_id = $3', [
    cashDiffOk ? 1 : 0,
    entry.date,
    entry.spot_id,
  ]);
  // Solishtirish natijasini kassa yozuvining o'ziga ham saqlaymiz: KPI sahifasi
  // "berildi / berilmadi / tekshirilmagan" holatini aynan shu yerdan oladi.
  await pool.query(
    'UPDATE cash_entries SET check_ok = $1, check_diff_percent = $2, checked_at = now() WHERE id = $3',
    [cashDiffOk ? 1 : 0, diffPercent, entry.id]
  );

  return {
    locked: false,
    rows,
    computed_at: snapshot.computed_at,
    diff_percent: Math.round(diffPercent * 100) / 100,
    limit_percent: limitPercent,
    cash_diff_ok: cashDiffOk,
    shift_info: shiftDiffInfo,
  };
}

/**
 * Filiallar bo'yicha "Umumiy kassa" farqi hisoboti: berilgan davr uchun har bir
 * filialning UMUMIY va O'RTACHA KUNLIK farqini hisoblaydi. Faqat allaqachon
 * hisoblangan (poster_snapshot mavjud) yozuvlardan foydalanadi - Poster'ga
 * qo'shimcha so'rov yubormaydi (tezkor, ko'p filial/kun bo'lsa ham og'irlik qilmaydi).
 */
async function getBranchDiffReport(spotIds, dateFrom, dateTo) {
  const result = await pool.query(
    `SELECT date, spot_id, toza, total_expense, payment_types, total_amount, poster_snapshot
     FROM cash_entries
     WHERE spot_id = ANY($1) AND date >= $2 AND date <= $3 AND poster_snapshot IS NOT NULL`,
    [spotIds, dateFrom, dateTo]
  );

  const agg = new Map();
  spotIds.forEach((sId) => agg.set(sId, { total: 0, count: 0 }));

  for (const row of result.rows) {
    const snapshot = JSON.parse(row.poster_snapshot || '{}');
    const shiftDiff = snapshot.shift_diff && snapshot.shift_diff.hasData && !snapshot.shift_diff.hasOpenShift
      ? snapshot.shift_diff.diff
      : 0;

    const paymentTypes = JSON.parse(row.payment_types || '{}');
    const inkassatsiya = Number(paymentTypes['Инкассация']) || 0;
    const naличныеFakt = row.toza + row.total_expense + inkassatsiya + shiftDiff;

    const nonCashKeys = ['uzcard', 'humo', 'uz_qr', 'karta_other', 'click', 'payme', 'uzum', 'alif', 'paynet'];
    const certKeys = ['yandex_eats', 'jizbiz'];
    const безналичныеFakt = ['UZCARD', 'HUMO', 'Uz Qr Kod', 'Click', 'Payme', 'Uzum', 'Alif', 'Paynet']
      .reduce((s, name) => s + (Number(paymentTypes[name]) || 0), 0);
    const sertifikatFakt = ['Yandex eats', 'Jiz-Biz restaurant']
      .reduce((s, name) => s + (Number(paymentTypes[name]) || 0), 0);

    const umumiyFakt = naличныеFakt + безналичныеFakt + sertifikatFakt;
    const umumiyPoster = (snapshot.cash || 0) +
      nonCashKeys.reduce((s, k) => s + (snapshot[k] || 0), 0) +
      certKeys.reduce((s, k) => s + (snapshot[k] || 0), 0);

    const diff = Math.round(umumiyFakt - umumiyPoster);

    const entry = agg.get(row.spot_id);
    if (entry) {
      entry.total += diff;
      entry.count += 1;
    }
  }

  return spotIds.map((spotId) => {
    const entry = agg.get(spotId);
    return {
      spot_id: spotId,
      total_diff: entry.total,
      avg_diff: entry.count ? Math.round(entry.total / entry.count) : 0,
      days_count: entry.count,
    };
  });
}

/**
 * Fon vazifasi: 6 soatlik qulf o'tgan, lekin hali solishtirilmagan kassa yozuvlarini
 * AVTOMATIK hisoblaydi. Shunda bonus holati (berildi/berilmadi) hech kim sahifani
 * ochishini kutmaydi.
 *  1) Keshi bor, lekin natijasi saqlanmagan eski yozuvlar - faqat bazadan (Poster'ga so'rovsiz).
 *  2) Keshi yo'q yozuvlar - Poster'dan, har safar eng ko'pi bilan maxPosterFetches ta
 *     (Poster'ga yuk kichik bo'lishi uchun). Poster xato bersa, shu tsiklda to'xtaydi.
 */
async function computePendingComparisons(maxPosterFetches = 6) {
  const stats = { cached: 0, fetched: 0, errors: 0 };

  const cachedRes = await pool.query(
    `SELECT * FROM cash_entries
     WHERE poster_snapshot IS NOT NULL AND check_ok IS NULL
       AND created_at <= now() - ($1::float * interval '1 hour')
     ORDER BY date ASC LIMIT 100`,
    [RECONCILE_DELAY_HOURS]
  );
  for (const row of cachedRes.rows) {
    try {
      await getComparison(row, { forceUnlock: false });
      stats.cached += 1;
    } catch (e) {
      stats.errors += 1;
      console.error('[cash-check] Keshdan hisoblashda xato:', e.message);
    }
  }

  const pendingRes = await pool.query(
    `SELECT * FROM cash_entries
     WHERE poster_snapshot IS NULL
       AND created_at <= now() - ($1::float * interval '1 hour')
     ORDER BY created_at ASC LIMIT $2`,
    [RECONCILE_DELAY_HOURS, maxPosterFetches]
  );
  for (const row of pendingRes.rows) {
    try {
      await getComparison(row, { forceUnlock: false });
      stats.fetched += 1;
    } catch (e) {
      stats.errors += 1;
      console.error('[cash-check] Poster bilan solishtirishda xato (bu tsikl to\'xtatildi):', e.message);
      break;
    }
  }

  return stats;
}

/**
 * Admin kassa farqi chegarasini o'zgartirganda: allaqachon hisoblangan barcha kunlarni
 * SAQLANGAN farq foizi bo'yicha qayta baholaydi (Poster'ga so'rovsiz), shunda eski
 * va yangi kunlar bir xil chegara bilan baholanadi.
 */
async function reapplyCashDiffLimit(limitPercent) {
  await pool.query(
    'UPDATE cash_entries SET check_ok = CASE WHEN check_diff_percent <= $1 THEN 1 ELSE 0 END WHERE check_diff_percent IS NOT NULL',
    [limitPercent]
  );
  await pool.query(
    `UPDATE daily_bonus d SET cash_diff_ok = c.check_ok
     FROM cash_entries c
     WHERE c.date = d.date AND c.spot_id = d.spot_id AND c.check_ok IS NOT NULL`
  );
}

// ============ Poster ma'lumoti keyin o'zgarganini aniqlash (chek o'chirilsa va h.k.) ============

const CHANNEL_LABELS = {
  cash: 'Наличные', uzcard: 'UZCARD', humo: 'HUMO', uz_qr: 'Uz Qr Kod', karta_other: 'Карточки',
  click: 'Click', payme: 'Payme', uzum: 'Uzum', alif: 'Alif', paynet: 'Paynet',
  yandex_eats: 'Yandex eats', jizbiz: 'Jiz-Biz restaurant',
};
const SNAPSHOT_KEYS = Object.keys(CHANNEL_LABELS);
const RECHECK_TOLERANCE = 0.5; // so'm - yaxlitlash xatosini o'zgarish deb hisoblamaymiz

function snapshotTotal(snap) {
  return SNAPSHOT_KEYS.reduce((s, k) => s + (Number(snap[k]) || 0), 0);
}

let isRechecking = false;

/**
 * Oxirgi `days` ish kuni (bugundan tashqari) uchun Poster'dagi kassa ma'lumotini QAYTA oladi va
 * keshdagi bilan solishtiradi. Farq topilsa (masalan Poster'da chek o'chirilgan): keshni yangilaydi,
 * kunni qayta hisoblaydi (kassa farqi, bonus holati) va o'zgarishni jurnalga yozadi.
 * Poster'ga so'rov: faqat kassa yozuvi bor kunlar uchun, har kunga 2 ta (barcha filial bitta so'rovda).
 */
async function recheckRecentDays(days = 3) {
  if (isRechecking) return { skipped: true, checked: 0, changed: 0, errors: 0, days: [], changedDates: [] };
  isRechecking = true;
  const stats = { checked: 0, changed: 0, errors: 0, suspicious: 0, days: [], changedDates: [] };
  try {
    const nDays = Math.max(1, Math.min(7, Number(days) || 3));
    const today = getCurrentBusinessDate();
    const [ty, tm, td] = today.split('-').map(Number);

    for (let i = 1; i <= nDays; i++) {
      const dateStr = new Date(Date.UTC(ty, tm - 1, td - i)).toISOString().slice(0, 10);
      const entriesRes = await pool.query(
        'SELECT * FROM cash_entries WHERE date = $1 AND poster_snapshot IS NOT NULL',
        [dateStr]
      );
      if (entriesRes.rows.length === 0) continue; // Poster'ga keraksiz so'rov yubormaymiz
      stats.days.push(dateStr);

      let allTx;
      try {
        allTx = await fetchAllTransactionsForBusinessDay(dateStr);
      } catch (e) {
        stats.errors += 1;
        console.error(`[poster-recheck] ${dateStr}: Poster xatosi:`, e.message);
        continue; // keshdagi eski raqam o'zgarishsiz qoladi
      }

      for (const entry of entriesRes.rows) {
        stats.checked += 1;
        try {
          const oldSnap = JSON.parse(entry.poster_snapshot);
          const spotTx = allTx.filter((tx) => Number(tx.spot_id) === Number(entry.spot_id));

          // Poster butunlay bo'sh javob qaytarsa (vaqtinchalik uzilish bo'lishi mumkin), kesh
          // o'chirilmaydi - aks holda butun kun noto'g'ri "0" bo'lib qolardi
          if (allTx.length === 0 || (spotTx.length === 0 && snapshotTotal(oldSnap) > 0)) {
            stats.suspicious += 1;
            continue;
          }

          const newSnap = await buildPosterSnapshot(spotTx, entry.spot_id);
          const changes = [];
          for (const k of SNAPSHOT_KEYS) {
            const o = Number(oldSnap[k]) || 0;
            const n = Number(newSnap[k]) || 0;
            if (Math.abs(n - o) > RECHECK_TOLERANCE) changes.push({ name: CHANNEL_LABELS[k], old: Math.round(o), new: Math.round(n) });
          }
          if (changes.length === 0) continue;

          const updated = { ...newSnap, shift_diff: oldSnap.shift_diff, computed_at: new Date().toISOString() };
          await pool.query(
            'UPDATE cash_entries SET poster_snapshot = $1, poster_synced_at = now() WHERE id = $2',
            [JSON.stringify(updated), entry.id]
          );
          await getComparison({ ...entry, poster_snapshot: JSON.stringify(updated) }, { forceUnlock: false });
          const afterRes = await pool.query('SELECT check_ok FROM cash_entries WHERE id = $1', [entry.id]);

          await pool.query(
            `INSERT INTO poster_change_log (date, spot_id, old_total, new_total, details, status_before, status_after)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [entry.date, entry.spot_id, snapshotTotal(oldSnap), snapshotTotal(updated), JSON.stringify(changes),
              entry.check_ok, afterRes.rows[0] ? afterRes.rows[0].check_ok : null]
          );
          stats.changed += 1;
          if (!stats.changedDates.includes(entry.date)) stats.changedDates.push(entry.date);
          console.log(`[poster-recheck] ${entry.date} filial ${entry.spot_id}: Poster kassa ${Math.round(snapshotTotal(oldSnap))} -> ${Math.round(snapshotTotal(updated))}`);
        } catch (e) {
          stats.errors += 1;
          console.error(`[poster-recheck] ${entry.date} filial ${entry.spot_id}:`, e.message);
        }
      }
    }
  } finally {
    isRechecking = false;
  }
  return stats;
}

async function listPosterChanges(limit = 50) {
  const res = await pool.query(
    `SELECT id, detected_at, date, spot_id, old_total, new_total, details, status_before, status_after
     FROM poster_change_log ORDER BY id DESC LIMIT $1`,
    [limit]
  );
  return res.rows.map((r) => ({ ...r, details: r.details ? JSON.parse(r.details) : [] }));
}

module.exports = {
  recheckRecentDays, listPosterChanges, fetchAllTransactionsForBusinessDay,
  getComparison, isLocked, unlockTime, RECONCILE_DELAY_HOURS, fetchTransactionsForBusinessDay,
  getBranchDiffReport, computePendingComparisons, reapplyCashDiffLimit,
};
