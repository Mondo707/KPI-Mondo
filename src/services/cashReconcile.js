// Kassa kiritilgan "Fakt" ma'lumotlarni Poster'dagi haqiqiy to'lovlar bilan solishtiradi.
//
// MUHIM: bu servis ma'lumotlarni oddiy "transactions.getTransactions" o'rniga
// "dash.getTransactions" orqali oladi - chunki faqat shu metod payment_method_id
// va client_id maydonlarini beradi (buni diagnostika orqali tasdiqladik).
// Vaqtni solishtirish uchun tx.date_close (raqamli epoch millisekund) ishlatiladi -
// bu ikkala Poster metodi orasidagi vaqt zonasi farqidan qochish uchun eng ishonchli usul.
//
// Tuzilma:
//   Umumiy kassa
//     Наличные оплаты   = Тоза + Umumiy rasxod + Инкассация (Poster tomonida: payed_cash)
//     Безналичные оплаты = pastdagi barcha kanallar yig'indisi
//       - UZCARD, HUMO, Uz Qr Kod, Click, Payme, Uzum, Alif, Paynet
//         (Poster tomonida: admin panelda sozlangan payment_method_id xaritasi orqali)
//       - Карточки - xaritada yo'q/aniqlanmagan karta to'lovlari (zaxira band)
//       - Yandex eats, Jiz-Biz restaurant - Poster'dagi client_id bo'yicha (aniq)

const poster = require('./posterClient');
const { pool } = require('../db/db');
const { getBusinessDayWindowEpoch } = require('./businessDay');
const { getMapping } = require('./posterPaymentMethods');

const RECONCILE_DELAY_HOURS = Number(process.env.CASH_RECONCILE_DELAY_HOURS || 6);

const CHANNEL_ORDER = ['uzcard', 'humo', 'uz_qr', 'karta_other', 'click', 'payme', 'uzum', 'alif', 'paynet', 'yandex_eats', 'jizbiz'];

/**
 * dash.getTransactions orqali berilgan "ish kuni" uchun barcha tranzaksiyalarni oladi
 * (payment_method_id va client_id bilan birga).
 */
