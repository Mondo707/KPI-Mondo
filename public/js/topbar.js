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
