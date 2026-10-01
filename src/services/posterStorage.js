// Poster'dagi ombor (ingredient) qoldiqlari bilan ishlash - "Portsiya" bo'limi uchun.
//
// MUHIM (diagnostika orqali tasdiqlangan, 5+ marta sinovdan keyin topilgan):
//   "storage.getStorageLeftovers" metodi storage_id/spot_id/warehouse_id
//   parametrlarini INKOR QILADI - qaysi qiymat berilmasin, doim bir xil
//   (filtrланmagan) natija qaytaradi.
//
//   TO'G'RI METOD: "storage.getReportMovement" - bu yerda storage_id HAQIQIY
//   filtr sifatida ishlaydi. dateFrom=dateTo=bugungi kun qilib so'rasak,
//   javobdagi "end" maydoni - aynan shu kunning oxiridagi (joriy) qoldiq.
//   Sana formati boshqacha: "Ymd" (masalan "20260930"), ISO emas!

const poster = require('./posterClient');

function todayYmd() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

/**
 * Poster'dagi barcha ingredientlar ro'yxatini oladi (admin panelda "Portsiya
 * ingredientlari" qo'shishda tanlash uchun - bu ro'yxat filialga bog'liq emas,
 * shuning uchun menu.getIngredients'dan olinadi).
 */
async function getAllIngredients() {
  const result = await poster.call('menu.getIngredients');
  const list = Array.isArray(result) ? result : (result && result.response) || [];
  return list.map((ing) => ({
    ingredient_id: String(ing.ingredient_id),
    name: ing.ingredient_name,
    unit: ing.ingredient_unit,
  }));
}

/**
 * Berilgan filial (storage_id = spot_id) uchun barcha ingredientlarning JORIY
 * (bugungi kun oxiridagi) qoldig'ini oladi. Natija: { ingredient_id: qoldiq_son }
 */
async function getStorageLeftovers(spotId) {
  const today = todayYmd();
  const result = await poster.call('storage.getReportMovement', {
    dateFrom: today,
    dateTo: today,
    storage_id: spotId,
    type: 1, // 1 = ingredientlar (2=tovarlar, 3=modifikatsiyalar, 4=tех.karta, 5=yarim tayyor)
  });
  const list = Array.isArray(result) ? result : (result && result.response) || [];
  const map = new Map();
  list.forEach((item) => {
    map.set(String(item.ingredient_id), Number(item.end) || 0);
  });
  return map;
}

module.exports = { getAllIngredients, getStorageLeftovers };
