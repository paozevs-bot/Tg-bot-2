const express = require("express");
const axios = require("axios");
const { Telegraf } = require("telegraf");
const mongoose = require("mongoose");
const path = require("path");

const app = express();

app.use(express.json());
app.use("/media", express.static(path.join(__dirname, "media")));

// MongoDB подключение
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((e) => console.log("Mongo error:", e.message));

const SubscriptionSchema = new mongoose.Schema({
  userId: String,
  expireAt: Number
});

const Subscription = mongoose.model("Subscription", SubscriptionSchema);

// 🔐 ДАННЫЕ
const MERCHANT_ID = "5844ffa9-a371-4b88-ab20-eb5c055385d2";
const SECRET = "UUyQW5aZLO591x0tm4u4EUbUyCYWH1ZryO6Z1r7R58sf83ZirFBp7VRKbuW8LjXHbombbpjnIAgyzr6DIWTqhonP13Liw3iW7mvB";

const BOT_TOKEN = "8131097541:AAEBbpryOtqfJ3vvJrY6EHDAkuNuS-Zq2jY";
const CRYPTOBOT_TOKEN = "573763:AAKaGSoSAWqHF4gSCkpOkGWgkBPlIrAUW4Z";

const CHANNEL_ID = -1002358356232;

const OWNER_ID = 371813064;
const ADMIN_IDS = [OWNER_ID];

const bot = new Telegraf(BOT_TOKEN);

bot.action(/renew_30_(\d+)/, async (ctx) => {
  const userId = ctx.match[1];
  const days = 30;

  const url = await createCryptoLink(days, userId);

  await ctx.reply(
    "💳 Оплати продление подписки:",
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: "Оплатить", url }]
        ]
      }
    }
  );
});

// 💰 тарифы
const tariffs = {
  "30": { rub: 399, usdt: 5, stars: 399 },
  "90": { rub: 899, usdt: 12, stars: 899 },
  "360": { rub: 1499, usdt: 20, stars: 1499 }
};

// 🧠 активные подписки
const activeSubs = new Map();

async function revokeExpiredSubs() {
  const now = Date.now();

  for (const [userId, expire] of activeSubs.entries()) {
    if (now > expire) {
      try {
        await bot.telegram.banChatMember(CHANNEL_ID, Number(userId));

        // сразу разбаним, чтобы можно было снова зайти по новой ссылке
        await bot.telegram.unbanChatMember(CHANNEL_ID, Number(userId));

        activeSubs.delete(userId);

       await bot.telegram.sendMessage(
  userId,
  "⛔️ Твоя подписка закончилась 😔.\n\nНо ты всегда можешь продлить доступ 💖🥰",
  {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "🔁 Продлить подписку на 30 дней", callback_data: `renew_30_${userId}` }
        ],
        [
          { text: "💎 Выбрать тариф", callback_data: "tariffs" }
        ]
      ]
    }
  }
);

        console.log(`Access revoked for ${userId}`);
      } catch (e) {
        console.log("REVOKE ERROR:", e.message);
      }
    }
  }
}

// =======================
// Crypto
// =======================
async function createCryptoLink(days, userId) {
  const response = await axios.post(
    "https://pay.crypt.bot/api/createInvoice",
    {
      asset: "USDT",
      amount: tariffs[days].usdt,
      description: `tariff ${days}`,
      payload: `crypto_${days}_${userId}`
    },
    {
      headers: {
        "Crypto-Pay-API-Token": CRYPTOBOT_TOKEN
      }
    }
  );

  return response.data.result.pay_url;
}

// =======================
// REVOKE 
// =======================

async function revokeExpiredSubs() {
  const now = Date.now();

  const expired = await Subscription.find({
    expireAt: { $lt: now }
  });

  for (const sub of expired) {

    const userId = Number(sub.userId);

    try {
      // ❌ удаляем из базы
      await Subscription.deleteOne({ userId });

      // 🔥 выкидываем из канала
      await bot.telegram.banChatMember(CHANNEL_ID, userId);

      // (опционально) сразу разрешаем зайти снова в будущем
      await bot.telegram.unbanChatMember(CHANNEL_ID, userId);

      await bot.telegram.sendMessage(
        userId,
        "⛔️ Подписка закончилась. Доступ к каналу закрыт."
      );

      console.log("revoked:", userId);

    } catch (e) {
      console.log("REVOKE ERROR:", e.message);
    }
  }
}

