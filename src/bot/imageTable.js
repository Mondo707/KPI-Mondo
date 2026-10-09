// Jadvalni rasm (PNG) qilib chizadi. pdfTable.js bilan bir xil ma'lumot (spec) va bir xil ko'rinish.
// Uzun jadval bir necha rasmga bo'linadi (sarlavha har birida takrorlanadi).
const path = require('path');
const { createCanvas, GlobalFonts } = require('@napi-rs/canvas');
const { COLOR } = require('./pdfTable');

GlobalFonts.registerFromPath(path.join(__dirname, 'fonts', 'DejaVuSans.ttf'), 'MondoR');
GlobalFonts.registerFromPath(path.join(__dirname, 'fonts', 'DejaVuSans-Bold.ttf'), 'MondoB');

const SCALE = 2.2;          // 1 pt = 2.2 piksel (aniq, telefonda o'qiladi)
const MAX_PAGE_H = 2400;    // bitta rasmning maksimal balandligi (piksel)

function wrap(ctx, text, maxW) {
  const out = [];
  for (const para of String(text ?? '').split('\n')) {
    const words = para.split(' ');
    let line = '';
    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      if (ctx.measureText(test).width <= maxW || !line) {
        line = test;
        // juda uzun bitta so'z: harflab bo'lamiz
        while (ctx.measureText(line).width > maxW && line.length > 1) {
          let i = line.length - 1;
          while (i > 1 && ctx.measureText(line.slice(0, i)).width > maxW) i--;
          out.push(line.slice(0, i));
          line = line.slice(i);
        }
      } else {
        out.push(line);
        line = w;
      }
    }
    out.push(line);
  }
  return out;
}

