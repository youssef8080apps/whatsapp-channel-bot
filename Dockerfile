FROM ghcr.io/puppeteer/puppeteer:latest

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .

# تأكد من وجود فولدر data
RUN mkdir -p /data
RUN chmod -R 777 /data

ENV DATA_DIR=/data
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome

EXPOSE 3000

CMD ["node", "bot.js"]
