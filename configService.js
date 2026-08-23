// bonusConfig.json (promtdan olingan boshlang'ich qiymatlar) + admin panelda
// kiritilgan o'zgartirishlarni (bonus_config_overrides jadvali) birlashtiradi.

const { pool } = require('../db/db');
const baseConfig = require('../data/bonusConfig.json');

async function getEffectiveCategories() {
  const result = await pool.query('SELECT category, tier_index, bonus FROM bonus_config_overrides');
  const overrideMap = new Map();
  for (const o of result.rows) {
    overrideMap.set(`${o.category}::${o.tier_index}`, o.bonus);
  }

  const categories = {};
  for (const [category, cfg] of Object.entries(baseConfig.categories)) {
    categories[category] = {
      unit: cfg.unit,
      tiers: cfg.tiers.map((tier, idx) => ({
        ...tier,
        bonus: overrideMap.has(`${category}::${idx}`) ? overrideMap.get(`${category}::${idx}`) : tier.bonus,
      })),
    };
  }
  return categories;
}

async function setTierBonus(category, tierIndex, bonus) {
  if (!baseConfig.categories[category]) {
    throw new Error(`Noma'lum kategoriya: ${category}`);
  }
  if (tierIndex < 0 || tierIndex >= baseConfig.categories[category].tiers.length) {
    throw new Error('Noto\'g\'ri pog\'ona raqami');
  }
  await pool.query(
    `INSERT INTO bonus_config_overrides (category, tier_index, bonus, updated_at)
     VALUES ($1, $2, $3, now())
     ON CONFLICT (category, tier_index) DO UPDATE SET bonus = EXCLUDED.bonus, updated_at = EXCLUDED.updated_at`,
    [category, tierIndex, bonus]
  );
}

module.exports = { getEffectiveCategories, setTierBonus };
