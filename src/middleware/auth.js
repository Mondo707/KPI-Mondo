const jwt = require('jsonwebtoken');
const { pool } = require('../db/db');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-please-change';

const DEFAULT_SECTIONS = ['kpi', 'daily_sales', 'bonus_table', 'cash', 'savdo', 'login_history', 'portsiya'];

function parseJsonArray(text, fallback) {
  try {
    const v = JSON.parse(text);
    return Array.isArray(v) ? v : fallback;
  } catch (e) {
    return fallback;
  }
}

async function authRequired(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Token topilmadi' });

  // 1) Token yaroqliligi: faqat shu holatda 401 (frontend foydalanuvchini login sahifasiga qaytaradi)
  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch (e) {
    return res.status(401).json({ error: 'Token yaroqsiz yoki muddati o\'tgan' });
  }

  // 2) Foydalanuvchi holati va HUQUQLARI har so'rovda bazadan olinadi: admin huquqni
  //    o'zgartirsa yoki faolsizlantirsa, token muddatini (12 soat) kutmasdan darhol kuchga kiradi.
  //    Baza vaqtincha ishlamasa - bu 401 EMAS (foydalanuvchi tizimdan chiqarib yuborilmaydi),
  //    xato umumiy xato ushlagichga o'tadi (500).
  const result = await pool.query(
    'SELECT is_active, role, allowed_spots, allowed_sections FROM users WHERE id = $1',
    [payload.id]
  );
  const user = result.rows[0];
  if (!user || !user.is_active) {
    return res.status(403).json({ error: 'Bu foydalanuvchi faolsizlantirilgan' });
  }

  req.user = {
    ...payload,
    role: user.role,
    allowed_spots: parseJsonArray(user.allowed_spots, []),
    allowed_sections: parseJsonArray(user.allowed_sections, DEFAULT_SECTIONS),
  };
  next();
}

function adminOnly(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Faqat admin uchun ruxsat berilgan' });
  }
  next();
}

/**
 * Foydalanuvchi ma'lum bir bo'limga (masalan 'dashboard' yoki 'cash') kirish huquqiga
 * ega bo'lishini talab qiladi. Admin har doim barcha bo'limlarga kira oladi.
 */
function requireSection(section) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Token topilmadi' });
    if (req.user.role === 'admin') return next();

    const allowed = req.user.allowed_sections || ['kpi', 'daily_sales', 'bonus_table', 'cash', 'savdo', 'login_history', 'portsiya'];
    if (!allowed.includes(section)) {
      return res.status(403).json({ error: 'Bu bo\'limga ruxsatingiz yo\'q' });
    }
    next();
  };
}

/**
 * Foydalanuvchi berilgan bo'limlardan KAMIDA BITTASIGA kirish huquqiga ega
 * bo'lishini talab qiladi (masalan /api/bonus ham KPI, ham Kunlik savdo
 * sahifalarida ishlatiladi).
 */
function requireAnySection(...sections) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Token topilmadi' });
    if (req.user.role === 'admin') return next();

    const allowed = req.user.allowed_sections || ['kpi', 'daily_sales', 'bonus_table', 'cash', 'savdo', 'login_history', 'portsiya'];
    if (!sections.some((s) => allowed.includes(s))) {
      return res.status(403).json({ error: 'Bu bo\'limga ruxsatingiz yo\'q' });
    }
    next();
  };
}

module.exports = { authRequired, adminOnly, requireSection, requireAnySection, JWT_SECRET };
