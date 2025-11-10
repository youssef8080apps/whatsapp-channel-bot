FROM ghcr.io/puppeteer/puppeteer:latest

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .

# Create data dir (no chmod!)
RUN mkdir -p /app/data

ENV DATA_DIR=/app/data
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome

EXPOSE 3000

CMD ["node", "bot.js"]
