// Kassa smenasi (zakrit smen) shu kun uchun yopilganmi-yo'qmi, deb tekshiradi.
//
// MUHIM: Poster'ning ochiq API'sida bu ma'lumot uchun ishlaydigan aniq metod
// tasdiqlanmagan (biz turli variantlarni sinaymiz). Agar hech qaysi metod
// ishlamasa, tizim "aniqlab bo'lmadi" holatini qaytaradi va Yuborish tugmasini
// BLOKLAMAYDI (xatoga yo'l qo'ymaslik uchun ehtiyotkorlik bilan ochiq qoldiradi).
// Agar hisobingizda ishlaydigan metod topilsa, buni keyinroq qattiqroq qilib
// (majburiy bloklash) o'zgartirish mumkin.

const poster = require('./posterClient');

const CANDIDATES = [
  { method: 'dash.getCashShifts', httpMethod: 'POST' },
  { method: 'dash.getCashShifts', httpMethod: 'GET' },
  { method: 'finance.getCashShifts', httpMethod: 'GET' },
];

/**
 * @returns {{status: 'closed'|'open'|'unknown', raw?: any}}
 */
async function getShiftStatus(spotId, dateStr) {
  for (const { method, httpMethod } of CANDIDATES) {
    try {
      const data = await poster.call(method, { date_from: dateStr, date_to: dateStr, spot_id: spotId }, httpMethod);
      if (Array.isArray(data) && data.length > 0) {
        // Poster odatda smena obyektida date_end / status maydonlaridan birini beradi
        const shift = data[data.length - 1];
        const isClosed = !!(shift.date_end || shift.status === 'CLOSE' || shift.status === 'closed' || Number(shift.status) === 2);
        return { status: isClosed ? 'closed' : 'open', raw: shift };
      }
    } catch (e) {
      // keyingi nomzodni sinaymiz
    }
  }
  return { status: 'unknown' };
}

module.exports = { getShiftStatus };
