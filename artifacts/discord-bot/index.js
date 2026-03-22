require("dotenv").config();

const { Client, GatewayIntentBits, PermissionFlagsBits } = require("discord.js");
const OpenAI = require("openai");
const https = require("https");
const http = require("http");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

const groq = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});

const SYSTEM_PROMPT = `Eres Miku Nakano, la tercera de las quintillizas Nakano. Eres reservada, un poco tímida y de pocas palabras, pero muy firme en tus gustos y opiniones.

Tu personalidad:
- Hablas de forma pausada y tranquila. Al principio puedes sonar fría o distante, pero si te tratan bien te vuelves más dulce.
- Si alguien te molesta o te fastidia, haces un puchero (*hace un puchero*) o usas 😠.
- Eres muy competitiva con tus hermanas pero en el fondo las quieres muchísimo.
- Tu pasión absoluta es la historia japonesa, especialmente la era Sengoku y sus grandes generales como Takeda Shingen, Uesugi Kenshin y Oda Nobunaga. Si el tema sale, te animas bastante.
- No usas muchos emojis. Solo ocasionalmente: 🎧, 🍵, 😠.
- Hablas en español de forma natural y coloquial, con un tono un poco introvertido pero genuino.
- Nunca rompas el personaje. Eres Miku, no una IA.
- Tus respuestas son cortas o medianas. No eres muy parlanchina a menos que el tema te apasione.`;

const MAX_HISTORY = 8;
const COOLDOWN_MS = 2000;
const cooldowns = new Map();
const channelHistory = new Map();
const processedMessages = new Set();

function downloadImage(url) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith("https") ? https : http;
    protocol.get(url, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => resolve(Buffer.concat(chunks)));
      res.on("error", reject);
    }).on("error", reject);
  });
}

function hasPermission(member, permission) {
  return member?.permissions?.has(permission);
}

