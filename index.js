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
  "30": 399,
  "90": 899,
  "360": 1499
};

// =======================
// START
// =======================
bot.start(async (ctx) => {
  return ctx.reply("Выбери тариф", {
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
// ТАРИФ
// =======================
bot.action(/t_(\d+)/, async (ctx) => {
  const days = ctx.match[1];

  return ctx.editMessageText(`Тариф ${days} дней`, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "💳 СБП", callback_data: `pay_${days}` }],
        [{ text: "⬅️ Назад", callback_data: "back" }]
      ]
    }
  });
});

// =======================
// BACK
// =======================
bot.action("back", async (ctx) => {
  return ctx.editMessageText("Выбери тариф", {
    reply_markup: {
      inline_keyboard: [
        [{ text: "30", callback_data: "t_30" }],
        [{ text: "90", callback_data: "t_90" }],
        [{ text: "360", callback_data: "t_360" }]
      ]
    }
  });
});

// =======================
// СБП
// =======================
bot.action(/pay_(\d+)/, async (ctx) => {
  try {
    const days = ctx.match[1];

    console.log("PAY START", days);

    const response = await axios.post(
      "https://app.platega.io/transaction/process",
      {
        paymentMethod: 2,
        paymentDetails: {
          amount: tariffs[days],
          currency: "RUB"
        },
        description: `tariff ${days}`,
        payload: `tg_${ctx.from.id}_${days}`
      },
      {
        headers: {
          "X-MerchantId": MERCHANT_ID,
          "X-Secret": SECRET,
          "Content-Type": "application/json"
        }
      }
    );

    console.log("PLATEGA RAW:", response.data);

    // 🔥 ЖЁСТКО БЕРЁМ ЛЮБОЙ ВАРИАНТ
    const url =
      response.data?.url ||
      response.data?.data?.url ||
      response.data?.result?.url ||
      response.data?.payment_url ||
      response.data?.paymentUrl;

    if (!url) {
      console.log("NO URL:", response.data);
      return ctx.reply("Платёжка не вернула ссылку. Смотри логи.");
    }

    return ctx.reply(`💳 Ссылка на оплату:\n${url}`);

  } catch (e) {
    console.log("PAY ERROR:", e?.response?.data || e.message);
    return ctx.reply("Ошибка СБП. Платёжка не отвечает.");
  }
});

// =======================
// SERVER
// =======================
app.get("/", (req, res) => res.send("bot running"));

app.listen(3000, () => console.log("server running"));

bot.launch();
