// Telegram Bot API bilan oddiy aloqa (Node'ning o'rnatilgan fetch/FormData'idan foydalanadi).
const API_BASE = () => process.env.TELEGRAM_API_BASE || 'https://api.telegram.org';
const TOKEN = () => process.env.TELEGRAM_BOT_TOKEN || '';

function enabled() {
  return !!TOKEN();
}

async function call(method, params = {}) {
  const res = await fetch(`${API_BASE()}/bot${TOKEN()}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  let data;
  try { data = await res.json(); } catch (e) { data = null; }
  if (!data || !data.ok) {
    const msg = data && data.description ? data.description : `HTTP ${res.status}`;
    const err = new Error(`Telegram ${method}: ${msg}`);
    err.code = data && data.error_code;
    throw err;
  }
  return data.result;
}

async function sendDocument(chatId, buffer, filename, caption) {
  const form = new FormData();
  form.append('chat_id', String(chatId));
  if (caption) form.append('caption', caption);
  form.append('document', new Blob([buffer], { type: 'application/pdf' }), filename);
  const res = await fetch(`${API_BASE()}/bot${TOKEN()}/sendDocument`, { method: 'POST', body: form });
  let data;
  try { data = await res.json(); } catch (e) { data = null; }
  if (!data || !data.ok) {
    throw new Error(`Telegram sendDocument: ${data && data.description ? data.description : 'HTTP ' + res.status}`);
  }
  return data.result;
}

module.exports = { call, sendDocument, enabled };
