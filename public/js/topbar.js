// Sahifa yuqorisidagi navigatsiya panelini chizadi.
function renderTopbar(activePage) {
  const user = getUser();
  if (!user) return;

  const isAdmin = user.role === 'admin';
  const allowedSections = isAdmin ? ['dashboard', 'cash'] : (user.allowed_sections || ['dashboard', 'cash']);

  const nav = document.createElement('div');
  nav.className = 'topbar';
  nav.innerHTML = `
    <div class="brand">KPI Bonus</div>
    <nav>
      ${allowedSections.includes('dashboard') ? `<a href="/dashboard.html" class="${activePage === 'dashboard' ? 'active' : ''}">KPI</a>` : ''}
      ${allowedSections.includes('dashboard') ? `<a href="/daily-sales.html" class="${activePage === 'sales' ? 'active' : ''}">Kunlik savdo</a>` : ''}
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
