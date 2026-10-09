// "Kassa kiritilmagan" eslatmasi: PDF emas, oddiy matnli xabar. Faqat avto-hisobot sifatida yuboriladi;
// hamma filiallar kiritgan bo'lsa hech narsa yuborilmaydi (skip).
const { getMissingCash } = require('../../services/missingCash');
const { fmtDate } = require('../dates');
const { t } = require('../strings');

async function build({ user, spotIds, from, to, lang }) {
  const list = await getMissingCash({ user, from, to, spotIds });
  if (!list.length) return { skip: true };
  const allDates = new Set();
  list.forEach((it) => it.dates.forEach((d) => allDates.add(d)));
  const single = allDates.size === 1 ? Array.from(allDates)[0] : null;
  const head = single ? `${t(lang, 'm_title')} — ${fmtDate(single)}` : t(lang, 'm_title');
  const lines = list.map((it) => (single ? `• ${it.name}` : `• ${it.name} — ${it.dates.map(fmtDate).join(', ')}`));
  return { text: `${head}\n\n${lines.join('\n')}\n\n${t(lang, 'm_total', { n: list.length })}` };
}

module.exports = { build };
