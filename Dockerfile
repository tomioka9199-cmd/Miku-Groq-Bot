FROM node:20-alpine
WORKDIR /app
COPY artifacts/discord-bot/package*.json ./
RUN npm install
COPY artifacts/discord-bot/ .
CMD ["node", "index.js"]
