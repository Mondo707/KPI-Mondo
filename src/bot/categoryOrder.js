// Kategoriyalar tartibi (frontend'dagi public/js/categoryOrder.js bilan bir xil bo'lishi kerak).
const CATEGORY_ORDER = [
  'Шарик', 'Смесь', 'Кофе 250 мл', 'Кофе 350 мл', 'Чашка кофе', 'Айс кофе',
  'Лимонады', 'Манго сок', 'Милкшейк', 'Вафли', 'Десерты', 'Сан-себастьян',
  'Фреш', 'Фрозен', 'Чай', 'Фасовка',
];
function sortByCategoryOrder(names) {
  const known = CATEGORY_ORDER.filter((c) => names.includes(c));
  const unknown = names.filter((c) => !CATEGORY_ORDER.includes(c));
  return [...known, ...unknown];
}
module.exports = { CATEGORY_ORDER, sortByCategoryOrder };