// =======================
// START (ТВОЙ ТЕКСТ НЕ ТРОГАЮ)
// =======================
bot.start(async (ctx) => {
  await ctx.replyWithPhoto(
    "https://i.ibb.co/tpWJV9tr/Chat-GPT-Image-22-2026-12-57-27.png",
    {
      caption: `Just_relax_18+ - здесь ты найдешь уникальный контент, который поможет тебе расслабиться и насладиться приятными моментами. Подписка на наш канал — это доступ к эксклюзивным материалам, фото и видео 💦

ПОДДЕРЖКА - @ADreksler

Покупая подписку вы подтверждаете что вам есть 18 лет❗️`,
      reply_markup: {
        inline_keyboard: [
          [{ text: "✨ 30 дней", callback_data: "t_30" }],
          [{ text: "💎 90 дней", callback_data: "t_90" }],
          [{ text: "👑 360 дней", callback_data: "t_360" }]
        ]
      }
    }
  );
});

// =======================
// ТАРИФЫ
// =======================
bot.action(/t_(\d+)/, async (ctx) => {
  const days = ctx.match[1];
  const price = tariffs[days];

  await ctx.editMessageCaption(
    `✨ Тариф: ${days} дней 💰 ${price.rub}₽`,
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: "💳 СБП", callback_data: `pay_card_${days}` }],
          [{ text: "₿ Crypto", callback_data: `pay_crypto_${days}` }],
          [{ text: "⭐ Stars", callback_data: `pay_stars_${days}` }],
          [{ text: "⬅️ Назад", callback_data: "back_main" }]
        ]
      }
    }
  );
});

// =======================
// BACK
// =======================
bot.action("back_main", async (ctx) => {
  return ctx.editMessageCaption(
    `Главное меню`,
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: "✨ 30 дней", callback_data: "t_30" }],
          [{ text: "💎 90 дней", callback_data: "t_90" }],
          [{ text: "👑 360 дней", callback_data: "t_360" }]
        ]
      }
    }
  );
});

// =======================
// СБП
// =======================
bot.action(/pay_card_(\d+)/, async (ctx) => {
  const days = ctx.match[1];

  try {
    const response = await axios.post("http://127.0.0.1:3000/pay", {
      days,
      userId: ctx.from.id
    });

    const url = response.data?.url;

    if (!url) return ctx.reply("❌ Ошибка: нет ссылки оплаты");

    await ctx.editMessageCaption(
      `💳 Оплата ${days} дней`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "ОПЛАТИТЬ", url }],
            [{ text: "⬅️ Назад", callback_data: `t_${days}` }]
          ]
        }
      }
    );

  } catch (e) {
    console.log(e.response?.data || e.message);
    ctx.reply("❌ Ошибка СБП оплаты");
  }
});

// =======================
// CRYPTO
// =======================
bot.action(/pay_crypto_(\d+)/, async (ctx) => {
  const days = ctx.match[1];

  const url = await createCryptoLink(days, ctx.from.id);

  await ctx.editMessageCaption(
    `₿ Crypto ${days} дней`,
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: "ОПЛАТИТЬ", url }],
          [{ text: "⬅️ Назад", callback_data: `t_${days}` }]
        ]
      }
    }
  );
});

// =======================
// STARS
// =======================
bot.action(/pay_stars_(\d+)/, async (ctx) => {
  const days = ctx.match[1];

  await ctx.replyWithInvoice({
    title: `${days} дней`,
    description: `Подписка`,
    payload: `stars_${days}_${ctx.from.id}`,
    currency: "XTR",
    prices: [
      { label: `${days}`, amount: tariffs[days].stars }
    ]
  });
});

// =======================
// SUCCESS PAYMENT
// =======================
bot.on("successful_payment", async (ctx) => {
  try {
    const payload = ctx.message.successful_payment.invoice_payload;
    const [_, days, userId] = payload.split("_");

    const expire = Date.now() + days * 24 * 60 * 60 * 1000;
    await Subscription.findOneAndUpdate(
  { userId },
  { userId, expireAt: expire },
  { upsert: true }
);

    await ctx.telegram.approveChatJoinRequest(CHANNEL_ID, Number(userId));

    await ctx.reply("✅ Доступ выдан автоматически");

  } catch (e) {
    console.log(e.message);
  }
});

