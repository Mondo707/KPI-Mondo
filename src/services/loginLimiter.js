// Login'ga noto'g'ri urinishlarni cheklash (parol tanlab topishdan himoya).
//
//  - Bitta login + bitta qurilma (IP): MAX_FAILS marta noto'g'ri urinishdan keyin LOCK vaqtga bloklanadi.
//    Bloklangan paytda TO'G'RI parol ham qabul qilinmaydi (aks holda bloklash ma'nosiz).
//  - Bitta IP'dan jami IP_MAX_FAILS marta noto'g'ri urinish (turli loginlar bilan) - butun IP bloklanadi.
//  - Muvaffaqiyatli kirishda shu login+IP hisobi tozalanadi.
// Hisob xotirada saqlanadi: server qayta ishga tushsa, nolga tushadi (bu yetarli himoya).

function createLimiter(opts = {}) {
  const lockMs = (opts.lockSeconds ?? Number(process.env.LOGIN_LOCK_SECONDS || 900)) * 1000;
  const maxFails = opts.maxFails ?? Number(process.env.LOGIN_MAX_FAILURES || 5);
  const ipMaxFails = opts.ipMaxFails ?? Number(process.env.LOGIN_IP_MAX_FAILURES || 30);
  const now = opts.now || (() => Date.now());
  const records = new Map(); // kalit -> { count, windowStart, lockedUntil }

  const userKey = (login, ip) => `u|${String(login).toLowerCase()}|${ip}`;
  const ipKey = (ip) => `i|${ip}`;

  function prune() {
    const t = now();
    for (const [k, r] of records) {
      if (r.lockedUntil <= t && r.windowStart + lockMs <= t) records.delete(k);
    }
  }

  function recordFailure(key, limit) {
    const t = now();
    let r = records.get(key);
    if (!r || r.windowStart + lockMs <= t) {
      r = { count: 0, windowStart: t, lockedUntil: 0 };
      records.set(key, r);
    }
    r.count += 1;
    if (r.count >= limit) r.lockedUntil = t + lockMs;
  }

  // Bloklangan bo'lsa, necha soniyadan keyin qayta urinish mumkinligini qaytaradi, aks holda 0
  function retryAfterSeconds(login, ip) {
    const t = now();
    let wait = 0;
    for (const key of [userKey(login, ip), ipKey(ip)]) {
      const r = records.get(key);
      if (r && r.lockedUntil > t) wait = Math.max(wait, Math.ceil((r.lockedUntil - t) / 1000));
    }
    return wait;
  }

  function fail(login, ip) {
    if (records.size > 5000) prune();
    recordFailure(userKey(login, ip), maxFails);
    recordFailure(ipKey(ip), ipMaxFails);
  }

  function success(login, ip) {
    records.delete(userKey(login, ip));
  }

  return { retryAfterSeconds, fail, success, _records: records };
}

module.exports = { createLimiter, defaultLimiter: createLimiter() };