/** @returns {Buffer[]} PNG rasmlar */
function renderTableImages(o) {
  const S = SCALE;
  const margin = 36 * S;
  const basePage = o.pageWidth || (o.landscape ? 841.89 : 595.28);
  const W = Math.round(basePage * S);
  const pageW = W - margin * 2;
  const fs = Math.max(o.minFont || 7, Math.min(o.maxFont || 10, o.fontSize || 10)) * S;
  const padX = 5 * S;
  const padY = (fs / S >= 9 ? 5 : (fs / S >= 8 ? 3.5 : 2.6)) * S;
  const lineH = fs * 1.18;

  const sumW = o.columns.reduce((a, c) => a + c.width, 0);
  const colW = o.columns.map((c) => (c.width / sumW) * pageW);
  const colX = [];
  colW.reduce((x, w, i) => { colX[i] = x; return x + w; }, margin);

  const measure = createCanvas(10, 10).getContext('2d');
  const fontStr = (bold, size) => `${size}px ${bold ? 'MondoB' : 'MondoR'}`;

  function layout(cells, bold) {
    measure.font = fontStr(bold, fs);
    const lines = cells.map((t, i) => wrap(measure, t, colW[i] - padX * 2));
    const h = Math.max(...lines.map((l) => l.length)) * lineH + padY * 2;
    return { lines, h };
  }

  const headL = layout(o.columns.map((c) => c.title), true);
  const rowsL = o.rows.map((r) => ({ r, ...layout(r.cells, Array.isArray(r.bold) ? r.bold.some(Boolean) : !!r.bold) }));
  const totalL = o.totalRow ? { r: o.totalRow, ...layout(o.totalRow.cells, true) } : null;

  // Yuqori blok (sarlavha + subtitle) va pastki izoh
  measure.font = fontStr(true, 16 * S);
  const titleLines = wrap(measure, o.title, pageW * 0.72);
  const topH = titleLines.length * 16 * S * 1.2 + 3 * S;
  measure.font = fontStr(false, 9 * S);
  const subLines = wrap(measure, o.subtitle || '', pageW);
  const subH = subLines.length * 9 * S * 1.2;
  const headBlockH = margin + topH + subH + 10 * S;
  measure.font = fontStr(false, 8 * S);
  const noteLines = o.footerNote ? wrap(measure, o.footerNote, pageW) : [];
  const noteH = noteLines.length ? noteLines.length * 8 * S * 1.2 + 10 * S : 0;
  const footerH = 30 * S;

  // Sahifalarga bo'lish
  const all = rowsL.concat(totalL ? [totalL] : []);
  const pages = [];
  let cur = []; let used = headBlockH + headL.h;
  for (const row of all) {
    if (cur.length && used + row.h + footerH > MAX_PAGE_H) {
      pages.push(cur); cur = []; used = margin + headL.h;
    }
    cur.push(row); used += row.h;
  }
  pages.push(cur);

  return pages.map((rows, pi) => {
    const last = pi === pages.length - 1;
    const firstBlock = pi === 0 ? headBlockH : margin;
    const H = Math.ceil(firstBlock + headL.h + rows.reduce((a, r) => a + r.h, 0) + (last ? noteH : 0) + footerH);
    const cv = createCanvas(W, H);
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);
    ctx.textBaseline = 'top';

    let y = margin;
    if (pi === 0) {
      ctx.fillStyle = COLOR.brand; ctx.font = fontStr(true, 16 * S);
      ctx.textAlign = 'left';
      titleLines.forEach((l, i) => ctx.fillText(l, margin, y + i * 16 * S * 1.2));
      ctx.font = fontStr(true, 13 * S); ctx.textAlign = 'right';
      ctx.fillText(o.brand || 'KPI Mondo', margin + pageW, y + 2 * S);
      y += topH;
      ctx.fillStyle = COLOR.dim; ctx.font = fontStr(false, 9 * S); ctx.textAlign = 'left';
      subLines.forEach((l, i) => ctx.fillText(l, margin, y + i * 9 * S * 1.2));
      y += subH + 10 * S;
    }

    function drawCells(yy, h, lines, opt, isHead) {
      lines.forEach((ls, i) => {
        const fill = isHead ? COLOR.brand : ((opt.fills && opt.fills[i]) || opt.fill || '#ffffff');
        ctx.fillStyle = fill; ctx.fillRect(colX[i], yy, colW[i], h);
        ctx.strokeStyle = COLOR.border; ctx.lineWidth = 1;
        ctx.strokeRect(colX[i] + 0.5, yy + 0.5, colW[i] - 1, h - 1);
        const bold = isHead || (Array.isArray(opt.bold) ? !!opt.bold[i] : !!opt.bold);
        ctx.font = fontStr(bold, fs);
        ctx.fillStyle = isHead ? COLOR.headText : ((opt.colors && opt.colors[i]) || COLOR.text);
        const align = isHead ? 'center' : (opt.align || o.columns[i].align);
        ctx.textAlign = align;
        const tx = align === 'left' ? colX[i] + padX : align === 'right' ? colX[i] + colW[i] - padX : colX[i] + colW[i] / 2;
        ls.forEach((l, k) => ctx.fillText(l, tx, yy + padY + k * lineH));
      });
    }

    drawCells(y, headL.h, headL.lines, {}, true);
    y += headL.h;
    for (const row of rows) {
      const isTotal = row === totalL;
      drawCells(y, row.h, row.lines, isTotal ? { bold: true, fill: COLOR.totalBg, align: 'center' } : row.r, false);
      y += row.h;
    }
    if (last && noteLines.length) {
      ctx.fillStyle = COLOR.dim; ctx.font = fontStr(false, 8 * S); ctx.textAlign = 'left';
      noteLines.forEach((l, i) => ctx.fillText(l, margin, y + 8 * S + i * 8 * S * 1.2));
    }
    ctx.fillStyle = COLOR.dim; ctx.font = fontStr(false, 8 * S);
    ctx.textAlign = 'left'; ctx.fillText('Mondo Bot · KPI Mondo', margin, H - 20 * S);
    ctx.textAlign = 'right'; ctx.fillText(`${pi + 1} / ${pages.length}`, margin + pageW, H - 20 * S);
    return cv.toBuffer('image/png');
  });
}

module.exports = { renderTableImages };