// =======================
// PAY API
// =======================
app.post("/pay", async (req, res) => {
  try {
    const { days, userId } = req.body;

    const response = await axios.post(
      "https://app.platega.io/transaction/process",
      {
        paymentMethod: 2,
        paymentDetails: {
          amount: tariffs[days].rub,
          currency: "RUB"
        },
        description: `tariff ${days}`,
        payload: `tg_${userId}_${days}`
      },
      {
        headers: {
          "X-MerchantId": MERCHANT_ID,
          "X-Secret": SECRET
        }
      }
    );

    const url =
      response.data?.url ||
      response.data?.redirect ||
      response.data?.result?.url;

    if (!url) return res.status(500).json({ error: "no_url" });

    res.json({ url });

  } catch (e) {
    console.log(e.response?.data || e.message);
    res.status(500).json({ error: "payment_failed" });
  }
});

// =======================
// WEBHOOK
// =======================
app.post("/platega-webhook", async (req, res) => {
  try {
    const data = req.body;

    console.log("PLATEGA WEBHOOK:", data);

    const payload = data.payload;
    const status = data.status;

    if (status !== "CONFIRMED") {
      return res.sendStatus(200);
    }

    const [prefix, userId, days] = payload.split("_");

    const expire = Date.now() + Number(days) * 24 * 60 * 60 * 1000;

    // 💾 СОХРАНЯЕМ В MONGO (ЭТОГО У ТЕБЯ НЕ БЫЛО)
    await Subscription.findOneAndUpdate(
      { userId },
      { userId, expireAt: expire },
      { upsert: true, new: true }
    );

    const invite = await bot.telegram.createChatInviteLink(CHANNEL_ID, {
      member_limit: 1
    });

    await bot.telegram.sendMessage(
      userId,
      `✅ Оплата прошла !\n\n🎉 Доступ на ${days} дней активирован.\n\n👇 Ссылка:\n${invite.invite_link}`
    );

    return res.sendStatus(200);

  } catch (e) {
    console.log("WEBHOOK ERROR:", e);
    return res.sendStatus(500);
  }
});

// =======================
// CRYPTO WEBHOOK
// =======================

app.post("/crypto-webhook", async (req, res) => {
  try {
    const data = req.body;

    console.log("CRYPTO WEBHOOK:", data);

    const invoice = data.payload;

    if (invoice.status !== "paid") {
      return res.sendStatus(200);
    }

    const payload = invoice.payload;
    const [prefix, days, userId] = payload.split("_");

    const expire = Date.now() + days * 24 * 60 * 60 * 1000;
    await Subscription.findOneAndUpdate(
  { userId },
  { userId, expireAt: expire },
  { upsert: true }
);
    // ВАЖНО: создаём инвайт в канал
   const invite = await bot.telegram.createChatInviteLink(CHANNEL_ID, {
  member_limit: 1,
  expire_date: Math.floor(Date.now() / 1000) + days * 24 * 60 * 60
});

    await bot.telegram.sendMessage(
      userId,
      `✅ Оплата прошла!\n\n🎉 Доступ на ${days} дней активирован.\n\n👇 Войти в канал:\n${invite.invite_link}`
    );

    return res.sendStatus(200);

  } catch (e) {
    console.log("CRYPTO WEBHOOK ERROR:", e.message);
    return res.sendStatus(500);
  }
});

// =======================
// SERVER + WEBHOOK BOT (ВАЖНО)
// =======================
app.listen(3000, () => console.log("server running"));

setInterval(() => {
  revokeExpiredSubs();
}, 60 * 1000);

console.log("starting bot...");

const startBot = async () => {
  try {
    await bot.telegram.deleteWebhook({ drop_pending_updates: true });

const url = "https://tg-bot-2-eqgt.onrender.com";
await bot.telegram.setWebhook(`${url}/telegram-webhook`);

    app.use(bot.webhookCallback("/telegram-webhook"));

    console.log("bot launched (webhook mode)");
  } catch (e) {
    console.log("bot error:", e.message);
  }
};

if (require.main === module) {
  startBot();
}
