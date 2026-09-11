FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY worker/logs ./worker/logs
USER node
CMD ["node", "worker/logs/run.mjs"]
