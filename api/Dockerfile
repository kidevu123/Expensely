FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --silent
COPY . .
EXPOSE 4000
CMD ["node","server.js"]

