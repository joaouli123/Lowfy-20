FROM node:20-alpine
WORKDIR /app
# Chromium para o coletor do Hack Ads (Biblioteca de Anúncios da Meta via playwright-core).
RUN apk add --no-cache chromium nss freetype harfbuzz ca-certificates ttf-freefont
ENV META_CHROME_PATH=/usr/bin/chromium-browser
COPY package*.json ./
RUN npm ci --legacy-peer-deps
COPY . .
RUN npm run build
EXPOSE 5000
ENV PORT=5000
CMD ["npx", "tsx", "server/index.ts"]
