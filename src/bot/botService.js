// Mondo Bot: foydalanuvchini saytdagi hisob bilan bog'lash va interaktiv hisobotlar.
const { pool } = require('../db/db');
const tg = require('./telegramApi');
const { t } = require('./strings');
const { getAllowedSpots } = require('./spotNames');
const { presetRange, parseDates, fmtDate } = require('./dates');
const kassaFarqi = require('./reports/kassaFarqi');
const kpiBonus = require('./reports/kpiBonus');
const kunlikSavdo = require('./reports/kunlikSavdo');
const kassaEslatma = require('./reports/kassaEslatma');
const { renderTableImages } = require('./imageTable');
const { getCurrentBusinessDate } = require('../services/businessDay');

const DEFAULT_SECTIONS = ['kpi', 'daily_sales', 'bonus_table', 'cash', 'savdo', 'login_history', 'portsiya'];

// Hisobotlar ro'yxati: har biri uchun kerakli bo'lim huquqi (admin hammasiga ega)
const REPORTS = {
  k: { section: 'cash', btn: 'btn_report_kassa', title: 'btn_report_kassa', build: kassaFarqi.build },
  p: { section: 'kpi', btn: 'btn_report_kpi', title: 'btn_report_kpi', build: kpiBonus.build },
  m: { section: 'cash', auto_only: true, build: kassaEslatma.build }, // faqat avto-hisobotda (matnli eslatma)
  s: { section: 'daily_sales', btn: 'btn_report_sales', title: 'btn_report_sales', build: kunlikSavdo.build, cats: true, today: true },
};

const states = new Map(); // telegram_id -> { report, from, to, spots:Set, awaiting }
const busy = new Set();
const STATE_TTL = 6 * 3600 * 1000;

function getState(id) {
  const s = states.get(id);
  if (s && Date.now() - s.ts > STATE_TTL) { states.delete(id); return null; }
  return s || null;
}
function setState(id, patch) {
  const s = getState(id) || { spots: new Set() };
  Object.assign(s, patch, { ts: Date.now() });
  states.set(id, s);
  return s;
}

function parseJson(text, fallback) {
  try { const v = JSON.parse(text); return Array.isArray(v) ? v : fallback; } catch (e) { return fallback; }
}
function toUser(row) {
  return {
    id: row.id, login: row.login, role: row.role, is_active: !!row.is_active,
    allowed_spots: parseJson(row.allowed_spots, []),
    allowed_sections: parseJson(row.allowed_sections, DEFAULT_SECTIONS),
    lang: row.telegram_lang === 'ru' ? 'ru' : 'uz',
    telegram_id: row.telegram_id ? Number(row.telegram_id) : null,
  };
}
function canSee(user, reportKey) {
  const r = REPORTS[reportKey];
  return !!r && (user.role === 'admin' || user.allowed_sections.includes(r.section));
}

async function send(chatId, text, extra = {}) {
  return tg.call('sendMessage', { chat_id: chatId, text, ...extra });
}
async function edit(chatId, messageId, text, markup, parseMode = 'Markdown') {
  try {
    return await tg.call('editMessageText', {
      chat_id: chatId, message_id: messageId, text, parse_mode: parseMode, reply_markup: markup,
    });
  } catch (e) {
    if (/not modified/i.test(e.message)) return null;
    // Xabarni tahrirlab bo'lmasa (masalan eskirgan) - yangisini yuboramiz
    return send(chatId, text, { parse_mode: parseMode, reply_markup: markup });
  }
}

// ---------- ekranlar ----------
function menuScreen(user) {
  const L = user.lang;
  const rows = [];
  for (const key of Object.keys(REPORTS)) {
    if (!REPORTS[key].auto_only && canSee(user, key)) {
      rows.push([
        { text: t(L, `btn_short_${key}`), callback_data: `r:${key}` },
        { text: t(L, 'btn_quick'), callback_data: `q:${key}` },
      ]);
    }
  }
  const hasReports = rows.length > 0;
  rows.push([{ text: t(L, 'btn_lang'), callback_data: 'l' }]);
  return {
    text: hasReports ? t(L, 'menu_title') : `${t(L, 'menu_title')}\n\n${t(L, 'menu_empty')}`,
    markup: { inline_keyboard: rows },
  };
}

