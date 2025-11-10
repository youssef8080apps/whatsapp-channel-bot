FROM ghcr.io/puppeteer/puppeteer:latest

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .

# Create data directory inside /app
RUN mkdir -p /app/data
RUN chmod -R 777 /app/data

ENV DATA_DIR=/app/data
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome

EXPOSE 3000

CMD ["node", "bot.js"]
