const express = require("express");
const axios = require("axios");
const { Telegraf } = require("telegraf");

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const bot = new Telegraf("8131097541:AAEHHKDmedkzxXzaJtT9_xIPGA19B0Y4wOc");

// 🔐 Platega
const MERCHANT_ID = "5844ffa9-a371-4b88-ab20-eb5c055385d2";
const SECRET = "UUyQW5aZLO591x0tm4u4EUbUyCYWH1ZryO6Z1r7R58sf83ZirFBp7VRKbuW8LjXHbombbpjnIAgyzr6DIWTqhonP13Liw3iW7mvB";

// 💰 тарифы
const tariffs = {
  "30": { rub: 399, usdt: 5, stars: 399 },
  "90": { rub: 899, usdt: 12, stars: 899 },
  "360": { rub: 1499, usdt: 20, stars: 1499 }
};

// =======================
// START
// =======================
bot.start(async (ctx) => {
  await ctx.reply(
    "Выбери тариф",
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: "30 дней", callback_data: "t_30" }],
          [{ text: "90 дней", callback_data: "t_90" }],
          [{ text: "360 дней", callback_data: "t_360" }]
        ]
      }
    }
  );
});

// =======================
// ТАРИФ
// =======================
bot.action(/t_(\d+)/, async (ctx) => {
  const days = ctx.match[1];

  await ctx.editMessageText(
    `Тариф ${days} дней`,
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: "💳 СБП", callback_data: `pay_card_${days}` }],
          [{ text: "⬅️ Назад", callback_data: "back" }]
        ]
      }
    }
  );
});

// =======================
// BACK
// =======================
bot.action("back", async (ctx) => {
  return ctx.editMessageText("Выбери тариф", {
    reply_markup: {
      inline_keyboard: [
        [{ text: "30 дней", callback_data: "t_30" }],
        [{ text: "90 дней", callback_data: "t_90" }],
        [{ text: "360 дней", callback_data: "t_360" }]
      ]
    }
  });
});

// =======================
// СБП
// =======================
bot.action(/pay_card_(\d+)/, async (ctx) => {
  try {
    const days = ctx.match[1];

    console.log("PAY START:", days);

    const response = await axios.post(
      "https://app.platega.io/transaction/process",
      {
        paymentMethod: 2,
        paymentDetails: {
          amount: tariffs[days].rub,
          currency: "RUB"
        },
        description: `tariff ${days}`,
        payload: `tg_${ctx.from.id}_${days}`
      },
      {
        headers: {
          "X-MerchantId": MERCHANT_ID,
          "X-Secret": SECRET
        }
      }
    );

    console.log("PLATEGA RESPONSE:", response.data);

    // 🔥 ВАЖНО: вытаскиваем URL максимально надёжно
    const url =
      response.data?.url ||
      response.data?.data?.url ||
      response.data?.result?.url ||
      response.data?.paymentUrl ||
      response.data?.payment_url;

    if (!url) {
      console.log("NO URL FROM PLATEGA");
      return ctx.reply("Платёжка не вернула ссылку");
    }

    await ctx.editMessageText(
      `💳 Оплата ${days} дней готова`,
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
    console.log("PAY ERROR:", e?.response?.data || e.message);
    ctx.reply("Ошибка СБП (см. сервер)");
  }
});

// =======================
// SERVER PAY (если понадобится отдельно)
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
      response.data?.data?.url ||
      response.data?.result?.url ||
      response.data?.payment_url;

    return res.json({ url: url || null });

  } catch (e) {
    console.log("PAY API ERROR:", e?.response?.data || e.message);
    return res.status(500).json({ error: "payment_failed" });
  }
});

// =======================
app.get("/", (req, res) => res.send("bot running"));

app.listen(3000, () => console.log("server running"));

bot.launch();
