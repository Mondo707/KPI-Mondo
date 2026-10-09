// Avtomatik hisobotlar: admin belgilagan vaqtda hisobotni tanlangan foydalanuvchilarga (shaxsiy chat)
// va Telegram guruhlarga PDF qilib yuboradi. Natijalar jurnalga yoziladi.
const { pool } = require('../db/db');
const tg = require('./telegramApi');
const { getAllowedSpots, getSpots } = require('./spotNames');
const { presetRange } = require('./dates');
const { toUser, canSee, REPORTS } = require('./botService');
const { computePendingComparisons } = require('../services/cashReconcile');
const { renderTableImages } = require('./imageTable');

const CATCHUP_MINUTES = 360; // server uxlab qolgan bo'lsa, belgilangan vaqtdan keyin 6 soatgacha yuboriladi
const PERIODS = ['yesterday', 'last7', 'month'];

function parseArr(text) {
  try { const v = JSON.parse(text); return Array.isArray(v) ? v : []; } catch (e) { return []; }
}
function toDto(r) {
  return {
    id: r.id, name: r.name, report_key: r.report_key, send_time: r.send_time, period: r.period, lang: r.lang,
    spot_ids: parseArr(r.spot_ids).map(Number), user_ids: parseArr(r.user_ids).map(Number),
    group_ids: parseArr(r.group_ids).map(Number), category_names: parseArr(r.category_names).map(String),
    hide_amounts: !!r.hide_amounts, output_format: r.output_format || 'pdf',
    enabled: !!r.enabled, last_sent_date: r.last_sent_date,
  };
}

function tashkentNow() {
  const off = Number(process.env.TIMEZONE_OFFSET_HOURS || 5);
  const d = new Date(Date.now() + off * 3600 * 1000);
  const p = (n) => String(n).padStart(2, '0');
  return {
    date: `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`,
    minutes: d.getUTCHours() * 60 + d.getUTCMinutes(),
  };
}
function timeToMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

