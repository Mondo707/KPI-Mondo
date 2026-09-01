// Kassa kiritilgan "Fakt" ma'lumotlarni Poster'dagi haqiqiy to'lovlar bilan solishtiradi.
// DIQQAT (muhim texnik cheklov): Poster API tranzaksiyalarida faqat quyidagi umumiy
// maydonlar bor: payed_cash, payed_card, payed_cert, payed_third_party, payed_bonus.
// UZCARD va HUMO kabi aniq karta turlarini, yoki Click/Payme/Uzum/Alif/Paynet kabi
// elektron hamyonlarni Poster ALOHIDA-ALOHIDA bermaydi - ular "karta" yoki
// "boshqa to'lovlar" umumiy guruhida keladi. Shuning uchun quyidagi solishtirishda:
//  - "Наличные" va "Karta (UZCARD+HUMO)" - aniq (Poster shu ikkisini ajratib beradi)
//  - "Yandex eats" va "Jiz-Biz restaurant" - Poster'dagi client_id bo'yicha (admin
//    panelda sozlangan xarita orqali) - aniq, agar client_id to'g'ri sozlangan bo'lsa
//  - "Boshqa to'lovlar" (Инкассация+Click+Payme+Uzum+Alif+Paynet yig'indisi) -
//    Poster'ning "payed_third_party" umumiy maydoni bilan taqqoslanadi (bu guruh
//    ichida qaysi aniq xizmat ekanini Poster ajratib bermaydi)

const poster = require('./posterClient');
const { pool } = require('../db/db');
const { getBusinessDayWindow } = require('./businessDay');
const { computePosterPaymentBreakdown, sumByClientId } = require('./bonusCalculator');

const RECONCILE_DELAY_HOURS = Number(process.env.CASH_RECONCILE_DELAY_HOURS || 6);

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

/**
 * cash_entries yozuvi hali "qulflangan" (kiritilgandan beri RECONCILE_DELAY_HOURS
 * soat o'tmagan) bo'lsa true qaytaradi.
 */
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
    const breakdown = computePosterPaymentBreakdown(transactions);

    const mappingRes = await pool.query(
      'SELECT channel_key, poster_client_id FROM poster_client_mapping WHERE spot_id = $1',
      [entry.spot_id]
    );
    const mapping = {};
    mappingRes.rows.forEach((r) => { mapping[r.channel_key] = r.poster_client_id; });

    snapshot = {
      cash: breakdown.cash,
      card: breakdown.card,
      third_party: breakdown.thirdParty,
      yandex_eats: sumByClientId(transactions, mapping.yandex_eats),
      jizbiz: sumByClientId(transactions, mapping.jizbiz),
      computed_at: new Date().toISOString(),
    };

    await pool.query(
      'UPDATE cash_entries SET poster_snapshot = $1, poster_synced_at = now() WHERE id = $2',
      [JSON.stringify(snapshot), entry.id]
    );
  }

  const paymentTypes = JSON.parse(entry.payment_types || '{}');
  const naличныеFakt = entry.toza + entry.total_expense;
  const kartaFakt = (Number(paymentTypes['UZCARD']) || 0) + (Number(paymentTypes['HUMO']) || 0);
  const yandexFakt = Number(paymentTypes['Yandex eats']) || 0;
  const jizbizFakt = Number(paymentTypes['Jiz-Biz restaurant']) || 0;
  const otherFakt = ['Инкассация', 'Click', 'Payme', 'Uzum', 'Alif', 'Paynet']
    .reduce((s, k) => s + (Number(paymentTypes[k]) || 0), 0);

  const rows = [
    { name: 'Наличные', fakt: naличныеFakt, poster: snapshot.cash },
    { name: 'Karta (UZCARD+HUMO)', fakt: kartaFakt, poster: snapshot.card },
    { name: 'Yandex eats', fakt: yandexFakt, poster: snapshot.yandex_eats },
    { name: 'Jiz-Biz restaurant', fakt: jizbizFakt, poster: snapshot.jizbiz },
    { name: 'Boshqa to\'lovlar (Инкассация, Click, Payme, Uzum, Alif, Paynet)', fakt: otherFakt, poster: snapshot.third_party },
  ];

  const totalFakt = rows.reduce((s, r) => s + r.fakt, 0);
  const totalPoster = rows.reduce((s, r) => s + r.poster, 0);
  rows.push({ name: 'JAMI', fakt: totalFakt, poster: totalPoster, isTotal: true });

  return { locked: false, rows, computed_at: snapshot.computed_at };
}

module.exports = { getComparison, isLocked, unlockTime, RECONCILE_DELAY_HOURS };
