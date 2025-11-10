FROM node:20-slim

# Install dependencies for Chromium
RUN apt-get update && apt-get install -y \
  chromium \
  chromium-sandbox \
  chromium-common \
  --no-install-recommends && \
  rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .

# create session directory
RUN mkdir -p /data && chmod -R 777 /data

CMD ["node", "bot.js"]