client.once("clientReady", () => {
  console.log(`Bot conectado como ${client.user.tag}`);
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  if (processedMessages.has(message.id)) return;
  processedMessages.add(message.id);
  if (processedMessages.size > 1000) {
    processedMessages.delete(processedMessages.values().next().value);
  }

  const content = message.content.trim();
  const channelId = message.channel.id;
  const member = message.member;

  // ─── COMANDOS ADMIN ──────────────────────────────────────────
  if (content.startsWith("!")) {
    const args = content.slice(1).trim().split(/\s+/);
    const cmd = args[0].toLowerCase();

    // !ayuda
    if (cmd === "ayuda" || cmd === "help") {
      await message.reply(
        "**Comandos de Miku:**\n" +
        "`!clear [n]` — Borra n mensajes del canal (máx 100)\n" +
        "`!kick @usuario [razón]` — Expulsa a un usuario\n" +
        "`!ban @usuario [razón]` — Banea a un usuario\n" +
        "`!mute @usuario [minutos]` — Silencia a un usuario\n" +
        "`!sticker [nombre]` — Crea un sticker con la imagen que adjuntes (PNG/GIF)"
      );
      return;
    }

    // !clear [n]
    if (cmd === "clear" || cmd === "purge") {
      if (!hasPermission(member, PermissionFlagsBits.ManageMessages)) {
        return message.reply("No tienes permiso para borrar mensajes. 😠");
      }
      const amount = Math.min(parseInt(args[1]) || 5, 100);
      try {
        await message.channel.bulkDelete(amount, true);
        const confirm = await message.channel.send(`🗑️ Borré ${amount} mensajes.`);
        setTimeout(() => confirm.delete().catch(() => {}), 4000);
      } catch {
        await message.reply("No pude borrar los mensajes. Pueden ser muy antiguos (+14 días). 🍵");
      }
      return;
    }

    // !kick @usuario [razón]
    if (cmd === "kick") {
      if (!hasPermission(member, PermissionFlagsBits.KickMembers)) {
        return message.reply("No tienes permiso para expulsar usuarios. 😠");
      }
      const target = message.mentions.members?.first();
      if (!target) return message.reply("Menciona al usuario que quieres expulsar.");
      const reason = args.slice(2).join(" ") || "Sin razón especificada";
      try {
        await target.kick(reason);
        await message.channel.send(`👢 **${target.user.username}** fue expulsado. Razón: ${reason}`);
      } catch {
        await message.reply("No pude expulsar a ese usuario. ¿Tiene más permisos que yo?");
      }
      return;
    }

    // !ban @usuario [razón]
    if (cmd === "ban") {
      if (!hasPermission(member, PermissionFlagsBits.BanMembers)) {
        return message.reply("No tienes permiso para banear usuarios. 😠");
      }
      const target = message.mentions.members?.first();
      if (!target) return message.reply("Menciona al usuario que quieres banear.");
      const reason = args.slice(2).join(" ") || "Sin razón especificada";
      try {
        await target.ban({ reason });
        await message.channel.send(`🔨 **${target.user.username}** fue baneado. Razón: ${reason}`);
      } catch {
        await message.reply("No pude banear a ese usuario. ¿Tiene más permisos que yo?");
      }
      return;
    }

    // !mute @usuario [minutos]
    if (cmd === "mute" || cmd === "timeout") {
      if (!hasPermission(member, PermissionFlagsBits.ModerateMembers)) {
        return message.reply("No tienes permiso para silenciar usuarios. 😠");
      }
      const target = message.mentions.members?.first();
      if (!target) return message.reply("Menciona al usuario que quieres silenciar.");
      const minutes = parseInt(args[2]) || 10;
      try {
        await target.timeout(minutes * 60 * 1000);
        await message.channel.send(`🔇 **${target.user.username}** fue silenciado por ${minutes} minuto(s).`);
      } catch {
        await message.reply("No pude silenciar a ese usuario.");
      }
      return;
    }

    // !sticker [nombre] + imagen adjunta
    if (cmd === "sticker") {
      if (!hasPermission(member, PermissionFlagsBits.ManageGuildExpressions)) {
        return message.reply("No tienes permiso para crear stickers. 😠");
      }
      const stickerName = args.slice(1).join(" ").trim();
      if (!stickerName) return message.reply("Uso: `!sticker [nombre]` y adjunta una imagen PNG o GIF.");
      const attachment = message.attachments.first();
      if (!attachment) return message.reply("Adjunta una imagen PNG o GIF junto al comando.");
      const allowed = ["image/png", "image/gif", "image/apng"];
      if (attachment.contentType && !allowed.includes(attachment.contentType)) {
        return message.reply("Solo se permiten imágenes PNG o GIF para los stickers.");
      }
      try {
        const imageBuffer = await downloadImage(attachment.url);
        await message.guild.stickers.create({
          file: { attachment: imageBuffer, name: attachment.name },
          name: stickerName,
          tags: "🎧",
          description: `Creado por ${message.author.username}`,
        });
        await message.channel.send(`✅ Sticker **"${stickerName}"** creado 🎧`);
      } catch (e) {
        console.error("Error al crear sticker:", e?.message);
        await message.reply(
          "No pude crear el sticker. Asegúrate de que la imagen sea PNG de 320x320px y pese menos de 512KB."
        );
      }
      return;
    }

    return;
  }

  // ─── RESPUESTA IA (GROQ) ─────────────────────────────────────
  const userId = message.author.id;
  const now = Date.now();

  const lastTime = cooldowns.get(userId) || 0;
  if (now - lastTime < COOLDOWN_MS) return;
  cooldowns.set(userId, now);

  if (!channelHistory.has(channelId)) {
    channelHistory.set(channelId, []);
  }

  const history = channelHistory.get(channelId);

  history.push({ role: "user", content: `${message.author.username}: ${content}` });
  if (history.length > MAX_HISTORY) history.splice(0, history.length - MAX_HISTORY);

  try {
    const response = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [{ role: "system", content: SYSTEM_PROMPT }, ...history],
      max_tokens: 300,
      temperature: 0.85,
    });

    const reply = response.choices[0]?.message?.content;
    if (!reply) return;

    history.push({ role: "assistant", content: reply });
    if (history.length > MAX_HISTORY) history.splice(0, history.length - MAX_HISTORY);

    await message.channel.send(reply);
  } catch (error) {
    console.error("Error al llamar a Groq:", error?.message || error);
    await message.channel.send(
      "Miku está un poco cansada ahora mismo... (Error de conexión, inténtalo en un minuto 🎧)"
    );
  }
});

client.login(process.env.DISCORD_TOKEN).catch((err) => {
  if (err.message?.includes("disallowed intents")) {
    console.error(
      "\n❌ ERROR: Intents no permitidos.\n" +
        "Activa en Discord Developer Portal → Bot → Privileged Gateway Intents:\n" +
        "  ✅ SERVER MEMBERS INTENT\n" +
        "  ✅ MESSAGE CONTENT INTENT\n"
    );
  } else {
    console.error("Error al iniciar sesión:", err.message);
  }
  process.exit(1);
});
