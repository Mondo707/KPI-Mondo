// Sahifa yuqorisidagi navigatsiya panelini chizadi.
function renderTopbar(activePage) {
  const user = getUser();
  if (!user) return;

  const isAdmin = user.role === 'admin';
  const allowedSections = isAdmin
    ? ['kpi', 'daily_sales', 'bonus_table', 'cash']
    : (user.allowed_sections || ['kpi', 'daily_sales', 'bonus_table', 'cash']);

  const nav = document.createElement('div');
  nav.className = 'topbar';
  nav.innerHTML = `
    <div class="brand" style="display:flex; align-items:center; gap:10px;">
      <img src="/img/logo.png" alt="Mondo" class="brand-logo">
      <span class="brand-sep"></span>
      <span>KPI <span style="color:var(--accent);">Bonus</span></span>
    </div>
    <nav>
      ${allowedSections.includes('kpi') ? `<a href="/dashboard.html" class="${activePage === 'kpi' ? 'active' : ''}">KPI</a>` : ''}
      ${allowedSections.includes('daily_sales') ? `<a href="/daily-sales.html" class="${activePage === 'sales' ? 'active' : ''}">Kunlik savdo</a>` : ''}
      ${allowedSections.includes('bonus_table') ? `<a href="/bonus-table.html" class="${activePage === 'bonus_table' ? 'active' : ''}">Bonus jadvali</a>` : ''}
      ${allowedSections.includes('cash') ? `<a href="/cash-entry.html" class="${activePage === 'cash' ? 'active' : ''}">Kassa kiritish</a>` : ''}
      ${isAdmin ? `<a href="/admin.html" class="${activePage === 'admin' ? 'active' : ''}">Admin panel</a>` : ''}
    </nav>
    <div class="user-info">
      <span>${user.login} ${isAdmin ? '(admin)' : ''}</span>
      <button class="btn-secondary" id="logout-btn">Chiqish</button>
    </div>
  `;
  document.body.prepend(nav);
  nav.querySelector('#logout-btn').addEventListener('click', logout);
}