function periodScreen(user, reportKey) {
  const L = user.lang;
  const b = (k, d) => ({ text: t(L, k), callback_data: `p:${d}` });
  // Kassa farqi va KPI/Bonus uchun «Bugun» yo'q: bugungi kun hali hisoblanmaydi
  const withToday = REPORTS[reportKey].today === true;
  const rows = withToday
    ? [
      [b('p_yesterday', 'yesterday'), b('p_today', 'today')],
      [b('p_last7', 'last7'), b('p_month', 'month')],
      [b('p_prevmonth', 'prevmonth'), b('p_custom', 'custom')],
    ]
    : [
      [b('p_yesterday', 'yesterday'), b('p_last7', 'last7')],
      [b('p_month', 'month'), b('p_prevmonth', 'prevmonth')],
      [b('p_custom', 'custom')],
    ];
  rows.push([{ text: t(L, 'btn_back'), callback_data: 'b:m' }]);
  return {
    text: t(L, 'pick_period', { report: t(L, REPORTS[reportKey].title) }),
    markup: { inline_keyboard: rows },
  };
}

async function spotsScreen(user, st) {
  const L = user.lang;
  const spots = await getAllowedSpots(user);
  const single = spots.length === 1; // bitta filial: tanlash bosqichi o'tkazib yuboriladi
  if (single) st.spots.add(spots[0].id);
  const rows = [];
  if (!single) {
    for (let i = 0; i < spots.length; i += 2) {
      rows.push(spots.slice(i, i + 2).map((s) => ({
        text: `${st.spots.has(s.id) ? '✅' : '▫️'} ${s.name}`,
        callback_data: `s:${s.id}`,
      })));
    }
    rows.unshift([{ text: t(L, 'btn_all'), callback_data: 's:all' }, { text: t(L, 'btn_clear'), callback_data: 's:none' }]);
  }
  if (REPORTS[st.report].cats) {
    const all = await kunlikSavdo.listCategories(getCurrentBusinessDate());
    const n = st.catsSel ? st.catsSel.size : all.length;
    rows.push([{ text: t(L, 'btn_cats', { n, m: all.length }), callback_data: 'c:menu' }]);
  }
  rows.push([{ text: t(L, 'btn_pdf'), callback_data: 'g:pdf' }, { text: t(L, 'btn_img'), callback_data: 'g:img' }]);
  rows.push([{ text: t(L, 'btn_back'), callback_data: 'b:p' }, { text: t(L, 'btn_menu'), callback_data: 'b:m' }]);
  const period = st.from === st.to ? fmtDate(st.from) : `${fmtDate(st.from)} – ${fmtDate(st.to)}`;
  const report = t(L, REPORTS[st.report].title);
  return {
    text: single
      ? t(L, 'pick_one', { report, period, spot: spots[0].name })
      : t(L, 'pick_spots', { report, period, n: st.spots.size }),
    markup: { inline_keyboard: rows },
    spots,
  };
}

async function catsScreen(user, st) {
  const L = user.lang;
  const all = await kunlikSavdo.listCategories(getCurrentBusinessDate());
  if (!st.catsSel) st.catsSel = new Set(all.map((c) => c.name));
  const rows = [];
  for (let i = 0; i < all.length; i += 2) {
    rows.push(all.slice(i, i + 2).map((c, k) => ({
      text: `${st.catsSel.has(c.name) ? '✅' : '▫️'} ${c.name}`,
      callback_data: `c:${i + k}`,
    })));
  }
  rows.push([{ text: t(L, 'btn_all'), callback_data: 'c:all' }, { text: t(L, 'btn_clear'), callback_data: 'c:none' }]);
  rows.push([{ text: t(L, 'btn_back_spots'), callback_data: 'b:s' }]);
  return {
    text: t(L, 'pick_cats', { report: t(L, REPORTS[st.report].title), n: st.catsSel.size, m: all.length }),
    markup: { inline_keyboard: rows },
    all,
  };
}

// ---------- foydalanuvchini aniqlash va bog'lash ----------
async function findLinked(tgId) {
  const r = await pool.query('SELECT * FROM users WHERE telegram_id = $1', [tgId]);
  return r.rows[0] || null;
}

