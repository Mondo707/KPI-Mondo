// "Kunlik savdo (kategoriya bo'yicha)": filial x kategoriya miqdorlari. Hamma narsa BITTA listga
// sig'adi: kategoriya 8 tadan ko'p bo'lsa, kategoriyalar qatorga, filiallar ustunga o'tkaziladi,
// kerak bo'lsa varaq kengayadi va shrift kichrayadi (7 pt gacha).
const { pool } = require('../../db/db');
const { getEffectiveCategories } = require('../../services/configService');
const { getAllowedSpots } = require('../spotNames');
const { renderTablePdfFit, fmtQty, COLOR } = require('../pdfTable');
const { sortByCategoryOrder } = require('../categoryOrder');
const { t } = require('../strings');
const { nowTashkent, periodLabel } = require('../dates');

const FLIP_OVER = 8; // shu sondan ko'p kategoriya bo'lsa - transpozitsiya

async function listCategories(date) {
  const cats = await getEffectiveCategories(date);
  const names = sortByCategoryOrder(Object.keys(cats));
  return names.map((name) => ({ name, unit: cats[name].unit === 'kg' ? 'kg' : 'dona' }));
}

async function build({ user, spotIds, from, to, lang, categories }) {
  const allowed = await getAllowedSpots(user);
  const chosen = allowed.filter((s) => spotIds.includes(s.id));
  if (!chosen.length) throw new Error('Filial tanlanmagan');

  const allCats = await listCategories(to);
  const cats = categories && categories.length ? allCats.filter((c) => categories.includes(c.name)) : allCats;
  if (!cats.length) throw new Error('Kategoriya tanlanmagan');

  const res = await pool.query(
    `SELECT spot_id, category, SUM(quantity) AS qty FROM daily_bonus
     WHERE spot_id = ANY($1) AND date >= $2 AND date <= $3 AND category = ANY($4)
     GROUP BY spot_id, category`,
    [chosen.map((s) => s.id), from, to, cats.map((c) => c.name)]
  );
  const qty = new Map(res.rows.map((r) => [`${r.spot_id}::${r.category}`, Number(r.qty)]));
  const unitWord = (c) => t(lang, c.unit === 'kg' ? 'u_kg' : 'u_dona');
  const catLabel = (c) => `${c.name}, ${unitWord(c)}`;
  const val = (spotId, c) => qty.get(`${spotId}::${c.name}`) || 0;
  const show = (v) => (v ? fmtQty(v) : '—');

  const flip = cats.length > FLIP_OVER;
  let columns; let rows; let totalRow = null; let pageWidth; let note;

  if (!flip) {
    columns = [{ title: t(lang, 'k_col_spot'), width: 18, align: 'left' }]
      .concat(cats.map((c) => ({ title: catLabel(c), width: 12, align: 'right' })));
    rows = chosen.map((s) => ({ cells: [s.name].concat(cats.map((c) => show(val(s.id, c)))) }));
    totalRow = {
      cells: [t(lang, 'k_total')].concat(cats.map((c) => show(chosen.reduce((sum, s) => sum + val(s.id, c), 0)))),
    };
    note = t(lang, 's_note');
  } else {
    const nCols = chosen.length + 2; // kategoriya + filiallar + JAMI
    // Ustun kengliklari matn uzunligiga qarab (so'z o'rtasidan uzilmasligi uchun); varaq kerak bo'lsa kengayadi
    const longestWord = (str) => String(str).split(/\s+/).reduce((m, w) => Math.max(m, w.length), 0);
    const spotW = chosen.map((s) => Math.min(100, Math.max(48, longestWord(s.name) * 5.9 + 12)));
    const totals = cats.map((c) => show(chosen.reduce((sum, s) => sum + val(s.id, c), 0)));
    const totW = Math.min(110, Math.max(54, Math.max(...totals.map((x) => x.length)) * 6 + 14));
    const labelW = Math.min(170, Math.max(118, Math.max(...cats.map((c) => catLabel(c).length)) * 5.4 + 14));
    const need = 72 + labelW + spotW.reduce((a, b) => a + b, 0) + totW;
    pageWidth = Math.max(841.89, need);
    columns = [{ title: t(lang, 's_col_cat'), width: labelW, align: 'left' }]
      .concat(chosen.map((s, i) => ({ title: s.name, width: spotW[i], align: 'right' })))
      .concat([{ title: t(lang, 'k_total'), width: totW, align: 'right' }]);
    rows = cats.map((c) => {
      const total = chosen.reduce((sum, s) => sum + val(s.id, c), 0);
      const cells = [catLabel(c)].concat(chosen.map((s) => show(val(s.id, c)))).concat([show(total)]);
      const fills = cells.map((_, i) => (i === nCols - 1 ? COLOR.totalBg : null));
      const bold = cells.map((_, i) => i === nCols - 1);
      return { cells, fills, bold };
    });
    note = `${t(lang, 's_note_flip')} ${t(lang, 's_note')}`;
  }

  const catsInfo = categories && categories.length && cats.length < allCats.length
    ? t(lang, 's_cats', { n: cats.length })
    : t(lang, 's_cats_all', { n: cats.length });
  const subtitle = [
    t(lang, 'k_period', { period: periodLabel(from, to, lang) }),
    catsInfo,
    t(lang, 'k_spots', { n: chosen.length }),
    t(lang, 'k_made', { time: nowTashkent() }),
  ].join(' · ');

  const pdf = await renderTablePdfFit({
    title: t(lang, 's_title'),
    subtitle,
    columns, rows, totalRow,
    footerNote: note,
    landscape: true,
    pageWidth,
    fontSize: flip ? 8 : 9.5,
    minFont: 7,
  });
  return {
    pdf,
    filename: `${t(lang, 'file_sales')}_${from}${from === to ? '' : '_' + to}.pdf`,
    caption: `📄 ${t(lang, 's_title')}\n${periodLabel(from, to, lang)}`,
  };
}

module.exports = { build, listCategories };
