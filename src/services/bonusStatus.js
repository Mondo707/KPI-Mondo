/**
 * Bitta (kun + filial) uchun bonus holatini aniqlaydi - butun saytda YAGONA qoida:
 *   given   - kassa Poster bilan solishtirilgan va farq chegara ichida  -> BERILDI
 *   held    - kassa solishtirilgan va farq chegaradan oshgan             -> BERILMADI
 *   pending - tekshirilmagan: kassa kiritilmagan YOKI hali solishtirilmagan -> TEKSHIRILMAGAN
 * Manba: cash_entries.check_ok. (Eski yozuvlarda u bo'sh, lekin keshi bor bo'lsa, daily_bonus
 * belgisiga tayaniladi - fon vazifasi ularni bir necha daqiqada yangilab chiqadi.)
 */
function classifyDay(r) {
  if (r.cash_id === null || r.cash_id === undefined) return { status: 'pending', reason: 'no_entry' };
  let check = r.check_ok;
  if (check === null || check === undefined) {
    check = r.has_snapshot ? r.cash_diff_ok : null;
  }
  if (check === null || check === undefined) return { status: 'pending', reason: 'waiting' };
  return check ? { status: 'given', reason: null } : { status: 'held', reason: 'diff' };
}


module.exports = { classifyDay };
