// bonusConfig.json (promtdan olingan boshlang'ich qiymatlar) + admin panelda
// kiritilgan o'zgartirishlarni (bonus_config_overrides jadvali) birlashtiradi.
// Endi har bir pog'onaning min/max chegarasini ham (bonus summasidan tashqari)
// admin panelda o'zgartirish mumkin.

const { pool } = require('../db/db');
const baseConfig = require('../data/bonusConfig.json');

async function getLegacyCategories() {
  const result = await pool.query('SELECT category, tier_index, bonus, min_override, max_override FROM bonus_config_overrides');
  const overrideMap = new Map();
  for (const o of result.rows) {
    overrideMap.set(`${o.category}::${o.tier_index}`, o);
  }

  const categories = {};
  for (const [category, cfg] of Object.entries(baseConfig.categories)) {
    categories[category] = {
      unit: cfg.unit,
      tiers: cfg.tiers.map((tier, idx) => {
        const override = overrideMap.get(`${category}::${idx}`);
        return {
          min: override && override.min_override !== null && override.min_override !== undefined ? override.min_override : tier.min,
          max: override && override.max_override !== null && override.max_override !== undefined ? override.max_override : tier.max,
          bonus: override ? override.bonus : tier.bonus,
        };
      }),
    };
  }
  return categories;
}

/**
 * Bitta pog'onaning bonus summasini va/yoki min/max chegarasini o'zgartiradi.
 * Har bir maydon ixtiyoriy - berilmasa, joriy (effektiv) qiymat saqlanadi.
 */
async function setTierConfig(category, tierIndex, { bonus, min, max } = {}) {
  if (!baseConfig.categories[category]) {
    throw new Error(`Noma'lum kategoriya: ${category}`);
  }
  const baseTiers = baseConfig.categories[category].tiers;
  if (tierIndex < 0 || tierIndex >= baseTiers.length) {
    throw new Error('Noto\'g\'ri pog\'ona raqami');
  }

  // Hozirgi effektiv qiymatlarni olamiz (faqat berilmagan maydonlarni to'ldirish uchun)
  const current = await pool.query(
    'SELECT bonus, min_override, max_override FROM bonus_config_overrides WHERE category = $1 AND tier_index = $2',
    [category, tierIndex]
  );
  const existing = current.rows[0];
  const baseTier = baseTiers[tierIndex];

  const finalBonus = bonus !== undefined ? bonus : (existing ? existing.bonus : baseTier.bonus);
  const finalMin = min !== undefined ? min : (existing && existing.min_override !== null ? existing.min_override : null);
  const finalMax = max !== undefined ? max : (existing && existing.max_override !== null ? existing.max_override : null);

  if (finalMin !== null && finalMax !== null && Number(finalMin) > Number(finalMax)) {
    throw new Error('Pastki chegara yuqori chegaradan katta bo\'lishi mumkin emas');
  }

  await pool.query(
    `INSERT INTO bonus_config_overrides (category, tier_index, bonus, min_override, max_override, updated_at)
     VALUES ($1, $2, $3, $4, $5, now())
     ON CONFLICT (category, tier_index) DO UPDATE SET
       bonus = EXCLUDED.bonus,
       min_override = EXCLUDED.min_override,
       max_override = EXCLUDED.max_override,
       updated_at = EXCLUDED.updated_at`,
    [category, tierIndex, finalBonus, finalMin, finalMax]
  );
}

// Eskisi bilan moslik uchun (agar boshqa joyda ishlatilgan bo'lsa)
async function setTierBonus(category, tierIndex, bonus) {
  return setTierConfig(category, tierIndex, { bonus });
}

/**
 * Berilgan kategoriyaning barcha pog'onalarini tekshirib, ketma-ketlikda
 * bo'shliq yoki qoplanish bo'lsa, ogohlantirish matnlarini qaytaradi.
 */
function validateTierContinuity(tiers) {
  const warnings = [];
  const sorted = [...tiers].sort((a, b) => a.min - b.min);
  for (let i = 0; i < sorted.length - 1; i++) {
    const current = sorted[i];
    const next = sorted[i + 1];
    if (current.max === null || current.max === undefined) continue; // oxirgi pog'ona (cheksiz)
    if (next.min > current.max + 1) {
      warnings.push(`${current.min}-${current.max} bilan ${next.min}-${next.max || '∞'} orasida bo'shliq bor (${current.max + 1}-${next.min - 1} hech qaysi pog'onaga kirmaydi)`);
    } else if (next.min <= current.max) {
      warnings.push(`${current.min}-${current.max} va ${next.min}-${next.max || '∞'} pog'onalari bir-biriga qoplanadi`);
    }
  }
  return warnings;
}

// ============ TARIF VERSIYALARI (sanaga bog'liq tarif) ============
// Har bir versiya = "shu sanadan (ish kuni) boshlab amal qiladigan TO'LIQ tarif".
// Kun uchun tarif = effective_from <= kun bo'lgan eng so'nggi versiya. Shunday qilib
// o'tgan kunlar qayta hisoblansa ham o'sha kundagi tarif bilan hisoblanadi.