async function handleStart(from, chatId) {
  const L = from.language_code && from.language_code.startsWith('ru') ? 'ru' : 'uz';
  const linked = await findLinked(from.id);
  if (linked) {
    const user = toUser(linked);
    if (!user.is_active) return send(chatId, t(user.lang, 'inactive'));
    const m = menuScreen(user);
    return send(chatId, m.text, { parse_mode: 'Markdown', reply_markup: m.markup });
  }
  if (!from.username) return send(chatId, t(L, 'no_username'));
  const uname = from.username.toLowerCase();
  const r = await pool.query('SELECT * FROM users WHERE lower(telegram_username) = $1', [uname]);
  const row = r.rows[0];
  if (!row) return send(chatId, t(L, 'not_registered', { username: '@' + from.username }));
  if (!row.is_active) return send(chatId, t(L, 'inactive'));
  if (row.telegram_id && Number(row.telegram_id) !== Number(from.id)) return send(chatId, t(L, 'taken'));
  await pool.query(
    'UPDATE users SET telegram_id = $1, telegram_linked_at = now(), telegram_lang = $2 WHERE id = $3',
    [from.id, L, row.id]
  );
  const user = toUser({ ...row, telegram_id: from.id, telegram_lang: L });
  await send(chatId, t(L, 'start_linked', { login: user.login }));
  const m = menuScreen(user);
  return send(chatId, m.text, { parse_mode: 'Markdown', reply_markup: m.markup });
}

async function requireUser(from, chatId) {
  const row = await findLinked(from.id);
  if (!row) { await send(chatId, t('uz', 'unlinked') + '\n\n' + t('ru', 'unlinked')); return null; }
  const user = toUser(row);
  if (!user.is_active) { await send(chatId, t(user.lang, 'inactive')); return null; }
  return user;
}

// ---------- xabarlar ----------
// Guruhda faqat bitta buyruq ishlaydi: /guruh (faqat bog'langan admin yuborsa guruh ro'yxatga olinadi)
async function onGroupMessage(msg) {
  const text = (msg.text || '').trim();
  if (!/^\/guruh(@\w+)?(\s|$)/i.test(text)) return;
  const chatId = msg.chat.id;
  const row = msg.from ? await findLinked(msg.from.id) : null;
  if (!row || row.role !== 'admin' || !row.is_active) {
    return send(chatId, t('uz', 'group_admin_only') + '\n' + t('ru', 'group_admin_only'));
  }
  await pool.query(
    `INSERT INTO bot_groups (chat_id, title, registered_by, registered_at, is_active)
     VALUES ($1, $2, $3, now(), 1)
     ON CONFLICT (chat_id) DO UPDATE SET title = EXCLUDED.title, registered_by = EXCLUDED.registered_by, is_active = 1`,
    [chatId, msg.chat.title || String(chatId), row.login]
  );
  const ttl = msg.chat.title ? ` «${msg.chat.title}»` : '';
  return send(chatId, t('uz', 'group_ok', { title: ttl }) + '\n' + t('ru', 'group_ok', { title: ttl }));
}

async function onMyChatMember(upd) {
  const chat = upd.chat;
  if (!chat || chat.type === 'private') return;
  const status = upd.new_chat_member && upd.new_chat_member.status;
  if (status === 'left' || status === 'kicked') {
    await pool.query('UPDATE bot_groups SET is_active = 0 WHERE chat_id = $1', [chat.id]);
  }
}

async function onMessage(msg) {
  const chatId = msg.chat.id;
  if (msg.chat.type !== 'private') return onGroupMessage(msg);
  const from = msg.from;
  const text = (msg.text || '').trim();

  if (/^\/start(@\w+)?(\s|$)/i.test(text)) return handleStart(from, chatId);

  const user = await requireUser(from, chatId);
  if (!user) return;

  if (/^\/(menu|help)(@\w+)?$/i.test(text)) {
    states.delete(from.id);
    const m = menuScreen(user);
    return send(chatId, m.text, { parse_mode: 'Markdown', reply_markup: m.markup });
  }
  if (/^\/lang(@\w+)?$/i.test(text)) return toggleLang(user, chatId, null);

  const st = getState(from.id);
  if (st && st.awaiting === 'dates') {
    const p = parseDates(text);
    if (p.error) {
      const key = p.error === 'future' ? 'dates_future' : p.error === 'long' ? 'dates_long' : 'bad_dates';
      return send(chatId, t(user.lang, key), { parse_mode: 'Markdown' });
    }
    setState(from.id, { from: p.from, to: p.to, awaiting: null });
    const s = await spotsScreen(user, getState(from.id));
    return send(chatId, s.text, { parse_mode: 'Markdown', reply_markup: s.markup });
  }

  const m = menuScreen(user);
  return send(chatId, m.text, { parse_mode: 'Markdown', reply_markup: m.markup });
}

