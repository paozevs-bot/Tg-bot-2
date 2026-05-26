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

const bot = new Telegraf(BOT_TOKEN);

// 💰 тарифы
const tariffs = {
  "30": { rub: 399, usdt: 5, stars: 399 },
  "90": { rub: 899, usdt: 12, stars: 899 },
  "360": { rub: 1499, usdt: 20, stars: 1499 }
};

// =======================
// START (НЕ ТРОГАЕМ ТЕКСТ)
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
// WEBHOOK PLATEGA
// =======================
app.post("/platega-webhook", async (req, res) => {
  res.sendStatus(200); // ОТВЕЧАЕМ СРАЗУ

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
    console.log(e.message);
    res.status(500).json({ error: "payment_failed" });
  }
});

// =======================
// HOME CHECK
// =======================
app.get("/", (req, res) => {
  res.send("bot is running");
});

// =======================
// SERVER START
// =======================
app.listen(3000, () => console.log("server running"));

bot.launch();
