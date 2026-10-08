// Tarif o'zgargandan keyin tanlangan o'tgan kunlarni orqa fonda, ketma-ket qayta hisoblaydi.
// Har bir kun Poster'dan alohida olinadi, shuning uchun so'rovlar orasida qisqa pauza bor.
// Holat xotirada saqlanadi (server qayta ishga tushsa, tugamagan ish to'xtaydi - admin
// "Davr bilan qo'llash"ni qayta bosishi mumkin).

const { syncDate } = require('./scheduler');
const { markRecalculated } = require('./configService');

const PAUSE_MS = 400;

const state = {
  running: false, category: null, from: null, total: 0, done: 0, failed: 0,
  startedAt: null, finishedAt: null, lastError: null,
};

function status() { return { ...state }; }

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

/** Ish boshlangan bo'lsa true, band bo'lsa false qaytaradi. */
function start({ category, from, dates }) {
  if (state.running) return false;
  Object.assign(state, {
    running: true, category, from, total: dates.length, done: 0, failed: 0,
    startedAt: new Date().toISOString(), finishedAt: null, lastError: null,
  });
  (async () => {
    for (const d of dates) {
      try {
        await syncDate(d);
      } catch (e) {
        state.failed += 1;
        state.lastError = `${d}: ${e.message}`;
        console.error('[tariff-recalc]', d, e.message);
      }
      state.done += 1;
      await sleep(PAUSE_MS);
    }
    try { await markRecalculated(category, from, state.done - state.failed); } catch (e) { /* jurnal yozilmasa ham ish tugaydi */ }
    state.running = false;
    state.finishedAt = new Date().toISOString();
    console.log(`[tariff-recalc] tugadi: ${state.done - state.failed}/${state.total} kun`);
  })();
  return true;
}

module.exports = { start, status };
