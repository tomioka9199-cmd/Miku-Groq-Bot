require("dotenv").config();

const { Client, GatewayIntentBits } = require("discord.js");
const OpenAI = require("openai");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
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

client.once("ready", () => {
  console.log(`Bot conectado como ${client.user.tag}`);
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  const userId = message.author.id;
  const channelId = message.channel.id;
  const now = Date.now();

  const lastTime = cooldowns.get(userId) || 0;
  if (now - lastTime < COOLDOWN_MS) return;
  cooldowns.set(userId, now);

  if (!channelHistory.has(channelId)) {
    channelHistory.set(channelId, []);
  }

  const history = channelHistory.get(channelId);

  history.push({
    role: "user",
    content: `${message.author.username}: ${message.content}`,
  });

  if (history.length > MAX_HISTORY) {
    history.splice(0, history.length - MAX_HISTORY);
  }

  try {
    const response = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...history,
      ],
      max_tokens: 300,
      temperature: 0.85,
    });

    const reply = response.choices[0]?.message?.content;
    if (!reply) return;

    history.push({ role: "assistant", content: reply });

    if (history.length > MAX_HISTORY) {
      history.splice(0, history.length - MAX_HISTORY);
    }

    await message.channel.send(reply);
  } catch (error) {
    console.error("Error al llamar a Groq:", error?.message || error);
    await message.channel.send(
      "Miku está un poco cansada ahora mismo... (Error de conexión, inténtalo en un minuto 🎧)"
    );
  }
});

client.login(process.env.DISCORD_TOKEN);
