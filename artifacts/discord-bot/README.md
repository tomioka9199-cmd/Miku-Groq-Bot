# Miku Nakano Discord Bot

Bot de Discord con personalidad de Miku Nakano (La quintilliza #3), impulsado por Groq + Llama 3.1.

## Variables de entorno necesarias

Crea un archivo `.env` (o configúralas en Railway):

```
DISCORD_TOKEN=tu_token_aqui
GROQ_API_KEY=tu_api_key_aqui
```

## Funcionalidades

- Responde a todos los mensajes del canal automáticamente
- Personalidad de Miku: reservada, tímida, apasionada de la historia Sengoku
- Memoria de los últimos 8 mensajes por canal
- Cooldown de 2 segundos por usuario para no saturar la API
- Ignora mensajes de otros bots (anti-bucle)
- Manejo de errores: si Groq falla, responde con mensaje amable

## Despliegue en Railway

1. Sube este proyecto a GitHub
2. En Railway: New Project → Deploy from GitHub Repo
3. Agrega las variables de entorno: `DISCORD_TOKEN` y `GROQ_API_KEY`
4. Railway detectará el script `"start": "node index.js"` automáticamente
5. ¡Listo! El bot estará en línea.

## Comandos locales

```bash
npm install
npm start
```
