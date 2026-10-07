// Sahifa navigatsiyasini chizadi: kompyuterda CHAP YON PANEL (sidebar),
// telefon/tor ekranda yuqoridagi "☰" tugmasi orqali ochiladigan menyu.
function renderTopbar(activePage) {
  const user = getUser();
  if (!user) return;

  const isAdmin = user.role === 'admin';
  const allowedSections = isAdmin
    ? ['kpi', 'daily_sales', 'bonus_table', 'cash', 'savdo', 'login_history', 'portsiya']
    : (user.allowed_sections || ['kpi', 'daily_sales', 'bonus_table', 'cash', 'savdo', 'login_history', 'portsiya']);

  const currentTheme = localStorage.getItem('kpi_theme') || 'dark';
  const isDark = currentTheme === 'dark';

  // Har bir bo'lim uchun: href, kod (activePage bilan solishtirish uchun), nom, ikonka
  const NAV_ITEMS = [
    { href: '/dashboard.html', code: 'kpi', label: 'KPI', icon: '📊', section: 'kpi' },
    { href: '/daily-sales.html', code: 'sales', label: 'Kunlik savdo', icon: '📈', section: 'daily_sales' },
    { href: '/bonus-table.html', code: 'bonus_table', label: 'Bonus jadvali', icon: '🧾', section: 'bonus_table' },
    { href: '/cash-entry.html', code: 'cash', label: 'Kassa kiritish', icon: '💰', section: 'cash' },
    { href: '/portsiya.html', code: 'portsiya', label: 'Portsiya', icon: '🍨', section: 'portsiya' },
    { href: '/savdo.html', code: 'savdo', label: 'Savdo', icon: '📉', section: 'savdo' },
    { href: '/login-history.html', code: 'login_history', label: 'Kirish tarixi', icon: '🕐', section: 'login_history' },
  ];
  const visibleItems = NAV_ITEMS.filter((item) => allowedSections.includes(item.section));
  if (isAdmin) {
    visibleItems.push({ href: '/admin.html', code: 'admin', label: 'Admin panel', icon: '⚙️', section: null });
  }

  const navLinksHtml = (iconClass) => visibleItems.map((item) => `
    <a href="${item.href}" class="${activePage === item.code ? 'active' : ''}">
      <span class="${iconClass}">${item.icon}</span> ${item.label}
    </a>
  `).join('');

  document.body.classList.add('has-sidebar');
  startHeartbeat();

  // ===== 1) Kompyuter uchun: doimiy chap yon panel =====
  const sidebar = document.createElement('div');
  sidebar.className = 'sidebar';
  sidebar.innerHTML = `
    <div class="brand">
      <img src="/img/logo.png" alt="Mondo" class="brand-logo">
      <span>KPI <span style="color:var(--accent);">Bonus</span></span>
    </div>
    <nav>${navLinksHtml('nav-ic')}</nav>
    <div class="bottom-block">
      <div class="user-chip">👤 ${user.login} ${isAdmin ? '(admin)' : ''}</div>
      <button class="theme-toggle-full" id="theme-toggle-btn-desktop">
        <span id="theme-label-desktop">${isDark ? '🌙 Tungi rejim' : '☀️ Yorug\' rejim'}</span>
      </button>
      ${langToggleHtml('lang-toggle-btn-desktop')}
      <button class="btn-secondary" id="logout-btn-desktop" style="width:100%; margin-top:8px;">Chiqish</button>
    </div>
  `;
  document.body.prepend(sidebar);

  // ===== 2) Mobil uchun: yuqori panel + ochiladigan menyu =====
  const mobileTopbar = document.createElement('div');
  mobileTopbar.className = 'mobile-topbar';
  mobileTopbar.innerHTML = `
    <div class="brand">
      <img src="/img/logo.png" alt="Mondo" class="brand-logo" style="height:30px;">
      <span>KPI <span style="color:var(--accent);">Bonus</span></span>
    </div>
    <div class="icon-btn" id="hamburger-btn">☰</div>
  `;
  document.body.prepend(mobileTopbar);

  const overlay = document.createElement('div');
  overlay.className = 'mobile-overlay';
  document.body.appendChild(overlay);

  const mobileMenu = document.createElement('div');
  mobileMenu.className = 'mobile-menu';
  mobileMenu.innerHTML = `
    <div class="close-btn" id="mobile-close-btn">✕ Yopish</div>
    ${navLinksHtml('nav-ic')}
    <div style="border-top:1px solid var(--border); margin:14px 0; padding-top:14px;">
      <button class="theme-toggle-full" id="theme-toggle-btn-mobile" style="margin-bottom:8px;">
        <span id="theme-label-mobile">${isDark ? '🌙 Tungi rejim' : '☀️ Yorug\' rejim'}</span>
      </button>
      ${langToggleHtml('lang-toggle-btn-mobile')}
      <a href="#" id="logout-btn-mobile" style="color:var(--danger);"><span class="nav-ic">↩</span> Chiqish</a>
    </div>
  `;
  document.body.appendChild(mobileMenu);

  function openMobileMenu() {
    mobileMenu.classList.add('open');
    overlay.classList.add('show');
  }
  function closeMobileMenu() {
    mobileMenu.classList.remove('open');
    overlay.classList.remove('show');
  }
  mobileTopbar.querySelector('#hamburger-btn').addEventListener('click', openMobileMenu);
  mobileMenu.querySelector('#mobile-close-btn').addEventListener('click', closeMobileMenu);
  overlay.addEventListener('click', closeMobileMenu);

  // ===== Umumiy: chiqish va mavzu almashtirish (ikkala joyda ham) =====
  document.getElementById('logout-btn-desktop').addEventListener('click', logout);
  document.getElementById('logout-btn-mobile').addEventListener('click', (e) => { e.preventDefault(); logout(); });

  bindLangButton('lang-toggle-btn-desktop');
  bindLangButton('lang-toggle-btn-mobile');
  i18nRefresh();

  function applyTheme(next) {
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('kpi_theme', next);
    const label = next === 'dark' ? '🌙 Tungi rejim' : '☀️ Yorug\' rejim';
    document.getElementById('theme-label-desktop').textContent = label;
    document.getElementById('theme-label-mobile').textContent = label;
  }
  document.getElementById('theme-toggle-btn-desktop').addEventListener('click', () => {
    const nowDark = document.documentElement.getAttribute('data-theme') !== 'light';
    applyTheme(nowDark ? 'light' : 'dark');
  });
  document.getElementById('theme-toggle-btn-mobile').addEventListener('click', () => {
    const nowDark = document.documentElement.getAttribute('data-theme') !== 'light';
    applyTheme(nowDark ? 'light' : 'dark');
  });
}


