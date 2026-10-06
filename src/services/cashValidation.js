// Kassa ma'lumotlarini tekshirish: noto'g'ri sana, manfiy yoki harfli summalar bazaga tushmasligi uchun.
const { getCurrentBusinessDate } = require('./businessDay');

const STAFF_MAX_DAYS_BACK = Number(process.env.CASH_STAFF_MAX_DAYS_BACK || 3);
const MAX_AMOUNT = 2000000000; // bazadagi INTEGER chegarasiga yetmaslik uchun

function isValidDateStr(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/**
 * Sana tekshiruvi. Hamma uchun: to'g'ri format va kelajak emas.
 * Oddiy xodim uchun qo'shimcha: bugundan boshlab eng ko'pi bilan STAFF_MAX_DAYS_BACK kun orqaga.
 * Admin eski kunlarni ham kirita oladi. Xato bo'lsa matn, aks holda null qaytaradi.
 */
function validateEntryDate(dateStr, user, { enforceWindow = true } = {}) {
  if (!isValidDateStr(dateStr)) return "Sana noto'g'ri. To'g'ri format: YYYY-MM-DD";
  const today = getCurrentBusinessDate();
  if (dateStr > today) return "Kelajak sanasiga ma'lumot kiritib bo'lmaydi";
  if (enforceWindow && (!user || user.role !== 'admin')) {
    const earliest = addDays(today, -STAFF_MAX_DAYS_BACK);
    if (dateStr < earliest) {
      return `Faqat oxirgi ${STAFF_MAX_DAYS_BACK} kun uchun kiritish mumkin (${earliest} dan boshlab). Eski kun uchun administratorga murojaat qiling.`;
    }
  }
  return null;
}

function toNonNegativeInt(v) {
  const n = typeof v === 'string' ? Number(v.replace(/[\s\u00A0]/g, '')) : v;
  return Number.isInteger(n) && n >= 0 && n <= MAX_AMOUNT ? n : null;
}

/**
 * { expenses, banknotes, payment_types } ni tekshiradi. Natija: { error } yoki { value } (tozalangan).
 */
function validateCashPayload(input) {
  const expenses = input.expenses === undefined ? [] : input.expenses;
  const banknotes = input.banknotes === undefined ? {} : input.banknotes;
  const paymentTypes = input.payment_types === undefined ? {} : input.payment_types;

  if (!Array.isArray(expenses) || expenses.length > 50) return { error: "Rasxodlar ro'yxati noto'g'ri (ko'pi bilan 50 ta)" };
  const cleanExpenses = [];
  for (const e of expenses) {
    const amount = toNonNegativeInt(e && e.amount);
    const name = e && e.name === undefined ? '' : e && e.name;
    if (amount === null) return { error: "Rasxod summasi musbat butun son bo'lishi kerak" };
    if (typeof name !== 'string' || name.length > 100) return { error: "Rasxod nomi noto'g'ri (ko'pi bilan 100 belgi)" };
    cleanExpenses.push({ name: name.trim(), amount });
  }

  const isPlainObject = (o) => o && typeof o === 'object' && !Array.isArray(o);
  if (!isPlainObject(banknotes)) return { error: "Kupyuralar ma'lumoti noto'g'ri" };
  const cleanBanknotes = {};
  for (const [denom, count] of Object.entries(banknotes)) {
    if (!/^\d{1,7}$/.test(denom)) return { error: `Kupyura turi noto'g'ri: ${denom}` };
    const c = toNonNegativeInt(count);
    if (c === null || c > 1000000) return { error: `${Number(denom).toLocaleString('ru-RU')} so'mlik kupyura soni manfiy bo'lmagan butun son bo'lishi kerak` };
    cleanBanknotes[denom] = c;
  }

  if (!isPlainObject(paymentTypes)) return { error: "To'lov turlari ma'lumoti noto'g'ri" };
  const cleanPayments = {};
  for (const [name, amount] of Object.entries(paymentTypes)) {
    if (!name || name.length > 60) return { error: "To'lov turi nomi noto'g'ri" };
    const a = toNonNegativeInt(amount);
    if (a === null) return { error: `"${name}" summasi musbat butun son bo'lishi kerak` };
    cleanPayments[name] = a;
  }

  const toza = Object.entries(cleanBanknotes).reduce((s, [d, c]) => s + Number(d) * c, 0);
  const total = toza
    + cleanExpenses.reduce((s, e) => s + e.amount, 0)
    + Object.values(cleanPayments).reduce((s, v) => s + v, 0);
  if (total > MAX_AMOUNT) return { error: "Umumiy summa juda katta - kiritilgan qiymatlarni tekshiring" };

  return { value: { expenses: cleanExpenses, banknotes: cleanBanknotes, payment_types: cleanPayments } };
}

module.exports = { validateEntryDate, validateCashPayload, isValidDateStr, STAFF_MAX_DAYS_BACK };