async function writeLog(rep, targetType, label, status, detail, manual) {
  try {
    await pool.query(
      `INSERT INTO auto_report_log (auto_id, report_name, target_type, target_label, status, detail, manual)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [rep.id, rep.name, targetType, label, status, detail || null, manual ? 1 : 0]
    );
    await pool.query('DELETE FROM auto_report_log WHERE id < (SELECT COALESCE(MAX(id), 0) - 1000 FROM auto_report_log)');
  } catch (e) {
    console.error('[auto-report] jurnalga yozib bo\'lmadi:', e.message);
  }
}

/**
 * Bitta avto-hisobotni yuboradi.
 * opts: { manual: bool, onlyUserId: number|null }  (onlyUserId - faqat shu foydalanuvchiga sinab yuborish)
 */
async function runReport(rep, opts = {}) {
  const manual = !!opts.manual;
  const summary = { ok: 0, failed: 0, skipped: 0 };
  const def = REPORTS[rep.report_key];
  if (!def) throw new Error('Noma\'lum hisobot turi');
  const range = presetRange(rep.period) || presetRange('yesterday');

  // Hisoblanmagan kunlar bo'lsa, avval hisoblab olamiz (hisobot to'liq chiqishi uchun)
  try { await computePendingComparisons(20); } catch (e) { console.error('[auto-report] oldindan hisoblashda xato:', e.message); }

  const cache = new Map(); // (til|rol|filiallar|savdosiz) -> PDF
  const imgCache = new Map();
  const hideAll = rep.report_key === 'k' && !!rep.hide_amounts;
  async function buildFor(user, spotIds, lang) {
    const cats = def.cats && rep.category_names.length ? rep.category_names : undefined;
    const key = `${lang}|${user.role === 'admin' ? 'a' : 'v'}|${spotIds.slice().sort((a, b) => a - b).join(',')}`;
    if (!cache.has(key)) {
      cache.set(key, await def.build({ user, spotIds, from: range.from, to: range.to, lang, categories: cats, hideAmounts: hideAll }));
    }
    return { key, out: cache.get(key) };
  }
  // Tanlangan formatga qarab PDF va/yoki rasm(lar) yuboradi
  async function deliver(chatId, key, out) {
    const fmt = rep.output_format || 'pdf';
    if (fmt === 'pdf' || fmt === 'both') await tg.sendDocument(chatId, out.pdf, out.filename, out.caption);
    if (fmt === 'image' || fmt === 'both') {
      if (!imgCache.has(key)) imgCache.set(key, renderTableImages(out.pdf.spec));
      const imgs = imgCache.get(key);
      for (let i = 0; i < imgs.length; i++) {
        const cap = i === 0 && fmt === 'image' ? out.caption.replace('📄', '🖼') : undefined;
        await tg.sendPhoto(chatId, imgs[i], cap);
      }
    }
  }

  // --- shaxsiy chatlar ---
  let userIds = rep.user_ids;
  if (opts.onlyUserId) userIds = [opts.onlyUserId];
  for (const uid of userIds) {
    const r = await pool.query('SELECT * FROM users WHERE id = $1', [uid]);
    const row = r.rows[0];
    const label = row ? `@${row.telegram_username || '—'} (${row.login})` : `#${uid}`;
    if (!row) { summary.skipped++; await writeLog(rep, 'user', label, 'o\'tkazildi', 'Foydalanuvchi topilmadi', manual); continue; }
    if (!row.is_active) { summary.skipped++; await writeLog(rep, 'user', label, 'o\'tkazildi', 'Foydalanuvchi faolsiz', manual); continue; }
    if (!row.telegram_id) { summary.skipped++; await writeLog(rep, 'user', label, 'o\'tkazildi', 'Telegram bog\'lanmagan (/start kerak)', manual); continue; }
    const user = toUser(row);
    if (!canSee(user, rep.report_key)) { summary.skipped++; await writeLog(rep, 'user', label, 'o\'tkazildi', 'Bu hisobotga huquqi yo\'q', manual); continue; }
    try {
      const allowed = (await getAllowedSpots(user)).map((s) => s.id);
      const spotIds = rep.spot_ids.length ? allowed.filter((id) => rep.spot_ids.includes(id)) : allowed;
      if (!spotIds.length) { summary.skipped++; await writeLog(rep, 'user', label, 'o\'tkazildi', 'Ruxsat etilgan filial yo\'q', manual); continue; }
      const { key, out } = await buildFor(user, spotIds, user.lang);
      await deliver(row.telegram_id, key, out);
      summary.ok++;
      await writeLog(rep, 'user', label, 'yuborildi', null, manual);
    } catch (e) {
      summary.failed++;
      await writeLog(rep, 'user', label, 'xato', e.message, manual);
    }
  }

  // --- guruhlar ---
  if (!opts.onlyUserId) {
    for (const gid of rep.group_ids) {
      const r = await pool.query('SELECT * FROM bot_groups WHERE chat_id = $1', [gid]);
      const g = r.rows[0];
      const label = g ? `${g.title || gid} (guruh)` : `#${gid} (guruh)`;
      if (!g || !g.is_active) { summary.skipped++; await writeLog(rep, 'group', label, 'o\'tkazildi', 'Guruh ulanmagan yoki bot chiqarib yuborilgan', manual); continue; }
      try {
        const pseudo = { id: 0, login: 'guruh', role: 'viewer', allowed_spots: [], allowed_sections: ['cash', 'kpi', 'daily_sales'], lang: rep.lang };
        let spotIds = rep.spot_ids;
        if (!spotIds.length) spotIds = (await getSpots()).map((s) => Number(s.spot_id));
        const { key, out } = await buildFor(pseudo, spotIds, rep.lang);
        await deliver(g.chat_id, key, out);
        summary.ok++;
        await writeLog(rep, 'group', label, 'yuborildi', null, manual);
      } catch (e) {
        summary.failed++;
        await writeLog(rep, 'group', label, 'xato', e.message, manual);
      }
    }
  }
  return summary;
}

async function tick() {
  if (!tg.enabled()) return;
  const now = tashkentNow();
  const res = await pool.query('SELECT * FROM auto_reports WHERE enabled = 1');
  for (const row of res.rows) {
    const mins = now.minutes - timeToMinutes(row.send_time);
    if (mins < 0 || mins > CATCHUP_MINUTES) continue;
    if (row.last_sent_date === now.date) continue;
    // Bir vaqtda ikki marta yuborilmasligi uchun "egallab" olamiz
    const claim = await pool.query(
      'UPDATE auto_reports SET last_sent_date = $1 WHERE id = $2 AND last_sent_date IS DISTINCT FROM $1 RETURNING id',
      [now.date, row.id]
    );
    if (!claim.rowCount) continue;
    try {
      const s = await runReport(toDto(row), { manual: false });
      console.log(`[auto-report] "${row.name}": yuborildi ${s.ok}, xato ${s.failed}, o'tkazildi ${s.skipped}`);
    } catch (e) {
      console.error(`[auto-report] "${row.name}" xato:`, e.message);
      await writeLog(toDto(row), 'system', '—', 'xato', e.message, false);
    }
  }
}

let timer = null;
function startAutoReports() {
  if (timer) return;
  const run = () => tick().catch((e) => console.error('[auto-report] tick xatosi:', e.message));
  timer = setInterval(run, 60 * 1000);
  setTimeout(run, 20 * 1000);
  console.log('[auto-report] Avto-hisobotlar rejalashtiruvchisi yoqildi (har daqiqada tekshiradi).');
}

module.exports = { startAutoReports, runReport, toDto, tick, PERIODS, parseArr };
