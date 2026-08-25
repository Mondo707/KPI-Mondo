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
function setSession(token, user) {
  localStorage.setItem('kpi_token', token);
  localStorage.setItem('kpi_user', JSON.stringify(user));
}
function clearSession() {
  localStorage.removeItem('kpi_token');
  localStorage.removeItem('kpi_user');
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
 * Foydalanuvchi berilgan bo'limga (masalan 'dashboard' yoki 'cash') kirish huquqi
 * yo'q bo'lsa, unga ruxsat etilgan boshqa sahifaga (yoki login'ga) yo'naltiradi.
 */
function requireSection(section) {
  requireAuth();
  const user = getUser();
  if (!user) return;
  if (user.role === 'admin') return;

  const allowed = user.allowed_sections || ['dashboard', 'cash'];
  if (!allowed.includes(section)) {
    if (allowed.includes('dashboard')) {
      window.location.href = '/dashboard.html';
    } else if (allowed.includes('cash')) {
      window.location.href = '/cash-entry.html';
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