async function toggleLang(user, chatId, messageId) {
  const newLang = user.lang === 'uz' ? 'ru' : 'uz';
  await pool.query('UPDATE users SET telegram_lang = $1 WHERE id = $2', [newLang, user.id]);
  user.lang = newLang;
  const m = menuScreen(user);
  if (messageId) return edit(chatId, messageId, m.text, m.markup);
  return send(chatId, m.text, { parse_mode: 'Markdown', reply_markup: m.markup });
}

// ---------- tugmalar ----------
async function onCallback(cb) {
  const chatId = cb.message.chat.id;
  const mid = cb.message.message_id;
  const from = cb.from;
  const data = cb.data || '';
  const answer = (text) => tg.call('answerCallbackQuery', { callback_query_id: cb.id, ...(text ? { text } : {}) }).catch(() => {});

  if (cb.message.chat.type !== 'private') return answer();
  const row = await findLinked(from.id);
  if (!row) { await answer(); return send(chatId, t('uz', 'unlinked')); }
  const user = toUser(row);
  if (!user.is_active) { await answer(); return send(chatId, t(user.lang, 'inactive')); }
  const L = user.lang;

  const showMenu = async () => {
    states.delete(from.id);
    const m = menuScreen(user);
    return edit(chatId, mid, m.text, m.markup);
  };

  if (data === 'm' || data === 'b:m') { await answer(); return showMenu(); }
  if (data === 'l') { await answer(); return toggleLang(user, chatId, mid); }

  if (data.startsWith('r:')) {
    const key = data.slice(2);
    if (!canSee(user, key) || REPORTS[key].auto_only) { await answer(t(L, 'no_access')); return; }
    setState(from.id, { report: key, from: null, to: null, spots: new Set(), catsSel: null, awaiting: null });
    await answer();
    const s = periodScreen(user, key);
    return edit(chatId, mid, s.text, s.markup);
  }

  // ⚡ Kecha: davr = kecha, filiallar = hammasi (ruxsat etilganlar), keyin faqat format tanlanadi
  if (data.startsWith('q:')) {
    const key = data.slice(2);
    if (!canSee(user, key) || REPORTS[key].auto_only) { await answer(t(L, 'no_access')); return; }
    const range = presetRange('yesterday');
    const allowed = await getAllowedSpots(user);
    setState(from.id, { report: key, from: range.from, to: range.to, spots: new Set(allowed.map((s) => s.id)), catsSel: null, awaiting: null });
    await answer();
    const s = await spotsScreen(user, getState(from.id));
    return edit(chatId, mid, s.text, s.markup);
  }

  // Hisobotdan keyingi «Boshqa davr»: yangi xabar sifatida davr tanlash ekrani
  if (data.startsWith('a:')) {
    const key = data.slice(2);
    await answer();
    if (!canSee(user, key) || !REPORTS[key] || REPORTS[key].auto_only) { const m = menuScreen(user); return send(chatId, m.text, { parse_mode: 'Markdown', reply_markup: m.markup }); }
    setState(from.id, { report: key, from: null, to: null, spots: new Set(), catsSel: null, awaiting: null });
    const s = periodScreen(user, key);
    return send(chatId, s.text, { parse_mode: 'Markdown', reply_markup: s.markup });
  }

  const st = getState(from.id);
  if (!st || !st.report) { await answer(t(L, 'expired')); return showMenu(); }
  if (!canSee(user, st.report)) { await answer(t(L, 'no_access')); return showMenu(); }

  if (data === 'b:p') {
    await answer();
    setState(from.id, { awaiting: null });
    const s = periodScreen(user, st.report);
    return edit(chatId, mid, s.text, s.markup);
  }

  if (data.startsWith('p:')) {
    const key = data.slice(2);
    await answer();
    if (key === 'custom') {
      setState(from.id, { awaiting: 'dates' });
      return edit(chatId, mid, t(L, 'ask_dates'), {
        inline_keyboard: [[{ text: t(L, 'btn_back'), callback_data: 'b:p' }]],
      });
    }
    const range = presetRange(key);
    if (!range) return;
    setState(from.id, { from: range.from, to: range.to, awaiting: null });
    const s = await spotsScreen(user, getState(from.id));
    return edit(chatId, mid, s.text, s.markup);
  }

  if (data === 'b:s') {
    await answer();
    if (!st.from) return showMenu();
    const s2 = await spotsScreen(user, st);
    return edit(chatId, mid, s2.text, s2.markup);
  }

  if (data.startsWith('c:')) {
    if (!st.from || !REPORTS[st.report].cats) { await answer(t(L, 'expired')); return showMenu(); }
    const arg = data.slice(2);
    if (arg !== 'menu') {
      const all = await kunlikSavdo.listCategories(getCurrentBusinessDate());
      if (!st.catsSel) st.catsSel = new Set(all.map((c) => c.name));
      if (arg === 'all') all.forEach((c) => st.catsSel.add(c.name));
      else if (arg === 'none') st.catsSel.clear();
      else {
        const c = all[Number(arg)];
        if (c) { if (st.catsSel.has(c.name)) st.catsSel.delete(c.name); else st.catsSel.add(c.name); }
      }
      setState(from.id, {});
    }
    await answer();
    const cs = await catsScreen(user, getState(from.id));
    return edit(chatId, mid, cs.text, cs.markup);
  }

  if (data.startsWith('s:')) {
    if (!st.from) { await answer(t(L, 'expired')); return showMenu(); }
    const arg = data.slice(2);
    const allowed = await getAllowedSpots(user);
    if (arg === 'all') allowed.forEach((s) => st.spots.add(s.id));
    else if (arg === 'none') st.spots.clear();
    else {
      const id = Number(arg);
      if (allowed.some((s) => s.id === id)) {
        if (st.spots.has(id)) st.spots.delete(id); else st.spots.add(id);
      }
    }
    setState(from.id, {});
    await answer();
    const s = await spotsScreen(user, getState(from.id));
    return edit(chatId, mid, s.text, s.markup);
  }

  if (data === 'g' || data === 'g:pdf' || data === 'g:img') {
    const asImage = data === 'g:img';
    if (!st.from) { await answer(t(L, 'expired')); return showMenu(); }
    if (!st.spots.size) { await answer(t(L, 'no_spots_chosen')); return; }
    if (REPORTS[st.report].cats && st.catsSel && st.catsSel.size === 0) { await answer(t(L, 'no_cats_chosen')); return; }
    if (busy.has(from.id)) { await answer(t(L, 'busy')); return; }
    busy.add(from.id);
    await answer(t(L, 'generating'));
    let progress = null;
    try {
      progress = await send(chatId, t(L, 'generating')).catch(() => null);
      await tg.call('sendChatAction', { chat_id: chatId, action: asImage ? 'upload_photo' : 'upload_document' }).catch(() => {});
      const out = await REPORTS[st.report].build({
        user, spotIds: Array.from(st.spots), from: st.from, to: st.to, lang: L,
        categories: REPORTS[st.report].cats && st.catsSel ? Array.from(st.catsSel) : undefined,
      });
      const after = { inline_keyboard: [[
        { text: t(L, 'btn_again'), callback_data: `a:${st.report}` },
        { text: t(L, 'btn_menu'), callback_data: 'b:m' },
      ]] };
      if (asImage) {
        const imgs = renderTableImages(out.pdf.spec);
        for (let i = 0; i < imgs.length; i++) {
          const last = i === imgs.length - 1;
          await tg.sendPhoto(chatId, imgs[i], i === 0 ? out.caption.replace('📄', '🖼') : undefined, last ? after : undefined);
        }
      } else {
        await tg.sendDocument(chatId, out.pdf, out.filename, out.caption, after);
      }
    } catch (e) {
      console.error('[bot] hisobot yaratishda xato:', e.message);
      await send(chatId, t(L, 'gen_error', { msg: e.message }));
    } finally {
      if (progress && progress.message_id) tg.call('deleteMessage', { chat_id: chatId, message_id: progress.message_id }).catch(() => {});
      busy.delete(from.id);
    }
    return;
  }

  return answer();
}

async function handleUpdate(update) {
  try {
    if (update.message) return await onMessage(update.message);
    if (update.callback_query) return await onCallback(update.callback_query);
    if (update.my_chat_member) return await onMyChatMember(update.my_chat_member);
  } catch (e) {
    console.error('[bot] update xatosi:', e.message);
  }
}

module.exports = { handleUpdate, toUser, canSee, REPORTS };
