// Sana yordamchilari (ish kuni YYYY-MM-DD matn ko'rinishida, Toshkent vaqti).
const { getCurrentBusinessDate } = require('../services/businessDay');

function shift(d, n) {
  const [y, m, dd] = d.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, dd + n)).toISOString().slice(0, 10);
}
function listDates(from, to) {
  const out = [];
  for (let d = from; d <= to && out.length < 400; d = shift(d, 1)) out.push(d);
  return out;
}
function fmtDate(d) {
  const [y, m, dd] = d.split('-');
  return `${dd}.${m}.${y}`;
}
function nowTashkent() {
  const off = Number(process.env.TIMEZONE_OFFSET_HOURS || 5);
  const d = new Date(Date.now() + off * 3600 * 1000);
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getUTCDate())}.${p(d.getUTCMonth() + 1)}.${d.getUTCFullYear()} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}

// Tayyor davrlar (ish kuniga nisbatan)
function presetRange(key) {
  const today = getCurrentBusinessDate();
  const [y, m] = today.split('-').map(Number);
  const p = (n) => String(n).padStart(2, '0');
  switch (key) {
    case 'yesterday': { const d = shift(today, -1); return { from: d, to: d }; }
    case 'today': return { from: today, to: today };
    case 'last7': return { from: shift(today, -7), to: shift(today, -1) };
    case 'month': return { from: `${y}-${p(m)}-01`, to: today };
    case 'prevmonth': {
      const py = m === 1 ? y - 1 : y; const pm = m === 1 ? 12 : m - 1;
      const last = new Date(Date.UTC(py, pm, 0)).getUTCDate();
      return { from: `${py}-${p(pm)}-01`, to: `${py}-${p(pm)}-${p(last)}` };
    }
    default: return null;
  }
}

// "07.10.2026" yoki "01.10.2026 - 07.10.2026" (yoki 2026-10-07) -> { from, to } yoki { error }
function parseDates(text) {
  const raw = String(text || '').trim();
  const re = /\d{1,2}[.\/]\d{1,2}[.\/]\d{4}|\d{4}-\d{1,2}-\d{1,2}/g;
  const tokens = raw.match(re) || [];
  const rest = raw.replace(re, '').replace(/[\s\-–—]+/g, '');
  if (!tokens.length || tokens.length > 2 || rest) return { error: 'bad' };
  const norm = (s) => {
    let m = s.match(/^(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})$/);
    if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  };
  let a = norm(tokens[0]);
  let b = tokens.length === 2 ? norm(tokens[1]) : a;
  const valid = (d) => new Date(d + 'T00:00:00Z').toISOString().slice(0, 10) === d;
  try { if (!valid(a) || !valid(b)) return { error: 'bad' }; } catch (e) { return { error: 'bad' }; }
  if (a > b) [a, b] = [b, a];
  if (b > getCurrentBusinessDate()) return { error: 'future' };
  if (listDates(a, b).length > 92) return { error: 'long' };
  return { from: a, to: b };
}

module.exports = { shift, listDates, fmtDate, nowTashkent, presetRange, parseDates };
