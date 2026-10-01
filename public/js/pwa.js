// PWA (Progressive Web App) ro'yxatdan o'tkazish va "ilovani o'rnatish" taklifi.
// Barcha sahifalarga ulanadi.

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js').catch(() => {
      // e'tiborsiz - service worker ishlamasa ham sayt oddiy holda ishlayveradi
    });
  });
}

// --- "Ilovani o'rnatish" taklifi ---
// Android/Chrome: brauzerning o'z "beforeinstallprompt" hodisasini ushlab, o'zimizning
// chiroyli tugmamiz orqali ko'rsatamiz.
// iOS/Safari: bunday hodisa yo'q, shuning uchun agar Safari'da ekanini aniqlasak,
// qo'lda "Share > Add to Home Screen" yo'riqnomasini ko'rsatamiz.

let deferredInstallPrompt = null;

function isIos() {
  return /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());
}
function isInStandaloneMode() {
  return ('standalone' in window.navigator && window.navigator.standalone) ||
    window.matchMedia('(display-mode: standalone)').matches;
}
function wasInstallBannerDismissed() {
  return localStorage.getItem('kpi_install_dismissed') === '1';
}

function showInstallBanner(mode) {
  if (isInStandaloneMode() || wasInstallBannerDismissed()) return;
  if (document.getElementById('pwa-install-banner')) return;

  const banner = document.createElement('div');
  banner.id = 'pwa-install-banner';
  banner.className = 'pwa-install-banner';

  if (mode === 'android') {
    banner.innerHTML = `
      <div class="pwa-install-text">
        <b>📲 Ilova sifatida o'rnating</b>
        <span>Tezroq ochilish va qulay foydalanish uchun</span>
      </div>
      <div class="pwa-install-actions">
        <button class="pwa-install-btn" id="pwa-install-yes">O'rnatish</button>
        <button class="pwa-install-close" id="pwa-install-no">✕</button>
      </div>
    `;
  } else {
    banner.innerHTML = `
      <div class="pwa-install-text">
        <b>📲 Bosh ekranga qo'shing</b>
        <span>Pastdagi 📤 (Share) tugmasini bosing, so'ng "Add to Home Screen"ni tanlang</span>
      </div>
      <div class="pwa-install-actions">
        <button class="pwa-install-close" id="pwa-install-no">✕</button>
      </div>
    `;
  }

  document.body.appendChild(banner);

  document.getElementById('pwa-install-no').addEventListener('click', () => {
    banner.remove();
    localStorage.setItem('kpi_install_dismissed', '1');
  });

  if (mode === 'android') {
    document.getElementById('pwa-install-yes').addEventListener('click', async () => {
      banner.remove();
      if (deferredInstallPrompt) {
        deferredInstallPrompt.prompt();
        await deferredInstallPrompt.userChoice;
        deferredInstallPrompt = null;
      }
    });
  }
}

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  showInstallBanner('android');
});

// iOS uchun avtomatik hodisa yo'q - o'zimiz sahifa ochilganda tekshiramiz
if (isIos() && !isInStandaloneMode()) {
  setTimeout(() => showInstallBanner('ios'), 2000);
}