// ============ Sessiya signali (Kirish tarixi uchun) ============
// Sahifa ochiq turganda har 2 daqiqada serverga "men shu yerdaman" signali yuboradi va
// shu oraliqda sahifa ekranda ko'rinib (faol) / fonda turgan soniyalarni xabar qiladi.
// Foydalanuvchi 3 soat hech narsa qilmasa, signal to'xtatiladi (kechasi ochiq qolgan
// oynalar bazani band qilmasligi uchun) va yangi harakatda qayta boshlanadi.
const HEARTBEAT_INTERVAL_MS = (window.KPI_HEARTBEAT_MS && Number(window.KPI_HEARTBEAT_MS)) || 120000;
const HEARTBEAT_IDLE_LIMIT_MS = 3 * 60 * 60 * 1000;
let _hbStarted = false;

function startHeartbeat() {
  if (_hbStarted) return;
  const sessionId = Number(localStorage.getItem('kpi_session_id'));
  if (!sessionId) return; // eski sessiya (signal tizimidan oldin kirgan) - kuzatilmaydi
  _hbStarted = true;

  let lastTick = Date.now();
  let lastInteraction = Date.now();
  let visibleMs = 0;
  let hiddenMs = 0;

  // Oxirgi o'lchovdan beri o'tgan vaqtni joriy holatga (ko'rinadi / fonda) yozib boramiz
  function accumulate() {
    const now = Date.now();
    const elapsed = Math.max(0, now - lastTick);
    lastTick = now;
    if (document.visibilityState === 'hidden') hiddenMs += elapsed;
    else visibleMs += elapsed;
  }

  function send(keepalive) {
    accumulate();
    const state = document.visibilityState === 'hidden' ? 'hidden' : 'visible';
    // Butun soniyalarni yuboramiz, kasr qismi (qoldiq) keyingi signalga o'tadi - vaqt yo'qolmaydi
    const visibleSec = Math.floor(visibleMs / 1000);
    const hiddenSec = Math.floor(hiddenMs / 1000);
    visibleMs -= visibleSec * 1000;
    hiddenMs -= hiddenSec * 1000;
    const body = { session_id: sessionId, state, visible_seconds: visibleSec, hidden_seconds: hiddenSec };
    const token = getToken();
    if (!token) return;
    fetch('/api/auth/heartbeat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify(body),
      keepalive: !!keepalive,
    }).catch(() => {});
  }

  ['mousemove', 'keydown', 'touchstart', 'scroll', 'click'].forEach((evt) => {
    window.addEventListener(evt, () => { lastInteraction = Date.now(); }, { passive: true });
  });

  setInterval(() => {
    if (Date.now() - lastInteraction > HEARTBEAT_IDLE_LIMIT_MS) {
      lastTick = Date.now(); // faolsiz vaqt hisoblanmaydi
      return;
    }
    send(false);
  }, HEARTBEAT_INTERVAL_MS);

  // Sahifa fonga o'tganda/qaytganda darhol signal (telefon ekrani o'chsa ham oxirgi holat qoladi)
  document.addEventListener('visibilitychange', () => send(document.visibilityState === 'hidden'));
  window.addEventListener('pagehide', () => send(true));
}
