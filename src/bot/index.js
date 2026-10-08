// Botni ishga tushirish: webhook marshruti va Telegram'da webhook'ni ro'yxatdan o'tkazish.
const crypto = require('crypto');
const express = require('express');
const tg = require('./telegramApi');
const { handleUpdate } = require('./botService');

function secretToken() {
  // Tokendan olingan barqaror maxfiy kalit (Telegram har so'rovda shuni qaytaradi)
  return crypto.createHash('sha256').update('mondo-bot:' + (process.env.TELEGRAM_BOT_TOKEN || '')).digest('hex').slice(0, 48);
}

function webhookRouter() {
  const router = express.Router();
  router.post('/webhook', (req, res) => {
    if (!tg.enabled()) return res.sendStatus(404);
    if (req.get('x-telegram-bot-api-secret-token') !== secretToken()) return res.sendStatus(403);
    res.sendStatus(200); // Telegram'ga darhol javob; ishlov fonda
    handleUpdate(req.body || {}).catch((e) => console.error('[bot] xato:', e.message));
  });
  return router;
}

async function initBot() {
  if (!tg.enabled()) {
    console.log('[bot] TELEGRAM_BOT_TOKEN yo\'q - Telegram bot o\'chirilgan.');
    return;
  }
  const base = (process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || '').replace(/\/$/, '');
  if (!base) {
    console.log('[bot] PUBLIC_URL/RENDER_EXTERNAL_URL yo\'q - webhook o\'rnatilmadi (faqat lokal sinov).');
    return;
  }
  try {
    await tg.call('setWebhook', {
      url: `${base}/api/telegram/webhook`,
      secret_token: secretToken(),
      allowed_updates: ['message', 'callback_query'],
      drop_pending_updates: false,
    });
    await tg.call('setMyCommands', {
      commands: [
        { command: 'start', description: 'Boshlash / Начать' },
        { command: 'menu', description: 'Menyu / Меню' },
        { command: 'lang', description: 'Til / Язык' },
      ],
    });
    console.log('[bot] Telegram webhook o\'rnatildi:', `${base}/api/telegram/webhook`);
  } catch (e) {
    console.error('[bot] Webhook o\'rnatishda xato:', e.message);
  }
}

module.exports = { webhookRouter, initBot };