const { getCurrentBusinessDate } = require('./businessDay');

const BASELINE_DATE = '2000-01-01';
const MAX_RECALC_DAYS = 92;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
let versionsCache = null; // [{from, categories}] sana bo'yicha o'sish tartibida
let versionsCacheAt = 0;
const CACHE_MS = 60 * 1000;

function clone(o) { return JSON.parse(JSON.stringify(o)); }

function invalidateVersionsCache() { versionsCache = null; versionsCacheAt = 0; }

async function loadVersions() {
  if (versionsCache && Date.now() - versionsCacheAt < CACHE_MS) return versionsCache;
  let res = await pool.query('SELECT effective_from, snapshot FROM bonus_config_versions ORDER BY effective_from');
  if (res.rows.length === 0) {
    // Birinchi marta: hozirgi (eski usulda saqlangan) tarifni boshlang'ich versiya qilamiz
    const base = await getLegacyCategories();
    await pool.query(
      'INSERT INTO bonus_config_versions (effective_from, snapshot) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [BASELINE_DATE, JSON.stringify(base)]
    );
    res = await pool.query('SELECT effective_from, snapshot FROM bonus_config_versions ORDER BY effective_from');
  }
  versionsCache = res.rows.map((r) => ({ from: r.effective_from, categories: JSON.parse(r.snapshot) }));
  versionsCacheAt = Date.now();
  return versionsCache;
}

function pickVersion(versions, dateStr) {
  let found = versions[0];
  for (const v of versions) {
    if (v.from <= dateStr) found = v; else break;
  }
  return found;
}

/** Berilgan ish kuni uchun amaldagi tarif (sana berilmasa - bugungi ish kuni). */
async function getCategoriesForDate(dateStr) {
  const date = dateStr && DATE_RE.test(dateStr) ? dateStr : getCurrentBusinessDate();
  const versions = await loadVersions();
  return clone(pickVersion(versions, date).categories);
}

/** Eski nom (moslik uchun): endi sanaga bog'liq tarif qaytaradi. */
async function getEffectiveCategories(dateStr) {
  return getCategoriesForDate(dateStr);
}

function addDays(dateStr, days) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

function normalizeTiers(category, tiers) {
  const base = baseConfig.categories[category];
  if (!base) throw new Error(`Noma'lum kategoriya: ${category}`);
  if (!Array.isArray(tiers) || tiers.length !== base.tiers.length) {
    throw new Error('Pog\'onalar soni noto\'g\'ri');
  }
  const out = tiers.map((t, i) => {
    const min = Number(t.min);
    const bonus = Number(t.bonus);
    const isLast = i === base.tiers.length - 1;
    let max = (t.max === null || t.max === undefined || t.max === '') ? null : Number(t.max);
    if (isLast) max = null; // oxirgi pog'ona doim cheksiz
    if (!Number.isFinite(min) || min < 0) throw new Error(`${i + 1}-pog'ona: pastki chegara noto'g'ri`);
    if (!Number.isFinite(bonus) || bonus < 0) throw new Error(`${i + 1}-pog'ona: bonus summasi noto'g'ri`);
    if (max !== null && (!Number.isFinite(max) || max < min)) throw new Error(`${i + 1}-pog'ona: yuqori chegara pastkidan kichik`);
    return { min: Math.round(min), max: max === null ? null : Math.round(max), bonus: Math.round(bonus) };
  });
  return out;
}

function describeChange(oldTiers, newTiers, unit) {
  const parts = [];
  newTiers.forEach((t, i) => {
    const o = oldTiers[i];
    const bits = [];
    if (o.bonus !== t.bonus) bits.push(`bonus ${o.bonus} → ${t.bonus}`);
    if (o.min !== t.min) bits.push(`dan ${o.min} → ${t.min}`);
    if (o.max !== t.max && !(o.max === null && t.max === null)) bits.push(`gacha ${o.max === null ? '∞' : o.max} → ${t.max === null ? '∞' : t.max}`);
    if (bits.length) parts.push(`${i + 1}-pog'ona: ${bits.join(', ')}`);
  });
  return parts.join('; ');
}

/**
 * Bitta kategoriyaning pog'onalarini o'zgartiradi.
 *  from  - qaysi ish kunidan boshlab (standart: bugungi ish kuni)
 *  to    - qaysi ish kunigacha (berilmasa: "shundan keyingi barcha kunlar")
 * Natija: { changed, from, to, summary, affectedPastDates: [..] } - qayta hisoblash kerak bo'lgan o'tgan kunlar
 */
