require('dotenv').config();
const express = require('express');
require('./asyncErrors'); // async so'rovlardagi xatolar serverni yiqitmasdan, 500 javobiga aylanadi
const cors = require('cors');
const fs = require('fs');

const path = require('path');
const { ready: dbReady } = require('./db/db');
const { ensureAdminUser } = require('./services/bootstrap');
const { matchProducts } = require('./services/productMatcher');
const authRoutes = require('./routes/auth');
const bonusRoutes = require('./routes/bonus');
const spotsRoutes = require('./routes/spots');
const adminRoutes = require('./routes/admin');
const cashRoutes = require('./routes/cash');
const loginHistoryRoutes = require('./routes/loginHistory');
const portionRoutes = require('./routes/portion');
const { startScheduler } = require('./services/scheduler');
const { webhookRouter, initBot } = require('./bot');

const app = express();
const PORT = process.env.PORT || 4000;

// Render (va boshqa hostinglar) proksi orqasida ishlaydi - foydalanuvchining haqiqiy IP manzilini
// (login'ga urinishlarni cheklash uchun) shu sozlama orqali olamiz.
app.set('trust proxy', 1);

// Kutilmagan "unhandled rejection" butun serverni to'xtatmasin - yozib qo'yamiz.
process.on('unhandledRejection', (reason) => {
  console.error('[server] Ushlanmagan xato (server ishlashda davom etadi):', reason && reason.message ? reason.message : reason);
});

app.use(cors());
app.use(express.json());

// ---- Ilova fayllari versiyasi ----
// HTML sahifalardagi barcha /js/*.js va /css/*.css havolalariga deploy versiyasi qo'shiladi
// (masalan /js/api.js?v=ab12cd34). Har deploy'da versiya o'zgaradi, shuning uchun telefondagi
// eski ilova ham yangi faylni tarmoqdan olishga majbur - "eski fayl + yangi sahifa" xatosi bo'lmaydi.
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const APP_VERSION = (process.env.RENDER_GIT_COMMIT || '').slice(0, 8) || Date.now().toString(36);
const htmlCache = new Map(); // fayl yo'li -> { mtimeMs, html }

function versionAssetUrls(html) {
  return html.replace(/(src|href)="(\/(?:js|css)\/[^"?]+\.(?:js|css))"/g, `$1="$2?v=${APP_VERSION}"`);
}

app.get(/\.html$/, (req, res, next) => {
  const filePath = path.normalize(path.join(PUBLIC_DIR, req.path));
  if (!filePath.startsWith(PUBLIC_DIR + path.sep)) return next();
  fs.stat(filePath, (err, st) => {
    if (err || !st.isFile()) return next();
    let cached = htmlCache.get(filePath);
    if (!cached || cached.mtimeMs !== st.mtimeMs) {
      cached = { mtimeMs: st.mtimeMs, html: versionAssetUrls(fs.readFileSync(filePath, 'utf8')) };
      htmlCache.set(filePath, cached);
    }
    res.set('Content-Type', 'text/html; charset=utf-8');
    res.set('Cache-Control', 'no-cache');
    res.send(cached.html);
  });
});

app.use(express.static(PUBLIC_DIR));

app.get('/', (req, res) => res.redirect('/login.html'));

app.get('/api/health', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

app.use('/api/auth', authRoutes);
app.use('/api/bonus', bonusRoutes);
app.use('/api/spots', spotsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/cash', cashRoutes);
app.use('/api/login-history', loginHistoryRoutes);
app.use('/api/portion', portionRoutes);
app.use('/api/telegram', webhookRouter());

app.use((err, req, res, next) => {
  console.error('[server] So\'rovda xato:', req.method, req.originalUrl, '-', err && err.message ? err.message : err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: 'Server vaqtincha javob bera olmadi. Bir necha soniyadan keyin qayta urinib ko\'ring.' });
});

async function start() {
  await dbReady; // Baza jadvallari tayyor bo'lishini kutamiz
  await ensureAdminUser(); // ADMIN_LOGIN/ADMIN_PASSWORD bo'lsa, admin yaratadi (Render'da shell yo'q)

  try {
    await matchProducts(); // Poster mahsulotlarini bonus jadvali bilan moslashtirish
  } catch (e) {
    console.error('[server] Mahsulotlarni moslashtirishda xato (Poster ulanishini tekshiring):', e.message);
  }

  app.listen(PORT, () => {
    console.log(`KPI backend http://localhost:${PORT} portida ishga tushdi`);
    startScheduler();
    initBot();
  });
}

start();
