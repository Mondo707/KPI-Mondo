const jwt = require('jsonwebtoken');
const { pool } = require('../db/db');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-please-change';

async function authRequired(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Token topilmadi' });

  try {
    const payload = jwt.verify(token, JWT_SECRET);

    // Har bir so'rovda foydalanuvchi hali faolligini tekshiramiz
    // (admin uni sessiya davomida faolsizlantirgan bo'lishi mumkin).
    const result = await pool.query('SELECT is_active FROM users WHERE id = $1', [payload.id]);
    const user = result.rows[0];
    if (!user || !user.is_active) {
      return res.status(403).json({ error: 'Bu foydalanuvchi faolsizlantirilgan' });
    }

    req.user = payload; // { id, login, role, allowed_spots }
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Token yaroqsiz yoki muddati o\'tgan' });
  }
}

function adminOnly(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Faqat admin uchun ruxsat berilgan' });
  }
  next();
}

module.exports = { authRequired, adminOnly, JWT_SECRET };
