// "KPI / Bonus holati" hisoboti: filial bo'yicha hisoblangan, berilgan, berilmagan va
// kutilayotgan bonus. Holat qoidasi saytdagi KPI sahifasi bilan bir xil (services/bonusStatus).
const { pool } = require('../../db/db');
const { classifyDay } = require('../../services/bonusStatus');
const { getSettingNumber } = require('../../services/appSettings');
const { getAllowedSpots } = require('../spotNames');
const { renderTablePdf, fmtNum, COLOR } = require('../pdfTable');
const { t } = require('../strings');
const { fmtDate, nowTashkent, periodLabel } = require('../dates');

async function build({ user, spotIds, from, to, lang }) {
  const allowed = await getAllowedSpots(user);
  const chosen = allowed.filter((s) => spotIds.includes(s.id));
  if (!chosen.length) throw new Error('Filial tanlanmagan');

  const res = await pool.query(
    `SELECT d.date, d.spot_id, SUM(d.bonus) AS bonus, MIN(d.cash_diff_ok) AS cash_diff_ok,
            c.id AS cash_id, c.check_ok, (c.poster_snapshot IS NOT NULL) AS has_snapshot
     FROM daily_bonus d
     LEFT JOIN cash_entries c ON c.date = d.date AND c.spot_id = d.spot_id
     WHERE d.spot_id = ANY($1) AND d.date >= $2 AND d.date <= $3
     GROUP BY d.date, d.spot_id, c.id, c.check_ok, c.poster_snapshot`,
    [chosen.map((s) => s.id), from, to]
  );

  const agg = new Map(chosen.map((s) => [s.id, {
    calc: 0, given: 0, held: 0, pending: 0, heldDays: 0, noEntryDays: 0, waitDays: 0, any: false,
  }]));
  for (const r of res.rows) {
    const a = agg.get(r.spot_id);
    if (!a) continue;
    const bonus = Number(r.bonus);
    const { status, reason } = classifyDay(r);
    a.any = true;
    a.calc += bonus;
    if (status === 'given') a.given += bonus;
    else if (status === 'held') { a.held += bonus; if (bonus > 0) a.heldDays += 1; }
    else {
      a.pending += bonus;
      if (bonus > 0) { if (reason === 'no_entry') a.noEntryDays += 1; else a.waitDays += 1; }
    }
  }

  const multiDay = from !== to;
  const limitPct = await getSettingNumber('cash_diff_limit_percent', Number(process.env.CASH_DIFF_LIMIT_PERCENT || 0.3));

  const rows = [];
  const tot = { calc: 0, given: 0, held: 0, pending: 0 };
  for (const s of chosen) {
    const a = agg.get(s.id);
    const fills = [];
    const colors = [];
    const bold = [];
    let cells;
    if (!a.any || (a.calc === 0 && a.heldDays === 0 && a.noEntryDays === 0 && a.waitDays === 0)) {
      cells = [s.name, '—', '—', '—', '—', t(lang, 'p_nodata')];
      fills[5] = COLOR.grey; colors[5] = COLOR.greyText;
    } else {
      tot.calc += a.calc; tot.given += a.given; tot.held += a.held; tot.pending += a.pending;
      const parts = [];
      let kind = 'ok';
      if (a.heldDays > 0) {
        kind = 'red';
        parts.push(multiDay ? t(lang, 'p_held_n', { n: a.heldDays }) : t(lang, 'p_held_1'));
      }
      if (a.noEntryDays > 0) {
        if (kind === 'ok') kind = 'yellow';
        parts.push(multiDay ? t(lang, 'p_noentry_n', { n: a.noEntryDays }) : t(lang, 'p_noentry_1'));
      }
      if (a.waitDays > 0) {
        if (kind === 'ok') kind = 'yellow';
        parts.push(multiDay ? t(lang, 'p_wait_n', { n: a.waitDays }) : t(lang, 'p_wait_1'));
      }
      if (kind === 'ok') parts.push(t(lang, 'p_all_given'));
      cells = [s.name, fmtNum(a.calc), fmtNum(a.given), fmtNum(a.held), fmtNum(a.pending), parts.join(' · ')];
      const fill = kind === 'ok' ? COLOR.green : kind === 'red' ? COLOR.red : COLOR.yellow;
      fills[5] = fill;
      if (kind === 'red') { colors[5] = COLOR.redText; bold[5] = true; fills[3] = COLOR.red; colors[3] = COLOR.redText; bold[3] = true; }
      if (kind === 'yellow') { bold[5] = true; }
      if (a.pending > 0) fills[4] = COLOR.yellow;
    }
    rows.push({ cells, fills, colors, bold });
  }

  const subtitle = [
    t(lang, 'k_period', { period: periodLabel(from, to, lang) }),
    t(lang, 'k_spots', { n: chosen.length }),
    t(lang, 'k_made', { time: nowTashkent() }),
  ].join(' · ');

  const pdf = await renderTablePdf({
    title: t(lang, 'p_title'),
    subtitle,
    columns: [
      { title: t(lang, 'k_col_spot'), width: 13, align: 'left' },
      { title: t(lang, 'p_col_calc'), width: 15, align: 'right' },
      { title: t(lang, 'p_col_given'), width: 15, align: 'right' },
      { title: t(lang, 'p_col_held'), width: 15, align: 'right' },
      { title: t(lang, 'p_col_pending'), width: 15, align: 'right' },
      { title: t(lang, 'k_col_status'), width: 27, align: 'left' },
    ],
    rows,
    totalRow: { cells: [t(lang, 'k_total'), fmtNum(tot.calc), fmtNum(tot.given), fmtNum(tot.held), fmtNum(tot.pending), ''] },
    footerNote: t(lang, 'p_note', { limit: limitPct }),
    fontSize: 9,
  });
  return {
    pdf,
    filename: `${t(lang, 'file_kpi')}_${from}${from === to ? '' : '_' + to}.pdf`,
    caption: `📄 ${t(lang, 'p_title')}\n${periodLabel(from, to, lang)}`,
  };
}

module.exports = { build };
