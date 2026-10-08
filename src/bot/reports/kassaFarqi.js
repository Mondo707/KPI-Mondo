// "Kassa farqi (Fakt va Poster)" hisoboti: har bir filial uchun tanlangan davrdagi
// Fakt (kiritilgan kassa) va Poster summalari, farq va izoh. PDF qaytaradi.
const { pool } = require('../../db/db');
const { getComparison } = require('../../services/cashReconcile');
const { getCurrentBusinessDate } = require('../../services/businessDay');
const { getSettingNumber } = require('../../services/appSettings');
const { getAllowedSpots } = require('../spotNames');
const { renderTablePdf, fmtNum, COLOR } = require('../pdfTable');
const { t } = require('../strings');
const { listDates, fmtDate, nowTashkent } = require('../dates');

const TOLERANCE = 1000; // so'm
const MAX_POSTER_FETCHES = 12; // bitta hisobotda Poster'dan yangi yuklanadigan kun-filial soni

async function collect({ user, spotIds, from, to }) {
  const dates = listDates(from, to);
  const currentDay = getCurrentBusinessDate();
  const forceUnlock = user.role === 'admin';
  const res = await pool.query(
    'SELECT * FROM cash_entries WHERE spot_id = ANY($1) AND date >= $2 AND date <= $3 ORDER BY date',
    [spotIds, from, to]
  );
  const bySpot = new Map(spotIds.map((id) => [id, []]));
  res.rows.forEach((r) => bySpot.get(r.spot_id).push(r));

  let fetchBudget = MAX_POSTER_FETCHES;
  const out = new Map();
  for (const spotId of spotIds) {
    const rows = bySpot.get(spotId);
    const a = { fakt: 0, poster: 0, computed: 0, over: 0, waiting: 0, entries: rows.length, missing: 0, limit: 0 };
    const have = new Set(rows.map((r) => r.date));
    // kiritilishi kerak bo'lgan, lekin kiritilmagan kunlar (bugungi ish kuni hisobga olinmaydi)
    a.missing = dates.filter((d) => d < currentDay && !have.has(d)).length;
    for (const row of rows) {
      try {
        const needFetch = !row.poster_snapshot;
        const cmp = await getComparison(row, { forceUnlock, cachedOnly: needFetch && fetchBudget <= 0 });
        if (needFetch && !cmp.locked && !cmp.notComputed) fetchBudget -= 1;
        if (cmp.locked || cmp.notComputed) { a.waiting += 1; continue; }
        const total = cmp.rows.find((r) => r.level === 'total');
        a.fakt += total.fakt;
        a.poster += total.poster;
        a.computed += 1;
        a.limit = cmp.limit_percent;
        if (!cmp.cash_diff_ok) a.over += 1;
      } catch (e) {
        console.error('[bot] kassa farqi hisoblashda xato:', e.message);
        a.waiting += 1;
      }
    }
    out.set(spotId, a);
  }
  return { agg: out, dates };
}

function statusFor(lang, a, multiDay) {
  const parts = [];
  let kind;
  let main;
  if (a.entries === 0) {
    kind = 'none';
    main = t(lang, 'k_no_entry');
  } else if (a.computed === 0) {
    kind = 'none';
    main = multiDay ? t(lang, 'k_waiting_n', { n: a.waiting }) : t(lang, 'k_waiting');
  } else {
    const diff = a.poster - a.fakt; // Farq = Poster − Fakt
    if (Math.abs(diff) < TOLERANCE) {
      kind = 'ok';
      main = t(lang, 'k_ok');
    } else if (diff < 0) {
      kind = 'red'; // Fakt > Poster: Posterga urilmagan
      main = t(lang, 'k_not_posted', { x: fmtNum(Math.abs(diff)) });
    } else {
      kind = 'yellow'; // Fakt < Poster: kassa kam topshirilgan
      main = t(lang, 'k_less', { x: fmtNum(diff) });
    }
  }
  parts.push(main);
  if (a.computed > 0 && a.over > 0) parts.push(multiDay ? t(lang, 'k_over_n', { n: a.over }) : t(lang, 'k_over'));
  if (multiDay && a.entries > 0) {
    if (a.missing > 0) parts.push(t(lang, 'k_missing_n', { n: a.missing }));
    if (a.computed > 0 && a.waiting > 0) parts.push(t(lang, 'k_waiting_n', { n: a.waiting }));
  }
  return { kind, text: parts.join(' · ') };
}

