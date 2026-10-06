// Umumiy API klienti va sessiya boshqaruvi (barcha sahifalar uchun)

const API_BASE = '/api';

function getToken() {
  return localStorage.getItem('kpi_token');
}
function getUser() {
  try {
    return JSON.parse(localStorage.getItem('kpi_user') || 'null');
  } catch (e) {
    return null;
  }
}
function setSession(token, user, sessionId) {
  localStorage.setItem('kpi_token', token);
  localStorage.setItem('kpi_user', JSON.stringify(user));
  if (sessionId) localStorage.setItem('kpi_session_id', String(sessionId));
}
function clearSession() {
  localStorage.removeItem('kpi_token');
  localStorage.removeItem('kpi_user');
  localStorage.removeItem('kpi_session_id');
}
function requireAuth() {
  if (!getToken()) {
    window.location.href = '/login.html';
  }
}
function requireAdmin() {
  requireAuth();
  const user = getUser();
  if (!user || user.role !== 'admin') {
    window.location.href = '/dashboard.html';
  }
}

/**
 * Foydalanuvchi berilgan bo'limga (masalan 'kpi', 'daily_sales', 'bonus_table', 'cash')
 * kirish huquqi yo'q bo'lsa, unga ruxsat etilgan boshqa sahifaga (yoki login'ga) yo'naltiradi.
 */
function requireSection(section) {
  requireAuth();
  const user = getUser();
  if (!user) return;
  if (user.role === 'admin') return;

  const allowed = user.allowed_sections || ['kpi', 'daily_sales', 'bonus_table', 'cash', 'savdo', 'login_history', 'portsiya'];
  if (!allowed.includes(section)) {
    if (allowed.includes('kpi')) {
      window.location.href = '/dashboard.html';
    } else if (allowed.includes('daily_sales')) {
      window.location.href = '/daily-sales.html';
    } else if (allowed.includes('bonus_table')) {
      window.location.href = '/bonus-table.html';
    } else if (allowed.includes('cash')) {
      window.location.href = '/cash-entry.html';
    } else if (allowed.includes('portsiya')) {
      window.location.href = '/portsiya.html';
    } else if (allowed.includes('savdo')) {
      window.location.href = '/savdo.html';
    } else if (allowed.includes('login_history')) {
      window.location.href = '/login-history.html';
    } else {
      window.location.href = '/login.html';
    }
  }
}

async function apiFetch(path, options = {}) {
  const token = getToken();
  const headers = Object.assign(
    { 'Content-Type': 'application/json' },
    options.headers || {}
  );
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(API_BASE + path, { ...options, headers });

  if (res.status === 401) {
    clearSession();
    window.location.href = '/login.html';
    throw new Error('Sessiya tugagan');
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `So'rov xatosi (${res.status})`);
  }
  return data;
}

function formatMoney(n) {
  return Number(n || 0).toLocaleString('ru-RU') + " so'm";
}

// Kassa farqini ko'rsatish qoidasi (butun saytda bir xil). diff = Fakt - Poster.
//   Fakt Posterdan KO'P  -> qizil, MINUS bilan   (masalan "-23 000")
//   Fakt Posterdan KAM   -> sariq, ishorasiz     (masalan "23 000")
//   Teng (1000 so'mgacha)-> yashil, ishorasiz
function formatDiffDisplay(diff, tolerance = 1000) {
  const value = Math.round(Number(diff) || 0);
  const abs = Math.abs(value).toLocaleString('ru-RU');
  if (Math.abs(value) < tolerance) return { text: abs, cls: 'diff-eq' };
  if (value > 0) return { text: '-' + abs, cls: 'diff-over' };
  return { text: abs, cls: 'diff-under' };
}

// Soniyalarni "3 s 26 d" ko'rinishiga o'tkazadi (soat / daqiqa)
function formatDuration(seconds) {
  if (seconds === null || seconds === undefined) return '—';
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  if (h === 0 && m === 0) return total > 0 ? '<1 d' : '0 d';
  return h > 0 ? `${h} s ${String(m).padStart(2, '0')} d` : `${m} d`;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function showToast(message, isError = false) {
  let toast = document.getElementById('kpi-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'kpi-toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.className = 'toast show' + (isError ? ' error' : '');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('show'), 3500);
}

function logout() {
  clearSession();
  window.location.href = '/login.html';
}
