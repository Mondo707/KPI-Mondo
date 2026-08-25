const express = require('express');
const bcrypt = require('bcryptjs');
const { pool } = require('../db/db');
const { authRequired, adminOnly } = require('../middleware/auth');
const { getEffectiveCategories, setTierBonus } = require('../services/configService');
const { syncDate } = require('../services/scheduler');

const router = express.Router();

router.use(authRequired, adminOnly);

// GET /api/admin/bonus-config - joriy bonus jadvalini ko'rish
router.get('/bonus-config', async (req, res) => {
  res.json({ categories: await getEffectiveCategories() });
});

// PUT /api/admin/bonus-config - bitta pog'ona bonusini o'zgartirish
// body: { category: "Лимонады", tier_index: 0, bonus: 15000 }
router.put('/bonus-config', async (req, res) => {
  const { category, tier_index, bonus } = req.body || {};
  if (!category || tier_index === undefined || bonus === undefined) {
    return res.status(400).json({ error: 'category, tier_index, bonus kerak' });
  }
  try {
    await setTierBonus(category, Number(tier_index), Number(bonus));
    res.json({ ok: true, categories: await getEffectiveCategories() });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// POST /api/admin/users - yangi foydalanuvchi (masalan filial menejeri/supervizor) yaratish
// body: { login, password, role: 'viewer'|'admin', allowed_spots: [1,2,3], allowed_sections: ['dashboard','cash'] }
router.post('/users', async (req, res) => {
  const { login, password, role = 'viewer', allowed_spots = [], allowed_sections = ['dashboard', 'cash'] } = req.body || {};
  if (!login || !password) {
    return res.status(400).json({ error: 'login va password kerak' });
  }
  const hash = bcrypt.hashSync(password, 10);
  try {
    await pool.query(
      'INSERT INTO users (login, password_hash, password_plain, role, allowed_spots, allowed_sections) VALUES ($1, $2, $3, $4, $5, $6)',
      [login, hash, password, role, JSON.stringify(allowed_spots), JSON.stringify(allowed_sections)]
    );
    res.json({ ok: true });
  } catch (e) {
    if (String(e.message).includes('duplicate key') || String(e.message).includes('UNIQUE')) {
      return res.status(409).json({ error: 'Bu login allaqachon mavjud' });
    }
    res.status(500).json({ error: e.message });
  }
});

// GET /api/admin/users - foydalanuvchilar ro'yxati
// (password_plain faqat parol o'rnatilgan/tiklangandan keyin ko'rinadi - eski
// foydalanuvchilar uchun bu maydon bo'sh bo'ladi, chunki hash qaytarib bo'lmaydi)
router.get('/users', async (req, res) => {
  const result = await pool.query(
    'SELECT id, login, role, allowed_spots, allowed_sections, password_plain, is_active, created_at FROM users ORDER BY id'
  );
  res.json({
    users: result.rows.map((u) => ({
      ...u,
      allowed_spots: JSON.parse(u.allowed_spots),
      allowed_sections: JSON.parse(u.allowed_sections || '["dashboard","cash"]'),
      is_active: !!u.is_active,
    })),
  });
});

// PUT /api/admin/users/:id/status - foydalanuvchini faollashtirish/faolsizlantirish
// (ishdan ketgan xodimning dostupini o'chirish uchun - login qila olmaydi, lekin tarixi saqlanadi)
// body: { is_active: true|false }
router.put('/users/:id/status', async (req, res) => {
  const { id } = req.params;
  const { is_active } = req.body || {};
  if (is_active === undefined) {
    return res.status(400).json({ error: 'is_active kerak' });
  }

  if (Number(id) === req.user.id && !is_active) {
    return res.status(400).json({ error: 'O\'zingizni faolsizlantira olmaysiz' });
  }

  const result = await pool.query('UPDATE users SET is_active = $1 WHERE id = $2', [is_active ? 1 : 0, id]);
  if (result.rowCount === 0) {
    return res.status(404).json({ error: 'Foydalanuvchi topilmadi' });
  }
  res.json({ ok: true });
});

// PUT /api/admin/users/:id/spots - foydalanuvchining ruxsat etilgan filiallarini yangilash
// (masalan supervizorga bir nechta filial biriktirish)
// body: { allowed_spots: [1,2,3] }
router.put('/users/:id/spots', async (req, res) => {
  const { id } = req.params;
  const { allowed_spots } = req.body || {};
  if (!Array.isArray(allowed_spots)) {
    return res.status(400).json({ error: 'allowed_spots massiv bo\'lishi kerak' });
  }
  const result = await pool.query('UPDATE users SET allowed_spots = $1 WHERE id = $2', [
    JSON.stringify(allowed_spots),
    id,
  ]);
  if (result.rowCount === 0) {
    return res.status(404).json({ error: 'Foydalanuvchi topilmadi' });
  }
  res.json({ ok: true });
});

// PUT /api/admin/users/:id/sections - foydalanuvchiga qaysi bo'limlar (Ko'rish/KPI, Kassa kiritish)
// ko'rinishini belgilaydi
// body: { allowed_sections: ['dashboard', 'cash'] }
router.put('/users/:id/sections', async (req, res) => {
  const { id } = req.params;
  const { allowed_sections } = req.body || {};
  if (!Array.isArray(allowed_sections)) {
    return res.status(400).json({ error: 'allowed_sections massiv bo\'lishi kerak' });
  }
  const result = await pool.query('UPDATE users SET allowed_sections = $1 WHERE id = $2', [
    JSON.stringify(allowed_sections),
    id,
  ]);
  if (result.rowCount === 0) {
    return res.status(404).json({ error: 'Foydalanuvchi topilmadi' });
  }
  res.json({ ok: true });
});

// PUT /api/admin/users/:id/password - parolni tiklash (yangi parol o'rnatiladi va
// admin uni keyinroq ko'ra oladi, chunki plain nusxasi ham saqlanadi)
// body: { password: "YangiParol123" }
router.put('/users/:id/password', async (req, res) => {
  const { id } = req.params;
  const { password } = req.body || {};
  if (!password || password.length < 4) {
    return res.status(400).json({ error: 'Parol kamida 4 belgidan iborat bo\'lishi kerak' });
  }
  const hash = bcrypt.hashSync(password, 10);
  const result = await pool.query('UPDATE users SET password_hash = $1, password_plain = $2 WHERE id = $3', [
    hash,
    password,
    id,
  ]);
  if (result.rowCount === 0) {
    return res.status(404).json({ error: 'Foydalanuvchi topilmadi' });
  }
  res.json({ ok: true });
});

// DELETE /api/admin/users/:id - foydalanuvchini butunlay o'chirish
router.delete('/users/:id', async (req, res) => {
  const { id } = req.params;
  if (Number(id) === req.user.id) {
    return res.status(400).json({ error: 'O\'zingizni o\'chira olmaysiz' });
  }
  const result = await pool.query('DELETE FROM users WHERE id = $1', [id]);
  if (result.rowCount === 0) {
    return res.status(404).json({ error: 'Foydalanuvchi topilmadi' });
  }
  res.json({ ok: true });
});

// POST /api/admin/sync-range - tarixiy sanalar uchun Poster'dan ma'lumotlarni yuklab, bazaga saqlaydi
// body: { date_from: "2026-08-01", date_to: "2026-08-23" }
router.post('/sync-range', async (req, res) => {
  const { date_from, date_to } = req.body || {};
  if (!date_from || !date_to) {
    return res.status(400).json({ error: 'date_from va date_to kerak' });
  }
  if (date_from > date_to) {
    return res.status(400).json({ error: 'date_from date_to dan katta bo\'lmasligi kerak' });
  }

  const dates = [];
  let cur = new Date(date_from + 'T00:00:00');
  const end = new Date(date_to + 'T00:00:00');
  while (cur <= end) {
    dates.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
  }

  if (dates.length > 92) {
    return res.status(400).json({ error: 'Bir martada eng ko\'pi bilan 92 kun (taxminan 3 oy) sinxronlash mumkin' });
  }

  const results = [];
  for (const date of dates) {
    try {
      await syncDate(date);
      results.push({ date, ok: true });
    } catch (e) {
      results.push({ date, ok: false, error: e.message });
    }
  }

  const failed = results.filter((r) => !r.ok);
  res.json({
    ok: failed.length === 0,
    total_days: dates.length,
    failed_days: failed.length,
    results,
  });
});

module.exports = router;
