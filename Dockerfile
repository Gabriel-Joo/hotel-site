FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY . .
COPY db.json ./db.json.seed
ENV PORT=3000
EXPOSE 3000
CMD ["node", "server.cjs"]