async function changeCategoryTiers(category, tiers, { from, to, userLogin } = {}) {
  const today = getCurrentBusinessDate();
  const fromDate = from || today;
  const toDate = to || null;
  if (!DATE_RE.test(fromDate)) throw new Error('Boshlanish sanasi noto\'g\'ri');
  if (toDate !== null && !DATE_RE.test(toDate)) throw new Error('Tugash sanasi noto\'g\'ri');
  if (fromDate < '2020-01-01') throw new Error('Boshlanish sanasi juda eski');
  if (toDate !== null && toDate < fromDate) throw new Error('Tugash sanasi boshlanish sanasidan oldin bo\'lishi mumkin emas');

  const spanEnd = toDate !== null && toDate < today ? toDate : today;
  if (fromDate <= spanEnd) {
    const days = Math.round((Date.parse(spanEnd) - Date.parse(fromDate)) / 86400000) + 1;
    if (days > MAX_RECALC_DAYS && (fromDate < today || toDate !== null)) {
      throw new Error(`Bir martada eng ko'pi bilan ${MAX_RECALC_DAYS} kunlik davrni qayta hisoblash mumkin (siz ${days} kun tanladingiz)`);
    }
  }

  const newTiers = normalizeTiers(category, tiers);
  const versions = clone(await loadVersions());
  const unit = baseConfig.categories[category].unit;

  const currentAtFrom = pickVersion(versions, fromDate).categories[category].tiers;
  const summary = describeChange(currentAtFrom, newTiers, unit);

  // Davr tugagach ("to"dan keyingi kun) avvalgi tarif tiklanishi uchun, o'zgartirishdan OLDINGI holat
  let restoreSnapshot = null;
  let restoreDate = null;
  if (toDate !== null) {
    restoreDate = addDays(toDate, 1);
    if (!versions.some((v) => v.from === restoreDate)) {
      restoreSnapshot = clone(pickVersion(versions, restoreDate).categories);
    }
  }

  const setCat = (snap) => { snap[category] = { unit, tiers: clone(newTiers) }; };
  const lastDate = toDate === null ? '9999-12-31' : toDate;

  // 1) Oraliq ichidagi mavjud versiyalar (boshlanish sanasidan keyingilar) ham yangilanadi
  for (const v of versions) {
    if (v.from > fromDate && v.from <= lastDate) setCat(v.categories);
  }
  // 2) Boshlanish sanasida versiya bo'lmasa - yaratamiz (shu sanadagi amaldagi tarif asosida)
  let atFrom = versions.find((v) => v.from === fromDate);
  if (!atFrom) {
    atFrom = { from: fromDate, categories: clone(pickVersion(versions, fromDate).categories) };
    versions.push(atFrom);
  }
  setCat(atFrom.categories);
  // 3) Davr tugagach eski tarifni tiklash
  if (restoreSnapshot) versions.push({ from: restoreDate, categories: restoreSnapshot });

  versions.sort((a, b) => (a.from < b.from ? -1 : 1));

  // O'zgarish yo'q bo'lsa (hech narsa o'zgarmagan) - hech narsa yozmaymiz
  if (!summary) return { changed: false, from: fromDate, to: toDate, summary: '', affectedPastDates: [] };

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM bonus_config_versions');
    for (const v of versions) {
      await client.query(
        'INSERT INTO bonus_config_versions (effective_from, snapshot) VALUES ($1, $2)',
        [v.from, JSON.stringify(v.categories)]
      );
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
  invalidateVersionsCache();

  // Qayta hisoblash kerak bo'lgan o'tgan kunlar: faqat davr rejimida (bugundan boshlab bo'lsa - yo'q)
  const affectedPastDates = [];
  const recalcUntil = toDate !== null && toDate < today ? toDate : today;
  if (fromDate < today || (toDate !== null && fromDate <= today)) {
    for (let d = fromDate; d <= recalcUntil; d = addDays(d, 1)) affectedPastDates.push(d);
  }

  await pool.query(
    `INSERT INTO bonus_config_changes (user_login, category, effective_from, effective_to, summary)
     VALUES ($1, $2, $3, $4, $5)`,
    [userLogin || null, category, fromDate, toDate, summary]
  );

  return { changed: true, from: fromDate, to: toDate, summary, affectedPastDates };
}

async function markRecalculated(category, fromDate, days) {
  await pool.query(
    `UPDATE bonus_config_changes SET recalculated_days = $1
     WHERE id = (SELECT id FROM bonus_config_changes WHERE category = $2 AND effective_from = $3 ORDER BY id DESC LIMIT 1)`,
    [days, category, fromDate]
  );
}

async function listChanges(limit = 50) {
  const res = await pool.query(
    `SELECT id, created_at, user_login, category, effective_from, effective_to, summary, recalculated_days
     FROM bonus_config_changes ORDER BY id DESC LIMIT $1`,
    [limit]
  );
  return res.rows;
}

module.exports = {
  getEffectiveCategories, getCategoriesForDate, changeCategoryTiers, listChanges, markRecalculated,
  invalidateVersionsCache, setTierBonus, setTierConfig, validateTierContinuity,
};
