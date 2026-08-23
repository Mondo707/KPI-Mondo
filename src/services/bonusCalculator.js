// Bonus hisoblash logikasi.
// Kirish: berilgan spot_id + sana uchun Poster tranzaksiyalari ro'yxati.
// Chiqish: har bir bonus kategoriyasi bo'yicha sotilgan miqdor va tegishli bonus summasi.

const fs = require('fs');
const path = require('path');
const { getEffectiveCategories } = require('./configService');

const PRODUCT_MAP_PATH = path.join(__dirname, '..', 'data', 'productMap.json');

let productById = new Map();

/**
 * productMap.json faylini (qayta) o'qib, xotiradagi xaritani yangilaydi.
 * Server ishga tushganda (yoki matchProducts() muvaffaqiyatli tugagandan keyin) chaqiriladi,
 * chunki fayl server ishga tushgan paytda hali mavjud bo'lmasligi mumkin.
 */
function reloadProductMap() {
  try {
    delete require.cache[require.resolve(PRODUCT_MAP_PATH)];
  } catch (e) {
    // hali cache qilinmagan bo'lishi mumkin, muammo emas
  }
  try {
    const productMap = JSON.parse(fs.readFileSync(PRODUCT_MAP_PATH, 'utf-8'));
    productById = new Map(productMap.map((p) => [p.product_id, p]));
    console.log(`[bonusCalculator] productMap yuklandi: ${productById.size} ta mahsulot`);
  } catch (e) {
    console.warn('[bonusCalculator] productMap.json hali mavjud emas yoki noto\'g\'ri.');
    productById = new Map();
  }
}

// Ilova ishga tushganda, agar fayl allaqachon mavjud bo'lsa, darhol yuklaymiz
reloadProductMap();

/**
 * Tranzaksiyalar ro'yxatidan bir kunlik/bitta filial uchun kategoriya bo'yicha
 * sotilgan miqdorlarni yig'adi.
 * @param {Array} transactions Poster transactions.getTransactions dan olingan .data massivi
 * @returns {Map<string, number>} kategoriya nomi -> jami miqdor (dona yoki kg)
 */
function aggregateQuantities(transactions) {
  const totals = new Map();

  for (const tx of transactions) {
    if (!tx.products) continue;
    for (const item of tx.products) {
      const info = productById.get(Number(item.product_id));
      if (!info || !info.counts_for_bonus) continue;

      const num = Number(item.num) || 0;
      const amount = info.kg_per_unit ? num * info.kg_per_unit : num;

      const prev = totals.get(info.bonus_category) || 0;
      totals.set(info.bonus_category, prev + amount);
    }
  }

  return totals;
}

/**
 * Berilgan miqdor uchun mos pog'onani topib, bonus summasini qaytaradi.
 * Agar miqdor birinchi pog'onadan kam bo'lsa (masalan 10 tadan kam), bonus 0.
 */
async function tierBonus(category, quantity) {
  const categories = await getEffectiveCategories();
  const cfg = categories[category];
  if (!cfg) return 0;

  let result = 0;
  for (const tier of cfg.tiers) {
    const inRange = tier.max === null ? quantity >= tier.min : quantity >= tier.min && quantity <= tier.max;
    if (inRange) {
      result = tier.bonus;
      break;
    }
  }
  return result;
}

/**
 * Bir kunlik/bitta filial uchun to'liq bonus hisobotini qaytaradi.
 * @param {Array} transactions shu kun + shu filial uchun tranzaksiyalar
 * @param {object} options { cashDiffOk: boolean } - agar false bo'lsa, bonus butunlay 0 qilinadi
 */
async function calculateDailyBonus(transactions, options = {}) {
  const quantities = aggregateQuantities(transactions);
  const breakdown = [];
  let total = 0;

  for (const [category, qty] of quantities.entries()) {
    const bonus = options.cashDiffOk === false ? 0 : await tierBonus(category, qty);
    breakdown.push({ category, quantity: Math.round(qty * 100) / 100, bonus });
    total += bonus;
  }

  return { breakdown, total, cashDiffOk: options.cashDiffOk !== false };
}

/**
 * Kunlik naqd/naqdsiz savdo yig'indisini tranzaksiyalardan hisoblaydi
 * (dash.getCashShifts o'rniga - u 405 xato berayotgani uchun).
 */
function sumCashCard(transactions) {
  let cash = 0;
  let card = 0;
  for (const tx of transactions) {
    cash += Number(tx.payed_cash) || 0;
    card += Number(tx.payed_card) || 0;
  }
  return { cash, card, total: cash + card };
}

/**
 * Xodim kiritgan summa bilan Poster hisobotidagi naqd summasini solishtiradi.
 * @param {number} enteredAmount xodim tomonidan ilovaga kiritilgan bugungi umumiy kassa
 * @param {number} posterCashTotal Poster'dagi 1 kunlik naqd+naqdsiz savdo yig'indisi
 * @param {number} limitPercent masalan 0.3
 */
function checkCashDiff(enteredAmount, posterCashTotal, limitPercent = 0.3) {
  if (posterCashTotal === 0) return { ok: true, diffPercent: 0 };
  const diff = Math.abs(enteredAmount - posterCashTotal);
  const diffPercent = (diff / posterCashTotal) * 100;
  return { ok: diffPercent <= limitPercent, diffPercent: Math.round(diffPercent * 100) / 100 };
}

module.exports = {
  aggregateQuantities,
  tierBonus,
  calculateDailyBonus,
  sumCashCard,
  checkCashDiff,
  reloadProductMap,
};
