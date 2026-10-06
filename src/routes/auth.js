const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../db/db');
const { JWT_SECRET, authRequired } = require('../middleware/auth');

const { defaultLimiter: limiter } = require('../services/loginLimiter');

const router = express.Router();

// Foydalanuvchi topilmasa ham bcrypt ishlatiladi (javob vaqti loginning mavjudligini bildirmasligi uchun)
const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing', 10);

router.post('/login', async (req, res) => {
  const { login, password } = req.body || {};
  if (!login || !password || typeof login !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'login va password kerak' });
  }

  const ip = req.ip || 'noma\'lum';
  const waitSec = limiter.retryAfterSeconds(login, ip);
  if (waitSec > 0) {
    const waitMin = Math.ceil(waitSec / 60);
    res.set('Retry-After', String(waitSec));
    return res.status(429).json({
      error: `Juda ko'p noto'g'ri urinish. ${waitMin} daqiqadan keyin qayta urinib ko'ring.`,
      retry_after_seconds: waitSec,
    });
  }

  try {
    const result = await pool.query('SELECT * FROM users WHERE login = $1', [login]);
    const user = result.rows[0];

    // bcrypt'ning asinxron varianti: tekshiruv paytida server boshqa so'rovlarni to'xtatib turmaydi
    const ok = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);
    if (!user || !ok) {
      limiter.fail(login, ip);
      return res.status(401).json({ error: 'Login yoki parol xato' });
    }
    limiter.success(login, ip);

    if (!user.is_active) {
      return res.status(403).json({ error: 'Bu foydalanuvchi faolsizlantirilgan. Administratorga murojaat qiling.' });
    }

    await pool.query('UPDATE users SET last_login_at = now() WHERE id = $1', [user.id]);
    const sessionRes = await pool.query(
      `INSERT INTO login_history (user_id, login, role, logged_in_at, last_seen_at, last_state)
       VALUES ($1, $2, $3, now(), now(), 'visible') RETURNING id`,
      [user.id, user.login, user.role]
    );
    const sessionId = sessionRes.rows[0].id;

    const allowedSpots = JSON.parse(user.allowed_spots || '[]');
    const allowedSections = JSON.parse(user.allowed_sections || '["kpi","daily_sales","bonus_table","cash","savdo","login_history","portsiya"]');
    const token = jwt.sign(
      { id: user.id, login: user.login, role: user.role, allowed_spots: allowedSpots, allowed_sections: allowedSections },
      JWT_SECRET,
      { expiresIn: '12h' }
    );

    res.json({
      token,
      session_id: sessionId,
      user: { id: user.id, login: user.login, role: user.role, allowed_spots: allowedSpots, allowed_sections: allowedSections },
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/auth/heartbeat - sahifa ochiq turganda brauzer har 2 daqiqada yuboradi.
// body: { session_id, visible_seconds, hidden_seconds, state }
//   visible_seconds / hidden_seconds - oxirgi signaldan beri sahifa ekranda ko'rinib /
//   fonda turgan soniyalar (brauzer o'lchaydi). Server ularni cheklab (clamp) qo'shadi,
//   shuning uchun noto'g'ri/katta qiymat jadvalni buza olmaydi.
router.post('/heartbeat', authRequired, async (req, res) => {
  try {
    const { session_id, state } = req.body || {};
    const sessionId = Number(session_id);
    if (!Number.isInteger(sessionId) || sessionId <= 0) {
      return res.status(400).json({ error: 'session_id kerak' });
    }

    const own = await pool.query('SELECT user_id FROM login_history WHERE id = $1', [sessionId]);
    if (!own.rows.length || own.rows[0].user_id !== req.user.id) {
      return res.status(403).json({ error: 'Bu sessiya sizga tegishli emas' });
    }

    const clamp = (v) => Math.max(0, Math.min(300, Math.round(Number(v) || 0)));
    let visible = clamp(req.body.visible_seconds);
    let hidden = clamp(req.body.hidden_seconds);
    // Bir signal oralig'ida 5 daqiqadan ortiq vaqt hisoblanmaydi
    if (visible + hidden > 300) {
      const k = 300 / (visible + hidden);
      visible = Math.floor(visible * k);
      hidden = Math.floor(hidden * k);
    }

    await pool.query(
      `UPDATE login_history
       SET last_seen_at = now(),
           visible_seconds = visible_seconds + $1,
           hidden_seconds = hidden_seconds + $2,
           last_state = $3
       WHERE id = $4`,
      [visible, hidden, state === 'hidden' ? 'hidden' : 'visible', sessionId]
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