async function build({ user, spotIds, from, to, lang }) {
  const allowed = await getAllowedSpots(user);
  const allowedIds = new Set(allowed.map((s) => s.id));
  const chosen = allowed.filter((s) => spotIds.includes(s.id) && allowedIds.has(s.id));
  if (!chosen.length) throw new Error('Filial tanlanmagan');

  const { agg, dates } = await collect({ user, spotIds: chosen.map((s) => s.id), from, to });
  const multiDay = dates.length > 1;
  const limitPct = await getSettingNumber('cash_diff_limit_percent', Number(process.env.CASH_DIFF_LIMIT_PERCENT || 0.3));

  const rows = [];
  let tFakt = 0;
  let tPoster = 0;
  let anyComputed = false;
  for (const s of chosen) {
    const a = agg.get(s.id);
    const st = statusFor(lang, a, multiDay);
    const fills = [null, null, null, null, null, null];
    const colors = [];
    const bold = [false, false, false, false, false, false];
    let cells;
    if (a.computed === 0) {
      cells = [s.name, '—', '—', '—', '—', st.text];
      fills[5] = COLOR.grey; colors[5] = COLOR.greyText;
    } else {
      anyComputed = true;
      tFakt += a.fakt;
      tPoster += a.poster;
      const diff = a.poster - a.fakt;
      const pct = a.poster !== 0 ? (Math.abs(diff) / a.poster) * 100 : 0;
      cells = [s.name, fmtNum(a.fakt), fmtNum(a.poster), fmtNum(diff === 0 ? 0 : diff), pct.toFixed(2) + '%', st.text];
      const fill = st.kind === 'ok' ? COLOR.green : st.kind === 'red' ? COLOR.red : COLOR.yellow;
      fills[3] = fill; fills[5] = fill;
      if (st.kind === 'red') { colors[3] = COLOR.redText; colors[5] = COLOR.redText; bold[3] = true; bold[5] = true; }
      if (st.kind === 'yellow') { bold[3] = true; bold[5] = true; }
    }
    rows.push({ cells, fills, colors, bold });
  }

  const tDiff = tPoster - tFakt;
  const totalRow = {
    cells: [
      t(lang, 'k_total'),
      anyComputed ? fmtNum(tFakt) : '—',
      anyComputed ? fmtNum(tPoster) : '—',
      anyComputed ? fmtNum(tDiff) : '—',
      '', '',
    ],
  };

  const dayWord = from === to
    ? (from === getCurrentBusinessDate() ? ` (${t(lang, 'd_today')})` : (from === shiftDay(getCurrentBusinessDate(), -1) ? ` (${t(lang, 'd_yesterday')})` : ''))
    : '';
  const periodText = from === to ? fmtDate(from) + dayWord : `${fmtDate(from)} – ${fmtDate(to)}`;
  const subtitle = [
    t(lang, 'k_period', { period: periodText }),
    t(lang, 'k_spots', { n: chosen.length }),
    t(lang, 'k_made', { time: nowTashkent() }),
  ].join(' · ');

  const pdf = await renderTablePdf({
    title: t(lang, 'k_title'),
    subtitle,
    columns: [
      { title: t(lang, 'k_col_spot'), width: 16, align: 'left' },
      { title: t(lang, 'k_col_fakt'), width: 14, align: 'right' },
      { title: t(lang, 'k_col_poster'), width: 14, align: 'right' },
      { title: t(lang, 'k_col_diff'), width: 13, align: 'right' },
      { title: t(lang, 'k_col_pct'), width: 11, align: 'right' },
      { title: t(lang, 'k_col_status'), width: 32, align: 'left' },
    ],
    rows,
    totalRow,
    footerNote: t(lang, 'k_note', { limit: limitPct }),
    fontSize: 9,
  });

  const fname = `${t(lang, 'file_kassa')}_${from}${from === to ? '' : '_' + to}.pdf`;
  return { pdf, filename: fname, caption: `📄 ${t(lang, 'k_title')}\n${periodText}` };
}

function shiftDay(d, n) {
  const [y, m, dd] = d.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, dd + n));
  return dt.toISOString().slice(0, 10);
}

module.exports = { build, collect, statusFor };
