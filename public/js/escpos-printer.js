// USB termal printerga (masalan Xprinter XP-80C) brauzerdan TO'G'RIDAN-TO'G'RI,
// Windows chop etish navbatini (print spooler) chetlab o'tib yozish uchun.
//
// NEGA KERAK: ba'zi POS dasturlari (masalan Poster) o'rnatilganda printerning
// USB drayverini "WinUSB"ga almashtirib qo'yadi - bu Windows'ning oddiy printer
// navbatini (va demak brauzerning window.print() funksiyasini) butunlay
// ishlamay qoladigan qiladi, garchi printerning o'zi ishlab tursa ham.
// WebUSB texnologiyasi esa aynan shu WinUSB drayveriga ega qurilmalarga
// to'g'ridan-to'g'ri, xavfsiz tarzda murojaat qila oladi.
//
// TALABLAR: faqat Chrome yoki Edge brauzerida ishlaydi, sayt HTTPS orqali
// ochilgan bo'lishi kerak (localhost'da ham ishlaydi).

const ESC = 0x1B;
const GS = 0x1D;

// ---- CP866 (DOS Cyrillic) kodlashtirish jadvali ----
// Ko'pchilik ESC/POS termal printerlar kirill harflarini shu kodlashda qabul qiladi.
// Agar sizning printeringizda kirill harflari noto'g'ri (chalkash belgilar) chiqsa,
// pastdagi CODEPAGE_COMMAND qiymatini o'zgartirish kerak bo'lishi mumkin (fayl oxirida izoh bor).
function buildCp866Map() {
  const map = {};
  const upper = 'АБВГДЕЖЗИЙКЛМНОП'; // U+0410-U+041F -> 0x80-0x8F
  const upper2 = 'РСТУФХЦЧШЩЪЫЬЭЮЯ'; // U+0420-U+042F -> 0x90-0x9F
  const lower = 'абвгдежзийклмноп'; // U+0430-U+043F -> 0xA0-0xAF
  const lower2 = 'рстуфхцчшщъыьэюя'; // U+0440-U+044F -> 0xE0-0xEF

  [...upper].forEach((ch, i) => { map[ch] = 0x80 + i; });
  [...upper2].forEach((ch, i) => { map[ch] = 0x90 + i; });
  [...lower].forEach((ch, i) => { map[ch] = 0xA0 + i; });
  [...lower2].forEach((ch, i) => { map[ch] = 0xE0 + i; });
  map['Ё'] = 0xF0;
  map['ё'] = 0xF1;
  return map;
}
const CP866_MAP = buildCp866Map();

// Printerda CP866 kodlash jadvalini tanlash buyrug'i (Epson-mos ESC/POS uchun odatiy).
// Agar kirill harflari noto'g'ri chiqsa, shu raqamni 17, 18, 40, 45 kabi qiymatlarga
// almashtirib ko'ring (printer modeliga qarab farq qiladi).
const CODEPAGE_COMMAND = 17;

function encodeText(str) {
  const bytes = [];
  for (const ch of str) {
    const code = ch.codePointAt(0);
    if (code < 0x80) {
      bytes.push(code);
    } else if (CP866_MAP[ch] !== undefined) {
      bytes.push(CP866_MAP[ch]);
    } else {
      bytes.push(0x3F); // '?' - noma'lum belgi
    }
  }
  return bytes;
}

class EscPosBuilder {
  constructor() {
    this.bytes = [];
    this.bytes.push(ESC, 0x40); // Initialize
    this.bytes.push(ESC, 0x74, CODEPAGE_COMMAND); // Select CP866 codepage
  }
  raw(...b) { this.bytes.push(...b); return this; }
  text(str) { this.bytes.push(...encodeText(str)); return this; }
  line(str = '') { this.text(str); this.bytes.push(0x0A); return this; }
  center() { return this.raw(ESC, 0x61, 0x01); }
  left() { return this.raw(ESC, 0x61, 0x00); }
  bold(on) { return this.raw(ESC, 0x45, on ? 1 : 0); }
  doubleSize(on) { return this.raw(GS, 0x21, on ? 0x11 : 0x00); }
  hr(width = 42, ch = '-') { return this.line(ch.repeat(width)); }
  // Ikki ustunli qator: chapga nom, o'ngga summa (fixed-width monospace shrift asosida)
  row(label, value, width = 42) {
    const l = String(label);
    const v = String(value);
    const spaces = Math.max(1, width - l.length - v.length);
    return this.line(l + ' '.repeat(spaces) + v);
  }
  feed(n = 3) { for (let i = 0; i < n; i++) this.bytes.push(0x0A); return this; }
  cut() { return this.raw(GS, 0x56, 0x00); } // To'liq kesish (agar printer qo'llasa)
  build() { return new Uint8Array(this.bytes); }
}

let cachedDevice = null;
let cachedEndpoint = null;
let cachedInterface = null;

function isWebUSBSupported() {
  return !!(navigator.usb);
}

/**
 * Qurilmadan mos "bulk OUT" endpoint'ni va interfeys raqamini topadi.
 */
function findBulkOutEndpoint(device) {
  for (const config of device.configurations) {
    for (const iface of config.interfaces) {
      for (const alt of iface.alternates) {
        for (const ep of alt.endpoints) {
          if (ep.direction === 'out' && ep.type === 'bulk') {
            return { interfaceNumber: iface.interfaceNumber, endpointNumber: ep.endpointNumber };
          }
        }
      }
    }
  }
  return null;
}

/**
 * Avval ilgari ruxsat berilgan qurilmalarni tekshiradi (so'ramasdan ulanadi).
 * Topilmasa, foydalanuvchidan brauzer orqali printerni tanlashni so'raydi.
 */
async function getOrConnectPrinter() {
  if (!isWebUSBSupported()) {
    throw new Error('Bu brauzer WebUSB\'ni qo\'llab-quvvatlamaydi. Chrome yoki Edge ishlating.');
  }

  let device = cachedDevice;

  if (!device) {
    const existing = await navigator.usb.getDevices();
    device = existing[0] || null;
  }

  if (!device) {
    device = await navigator.usb.requestDevice({ filters: [] });
  }

  await device.open();
  if (device.configuration === null) {
    await device.selectConfiguration(1);
  }

  const found = findBulkOutEndpoint(device);
  if (!found) {
    throw new Error('Printerda mos USB endpoint topilmadi.');
  }

  try {
    await device.claimInterface(found.interfaceNumber);
  } catch (e) {
    // Ba'zida interfeys allaqachon ushlangan bo'lishi mumkin - shunchaki davom etamiz
  }

  cachedDevice = device;
  cachedEndpoint = found.endpointNumber;
  cachedInterface = found.interfaceNumber;

  return device;
}

/**
 * Foydalanuvchidan birinchi marta printerni tanlashni so'raydi (ruxsat berish uchun).
 * Bu funksiyani albatta tugma bosilganda (click handler ichida) chaqiring -
 * brauzer xavfsizlik siyosati shuni talab qiladi.
 */
async function pairPrinter() {
  const device = await navigator.usb.requestDevice({ filters: [] });
  cachedDevice = null; // getOrConnectPrinter qayta ochsin
  return device;
}

/**
 * Tayyor ESC/POS bayt massivini printerga yuboradi.
 */
async function sendToPrinter(bytes) {
  const device = await getOrConnectPrinter();
  await device.transferOut(cachedEndpoint, bytes);
}
