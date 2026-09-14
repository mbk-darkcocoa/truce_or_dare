FROM node:22-alpine

WORKDIR /app

COPY package.json ./
COPY server.js ./
COPY lib ./lib
COPY public ./public
COPY data ./data
COPY terraform ./terraform
COPY deploy ./deploy

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "server.js"]