async function fetchTransactionsForBusinessDay(dateStr, spotId) {
  const { startMs, endMs } = getBusinessDayWindowEpoch(dateStr);

  // Ikki kalendar kunini so'raymiz (chunki ish kuni kechayarim orqali o'tishi mumkin)
  const d1 = dateStr;
  const [y, m, d] = dateStr.split('-').map(Number);
  const nextDt = new Date(Date.UTC(y, m - 1, d + 1));
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

  return allTx.filter((tx) => {
    if (Number(tx.spot_id) !== Number(spotId)) return false;
    const closeMs = Number(tx.date_close);
    return closeMs >= startMs && closeMs < endMs;
  });
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
 * Tranzaksiyalarni kanal bo'yicha guruhlaydi: avval mijoz (Yandex eats/Jiz-Biz),
 * keyin qolganlarini naqd/karta va payment_method_id xaritasi bo'yicha.
 */
async function buildPosterSnapshot(transactions, spotId) {
  const clientMapping = await getClientMapping(spotId);
  const paymentMethodMapping = await getMapping(); // { payment_method_id: channel_key }

  const totals = { cash: 0, yandex_eats: 0, jizbiz: 0, karta_other: 0 };
  CHANNEL_ORDER.forEach((c) => { if (!(c in totals)) totals[c] = 0; });

  for (const tx of transactions) {
    const clientId = tx.client_id ? String(tx.client_id) : null;

    if (clientMapping.yandex_eats && clientId === String(clientMapping.yandex_eats)) {
      totals.yandex_eats += Number(tx.sum) || 0;
      continue;
    }
    if (clientMapping.jizbiz && clientId === String(clientMapping.jizbiz)) {
      totals.jizbiz += Number(tx.sum) || 0;
      continue;
    }

    totals.cash += Number(tx.payed_cash) || 0;

    const cardAmount = Number(tx.payed_card) || 0;
    if (cardAmount > 0) {
      const methodId = tx.payment_method_id;
      const channelKey = methodId !== undefined && methodId !== null ? paymentMethodMapping[String(methodId)] : undefined;
      if (channelKey && totals[channelKey] !== undefined) {
        totals[channelKey] += cardAmount;
      } else {
        totals.karta_other += cardAmount;
      }
    }

    // Sertifikat, elektron hamyon va uchinchi tomon to'lovlari - aniqlanmagan bandiga
    totals.karta_other += (Number(tx.payed_cert) || 0) + (Number(tx.payed_third_party) || 0) + (Number(tx.payed_ewallet) || 0);
  }

  return totals;
}

/**
 * Berilgan kassa yozuvi uchun Poster bilan solishtirish natijasini hisoblaydi
 * (yoki keshdan qaytaradi, agar avval hisoblangan bo'lsa).
 * @param {object} entry cash_entries qatori
 * @param {object} options { forceUnlock: boolean } - true bo'lsa (masalan admin so'ragan
 *   bo'lsa), 6 soatlik qulf hisobga olinmaydi.
 */
async function getComparison(entry, options = {}) {
  if (!options.forceUnlock && isLocked(entry)) {
    return { locked: true, unlock_at: unlockTime(entry) };
  }

  let snapshot;
  if (entry.poster_snapshot) {
    snapshot = JSON.parse(entry.poster_snapshot);
  } else {
    const transactions = await fetchTransactionsForBusinessDay(entry.date, entry.spot_id);
    snapshot = await buildPosterSnapshot(transactions, entry.spot_id);
    snapshot.computed_at = new Date().toISOString();

    await pool.query(
      'UPDATE cash_entries SET poster_snapshot = $1, poster_synced_at = now() WHERE id = $2',
      [JSON.stringify(snapshot), entry.id]
    );
  }

  const paymentTypes = JSON.parse(entry.payment_types || '{}');
  const getFakt = (name) => Number(paymentTypes[name]) || 0;

  // Наличные = Тоза + Rasxod + Инкассация (Poster tomonida payed_cash)
  const inkassatsiya = getFakt('Инкассация');
  const naличныеFakt = entry.toza + entry.total_expense + inkassatsiya;
  const naличныеPoster = snapshot.cash;

  const nonCashRows = [
    { key: 'uzcard', name: 'UZCARD', fakt: getFakt('UZCARD'), poster: snapshot.uzcard || 0 },
    { key: 'humo', name: 'HUMO', fakt: getFakt('HUMO'), poster: snapshot.humo || 0 },
    { key: 'uz_qr', name: 'Uz Qr Kod', fakt: getFakt('Uz Qr Kod'), poster: snapshot.uz_qr || 0 },
    { key: 'karta_other', name: 'Карточки (aniqlanmagan)', fakt: 0, poster: snapshot.karta_other || 0 },
    { key: 'click', name: 'Click', fakt: getFakt('Click'), poster: snapshot.click || 0 },
    { key: 'payme', name: 'Payme', fakt: getFakt('Payme'), poster: snapshot.payme || 0 },
    { key: 'uzum', name: 'Uzum', fakt: getFakt('Uzum'), poster: snapshot.uzum || 0 },
    { key: 'alif', name: 'Alif', fakt: getFakt('Alif'), poster: snapshot.alif || 0 },
    { key: 'paynet', name: 'Paynet', fakt: getFakt('Paynet'), poster: snapshot.paynet || 0 },
    { key: 'yandex_eats', name: 'Yandex eats', fakt: getFakt('Yandex eats'), poster: snapshot.yandex_eats || 0 },
    { key: 'jizbiz', name: 'Jiz-Biz restaurant', fakt: getFakt('Jiz-Biz restaurant'), poster: snapshot.jizbiz || 0 },
  ];

  const безналичныеFakt = nonCashRows.reduce((s, r) => s + r.fakt, 0);
  const безналичныеPoster = nonCashRows.reduce((s, r) => s + r.poster, 0);

  const umumiyFakt = naличныеFakt + безналичныеFakt;
  const umumiyPoster = naличныеPoster + безналичныеPoster;

  const rows = [
    { name: 'Umumiy kassa', fakt: umumiyFakt, poster: umumiyPoster, level: 'total' },
    { name: 'Наличные оплаты', fakt: naличныеFakt, poster: naличныеPoster, level: 'subtotal' },
    { name: 'Безналичные оплаты', fakt: безналичныеFakt, poster: безналичныеPoster, level: 'subtotal' },
    ...nonCashRows.map((r) => ({ name: r.name, fakt: r.fakt, poster: r.poster, level: 'detail' })),
  ];

  return { locked: false, rows, computed_at: snapshot.computed_at };
}

module.exports = { getComparison, isLocked, unlockTime, RECONCILE_DELAY_HOURS, fetchTransactionsForBusinessDay };
