// Kassa kiritilgan "Fakt" ma'lumotlarni Poster'dagi haqiqiy to'lovlar bilan solishtiradi.
//
// Tuzilma:
//   Umumiy kassa
//     Наличные оплаты   = Тоза + Umumiy rasxod + Инкассация (Poster tomonida: payed_cash)
//     Безналичные оплаты = pastdagi barcha kanallar yig'indisi
//       - UZCARD, HUMO, Uz Qr Kod, Click, Payme, Uzum, Alif, Paynet
//         (Poster tomonida: admin panelda sozlangan payment_method_id xaritasi orqali)
//       - Карточки - xaritada yo'q/aniqlanmagan karta to'lovlari (zaxira band)
//       - Yandex eats, Jiz-Biz restaurant - Poster'dagi client_id bo'yicha (aniq)
//
// MUHIM: payment_method_id xaritasi hali sizning haqiqiy hisobingiz bilan
// sinalmagan. Agar xarita bo'sh bo'lsa, barcha karta to'lovlari "Карточки"
// bandiga tushadi - hech narsa yo'qolmaydi, faqat kanal-kanal ajratilmaydi.

const poster = require('./posterClient');
const { pool } = require('../db/db');
const { getBusinessDayWindow } = require('./businessDay');
const { getMapping } = require('./posterPaymentMethods');

const RECONCILE_DELAY_HOURS = Number(process.env.CASH_RECONCILE_DELAY_HOURS || 6);

const CHANNEL_LABELS = {
  uzcard: 'UZCARD',
  humo: 'HUMO',
  uz_qr: 'Uz Qr Kod',
  click: 'Click',
  payme: 'Payme',
  uzum: 'Uzum',
  alif: 'Alif',
  paynet: 'Paynet',
};
const CHANNEL_ORDER = ['uzcard', 'humo', 'uz_qr', 'karta_other', 'click', 'payme', 'uzum', 'alif', 'paynet', 'yandex_eats', 'jizbiz'];

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
 * Tranzaksiyalarni kanal bo'yicha guruhlaydi: avval mijoz (Yandex eats/Jiz-Biz),
 * keyin qolganlarini naqd/karta va payment_method_id xaritasi bo'yicha.
 */
async function buildPosterSnapshot(transactions, spotId) {
  const mappingRes = await pool.query(
    'SELECT channel_key, poster_client_id FROM poster_client_mapping WHERE spot_id = $1',
    [spotId]
  );
  const clientMapping = {};
  mappingRes.rows.forEach((r) => { clientMapping[r.channel_key] = r.poster_client_id; });

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
      const methodId = tx.payment_method_id ?? tx.pay_type;
      const channelKey = methodId !== undefined ? paymentMethodMapping[String(methodId)] : undefined;
      if (channelKey && totals[channelKey] !== undefined) {
        totals[channelKey] += cardAmount;
      } else {
        totals.karta_other += cardAmount;
      }
    }

    // Sertifikat va uchinchi tomon to'lovlari ham "Карточки"ga qo'shiladi (aniqlanmagan)
    totals.karta_other += (Number(tx.payed_cert) || 0) + (Number(tx.payed_third_party) || 0);
  }

  return totals;
}

/**
 * Berilgan kassa yozuvi uchun Poster bilan solishtirish natijasini hisoblaydi
 * (yoki keshdan qaytaradi, agar avval hisoblangan bo'lsa).
 */
async function getComparison(entry) {
  if (isLocked(entry)) {
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
