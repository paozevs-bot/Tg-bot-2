const express = require("express");
const axios = require("axios");
const { Telegraf } = require("telegraf");

const app = express();
app.use(express.json());

const path = require("path");
app.use("/media", express.static(path.join(__dirname, "media")));

// 🔐 ДАННЫЕ
const MERCHANT_ID = "5844ffa9-a371-4b88-ab20-eb5c055385d2";
const SECRET = "UUyQW5aZLO591x0tm4u4EUbUyCYWH1ZryO6Z1r7R58sf83ZirFBp7VRKbuW8LjXHbombbpjnIAgyzr6DIWTqhonP13Liw3iW7mvB";

const BOT_TOKEN = "8131097541:AAEHHKDmedkzxXzaJtT9_xIPGA19B0Y4wOc";
const CRYPTOBOT_TOKEN = "573763:AAKaGSoSAWqHF4gSCkpOkGWgkBPlIrAUW4Z";

const CHANNEL_ID = -1002358356232;

const bot = new Telegraf(BOT_TOKEN);

// 💰 тарифы
const tariffs = {
  "30": { rub: 399, usdt: 5, stars: 399 },
  "90": { rub: 899, usdt: 12, stars: 899 },
  "360": { rub: 1499, usdt: 20, stars: 1499 }
};

// 🧠 активные подписки
const activeSubs = new Map();

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
// START (ТВОЙ ТЕКСТ НЕ ТРОГАЮ)
// =======================
bot.start(async (ctx) => {
  await ctx.replyWithPhoto(
    "https://i.ibb.co/tpWJV9tr/Chat-GPT-Image-22-2026-12-57-27.png",
    {
      caption: `Just_relax_18+ - здесь ты найдешь уникальный контент, который поможет тебе расслабиться и насладиться приятными моментами. Подписка на наш канал — это доступ к эксклюзивным материалам, фото и видео 💦                 
    
    
    ПОДДЕРЖКА - @ADreksler                
    
    
    Покупая подписку вы подтверждайте что вам есть 18 лет❗️️`,
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
// CARD PAY (Platega)
// =======================
bot.action(/pay_card_(\d+)/, async (ctx) => {
  const days = ctx.match[1];

  const response = await axios.post("http://localhost:3000/pay", {
    days,
    userId: ctx.from.id
  });

  await ctx.editMessageCaption(
    `💳 Оплата ${days} дней`,
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: "ОПЛАТИТЬ", url: response.data.url }],
          [{ text: "⬅️ Назад", callback_data: `t_${days}` }]
        ]
      }
    }
  );
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
    activeSubs.set(userId, expire);

    await ctx.telegram.sendMessage(
      userId,
      `✅ Оплата прошла! Доступ на ${days} дней активирован`
    );
  } catch (e) {
    console.log(e.message);
  }
});

// =======================
// PLATEGA WEBHOOK (ВОТ ОН)
// =======================
app.post("/platega-webhook", async (req, res) => {
  res.sendStatus(200); // СНАЧАЛА ОТВЕТ

  try {
    const data = req.body;

    console.log("WEBHOOK:", data);

    if (!data || data.status !== "paid") return;

    const [prefix, userId, days] = data.payload.split("_");

    await bot.telegram.sendMessage(
      userId,
      `✅ Оплата прошла! Доступ на ${days} дней активирован`
    );

  } catch (e) {
    console.log("WEBHOOK ERROR:", e.message);
  }
});

// =======================
// PAY API (Platega)
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

    res.json({ url: response.data.url });
  } catch (e) {
    res.status(500).json({ error: "payment_failed" });
  }
});

// =======================
// SERVER
// =======================
app.get("/", (req, res) => {
  res.send("bot is running");
});

app.listen(3000, () => console.log("server running"));

bot.launch();
