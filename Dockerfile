FROM ghcr.io/puppeteer/puppeteer:latest

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .

# create session directory
RUN mkdir -p /app/session && chmod -R 777 /app/session

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV DATA_DIR=/app/session

CMD ["node", "bot.js"]
