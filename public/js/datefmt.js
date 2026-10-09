// Sana ko'rinishi hamma joyda KUN.OY.YIL (08.10.2026).
// 1) Sana maydonlari (<input type="date">) o'zimizning matn maydoni + kalendar tugmasiga almashtiriladi.
//    Ichkarida qiymat oldingidek YYYY-MM-DD (kod va baza o'zgarmaydi).
// 2) Sahifadagi matnlardagi "2026-10-08" ko'rinishidagi sanalar "08.10.2026" qilib ko'rsatiladi.
(function () {
  'use strict';

  function fmtDMY(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    return m ? `${m[3]}.${m[2]}.${m[1]}` : (iso || '');
  }
  function parseDMY(text) {
    const m = /^(\d{1,2})[.\-/ ](\d{1,2})[.\-/ ](\d{4})$/.exec(String(text || '').trim());
    if (!m) return null;
    const d = Number(m[1]); const mo = Number(m[2]); const y = Number(m[3]);
    const dt = new Date(Date.UTC(y, mo - 1, d));
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
    return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }
  window.fmtDMY = fmtDMY;
  window.parseDMY = parseDMY;

  // ---------- 1) Sana maydoni ----------
  const valueDesc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');

  function enhance(input) {
    if (input.dataset.dp) return;
    input.dataset.dp = '1';

    const wrap = document.createElement('span');
    wrap.className = 'dp-wrap';
    const text = document.createElement('input');
    text.type = 'text';
    text.className = 'dp-text';
    text.inputMode = 'numeric';
    text.autocomplete = 'off';
    text.placeholder = 'KK.OO.YYYY';
    text.maxLength = 10;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'dp-btn';
    btn.tabIndex = -1;
    btn.setAttribute('aria-label', 'Kalendar');
    btn.textContent = '📅';

    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(text);
    wrap.appendChild(btn);
    wrap.appendChild(input);
    input.classList.add('dp-native');
    input.tabIndex = -1;
    if (input.id) {
      text.id = input.id + '__dp';
      document.querySelectorAll('label[for="' + input.id + '"]').forEach((l) => l.setAttribute('for', text.id));
    }

    const nativeGet = () => valueDesc.get.call(input);
    const nativeSet = (v) => valueDesc.set.call(input, v);
    function showFromNative() {
      text.value = fmtDMY(nativeGet());
      text.classList.remove('dp-bad');
    }
    // Kod input.value = '...' deb yozganda ham matn maydoni yangilansin
    Object.defineProperty(input, 'value', {
      configurable: true,
      get() { return nativeGet(); },
      set(v) { nativeSet(v); showFromNative(); },
    });
    showFromNative();

    function commit() {
      const iso = parseDMY(text.value);
      if (!iso) {
        if (text.value.trim() === '') {
          if (nativeGet() !== '') { nativeSet(''); input.dispatchEvent(new Event('change', { bubbles: true })); }
          text.classList.remove('dp-bad');
        } else {
          text.classList.add('dp-bad');
        }
        return;
      }
      text.classList.remove('dp-bad');
      text.value = fmtDMY(iso);
      if (nativeGet() !== iso) {
        nativeSet(iso);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }

    text.addEventListener('input', () => {
      // faqat raqam yozilsa nuqtalar o'zi qo'yiladi: 08102026 -> 08.10.2026
      const raw = text.value.replace(/\D/g, '').slice(0, 8);
      if (/^[\d.]*$/.test(text.value) || /^\d+$/.test(raw)) {
        let out = raw;
        if (raw.length > 4) out = raw.slice(0, 2) + '.' + raw.slice(2, 4) + '.' + raw.slice(4);
        else if (raw.length > 2) out = raw.slice(0, 2) + '.' + raw.slice(2);
        text.value = out;
      }
      if (text.value.length === 10) commit();
      else text.classList.remove('dp-bad');
    });
    text.addEventListener('blur', () => {
      if (text.value === '' || parseDMY(text.value)) commit(); else { text.classList.add('dp-bad'); }
    });
    text.addEventListener('keydown', (e) => { if (e.key === 'Enter') commit(); });
    input.addEventListener('change', showFromNative); // kalendardan tanlansa
    btn.addEventListener('click', () => {
      if (input.disabled) return;
      try { input.showPicker(); } catch (e) { input.focus(); input.click(); }
    });

    // disabled holati
    const sync = () => { text.disabled = input.disabled; btn.disabled = input.disabled; };
    new MutationObserver(sync).observe(input, { attributes: true, attributeFilter: ['disabled'] });
    sync();
  }

  function enhanceAll(root) {
    (root.querySelectorAll ? root.querySelectorAll('input[type="date"]') : []).forEach(enhance);
  }

  // ---------- 2) Matndagi sanalar ----------
  const ISO_RE = /(?<![\d-])(\d{4})-(\d{2})-(\d{2})(?![\d-])/g;
  const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'OPTION', 'CODE']);
  function convertNode(n) {
    if (n.nodeType === 3) {
      const p = n.parentNode;
      if (!p || SKIP.has(p.nodeName)) return;
      const v = n.nodeValue;
      if (v && v.indexOf('-') !== -1 && ISO_RE.test(v)) {
        ISO_RE.lastIndex = 0;
        const nv = v.replace(ISO_RE, (m, y, mo, d) => {
          const mm = Number(mo); const dd = Number(d);
          return (mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31) ? `${d}.${mo}.${y}` : m;
        });
        if (nv !== v) n.nodeValue = nv;
      }
      ISO_RE.lastIndex = 0;
    } else if (n.nodeType === 1 && !SKIP.has(n.nodeName)) {
      for (let c = n.firstChild; c; c = c.nextSibling) convertNode(c);
    }
  }

  let busy = false;
  function run(root) {
    if (busy || !root || !root.isConnected) return;
    busy = true;
    try { enhanceAll(root); convertNode(root); } finally { busy = false; }
  }

  function start() {
    run(document.body);
    new MutationObserver((muts) => {
      if (busy) return;
      for (const m of muts) {
        if (m.type === 'characterData') run(m.target.parentNode || document.body);
        else m.addedNodes.forEach((n) => { if (n.nodeType === 1 || n.nodeType === 3) run(n.nodeType === 3 ? n.parentNode : n); });
      }
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
  }
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
})();
