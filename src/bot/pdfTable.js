// Umumiy PDF jadval chizuvchi (barcha hisobotlar bir xil uslubda chiqishi uchun).
// Qoidalar: raqamlar o'ngda, matn (Filial, Holat/Izoh) chapda, sarlavha va JAMI qatorlari o'rtada.
const path = require('path');
const PDFDocument = require('pdfkit');

const FONT_REGULAR = path.join(__dirname, 'fonts', 'DejaVuSans.ttf');
const FONT_BOLD = path.join(__dirname, 'fonts', 'DejaVuSans-Bold.ttf');

const COLOR = {
  brand: '#5a2a73',
  headText: '#ffffff',
  border: '#8a8a8a',
  text: '#1a1a1a',
  dim: '#666666',
  totalBg: '#ebe8f0',
  green: '#e3f4e6',
  red: '#fde0e0',
  redText: '#b3261e',
  yellow: '#fff2cc',
  grey: '#f0f0f0',
  greyText: '#555555',
};

function fmtNum(n) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return '—';
  const v = Math.round(Number(n));
  const sign = v < 0 ? '-' : '';
  return sign + String(Math.abs(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/**
 * @param {object} o
 *  title, subtitle, brand, footerNote, generatedAt
 *  columns: [{ title, width (nisbiy), align: 'left'|'right'|'center' }]
 *  rows: [{ cells: [...matn], fills: [rang|null,...], colors: [...], bold: [...] | boolean }]
 *  totalRow: { cells: [...] } (ixtiyoriy)
 *  landscape: boolean, minFont, maxFont
 * @returns {Promise<Buffer>}
 */
function renderTablePdf(o) {
  return new Promise((resolve, reject) => {
    const landscape = !!o.landscape;
    const doc = new PDFDocument({
      size: o.pageWidth ? [o.pageWidth, 595.28] : 'A4',
      layout: o.pageWidth ? undefined : (landscape ? 'landscape' : 'portrait'),
      margin: 36,
      bufferPages: true,
      info: { Title: o.title, Author: 'Mondo Bot' },
    });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    let pageCount = 1;
    doc.on('end', () => { const b = Buffer.concat(chunks); b.pages = pageCount; resolve(b); });
    doc.on('error', reject);

    doc.registerFont('R', FONT_REGULAR);
    doc.registerFont('B', FONT_BOLD);

    const left = doc.page.margins.left;
    const pageW = doc.page.width - left - doc.page.margins.right;
    const pageH = doc.page.height;
    const bottomLimit = pageH - doc.page.margins.bottom - 28;

    // Ustun kengliklari
    const sumW = o.columns.reduce((s, c) => s + c.width, 0);
    const colW = o.columns.map((c) => (c.width / sumW) * pageW);
    const colX = [];
    colW.reduce((x, w, i) => { colX[i] = x; return x + w; }, left);

    // Shrift o'lchami
    const fontSize = Math.max(o.minFont || 7, Math.min(o.maxFont || 10, o.fontSize || 10));
    const padX = 5;
    const padY = fontSize >= 9 ? 5 : (fontSize >= 8 ? 3.5 : 2.6);

    function drawHeader(y) {
      let h = 0;
      doc.font('B').fontSize(fontSize);
      o.columns.forEach((c, i) => {
        h = Math.max(h, doc.heightOfString(c.title, { width: colW[i] - padX * 2, align: 'center' }));
      });
      h += padY * 2;
      o.columns.forEach((c, i) => {
        doc.rect(colX[i], y, colW[i], h).fillAndStroke(COLOR.brand, COLOR.border);
        doc.fillColor(COLOR.headText).font('B').fontSize(fontSize)
          .text(c.title, colX[i] + padX, y + padY, { width: colW[i] - padX * 2, align: 'center' });
      });
      return y + h;
    }

    function rowHeight(cells, bold) {
      let h = 0;
      cells.forEach((t, i) => {
        doc.font(bold ? 'B' : 'R').fontSize(fontSize);
        h = Math.max(h, doc.heightOfString(String(t ?? ''), { width: colW[i] - padX * 2, align: o.columns[i].align }));
      });
      return h + padY * 2;
    }

    function drawRow(y, h, cells, opt) {
      cells.forEach((t, i) => {
        const fill = (opt.fills && opt.fills[i]) || opt.fill || '#ffffff';
        doc.rect(colX[i], y, colW[i], h).fillAndStroke(fill, COLOR.border);
        const isBold = Array.isArray(opt.bold) ? !!opt.bold[i] : !!opt.bold;
        const color = (opt.colors && opt.colors[i]) || COLOR.text;
        const align = opt.align ? opt.align : o.columns[i].align;
        doc.fillColor(color).font(isBold ? 'B' : 'R').fontSize(fontSize)
          .text(String(t ?? ''), colX[i] + padX, y + padY, { width: colW[i] - padX * 2, align });
      });
    }

    function drawTopBlock() {
      let y = doc.page.margins.top;
      doc.fillColor(COLOR.brand).font('B').fontSize(16).text(o.title, left, y, { width: pageW * 0.72 });
      doc.fillColor(COLOR.brand).font('B').fontSize(13)
        .text(o.brand || 'KPI Mondo', left, y + 2, { width: pageW, align: 'right' });
      y = doc.y + 3;
      doc.fillColor(COLOR.dim).font('R').fontSize(9).text(o.subtitle || '', left, y, { width: pageW });
      return doc.y + 10;
    }

    let y = drawTopBlock();
    y = drawHeader(y);

    for (const r of o.rows) {
      const h = rowHeight(r.cells, r.bold);
      if (y + h > bottomLimit) {
        doc.addPage();
        y = doc.page.margins.top;
        y = drawHeader(y);
      }
      drawRow(y, h, r.cells, r);
      y += h;
    }

    if (o.totalRow) {
      const h = rowHeight(o.totalRow.cells, true);
      if (y + h > bottomLimit) {
        doc.addPage();
        y = doc.page.margins.top;
        y = drawHeader(y);
      }
      drawRow(y, h, o.totalRow.cells, { bold: true, fill: COLOR.totalBg, align: 'center' });
      y += h;
    }

    // Izoh (legenda)
    if (o.footerNote) {
      doc.font('R').fontSize(8);
      const nh = doc.heightOfString(o.footerNote, { width: pageW });
      if (y + 8 + nh > bottomLimit + 20) {
        doc.addPage();
        y = doc.page.margins.top;
      }
      doc.fillColor(COLOR.dim).text(o.footerNote, left, y + 8, { width: pageW });
    }

    // Pastki chiziq: bot nomi va sahifa raqami
    const range = doc.bufferedPageRange();
    pageCount = range.count;
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      doc.page.margins.bottom = 0; // pastki chiziq matni yangi sahifa ochib yubormasligi uchun
      doc.font('R').fontSize(8).fillColor(COLOR.dim);
      const fy = pageH - 46;
      doc.text('Mondo Bot · KPI Mondo', left, fy, { width: pageW / 2, align: 'left', lineBreak: false });
      doc.text(`${i + 1} / ${range.count}`, left + pageW / 2, fy, { width: pageW / 2, align: 'right', lineBreak: false });
    }

    doc.end();
  });
}

// Hamma narsa BITTA listga sig'ishi kerak bo'lsa: shrift o'lchamini (minFont gacha) kichraytirib sinaydi.
async function renderTablePdfFit(o) {
  const max = o.fontSize || 10;
  const min = o.minFont || 7;
  let buf = null;
  for (let fs = max; fs >= min - 0.001; fs -= 0.5) {
    buf = await renderTablePdf({ ...o, fontSize: fs, minFont: Math.min(min, fs) });
    if (buf.pages <= 1) return buf;
  }
  return buf; // minimal shriftda ham sig'masa - ko'p sahifali variant
}

function fmtQty(n) {
  if (n === null || n === undefined || !Number.isFinite(Number(n))) return '—';
  const v = Math.round(Number(n) * 100) / 100;
  const [i, d] = String(Math.abs(v)).split('.');
  return (v < 0 ? '-' : '') + i.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + (d ? '.' + d : '');
}

module.exports = { renderTablePdf, renderTablePdfFit, fmtNum, fmtQty, COLOR };
