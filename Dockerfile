FROM ghcr.io/puppeteer/puppeteer:latest

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .

RUN mkdir -p /app/data

ENV DATA_DIR=/app/data

EXPOSE 3000

CMD ["node", "bot.js"]
